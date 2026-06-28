#!/usr/bin/env python3
"""
Generera ElevenLabs-röstklipp för Östersjön-sajten.

Läser site/content.json och skapar mp3:er per varelse/språk/nivå med varje
varelses voiceId. Sajten förblir statisk – ingen API-nyckel i webbläsaren.

Användning:
    export ELEVENLABS_API_KEY=sk_...
    python3 tools/generate_audio.py                       # default: svenska, Barn + Förskola (20 klipp)
    python3 tools/generate_audio.py --langs sv,en --levels academic,general,child,preschool
    python3 tools/generate_audio.py --force               # skriv över befintliga filer

Filnamn: assets/audio/<id>_<lang>_<level>.mp3
Skriver även assets/audio/manifest.json (lista över genererade klipp).
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
CONTENT = os.path.join(SITE, "content.json")
OUTDIR = os.path.join(SITE, "assets", "audio")
API = "https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128"

def tts(api_key, voice_id, text, model):
    body = json.dumps({
        "text": text,
        "model_id": model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True},
    }).encode("utf-8")
    req = urllib.request.Request(API.format(vid=voice_id), data=body, method="POST", headers={
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def write_manifest():
    keys = sorted(f[:-4] for f in os.listdir(OUTDIR) if f.endswith(".mp3"))
    with open(os.path.join(OUTDIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(keys, f, ensure_ascii=False, indent=0)
    return keys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default="sv")
    ap.add_argument("--levels", default="child,preschool")
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--delay", type=float, default=0.4)
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Sätt ELEVENLABS_API_KEY i miljön först:  export ELEVENLABS_API_KEY=sk_...")

    langs = [s.strip() for s in args.langs.split(",") if s.strip()]
    levels = [s.strip() for s in args.levels.split(",") if s.strip()]
    os.makedirs(OUTDIR, exist_ok=True)
    data = json.load(open(CONTENT, encoding="utf-8"))

    plan = []
    for cid in data["order"]:
        c = data["creatures"][cid]
        vid = c.get("voiceId", "")
        if not vid:
            print(f"  hoppar {cid}: saknar voiceId"); continue
        for lg in langs:
            for lv in levels:
                text = (((c.get("i18n", {}).get(lg, {}) or {}).get("levels", {}) or {}).get(lv) or "").strip()
                if text:
                    plan.append((cid, lg, lv, vid, text))

    print(f"Planerar {len(plan)} klipp ({', '.join(langs)} × {', '.join(levels)}). Modell: {args.model}")
    done = skipped = failed = 0
    for cid, lg, lv, vid, text in plan:
        name = f"{cid}_{lg}_{lv}.mp3"
        path = os.path.join(OUTDIR, name)
        if os.path.exists(path) and not args.force:
            skipped += 1; continue
        try:
            audio = tts(key, vid, text, args.model)
            with open(path, "wb") as f:
                f.write(audio)
            done += 1
            print(f"  ✓ {name} ({len(audio)//1024} kB)")
            time.sleep(args.delay)
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"  ✗ {name}: HTTP {e.code} {e.read().decode('utf-8','ignore')[:200]}")
        except Exception as e:
            failed += 1
            print(f"  ✗ {name}: {e}")

    keys = write_manifest()
    print(f"\nKlart. nya={done} hoppade={skipped} fel={failed}. Manifest: {len(keys)} klipp totalt.")

if __name__ == "__main__":
    main()
