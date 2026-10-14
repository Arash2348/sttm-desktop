# Running a build against the Voice-Follow benchmark

`tools/level2-dataset/` in this dataset is a snapshot of `research/level2-dataset/` from the SikhiToTheMax
desktop repo (branch `vf-cached-replay`): the replay harness (`tools/vf-check.js` with its `--manifest` mode,
`vf-manifest.js`, `vf-suites.js`, `bench-driver.js`, `emis-cache.js`, `remote-cache.js`), the suite runners
(`bench-runner.js`, `khalis-bench.js`, `renton-bench.js`, `nw-bench.js`), the scorers (`rescore.js`, `paath-score.js`,
`aarti/aarti-score.js`, `khalis-arbiter.js`, `renton-score.js`, `nw-score.js`, `line-diff.js`) and every truth file
they read. The harness runs the app's real Voice-Follow component headless, so it needs more than this folder.
This page is the honest list.

## What you need (once)

| what | why | where |
|---|---|---|
| a checkout of `sttm-desktop` at the build under test, with `node_modules` installed (Node 18) | the harness compiles and drives `www/main/addons/voice-follow/components/VoiceFollow.jsx` of THAT tree | `git worktree add ~/personal/<name> <commit>`; symlink or install node_modules |
| the harness tree: the same repo at branch `vf-cached-replay` (or this `tools/level2-dataset` copied over `research/level2-dataset/` of any checkout) | runners live under `research/level2-dataset/tools` and resolve the app with `--cand` / `VF_DRIVER_ROOT` | this folder |
| the BaniDB Realm database the desktop app installs | search, Bani profiles, text for scoring | `~/Library/Application Support/SikhiToTheMax/sttmdesktop-evergreen-v2.realm` (+ `realm-schema-evergreen.json`); run the app once |
| the recognition model file | names the cache directory (its sha256); runs only when recording | `MODEL=` path to `model.int8.onnx` (karansea IndicConformer CTC, int8 export used by the app) |
| the model-output cache for the clips you run | replay never runs the model; a clip without a cache entry is a hard MISS | pull from the shared Azure copy (`vf-check cache pull`, needs the Khalis Azure credentials in `remote-cache.js`'s env) or record once with the model (`vf-check --record --only <clips>`, ~0.45x real time, under the bench lock) |
| the clips at `~/personal/live-darbar-venues/clips/<source_file>` | the suite runners read the original wav names (`source_file` in the manifest), not `audio.wav` | copy each `audio.wav` to `<dir>/<source_file>` (byte-identical) or symlink, and set `VF_CLIPS=<dir>`; the cache key is the audio itself |

`manifest.csv` tells you per clip which suite job scores it (`suite_jobs`), the original file name (`source_file`),
and whether the benchmark Mac's cache has it (`cache`).

## Commands

```
cd research/level2-dataset/tools
export HF_TOKEN=...                                   # read access to the dataset (only for hf: manifests)

# one content folder from the Hugging Face manifest
node vf-check.js --manifest hf:khalisfoundation/voice-follow-benchmark --cand ~/personal/<app worktree> --folder 3-bani-sung/aarti

# the whole benchmark from a local manifest, 6 workers
node vf-check.js --manifest /path/to/manifest.csv --cand ~/personal/<app worktree> --jobs 6

# see what would run (and which clips are "not run" and why) without running
node vf-check.js --manifest ... --cand ... --plan
```

Output (`research/level2-dataset/results/vf-check/manifest-<time>/`, or `--out`):

* `scorecard.md` / `scorecard.json` — one row per content folder, the four questions as columns:
  1. found within 10 s / wrong page, 2. on the right line or turning to it, 3. seconds behind, 4. seconds to the new
  Shabad / wrong switches. Each cell is the suite scorer's own metric(s) by name, or `not measured`.
* `cand/<suite>/<clip>.json` + `cand/<suite>/trace/<clip>.events.jsonl` — every screen event, transcript and judge trace.
* `score/<folder>/<suite>/` — the per-folder scoring directories (what the scorer saw).

Exit code 0 = every selected clip replayed; 1 = cache misses or errors (listed at the end).

## Comparing two builds

`vf-check.js --base <worktree A> --cand <worktree B>` is the regression check (one table, event-for-event diff per
clip, exit 0 = no metric worse); `--manifest` is the single-build scorecard. See `tools/REPLAY.md` for the cache
design, the deterministic driver and what still needs live-paced runs (audio backlog, Start/Stop).

## Clips the manifest runner does not run

* `ut13_s90`, `ut13_s91`, `rt11_handover` — scored by `ut13-bench.js` (branch `vf-mvp-9.0.1`, real model);
* `sp01`-`sp03` — scored by the paath-sequence bench (branch `akhand-paath`);
* `kh06` — truth included, no cache entry (not in the Fremont suite).

They are in the dataset with their truth so the next runner version can take them.

## Bench etiquette on the shared Mac

Every heavy phase takes `lockf -k /tmp/vf-bench.lock nice -n 19` by itself. Never run the model outside that lock.
