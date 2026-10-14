# SIM-SLOWPC — slow-PC runs from the cache on a virtual clock (branch vf-cached-replay)

Slow-PC checks used to be 10-13 min wall-paced runs per clip on the x86 VM (`renton-stress.js --pass-ms 185 --pad-scale`),
plus queueing. The simulated mode replays the same component from the emissions cache on a **virtual clock**: a 600 s
Rehras stretch at 0.9x takes 1.5-2 min on the Mac, is deterministic, and reproduces the VM results within run-to-run noise
on 5 of 6 clip x build cells at the default setting (section 2).

## 1. How to run

```
cd research/level2-dataset/tools
node sim-slowpc.js --clip rt11_rehras --from 0 --to 600 --root <worktree> --sim-speed 0.9 --out run.json   # one run
node sim-score.js run.json                                                                                 # score it
node sim-sweep.js --builds upstream=~/personal/sttm-er-bench,tiers=~/personal/sttm-slowpc \
     --clips rehras,kh04,ytasa1 --speeds 0.5,0.7,0.9,1.2 --fill                                            # one table per build
```
* `--sim-speed x` -> `--sim-pass-ms N` with N = 1000 / (6 x speed) (MVP 9.0 following = 6 passes per audio second):
  0.5x = 333, 0.7x = 238, 0.9x = 185, 1.2x = 139 ms per 4 s pass, exactly the VM harness's numbers.
