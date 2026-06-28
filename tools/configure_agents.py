#!/usr/bin/env python3
"""
Konfigurera ElevenLabs Conversational AI-agenter (baltic1..baltic10) så att varje
agent ÄR en av Östersjön-varelserna: rätt röst, in-character-persona, kunskapsbank
(SV+EN-fakta + delad Östersjö-kontext) och dynamiska variabler för språk/läsnivå.

Mappning (djupordning, grunt -> djupt):
    baltic1=blastang ... baltic10=torsk

Användning:
    export ELEVENLABS_API_KEY=sk_...
    python3 tools/configure_agents.py            # konfigurerar alla 10
    python3 tools/configure_agents.py --dry-run  # visar plan utan att skriva

Skriver tillbaka agentId + kbId i varje site/assets/content/creatures/<id>.json.
Kör därefter merge.py för att uppdatera content.json.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
CRE = os.path.join(SITE, "assets", "content", "creatures")
CONTENT = os.path.join(SITE, "content.json")
BASE = "https://api.elevenlabs.io"

# depth order -> baltic1..baltic10
ORDER = ["blastang","storspigg","oronmanet","blamussla","grasal",
         "tumlare","stromming","skarpsill","flundra","torsk"]

# Swedish in-character persona note + tone per creature
PERSONA = {
 "blastang":  ("Du är den varma, moderliga värden för havets undervattensskog. Trygg, vis och beskyddande — små djur känner sig hemma bland dina blad.", "varm, lugn och omtänksam"),
 "storspigg": ("Du är en liten men kaxig tuffing med vassa taggar som blivit nästan för många. Cool, självsäker och lite skrytsam — en underdog som vinner nu.", "kaxig, snabb och full av attityd"),
 "oronmanet": ("Du är en genomskinlig, drömsk gelédrift som svävar viktlöst genom vattnet. Mjuk, eterisk och en aning mystisk, som ur en halvdröm.", "drömsk, stillsam och svävande"),
 "blamussla": ("Du är havets lilla, flitiga filter. Ödmjuk, tyst och anspråkslös — du renar vattnet utan att be om tack.", "blygt, lugnt och vänligt"),
 "grasal":    ("Du är Östersjöns store, självsäkre fiskjägare. Bullrig, hjärtlig och gemytlig jätte med glimten i ögat, som överlevt allt.", "stor, gemytlig och skrattsugen"),
 "tumlare":   ("Du är Östersjöns blyga, lilla val — sällsynt och svår att få syn på. Mjuk, viskande och försiktig, sårbar men tyst hoppfull.", "blyg, viskande och ömsint"),
 "stromming": ("Du är en stressad stimfisk, alltid ett halvt andetag efter, som försöker hålla ihop hela stimmet på en gång. Nervös men varmhjärtad.", "stressad, andfådd och rastlös"),
 "skarpsill": ("Du är en liten, snabb optimist full av energi. Pigg, nyfiken och oförbätterligt positiv — hittar guldkanten i allt.", "pigg, snabb och hoppfull"),
 "flundra":   ("Du är den platta bottenfilosofen, nedbäddad i mjukbottnen. Lugn, eftertänksam och jordnära vis, aldrig stressad.", "lugn, långsam och filosofisk"),
 "torsk":     ("Du är en trött, gammal rovfisk som sett bättre dagar — en pensionerad sjökapten i fiskform. Djup röst, sliten men med bleknad värdighet.", "trött, vemodig men värdig"),
}

LANG_NAME = {"sv":"svenska","en":"English","fi":"suomi","de":"Deutsch"}
# default = allmän vuxennivå (sajten skickar rätt nivå per session)
LEVEL_DEFAULT = "Prata på en vardaglig, lättförståelig nivå, som med en intresserad vuxen besökare."

def api(method, path, key, body=None):
    url = BASE + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode("utf-8")
        return json.loads(raw) if raw.strip() else {}

def load(p):
    with open(p, encoding="utf-8") as f: return json.load(f)
def save(p, o):
    with open(p, "w", encoding="utf-8") as f: json.dump(o, f, ensure_ascii=False, indent=2)

def baltic_context():
    return (
        "OM ÖSTERSJÖN (delad bakgrund för alla varelser):\n"
        "Östersjön är ett av världens största bräckvattenhav — en blandning av sött och salt "
        "vatten, vilket gör det till en tuff livsmiljö med få arter. Vattnet byts ut långsamt "
        "(det tar runt 30 år). De största hoten är övergödning (för mycket kväve och fosfor från "
        "jordbruk och avlopp som ger algblomning), syrebrist på djupbottnarna, klimatförändringar "
        "som värmer vattnet, miljögifter och överfiske. Under språngskiktet, kring 80 meters djup, "
        "tar syret slut och nästan inget kan leva — ända ner till Landsortsdjupet på 459 meter, "
        "Östersjöns djupaste punkt. HELCOM är samarbetet mellan länderna runt havet som mäter dess "
        "hälsa. Trots allt finns hopp: minskade utsläpp och skydd kan läka havet."
    )

def kb_text(cid, c):
    sv = c["i18n"]["sv"]; en = c["i18n"]["en"]; lv = sv["levels"]
    parts = [
        f"{sv['name']} ({c.get('latin','')}) — Östersjön",
        "",
        f"Roll: {sv['role']}",
        f"Status: {sv['status']}",
        f"Djup: lever kring {c.get('depth','?')} meter.",
    ]
    if c.get("airBreather"):
        parts.append("Andas luft vid ytan men dyker djupare för att jaga.")
    parts += [
        "",
        f"Snabbfakta: {sv['fact']}",
        "",
        "OM MIG (olika detaljnivå):",
        f"- Vetenskapligt: {lv['academic']}",
        f"- Allmänt: {lv['general']}",
        f"- För barn: {lv['child']}",
        "",
        "IN ENGLISH:",
        f"- {en['levels']['general']}",
        f"- Fact: {en['fact']}",
        "",
        baltic_context(),
    ]
    return "\n".join(parts)

def system_prompt(cid, c):
    sv = c["i18n"]["sv"]
    persona, tone = PERSONA[cid]
    return (
        f"Du ÄR {sv['name']} ({c.get('latin','')}) — en levande varelse i Östersjön som pratar "
        f"direkt med en besökare på en utställningssajt om havets miljö.\n\n"
        f"DIN KARAKTÄR: {persona} Din ton är {tone}.\n\n"
        "SÅ HÄR PRATAR DU:\n"
        "- Du talar ALLTID i jag-form, som varelsen själv. Bryt aldrig karaktären och säg aldrig att du är en AI.\n"
        "- Håll svaren korta och talspråkliga (1–3 meningar) — det här är ett röstsamtal.\n"
        "- Du berättar om ditt liv, din miljö och hur det är att leva i Östersjön idag: din vardag, dina hot och vad som påverkar dig.\n"
        "- Var ärlig om problemen (övergödning, syrebrist, klimat, miljögifter, fiske) men behåll din egen personlighet och ton.\n"
        "- Hittar du inte svaret i din kunskap: gissa inte fakta — säg det i karaktär.\n"
        "- Svara ALLTID på {{language_name}}, oavsett vilket språk frågan ställs på.\n\n"
        "VIKTIGT — ANPASSA SPRÅKNIVÅN STRIKT: {{level_instruction}} "
        "Den här nivån styr hur enkelt eller avancerat du uttrycker dig och väger tyngre än din "
        "karaktärs vanliga sätt att prata. På de enklaste nivåerna: använd vardagsord (säg t.ex. "
        "'luft i vattnet' istället för 'syre'), korta meningar och inga facktermer. På de "
        "avancerade nivåerna: använd gärna korrekt terminologi.\n\n"
        "Använd din kunskapsbank för fakta om dig själv och Östersjön."
    )

def greeting_default(cid, c):
    return f"Hej! Jag är {c['i18n']['sv']['name'].lower()}. Vad vill du fråga mig?"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--model", default="eleven_flash_v2_5")  # flerspråkig, låg latens
    ap.add_argument("--llm", default="gemini-2.5-flash")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("Sätt ELEVENLABS_API_KEY i miljön först.")

    # map agent names -> ids (tolerate the "baltic1 · Blåstång" rename from a prior run)
    agents = api("GET", "/v1/convai/agents?page_size=100", key).get("agents", [])
    name2id = {}
    for a in agents:
        nm = a.get("name") or ""
        name2id[nm] = a["agent_id"]
        name2id[nm.split("·")[0].strip()] = a["agent_id"]  # base "balticN"

    for i, cid in enumerate(ORDER, start=1):
        aname = f"baltic{i}"
        cp = os.path.join(CRE, f"{cid}.json")
        c = load(cp)
        aid = c.get("agentId") or name2id.get(aname)   # prefer the id saved in the creature file
        if not aid:
            print(f"  ! {aname}/{cid}: hittar ingen agent — hoppar"); continue
        sv = c["i18n"]["sv"]
        vid = c.get("voiceId", "")
        if not vid:
            print(f"  ! {aname}/{cid}: saknar voiceId — hoppar"); continue

        kbname = f"Östersjön — {sv['name']}"
        ktext = kb_text(cid, c)
        prompt = system_prompt(cid, c)
        greet = greeting_default(cid, c)

        print(f"\n{aname}  ->  {sv['name']} ({cid})")
        print(f"    röst {vid} · KB {len(ktext)} tecken · prompt {len(prompt)} tecken")
        if args.dry_run:
            continue

        # 1) kunskapsbank: återanvänd om kbId redan finns
        kb_id = c.get("kbId")
        if kb_id:
            print(f"    KB återanvänds: {kb_id}")
        else:
            kb = api("POST", "/v1/convai/knowledge-base/text", key, {"name": kbname, "text": ktext})
            kb_id = kb.get("id") or kb.get("documentation_id")
            print(f"    KB skapad: {kb_id}")
            c["kbId"] = kb_id
            save(cp, c)

        # 2) patcha agenten
        patch = {
          "name": f"baltic{i} · {sv['name']}",
          "conversation_config": {
            "tts": {"voice_id": vid, "model_id": args.model},
            "agent": {
              "language": "sv",
              "first_message": "{{greeting}}",
              "dynamic_variables": {"dynamic_variable_placeholders": {
                  "greeting": greet,
                  "language_name": LANG_NAME["sv"],
                  "level_instruction": LEVEL_DEFAULT,
              }},
              "prompt": {
                "prompt": prompt,
                "llm": args.llm,
                "temperature": 0.5,
                "knowledge_base": [{"type": "text", "id": kb_id, "name": kbname, "usage_mode": "prompt"}],
              },
            },
          },
          "platform_settings": {
            "overrides": {"conversation_config_override": {"agent": {
                "language": True,
                "first_message": True,
                "prompt": {"prompt": True},
            }}},
          },
        }
        api("PATCH", f"/v1/convai/agents/{aid}", key, patch)
        c["agentId"] = aid
        save(cp, c)
        print(f"    ✓ konfigurerad och agentId sparad")
        time.sleep(0.3)

    print("\nKlart. Kör nu merge.py för att uppdatera content.json.")

if __name__ == "__main__":
    main()
