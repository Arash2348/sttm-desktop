# Voice-Follow — Seamless Agent Handoff (MASTER)

You are picking up an in-flight project. This folder is a **complete, self-contained
replication** of everything done across the entire session so you can continue with zero
loss of context. Read this file top-to-bottom first, then the memory files in the order given.

---

## 0. How to use this handoff

Read order:
1. **This file** (orientation, current state, how to run, constraints, this-session log).
2. `memory/voice-follow-project.md` — the SPINE. Full chronological history (sttm-web era +
   model/decoder/benchmark knowledge). Long but authoritative.
3. `memory/voice-follow-desktop-integration.md` — the CURRENT target (Electron app port).
4. `memory/voice-follow-native-port.md` — in-progress work (native ONNX, drop the Python sidecar).
5. `memory/voice-follow-kirtan-switch-bench.md` — the switching benchmark + tuning.
6. `memory/voice-follow-north-star-kpis.md` — the 9 agreed KPIs (how we grade).
7. `memory/voice-follow-realkirtan-frontier.md`, `-path-near100.md`, `-oracle-bakeoff.md`,
   `-kirtan-model-goal.md` — the accuracy frontier + per-mode analysis.
8. The rest of `memory/*.md` as referenced.
9. `my-prompts-verbatim.txt` — all 153 verbatim user prompts across the whole project, in order.
10. `MEMORY.md` — the one-line index of every memory file.

`[[double-bracket]]` names in the memory files are cross-links to other files in `memory/`.

---

## 1. Who you're working with (READ — behavioral)

- The user is building this feature to **ship to all SikhiToTheMax users**; treat it as real
  product work, not a demo.
- **Speak of Gurbani reverently.** See `memory/communication-respect-bani.md` (there is also
  one specific idiom to avoid — it's named in that file).
- **Talk plainly. Do not use question-forms / multiple-choice prompts** unless truly blocked —
  restate what you heard, pick a sensible default, and proceed.
- **Do NOT `git commit` unless the user explicitly says to** (`memory/no-commit-without-approval.md`).
- **Never use external/public file-hosting sites** (pastebin, gist, catbox, imgur, transfer.sh,
  0x0.st, etc.). This is absolute.
- Iteration discipline: **keep a change ONLY if strictly better** — lock-in ↑ AND erroneous NOT ↑.
  Otherwise discard.

---

## 2. The project in one screen

**Voice-Follow:** while a shabad is sung/recited, detect the current pangti (line) + word,
highlight it live, and auto-advance the projection. Hard requirement: **high accuracy + low
latency**.

- **Approach (locked):** forced alignment, NOT transcription — the shabad text is pre-selected,
  so we decide only the *timing* of known words.
- **Engine:** a **kirtan-specific CTC model** — `karansea/indicconformer-stt-pa-ctc-shabad-preview`
  (MIT), self-contained ONNX with featurizer baked in (raw 16k audio in → log-probs out), at
  `/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx`. Decoder = online
  token-passing / Viterbi line tracker with distance-graded transitions + rahao-return edges.
- **Two "modes":** *Path mode* (recitation, sequential) is strong; *Kirtan mode* (sung, with
  harmonium/tabla bleed, melisma, shabad switches) is the frontier.
- **Target platform:** the **DESKTOP Electron app** (`/Users/asingh02/AAI/sttm-desktop`).
  `sttm-web` is deprecated — do not invest there.

---

## 3. Timeline / chapters (pointers)

- **sttm-web era** (deprecated frontend, but shared decoder/model/benchmark knowledge):
  `memory/voice-follow-project.md`.
- **Desktop port** — voice-follow is now an Electron addon driving `setActiveVerseId` →
  auto highlight + projection: `memory/voice-follow-desktop-integration.md`.
- **Native port (in progress)** — replace the Python `voice-align-server` sidecar with in-app
  native `onnxruntime-node` (no server) to ship upstream: `memory/voice-follow-native-port.md`.
  Status: inference / recognizer / BPE-encode verified; **follower port is next**.
- **Switching benchmark** — real 86-min kirtan, 116 real switches, +2nd-voice pull test:
  `memory/voice-follow-kirtan-switch-bench.md`.
- **Accuracy frontier** — real-kirtan accuracy is FP-bound (~35–37% ceiling, largely acoustic);
  Path mode is ~100% fixable: `memory/voice-follow-realkirtan-frontier.md`,
  `memory/voice-follow-path-near100.md`, `memory/voice-follow-oracle-bakeoff.md`.

---

## 4. Current state & current-best config

**Checkpoint (this handoff): "Latest tested with Jashan — really good following, semi-okay
switching."** Following within a shabad is strong; switching between shabads on real kirtan is
the open problem (FP-bound, near the acoustic ceiling).

**Current-best shipped config** lives in
`www/main/addons/voice-follow/components/VoiceFollow.jsx`:
- `SWITCH_CONFIRM = 3`
- `AP_FOLLOW_WIN_S = 4`
- `SWITCH_CAND_MIN_LINE_CHARS = 15` (length-aware candidate penalty — cut erroneous switches
  with no recall loss; the last strictly-better win)

Autopilot commits are labeled `[AUTOPILOT]`. Baseline tag `pre-autopilot` = `2f451be` —
**do not regress it.**

---

## 5. How to run

### ⭐ Fresh machine (e.g. a different computer / Muse Spark agent) — READ THIS
The app is **fully self-sufficient from this git repo**. The native ONNX engine
(`www/main/addons/voice-follow/engine/`) **auto-downloads the model from HuggingFace** on first
run (`engine/model-manager.js` → `karansea/indicconformer-stt-pa-ctc-shabad-preview/model.int8.onnx`,
public, no token). There is **NO Python sidecar and NO venv** — that was removed by the native port.

```bash
git clone <repo-url> sttm-desktop
cd sttm-desktop
npm install          # pulls onnxruntime-node + everything
npm start            # builds (Babel + SASS) and launches the app; model auto-downloads on 1st launch
```
Then in the app: open the **Voice Follow** addon, grant **microphone**, play/sing Gurbani → the
active line auto-highlights and the projector/OBS view follows.

Requirements on the new machine: Node (for the build — Electron bundles its own), `npm install`,
and outbound network to huggingface.co (one-time ~184MB model download). Nothing else.

### E2E debug helpers (original machine, optional)
`vf-debug.sh` also starts the OLD Python sidecar — **vestigial; the app does not need it.** Plain
`npm start` is the current E2E. If you use the CDP helpers: `node vf-shot.js [urlSubstr] [outPath]`
screenshots a running renderer; **`vf-reload.js` — DO NOT USE** (CDP reload re-inits native
`realm.node` → SIGSEGV; to apply recompiled `www/js`, fully quit Electron and relaunch).

### Benchmark — KPIs, no GUI (OPTIONAL — only to reproduce measurements)
Harness + runners + manifests are bundled here in `handoff/benchmark/`
(`vf-kirtan-switch-eval.js`, `run_kpis.sh`, `ab_twosignal.sh`, `*_manifest.json`).
⚠️ **The ~1.2 GB of kirtan audio (`*_16k.wav`) is NOT in git.** On a fresh machine you must either
regenerate it (yt-dlp pipeline — see `memory/voice-follow-kirtan-benchmark-pull.md`) or have it
transferred separately (e.g. Google Drive). The scripts also contain **original-machine absolute
paths** (`/Users/asingh02/...`, node v18 at `~/.nvm/.../v18.20.8`, `NODE_PATH=.../ort-spike/node_modules`)
that must be adjusted for the new machine. The benchmark is for *measuring KPIs* — it is NOT needed
to run or develop the feature.

---

## 6. Frontier / open problems / next steps

- **#1: real-kirtan switching accuracy.** FP-bound; near the acoustic ceiling (~35–37% on the
  hardest real set). This is the goal, not more tuning on the easy captioning set.