* A pass costs N x window / 4 s (= `--pad-scale`, as every section 5-7 VM cell); `--sim-flat` prices every pass at N.
* `--sim-js-ms M`: virtual cost after each engine decode (default 0). `--sim-serial`: concurrent passes queue on one
  engine (default: each pass costs its own time, as the VM's padded engine did). `--tier T` pins a tier.
* `--fill`: the first run of a new build / speed / clip meets windows the awaited cache never saw (decodes moved by merged
  pushes, the tiers' 2.5 s windows and beat-aligned hops). Without `--fill` such a run stops with exit 3. With it, the run
  re-executes itself under `lockf -k /tmp/vf-bench.lock nice -n 19` (3 ORT threads) and the real model computes only the
  missing windows into an overlay store, `<cache>/sim/<model>-q16/<clip>/` (never the shared cache, never pushed). The
  recording run IS a simulated run (virtual time does not see the model's real time) and returns the codec-rounded output
  a replay will get, so record and replay are identical (verified: 6 of 6 cells, every event and backlog sample).
  `sim-sweep.js --fill` does this per cell, only when the replay misses. Replay cells take a shared replay slot like vf-check.
* Output = renton-stress.js's format (`{part, from, dur, summary, samples, backlogEvents, events}`), so renton-score.js,
  nw-score.js and the tp5 scorer read it unchanged. `sim-score.js` = those scorers (verified: it reproduces the tp5-score
  numbers of all 14 VM reference runs exactly).

## 2. Validation against the real x86 VM runs (0.9x, same clips, same builds)

VM references: tp4 = section 6 (upstream 2cb8b003 vs tiers ca4e8492), tp5 = section 7 (upstream r1/r2 vs daf855f1 r1/r2),
Rehras for ca4e8492 = section 3c/7 (the 0.4 s / 95.0 cell; a vf-throughput-2 tree with the same sync tier). Sim = this
mode, `--sim-js-ms 0` (default) and `50` (sensitivity, see below). Builds: upstream = ~/personal/sttm-er-bench (2cb8b003),
tiers = detached worktrees at ca4e8492 / daf855f1.

| clip | metric | upstream: VM | upstream: sim (js 0 / js 50) | tiers ca4e8492: VM | tiers ca4e8492: sim (js 0 / js 50) | agreement (js 0) |
|---|---|---|---|---|---|---|
| Rehras 0-600 | line lag median | 1.0 s (3 runs) | **1.0** / 1.2 s | 0.4 s | **0.4** / 0.5 s | same both builds; difference -0.6 s = VM -0.6 s |
| | within 1 line | 92.2-94.9 % | **93.7** / 83.3 % | 95.0 % | **94.2** / 93.9 % | in the VM range / -0.8 pt |
| | wrong page | 0 | **0** / 9.7 % (1370, 56 s) | 0 | **0** / 0 | same |
| | audio backlog max / p95 | 2.94 / 0.9 s | 1.02 / 0.77 s | - / 0.26 s | 0.38 / 0 s | p95 a bit lower (JS is free in the sim) |
| | tier | - | - | sync | sync/1 | same |
| kh04 (4 Shabads) | right % | 81.1-82.4 | **80.7** / 83.2 | 86.8 | **86.9** / 86.9 | upstream -0.4 pt below range; tiers exact |
| | wrong page s | 92-127 | **91** / 112 | 100 | **100** / 100 | same |
| | line lag median | 2.4-3.0 s | **2.2** / 3.3 s | 1.1 s | **1.0** / 2.1 s | -0.2 s / -0.1 s |
| | switch to 5393 (sung 571-601 s) | +20 s, +20 s, never | **never** / +21 s (return +36 s; VM +36, +37) | never | **never** / never | js 0 = the VM's 1-in-3 outcome; js 50 = the 2-in-3 outcome |
| | first Shabad on screen | 7-10 s | -5 / -5 s | -6 s | **-6** / -5 s | upstream 12-15 s earlier than the VM; tiers exact |
| ytasa1 Asa di Vaar (720 s) | within 1 line | 89.0-95.5 % | **93.6** / 93.6 % | 93.2 % | **93.0** / 92.8 % | in range / -0.2 pt |
| | lines reached | 153-158 | **154** / 154 | 152 | **151** / 151 | in range / -1 |
| | line lag median | 1.10-1.14 s | **1.17** / 1.3 s | 0.66 s | **0.64** / 0.77 s | +0.03..0.07 s / -0.02 s |
| | tier, backlog p95 | -, 0.77-0.9 s | -, 0.77 s | sync, 0 s | sync/1, 0 s | same |

Build difference (tiers - upstream), VM -> sim js 0: Rehras lag -0.6 -> -0.6 s, within 1 +0.1..+2.8 -> +0.5 pt; kh04 right
+4.4..+5.7 -> +6.2 pt, wrong page +7 -> +9 s, lag -1.3..-1.9 -> -1.2 s, the 5393 switch lost (2 of 3 -> 0; sim js 50: +21 s ->
never); Asa within 1 -2.3 (one run; mean of 3 upstream runs -0.6) -> -0.6 pt, reached -6 -> -3, lag -0.46 -> -0.53 s.
**Every direction agrees; sizes agree within the VM's run-to-run spread**, except two upstream numbers at js 0: kh04's
first Shabad shows 12-15 s earlier than on the VM, and the one-off switch to 5393 does not happen (the VM itself missed it
in 1 of 3 runs). The sim is deterministic: it gives ONE trajectory where the VM gives a spread.

The fix that followed (daf855f1, section 7), same harness:

| clip (0.9x) | VM daf855f1 (Rehras 1 run; kh04, Asa 2 runs) | sim js 0 | sim js 50 |
|---|---|---|---|
| Rehras 0-600: lag / within 1 / tier | 0.7 s / 95.0 % / sync -> lean (2) | 0.6 s / 94.2 % / sync (1) | **0.8 s / 94.0 % / sync -> lean (2)** |
| kh04: right / wrong s / lag / 5393 | 82.1 % / 91 / 1.4 s / never (x2) | 82.0 % / 56 / 1.9 s / never | **80.7 % / 91 / 1.5 s / never** |
| Asa: within 1 / reached / lag / tier | 97.2, 92.4 % / 158 / 0.74-0.75 s / lean (2) | 97.3 % / 158 / 0.64 s / sync (1) | 93.9 % / 153 / 0.85 s / lean (2) |

With JS free (js 0) the fixed build's read-Bani load (4.5 pass-equivalents x 185 ms = 0.83) never backs up 0.5 s for 3 s, so
it stays on sync; the VM, whose judge/board JS cost ~0.4 s per audio second on a shared core (THROUGHPUT-2 section 3), stepped
down to lean on Rehras and Asa. At js 50 the sim steps exactly as the VM did.

**JS cost is the one free parameter, and it is not tuned here.** js 0 = the Mac (~30 ms of JS per audio second); js 50
(~0.2-0.25 s per audio second) sits between the Mac and the loaded VM. The VM numbers lie between the two settings
almost everywhere: js 0 matches 5 of 6 primary cells, js 50 is right where the VM's JS load mattered (the tier step, the
kh04 switch) and too pessimistic for upstream Rehras (it turns 0.9x into the 0.7x failure below). Read a slow-PC
question at both settings; a conclusion that holds at js 0 and js 50 holds on the VM.

### Speed sweep, Rehras 0-600 (sim js 0 vs the VM, THROUGHPUT-2 sections 3, 3c, 3d)

| speed | upstream sim | VM (PR build f51130fa = MVP 9.0.1; 0.5x: 4ff68d0d) | tiers ca4e8492 sim | VM (tiers branch, auto) |
|---|---|---|---|---|
| 1.2x (139) | 0.6 s / 93.9 %, backlog p95 0.13 | 0.7 s / 91.8 %, p95 0.77 | 0.4 s / 94.0 %, sync | 0.4 s / 94.9 %, sync |
| 0.9x (185) | 1.0 s / 93.7 % | 1.0 s / 92.2-94.9 % | 0.4 s / 94.2 %, sync | 0.4 s / 95.0 %, sync |
| 0.7x (238) | 1.2 s / 83.4 %, **WRONG page 1370 for 56 s (9.6 %)** | 1.2 s / 81.5 %, **WRONG page 1370 for 57 s (9.7 %)** | 0.5 s / 94.0 %, sync, 0 wrong | 0.6 s / 94.8 %, sync, 0 wrong |
| 0.5x (333) | 1.4 s / 93.1 %, wrong page 31080 for 7 s | 1.5 s / 91.3 %, wrong page 7565 for 9 s | 1.1 s / 94.5 %, sync -> min (2) | 1.0 s / 94.9 %, lean -> min |

The 0.7x failure (stale windows decoded late put Shabad 1370 on screen for ~56 s) is reproduced to the page and the second.

## 3. Wall time (Mac M4 Pro, nice 19, 6 runs at once beside other agents' replays and recordings)

| clip (audio) | VM wall-paced | sim replay | first run of a new build/speed (`--fill`) |
|---|---|---|---|
| Rehras 0-600 (600 s) | ~11 min + queue | 78-155 s | 2-10 min (most of it waiting for the bench lock) |
| kh04 (793 s) | ~13 min | 21-34 s | 0.5-6 min |
| ytasa1 (720 s) | ~12 min | 62-135 s | 2.5-19 min (19 min = lock wait; 2547 windows recorded) |

The 0.9x validation (3 builds x 3 clips) replays in 3.2 min. The overlay store after this work: 0.7 GB for the 3 clips
(4 speeds, 3 builds, js 0/50); windows are shared across builds and settings, so later sweeps fill less.

## 4. What is simulated, and how

* `bench-driver.js` (`VF_SIM_PASS_MS`, with `VF_EMIS_CACHE`): a discrete-event clock (`sim-clock.js`) owns time. Events =
  microphone chunks (128 ms, at their audio end time, never awaited), model-pass completions, the component's timers, the
  1 s backlog sampler. After each event every piece of REAL asynchronous work (Realm / retrieval / a pass being recorded)
  finishes before the clock moves; JavaScript costs no virtual time unless `--sim-js-ms`.
* Time reads virtualized: the vm context's `Date`, `setTimeout/clearTimeout/setInterval/clearInterval`; the HOST
  process's `Date` and `performance.now` (engine/infer.js times passes with `Date.now()`, engine/pace.js runs the
  self-test with `performance.now()` and steps tiers with `Date.now()` — both are plain Node modules outside the vm).
  `performance.now` must be replaced with `Object.defineProperty`: a plain assignment is silently ignored by Node 18
  (the first build of this mode had a self-test reading 0 ms and picking `fast`; caught by the 185 ms check). No app
  time read was found that the harness cannot virtualize. Restored on `driver.stop()`. One simulated driver per process
  (engine/pace keeps module state; the driver refuses a second self-test).
* Model pass seam: `Infer.run` when the build has it (tiers: the app's `emissions()` memo, `pace.notePass` timing and perf
  bookkeeping run unmodified), else `Infer.emissions` (upstream). Cost = N x window / 4 s, concurrent passes overlap
  (as the VM's pad did). Recording uses the real model's `run()` so the Mac's real timing never reaches pace.
* Tier self-test: `engine/index.js ready()` runs `pace.selfTest(infer)`; the driver does the same through the simulated
  pass (its 7 noise windows get a dummy output and the full virtual cost): selfTestMs = 139 / 185 / 333 at 1.2x / 0.9x /
  0.5x -> sync / sync / lean, as on the VM.
* Everything else is the app: audio queue, 1 s backlog bound and merged pushes, `pace.observe` stepping, beat alignment,
  memo, followers, judge, Bani rules, decision cancellation by newer transcripts.
* Event times = the audio time of the last chunk delivered (as renton-stress stamped them), so the scorers' lag is
  comparable.

## 5. Limitations

* JS cost is a knob, not a measurement (above).
* banidb/realm-search.js:44 retries a failed `Realm.open` after `setTimeout(resolve, 300)`. banidb runs inside the vm
  context, so that timer is virtual, while the retry is database work the clock waits on before it moves: a Realm open
  failure would stall the sim (it never occurred). `VF_SIM_DEBUG=1` prints the clock and what it waits on every 5 s.
* The harness files (bench-driver.js among them) are part of vf-check's replay-reuse key: after this change every cached
  replay recomputes once. The awaited path is unchanged: vf-check smoke, upstream vs ca4e8492, 10 clips replayed with the
  new driver, 0 of 135 screen events differ (PASS), as in THROUGHPUT-2 section 5. Database and retrieval work cost no virtual time.
* Deterministic: one trajectory per build/speed/clip. A threshold event the VM hits in some runs (kh04's 5393 switch)
  appears or not; run js 0 and js 50 (or neighbouring speeds) to see whether a result is on a knife edge.
* Pass cost is linear in the window and identical for every pass; real ORT passes vary, and a real single-engine PC
  serializes concurrent passes (`--sim-serial`, not validated here).
* Model output is the Apple-silicon cache; the VM ran x86 ORT. Equal decisions at the metric level were shown earlier
  (CLOUD-RECORD.md); exact event equality with the VM is not expected and was not the bar.
* New build/speed/clip combinations need one `--fill` run (model, bench lock). The overlay is local (not in the Azure
  cache).
* The local shared cache had lost `emis.bin` for rt11_rehras, ytasa1 and ~20 other clips (index files left, evicted for
  disk space by someone); this work re-pulled rt11_rehras and ytasa1 from Azure (475 MB). A replay against an index with
  no bin reads as "every window missing".
