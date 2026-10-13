# Cached deterministic replay (`vf-check`)

A full no-regression proof used to take ~3.5 h because every run re-executed the speech model on
unchanged audio. ~90% of that is the model; most changes are decision logic. `vf-check` replays every
suite with the model's outputs served from a cache, runs ALL decision code for real (the real
`VoiceFollow.jsx`, recognizer/follower/follower2 logic, Realm search, judge, Bani rules), and scores
base and candidate with the suites' own scorers.

## How to benchmark a change (every agent, every change)

1. **One branch.** Make your worktree from the current release head, commit your change there
   (`git -C ~/personal/sttm-desktop worktree add ~/personal/<name> -b <branch> <head>`; symlink node_modules).
2. **Smoke after every edit (< 1 min, no model):**
   `node research/level2-dataset/tools/vf-check.js --base <release worktree> --cand <your worktree> --tier smoke`
   10 clips across L2 kirtan, paath, Aarti, Fremont, Renton. Uncommitted edits are fine (dirty trees are
   just never cached). Exit 0 = no smoke metric worse. Read the per-clip event diff, not only the table.
3. **One final run on the candidate you would ship:**
   `node .../vf-check.js --base <release worktree> --cand <your worktree>` (full tier), or
   `--changed <release head>..<your head>` to run only the suites your diff can affect.
   If clips report a CACHE MISS your change altered what the model is asked to hear (that is fine):
   add `--fill` — it records just those clips with the model under the bench lock, then replays them.
4. **Live-paced only for timing changes** (audio queue/backlog, Start/Stop): vf-check prints
   "NEEDS LIVE-PACED CHECK" with the command when your diff touches those areas.
Never run the model outside `lockf -k /tmp/vf-bench.lock nice -n 19` (vf-check does this itself).
Results of a committed, unchanged app tree are kept per tree hash (`<cache>/results/`,
`<cache>/replays/`), so the base side of a check is usually instant.

## How it works

* **Seam:** `Infer.emissions(buf)` (one ONNX pass over one audio window -> CTC log-probs). The
  recognizer, both followers and the search-phase acoustic check all go through it.
* **Key:** sha1 of the window's exact float32 samples + its length. The window is the model's whole
  input, so the key already covers the call type, window/hop config and chunk phase; anything that
  changes what the model would see is a MISS, never a wrong hit. The model file's sha256 names the
  cache directory, so a new model starts an empty cache.
* **Store:** `~/personal/live-darbar-venues/cache/<model sha[0:12]>-q16/<clip>/{emis.bin,index.jsonl}`
  (append-only, deflated). Codec `q16`: exact argmax id and exact max log-prob per frame, the other
  log-probs as u16 fixed point (1/1024 nat). Greedy decoding (every transcript) and confidence are
  bit-exact; only the follower's word index CTC and the search-phase `_ctcScore` see <= 0.0005 nat
  rounding (averaged over frames). `VF_EMIS_CODEC=f32` stores raw floats (exact, ~2x larger).
* **Miss = hard error.** Replay never runs the model. `--fill` records the missing clips (model,
  under the lock) and replays them again.
* **Deterministic driver** (`bench-driver.js`, on whenever `VF_EMIS_CACHE` is set):
  1. every decision (`handleTranscript`) and every database / Bani / retrieval call is tracked, and the
     next audio chunk is pushed only when all of them have finished;
  2. a model pass returns only after all other pending database/retrieval work has settled, in call
     order (FIFO). On a real machine a pass takes 50-100 ms and that work a few ms, so this is the
     ordering the app normally sees;
  3. the component's `Date` is the audio clock (live: wall ~= audio; `--fast`: wall runs 3-10x faster
     than audio and varies run to run). `Date` only feeds the panel board, logs and throttles.

### What differs from the live app, and why the replay is still a faithful proxy

| live app | replay | effect |
|---|---|---|
| Search-phase text retrieval runs in a separate process; a newer transcript ABORTS an in-flight decision (`transcriptAbortRef`, step/sequence staleness) | every decision completes before the next chunk; none is cancelled | Same as the existing `--fast` runs, where retrieval is in-process and finishes before the next decode. On the Mac decisions take a few ms against a 500 ms decode hop, so live cancellations are rare; on slow PCs they are not, and that is a timing question (below) |
| Chunks keep arriving while a lock (profile load, follower build) is in progress | the lock finishes first | follower starts a few chunks earlier than live; same as `--fast` |
| Audio backlog: a slow PC merges waiting audio into one push (`AUDIO_BACKLOG_S`) | never (each 128 ms chunk is pushed alone) | backlog behaviour is NOT tested here |
| ORT may finish two concurrent passes in either order | FIFO | removes a source of run-to-run jitter |