- Finish the **native follower port** (`voice-follow-native-port.md`) so the app ships without
  the Python sidecar — required to upstream to KhalisFoundation.
- KPI gaps: KPI #3 and #7 are agreed but not yet measured (`voice-follow-north-star-kpis.md`).

---

## 7. Dead-ends — do NOT retry (already disproven)

From `memory/voice-follow-project.md` and `-realkirtan-frontier.md`:
- Acoustic-blend into emission (hurts monotonically).
- Dual-window onset switch (no effect — short window still must hear the new line).
- The ~2s acoustic switch floor is **fundamental**; the only way to LEAD is predictive
  pre-highlight (already shipped), not a faster detector.
- Mid-pangti-start special-casing — decided NOT to (FP risk not worth it):
  `memory/voice-follow-midpangti-decision.md`.
- Loosening switch gates → 84% FP. `win8` is the safe Kirtan-mode win.

---

## 8. Repo / upstream

- Repo: `/Users/asingh02/AAI/sttm-desktop`, branch `feature/voice-follow`.
- Remotes: `fork` = Arash2348/sttm-desktop, `origin` = KhalisFoundation/sttm-desktop.
- Commits are portable; upstream via PR base=KhalisFoundation, compare=Arash2348:feature/voice-follow.
- Restore / re-fork recipe: `RESTORE-sttm-desktop.md` (in this folder).
- ⚠️ This `handoff/` folder contains internal notes/strategy — **strip it before opening the
  KhalisFoundation PR** (it's fine on the personal working branch).

---

## 9. Latest checkpoint (project continuity)

- Shipped the **length-aware candidate penalty** as the current best (strictly-better win:
  fewer erroneous switches, no recall loss).
- Created this **handoff bundle** and the checkpoint commit titled
  "Lastest Tested with Jashan (Really Good Following + Semi-Okay Switching)".
- Confirmed the desktop app is **self-sufficient from git** (native onnxruntime-node engine,
  model auto-downloads from HuggingFace — no Python sidecar/venv needed to run).

Protected local dirs on the original machine (not in git; do not delete if you are on it):
`ort-spike/node_modules`, `voice-venv`, `models/`, `kirtan_bench/`.

---

## 10. Key paths reference

| What | Path |
|---|---|
| App repo | `/Users/asingh02/AAI/sttm-desktop` |
| Voice-follow addon | `www/main/addons/voice-follow/` |
| Tuned config | `www/main/addons/voice-follow/components/VoiceFollow.jsx` |
| E2E launcher | `./vf-debug.sh` (+ `vf-shot.js`) |
| Alignment sidecar (Python) | `/Users/asingh02/AAI/voice-align-server/server.py` (:8000) |
| Python venv | `/Users/asingh02/AAI/voice-venv/bin/python` |
| Model | `/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx` |
| Benchmark harness | `/Users/asingh02/AAI/vf-kirtan-switch-eval.js` |
| Benchmark data + runners | `/Users/asingh02/aai/kirtan_bench/` |
| Node v18 (harness) | `~/.nvm/versions/node/v18.20.8/bin` |
| onnxruntime-node modules | `/Users/asingh02/aai/ort-spike/node_modules` |

---

## 11. Full transcripts (if you need raw detail beyond the memory files)

Too large to copy into the repo; on this machine at:
- `/Users/asingh02/.claude/projects/-Users-asingh02-AAI/5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8.jsonl`
- `/Users/asingh02/.claude/projects/-Users-asingh02-AAI/912be5a1-888f-4cb5-8069-6e0729b9a0c9.jsonl`

The memory files + `my-prompts-verbatim.txt` are the distilled version of these — start there.
