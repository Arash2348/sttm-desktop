---
name: voice-follow-kirtan-benchmark-pull
description: How to self-pull kirtan from YouTube + label shabads locally (Realm DB) to build voice-follow benchmarks
metadata: 
  node_type: memory
  type: reference
  originSessionId: 912be5a1-888f-4cb5-8069-6e0729b9a0c9
  modified: 2026-09-10T19:53:05.945Z
---

Reusable pipeline to grow the voice-follow kirtan switch benchmark from YouTube, built 2026-09-10. Complements [[voice-follow-kirtan-switch-bench]].

**YouTube download (the hard part — solved).** YouTube's 2025 PO-token/SABR anti-bot blocks plain yt-dlp. Working stack, all in the voice-venv (Python 3.12, `/Users/asingh02/aai/voice-venv/bin/python3`):
- `yt-dlp` master (2026.08.19) + `bgutil-ytdlp-pot-provider==2.0.0` + `imageio-ffmpeg`.
- POT provider **server** must run: `/Users/asingh02/aai/potgen/bgutil-ytdlp-pot-provider/server/build/main.js` on port 4416, started with **node20** (`~/.nvm/versions/node/v20.20.2/bin`; jsdom needs node20, node18 fails ERR_REQUIRE_ESM). Verify: `curl -s 127.0.0.1:4416/ping` → `{"version":"2.0.0"}`. Plugin AND server must BOTH be v2 (major-version mismatch → only images, no audio).
- ffmpeg: symlink the imageio binary to plain `ffmpeg` in its dir; pass `--ffmpeg-location <that dir>`.
- Command: `python -m yt_dlp --ffmpeg-location "$FFDIR" -f bestaudio/best --download-sections "*30-150" -x --audio-format wav --postprocessor-args "-ar 16000 -ac 1" -o OUT.wav "URL"`. Downloaded 40/40 from playlist PLnnODsM2enUZ5Ru1dQgFjvlgTZ59dgG-i with 0 failures. `--flat-playlist --print "%(id)s\t%(title)s"` dumps entries (NOTE: writes a LITERAL backslash-t, not a tab — split on `\\t`, and `cut -f1` fails).

**Labeling (title-based, RELIABLE).** Each playlist video = one shabad; the title's first segment (before `|`) is the uploader's romanized first line. Resolve via the LOCAL bundled Realm DB (no banidb.com egress needed, and egress is Meta-only anyway):
- Realm: `~/Library/Application Support/SikhiToTheMax/sttmdesktop-evergreen-v2.realm` (+ `realm-schema-evergreen.json`). Open **readOnly:true** with `sttm-desktop/node_modules/realm` (v10.24.0) — works while the app is running.
- `Verse` objects: `Gurmukhi` (GurmukhiAkhar ASCII-font), `FirstLetterEng`/`FirstLetterStr` (indexed), `Shabads` (link list). Get a shabad's lines: `objects('Verse').filtered('ANY Shabads.ShabadID == $0', sid).sorted('ID')`. Convert to Unicode (model's space) with `anvaad-js`.`unicode()`. (`anvaad.ascii()` returns codepoints, NOT the font string — don't use it for FirstLetterStr.)
- Resolver: title first-letters → `FirstLetterEng BEGINSWITH[c] <fl> AND Source.SourceID='G'`, then pick the candidate whose `anvaad.translit(Gurmukhi)` best `partialRatio`-matches the cleaned title. titleScore≥75 is trustworthy (spot-checked ~8/10 correct). Blind-ASR first-letter ID on this voice is NOT reliable (ASR too noisy) — title is the ground truth.
- IMPORTANT: playlist titles use EITHER `|` OR `/` to separate the shabad name from the artist ("Sun Shabad Tumara / Bhai Harjinder Singh"). `titleParts` must split on `/[|/]/` — splitting on `|` only makes the whole title the "first line" and resolution fails (was 27/40 → 76/90 after the fix). Set `ASR_SECONDS=0` to skip the useless intro-dominated ASR pass (fast). Downloaded 90/90 across two batches, 0 failures.
- CURRENT built artifacts (2026-09-10): `kirtan_pull_16k.wav`+`kirtan_pull_manifest.json` = 51 unique shabads / 38.5 min / 50 switches (titleScore≥75). Second-voice CONF sweep + cross-voice conclusion live in [[voice-follow-kirtan-switch-bench]].
- App's own search semantics live in `sttm-desktop/www/main/banidb/realm-search.js`; the Unicode→ASCII-font-first-letter converter (`toAsciiFirstLetters` / `UNI_TO_ASCII_FL`) is in VoiceFollow.jsx ~line 199-220.

**Scripts** (in `/Users/asingh02/aai/kirtan_bench/`): `label_pull.js` (title→sid + GT lines → pull/labels.json; drop its asrScore gate — it's intro-dominated and useless), `build_pull_stream.js` (slice 45s of sung middle per clip, concat → `kirtan_pull_16k.wav`+`kirtan_pull_manifest.json` in the harness's WAV=/MANIFEST= format). Run with `NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules MODEL=.../karansea-shabad-ctc/model.int8.onnx` under node18.