**Still needs live-paced runs:** anything about timing — backlog/throughput (`vf-lag-stress.js`
`--pace wall` with a slowed engine), decision cancellation on a slow PC, Start/Stop/take-over in the
app (`stop-keeps-screen-test.js`), and a final PR spot check of a few clips with the real model
(`--fast`) to confirm the cache still matches (model / ORT / tokenizer updates).

## Build the cache (once per model; the record runs ARE real `--fast` runs)

```
cd research/level2-dataset/tools
node vf-check.js --record --roots ~/personal/sttm-release-base,~/personal/sttm-replay [--suites l2,paath,aarti,fremont,renton,asa]
```
Each suite takes the bench lock once (`lockf -k /tmp/vf-bench.lock nice -n 19`, `VF_ORT_THREADS=3`)
and runs its clips one at a time with the real model. A window already cached is served from the
cache, so the second root only runs the model where its behaviour differs. Record the base and the
current release; later candidates usually only need `--fill` for the few clips they change.

## Run a check

```
node vf-check.js --base <base worktree> --cand <candidate worktree>          # all suites
node vf-check.js --base B --cand C --suites paath,aarti --sentinel           # sentinel subsets only
node vf-check.js --changed 61488e2c^..61488e2c                               # scoped by what changed
node vf-check.js --changed vf-mvp-9.0 --cand ~/personal/sttm-paath           # branch point vs a worktree
```
Prints ONE table (`suite | metric | base | candidate | pass/fail`), then per clip the event-for-event
diff (screen events = shabad/verse/seeking/pane/length; all events = + transcripts, follower moves,
judge traces). Exit code 0 = no metric worse. Output: `results/vf-check/<time>/{report.md,report.json,
base/<suite>/, cand/<suite>/}` (per-clip runner JSON + `trace/<clip>.events.jsonl`).
Replays of an unchanged, committed app tree are saved under `<cache>/replays/` and reused, so the
base side of a scoped check is usually free. `--jobs N` (default cores/2) sets the worker count.
`--plan` prints the selection without running.

`--changed A..B` maps every changed file (and, for `VoiceFollow.jsx`, every changed hunk's enclosing
function or constant) to an area in `vf-scope.json`: Bani follower -> paath/Aarti/Renton/Asa + the
L2 12-clip sentinel; search/judge -> L2/Fremont/Aarti + paath/Renton sentinels; UI-only -> sentinels;
anything unmapped -> everything. Audio-pipeline and Start/Stop changes are flagged "needs live-paced
check".

## Validate the replay against real runs

```
node replay-validate.js --suite renton --ref <real --fast run dir> --replay <vf-check out>/base/renton
```
Prints `| suite | clips | identical clips | identical events % | max metric difference |` and the first
divergence of every differing clip.

## Add a suite

Add an entry to `vf-suites.js`: `jobs()` (one clip per job: `id` = cache id = clip name, `args` for
the existing runner, which must pass `cacheId` to `createDriver`), `score(dir)` (call the suite's
scorer on a directory of per-clip JSON files and return `{ metric: number }`), `metrics` with a
direction (+1 higher is better, -1 lower is better, 0 informational) and a `sentinel` subset. Add the
suite to the right areas in `vf-scope.json`, then `vf-check --record --suites <new>`.

## Files

`emis-cache.js` (cache + codec), `bench-driver.js` (cache + deterministic mode, `VF_DRIVER_ROOT`,
`VF_EVENT_TRACE`), `vf-check.js`, `vf-suites.js`, `vf-scope.json`, `replay-validate.js`.
Env: `VF_EMIS_CACHE`, `VF_EMIS_MODE=replay|record`, `VF_EMIS_CODEC=q16|f32`, `VF_EMIS_ID`,
`VF_DRIVER_ROOT`, `VF_EVENT_TRACE`, `VF_DETERMINISTIC=1` (deterministic driver without a cache).

## Validation log (newest last; written as the work goes)

