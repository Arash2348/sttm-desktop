# Voice-Follow Autopilot — Handoff

Real-time Gurbani "voice-follow" for SikhiToTheMax desktop: recognizes sung/spoken
Gurbani from the mic and auto-drives the active line (`setActiveVerseId` → highlight +
projector/OBS follow).

> **➡️ NEW AGENT PICKING THIS UP: start with [`handoff/README.md`](handoff/README.md).**
> That is the complete, self-contained replication of the entire project — full history,
> current state, run instructions, dead-ends, constraints, and verbatim copies of all 15
> memory files + all 153 user prompts. This file is the short version.

## Current status (this checkpoint)
**"Latest tested with Jashan — really good following, semi-okay switching."**
- **Path mode / following** within a shabad: strong.
- **Switching** between shabads on real kirtan: the frontier. ~acoustic ceiling on real
  kirtan; switching is FP-bound. This is the open problem for the next agent.

## Repo layout
- Branch: `feature/voice-follow`
- Baseline tag: `pre-autopilot` (commit `2f451be`) — do NOT regress this.
- Feature code: `www/main/addons/voice-follow/` (Babel-compiled to `www/js/`).
- Core logic + tuned config: `www/main/addons/voice-follow/components/VoiceFollow.jsx`.

## Current-best config (shipped, cross-validated)
In `VoiceFollow.jsx`:
- `SWITCH_CONFIRM = 3`
- `AP_FOLLOW_WIN_S = 4`
- `SWITCH_CAND_MIN_LINE_CHARS = 15` (length-aware candidate penalty — cut erroneous
  switches with no recall loss)

**Iteration rule:** keep a change ONLY if strictly better (lock-in ↑ AND erroneous NOT ↑).
Discard otherwise. Autopilot commits are labeled `[AUTOPILOT]`.

## Run the full E2E (real app)
E2E must be launched from a REAL Terminal login session — macOS blocks GUI launch from
the agent sandbox (Mach-port error).

```bash
cd /Users/asingh02/AAI/sttm-desktop
./vf-debug.sh          # frees :9222, starts alignment sidecar on :8000, launches app w/ CDP
```
- Screenshot a running renderer over CDP: `node vf-shot.js [urlSubstr] [outPath]`
- `vf-reload.js` — **DO NOT USE**. CDP reload re-inits native `realm.node` → SIGSEGV.
  To apply recompiled `www/js`, fully quit Electron and re-run `./vf-debug.sh`.
- Plain build-only launch: `npm start` (Babel + SASS watchers + Electron dev).

## External dependencies (OUTSIDE this repo — same machine)
- Alignment sidecar: `/Users/asingh02/AAI/voice-align-server/server.py` (:8000)
- Python venv: `/Users/asingh02/AAI/voice-venv/bin/python`
- Model: `/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx`
  (env: `KARANSEA_MODEL_DIR=/Users/asingh02/AAI/models/karansea-shabad-ctc`)
- Node v18 for harness: `~/.nvm/versions/node/v18.20.8/bin`,
  `NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules`

## Run the benchmark (KPIs, no GUI)
```bash
cd /Users/asingh02/aai/kirtan_bench
./run_kpis.sh          # all datasets, north-star KPIs
./ab_twosignal.sh      # A/B: control vs two-signal switch gate
```
Harness: `/Users/asingh02/AAI/vf-kirtan-switch-eval.js`. Datasets (wav + manifest) live in
`/Users/asingh02/aai/kirtan_bench/`. Reports: time-on-correct, stale, erroneous, switch
recall, lock-in %, never-locked, latency.

## North-star KPIs
Big 3: right-page ↑, wrong-page ↓, lock-on ↑.

## In progress
Native port: replacing the Python sidecar with in-app native `onnxruntime-node` (no
server), to ship upstream to KhalisFoundation. Inference/recognizer/BPE-encode verified;
follower port next.

## Upstreaming
Remotes: `fork` = Arash2348/sttm-desktop, `origin` = KhalisFoundation/sttm-desktop.
Commits are portable; upstream via PR base=KhalisFoundation, compare=Arash2348:feature/voice-follow.
See `/Users/asingh02/AAI/RESTORE-sttm-desktop.md` for restore/re-fork recipe.
