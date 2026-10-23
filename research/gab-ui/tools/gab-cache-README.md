---
license: other
pretty_name: GAB cache (Gurbani Autopilot Bench, replay cache)
---

# GAB-cache: saved speech-model output for fast GAB re-tests (PRIVATE)

This dataset is a **cache**, not a benchmark. It holds what a fresh machine needs to re-test a change to the
Voice Autopilot logic of STTM Desktop (the harness: search, follower, judge, Bani rules) on the Gurbani Autopilot
Bench (GAB) at **pangti level** in minutes, **without running the speech model**.

The speech model only has to hear the audio again when **the model changes** (a new model file = a new sha256 = a new
`hearing/<model-id>-...` folder). A change to the app logic reuses the saved hearing: the app's real code is
replayed over these saved model outputs. If a build asks the model for a window that was never heard (for example a
lock at a new moment that starts the follower's windows at a new offset), the replay stops with a CACHE MISS and that
recording is reported as not scored; nothing is re-heard silently.

Tool: `research/gab-ui/tools/gab-quick` in the sttm-desktop repository (code lives on GitHub; data lives here).

```
gab-quick --pull                     # fresh machine: fill the local cache from this dataset
gab-quick <git ref | app worktree> --set all --jobs 4 [--baseline 6a866c94]
```

## Layout

| path | what |
|---|---|
| `manifest.json` | one row per recording: category (form of Guru's Bani), replay suite job, local cache entry name, namespace, audio sha256 + where the audio comes from, key source, viewer metadata |
| `hearing/<model-id>-q16-x86/<audio-hash>/` | model output for one recording, recorded on **x86 (linux-x64)**: the production reference. `emis.bin` + `index.jsonl` (one record per model window, keyed by sha1 of the window's exact samples; codec q16: exact argmax and max log-prob per frame, the rest as u16 fixed point) + `provenance.json` (platform, CPU, host) |
| `hearing/<model-id>-q16-mac/<audio-hash>/` | the same for **Apple silicon** output, kept separate (never mixed with x86: about 0.9% of frames differ). Only Karanbir v1 (no x86 recording yet) |
| `keys/<category>/<recording>/` | the pangti answer key used: `lines.csv` / `shabads.csv` as in the GAB dataset, and `key.json` = the key **as scored** (corrections, aligner check >= 0.6, ear-check rejections applied; `scored: false` spans are not scored) |
| `audio/<audio-hash>.wav` | audio that is not in `khalisfoundation/GurbaniAutopilotBench` (Karanbir Singh's benchmark v1 cases, annotations CC BY 4.0). Other audio is fetched from the GAB dataset and checked by sha256 |
| `bench-manifest.csv` | the Akhand Paath rows of the benchmark manifest (the Akhand Paath runner reads its recordings from it) |

`<model-id>` = `5f9e41d867de`, the first 12 hex of the sha256 of the int8 export of the karansea IndicConformer CTC model
used by STTM Desktop. `<audio-hash>` = the first 16 hex of the sha256 of the 16 kHz mono wav.

Categories: `main` (Kirtan), `paath` (Paath), `sungbani` (Sung Bani), `akhandpaath` (Sehaj / Akhand Paath),
`akhand` (Akhand Kirtan), `kbv1` (Karanbir v1 kirtan). Only recordings with full pangti timing are here (human or
publisher-slide keys, or aligner keys covering >= 60% of the keyed time), the same set the GAB viewer scores.

## Scoring (owner's pangti rule, 2026-10-22)

While a pangti is sung or read, the second is right only if that exact pangti is on screen (1 s catch-up; the line
just above at a pangti start also counts). Any other pangti or Shabad is wrong. When no pangti is being said, anything
already shown, the current or previous Shabad, the Waheguru slide or nothing is neutral (G, not counted).

## Rules

* Private. Cache only: nothing here is a published result.
* Re-hear (record) only for a new model, on the platform of its namespace; never mix platforms in one entry.
