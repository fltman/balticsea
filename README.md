# Östersjön — en resa neråt

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

En interaktiv scrollytelling-sajt som tar besökaren från Östersjöns yta ner i det mörka djupet. På vägen ner möter man tio av havets varelser i djupordning — från blåstång vid ytan till torsk i djupet — och får höra om deras situation, anpassat efter vald läsnivå och språk.

## Vad den gör

- **Resa neråt** — vattenkolumnen rör sig från yta till djup medan man scrollar, med drivande bakgrund, ljuseffekter och vinjett.
- **Tio varelser** i djupordning: blåstång, storspigg, öronmanet, blåmussla, gråsäl, tumlare, strömming, skarpsill, flundra, torsk.
- **Fyra läsnivåer** (akademisk, allmän, barn, förskola) och **fyra språk** (svenska, engelska, finska, tyska) — allt innehåll kommer från `site/content.json`.
- **Förgenererade röstklipp** (ElevenLabs) per varelse, språk och nivå spelas upp på sajten utan API-nyckel i webbläsaren.
- **Live-samtal** — knappen "Prata med mig" startar ett röstsamtal med varelsen via ElevenLabs Conversational AI (`@elevenlabs/client`), i sajtens aktuella språk och nivå.

Sajten är helt statisk. Verktygen i `tools/` används separat för att förbereda innehållet.

## Verktyg

- `tools/generate_audio.py` — genererar mp3-röstklipp från `content.json` med varje varelses voiceId. Kräver `ELEVENLABS_API_KEY`.
- `tools/configure_agents.py` — konfigurerar ElevenLabs Conversational AI-agenterna (baltic1..baltic10) så att varje agent ÄR en av varelserna, med rätt röst, persona och kunskapsbank.

## Användning

Servera mappen `site/` statiskt, t.ex.:

```bash
cd site
python3 -m http.server 8137
```

Öppna sedan `http://localhost:8137`. Mikrofon för live-samtal kräver HTTPS i produktion.

För att (åter)generera röster och agenter:

```bash
export ELEVENLABS_API_KEY=sk_...
python3 tools/generate_audio.py
python3 tools/configure_agents.py
```

## Teknik

Statisk HTML/CSS/JS (vanilla), `content.json`-driven, ElevenLabs (förgenererad TTS + Conversational AI via `@elevenlabs/client`), Python-verktyg för innehållsgenerering.