- 2026-10-12 20:00. First record of clip02+clip05 found two harness bugs before anything was cached at scale:
  (1) the q16 decoder threw on windows with an odd frame count (Float32Array alignment). The component
  swallows per-chunk errors, so transcripts silently went missing. Fixed: aligned copies, and ANY
  cached-pass error now stops the run, the same way a miss does. (2) q16 clamped log-probs at -64 nat,
  which moved the search-phase `_ctcScore` of lines with unheard tokens (a lock came 1 decode early).
  Fixed: piecewise code (1/1024 nat to -60, 1/4 nat below, no clamp). That test cache was deleted.
- 2026-10-12 20:10. Small-first validation queued (lock): clip02, clip05 (L2), pt01, pt54 (paath), aa28
  (Aarti), recorded with the exact f32 codec into a scratch cache. Plan: replay f32 == record
  (determinism), transcode to q16 and replay == record (codec), compare with release's real --fast run.
  No full-suite recording until these pass.
- 2026-10-12 23:00. SMALL-FIRST VALIDATION PASSED. Record (real model, f32 codec) of clip02, clip05, pt01,
  pt54, aa28 on c119a80c (= MVP 9.0 app code): ~0.45x real time. Replay from cache, f32 AND q16:
  5/5 clips event-for-event IDENTICAL to the record (every transcript, retrieval, judge trace, screen
  event). Replay speed ~0.08 s per audio second (+3.5 s process start). q16 cache = 56% of f32.
  Against release's real --fast runs: clip05 identical; pt01, pt54 identical (replayed on the
  release-next tree 7165bd24 from the c119a80c cache: no misses); clip02 same lock (2567) 0.128 s =
  one audio chunk earlier (9.94 vs 10.06 s): the deterministic driver finishes a decision before the
  next chunk, --fast finished this one during the next chunk. Expected divergence; it can flip a
  threshold metric (found <= 10 s) on a clip right at the boundary.
- 2026-10-12 23:30. Shared cache on Khalis Azure (banidb / voice-follow-training-data, prefix bench-cache/):
  `vf-check cache push|pull|list`; vf-check pulls missing clips automatically before replaying.
  Validated small first: pushed clip02 (12.5 MB), removed it locally, pulled it back (byte-identical),
  replayed: event-for-event identical to the real-model record.
- 2026-10-13 00:35. Line truth (line-truth.js, forced aligner of the rt11 truth) validated small first on pt54 (Japji, 55 s):
  14 aligned lines, 2 flagged check<0.6 (the two "॥ ਜਪੁ ॥" title repeats). Line-level diff 265da34e -> MVP 9.0 on that clip:
  line exact 25.6 -> 60.2 %, median lag 2.18 -> 0.41 s, 9 lines better, 0 worse (matches the paath agent's follower-bench
  numbers: lag 1.85 -> 0.37 s). vf-check prints the per-clip line table whenever <cache>/line-truth/truth/<clip>.json exists.
- Pipeline test (vf-check, 5 clips x 2 roots = 12.2 min of audio, 3 workers, machine busy with a release run): 42 s replay,
  2 s scoring; a repeat run of the same committed trees: 0.9 s (replays and metrics reused per tree hash).
- 2026-10-13 02:20. Status: smoke-tier cache build running in the background, one clip per lock turn behind the release's runs
  (`vf-check --record --queue --tier smoke`, log in the replay scratchpad). Full-suite recording is ON HOLD by the lead's
  instruction (record once). Shared Azure cache: 6 clips, 108.5 MB pushed. Estimated full cache: ~8 GB q16 (734 min audio x
  ~0.19 MB/s), ~$0.16/month at Azure hot LRS (~$0.02/GB-month), ~$0.7 egress per full pull.
- 2026-10-13 02:20. Full cache build started (`vf-record-all.js --roots base,release-next --par 3`): 170 clips, 12.2 h of
  audio, order Renton -> smoke -> rest, lock-aware parallelism, push per batch, resumable via progress.json.
- 2026-10-13 02:57. SMOKE TIER CACHED. First real smoke run (base 265da34e vs release-next 7165bd24, 10 clips, 19.5 min of
  audio per side): 67 s wall with 3 recordings running on the machine; PASS. Rehras (1716 s) recorded in 665 s on the base
  root and 219 s more on the second root (only its diverging windows), 336 MB in the cache: ~0.2 MB per audio second.
