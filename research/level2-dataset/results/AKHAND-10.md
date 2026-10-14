# Akhand / Sehaj Paath sequence mode on the merged Voice-Follow code (branch vf-akhand-paath)

Base: `upstream/experimental-release` 2cb8b003 (worktree ~/personal/sttm-akhand10-base, clean).
Candidate: vf-akhand-paath = base + 65f8364c (sequence mode port) + f4c687e8 (session-to-hf tool) + 41d92317 (bench) +
6b556b77 (sequence mode only for a Shabad in no Bani, never for one whose lines came back).

## Disk-full check (step 1)
Worktree clean, node_modules symlinked, `node --check` on every changed tool OK, `npm run build:local` OK (279 files),
`node --test www/main/addons/voice-follow/components/` 35/35 pass. Nothing truncated.
(Both worktrees show `www/assets/videos/*.mp4` deleted by the disk cleanup; not app code, only stops vf-check reusing replays.)

## Method
Everything is Mac deterministic replay through the cached-replay harness (~/personal/sttm-replay tools, `VF_EMIS_CACHE`),
NOT x86 real time as in AKHAND-9. So every base-vs-candidate difference below is a code difference, not run-to-run jitter.
- Sequence sets: `paath-seq-bench.js --fast --trace-all` (Bani routes off, `VF_EXP_NO_BANI`), `VF_DRIVER_ROOT` = each tree.
  sp01/sp02 replayed from the cache; ps01-04 (bn01-04, never cached) and sp03 (cache incomplete) recorded with the model
  (`VF_EMIS_MODE=record`, under `lockf -k /tmp/vf-bench.lock nice -n 19`, `VF_ORT_THREADS=3`), base first, then candidate.
- Sehaj line truth: seq-truth/*.json (forced alignment, lines with check < 0.6 dropped); `seq-lag.js`.
- Sangat view: `sangat-score.js --events` against a scratch copy of the benchmark whose sp01-03 lines.csv were filled from
  seq-truth (source `aligned`). The real benchmark has no line truth for sp01-03 and no rows at all for bn01-04 (ps01-04),
  so ps01-04 have no sangat score.
- Regression: `vf-check.js --base sttm-akhand10-base --cand sttm-akhand10` full tier (6 suites, 170 clips per side).

## Sequence sets (Bani routes OFF, base -> this)

| clip | in-sequence % | wrong % | covered | carry-overs | flips | first correct |
|---|---|---|---|---|---|---|
| ps01 Rehras bn01 | 93.6 -> 93.6 | 5.9 -> 5.9 | 6/9 -> 6/9 | 5 -> 5 | 8 -> 8 | 28.9 -> 28.9 s |
| ps02 Rehras bn02 | 84.8 -> **73.9** | 14.6 -> **25.6** | 5/9 -> 4/9 | 3 -> 2 | 6 -> 6 | 13.6 -> 13.6 s |
| ps03 Sohila bn03 | 41.0 -> 41.0 | 58.5 -> 58.5 | 3/5 -> 3/5 | 1 -> 1 | 4 -> 4 | 0 -> 0 s |
| ps04 Sohila bn04 | 73.3 -> 73.3 | 25.7 -> 25.7 | 4/5 -> 4/5 | 2 -> 2 | 4 -> 4 | 0 -> 0 s |
| sp01 Sehaj Ang 100-109 | 98.2 -> 99.5 | 0.5 -> 0.0 | 11/35 -> 11/35 | 10 -> 10 | 11 -> 10 | 3.1 -> 3.1 s |
| sp02 Sehaj Ang 103-110 | 97.7 -> 99.1 | 0.0 -> 0.0 | 11/25 -> 11/25 | 10 -> 10 | 10 -> 10 | 3.1 -> 3.1 s |
| sp03 Sehaj Ang 1000-1010 | 97.3 -> 99.1 | 0.7 -> 0.0 | 12/35 -> 12/35 | 11 -> 11 | 13 -> 11 | 5.2 -> 5.2 s |

ps01, ps03, ps04: identical shown sequence on both. (ps03/ps04 "wrong" on both sides is 2533 and 644, Sohila / Aarti copies
of the same pangtis, which this id-based scorer counts as wrong.)

**ps02 (worse by id, same words on screen).** Both sides show 1370 (Raag Asa copy of So Dar's "Sun vadda", 41) at 129.7 s.
Base leaves it through the judge to 42 at 188.6 s; the candidate's sequence mode engages on 1370 and carries over to 1371 at
184.0 s, which is the Raag Asa copy of 42 (15 of its 18 lines are letter-for-letter 42's lines), and stays there until 43 at
242.4 s on both. So the hall sees the right words 4.6 s earlier, but under Asa's ids, and the id scorer counts 53.8 s more
"wrong". It happens only because the bench switches every Bani route off (`VF_EXP_NO_BANI`). Checked with routes ON
(`paath-seq-bench --bani --only ps02`, recorded both sides): base and this open the Rehras Bani (bani:21) at 0 s and follow
it to the end, identical events, sequence mode never engages; the paath suite with routes on is identical too (below).

### Sehaj Paath against the forced-aligned line truth

| clip | Shabad lag median / p90 (s) | line lag median / p90 (s) | line exact % | within 1 % | lines reached |
|---|---|---|---|---|---|
| sp01 | 5.18 / 8.91 -> 0.31 / 1.02 | 1.73 / 2.26 -> 0.36 / 1.26 | 52.4 -> 85.3 | 87.0 -> 98.8 | 84 -> 120 of 121 |
| sp02 | 6.08 / 9.61 -> 0.65 / 2.19 | 1.78 / 2.18 -> 0.34 / 1.46 | 50.5 -> 85.2 | 87.1 -> 98.1 | 101 -> 121 of 124 |
| sp03 | 5.06 / 7.30 -> 0.39 / 3.04 | 2.04 / 4.80 -> 0.35 / 1.51 | 48.7 -> 84.4 | 86.5 -> 97.5 | 70 -> 120 of 121 |

Shabad lag max: sp01 11.0 -> 2.5, sp02 10.0 -> 6.1 (Slok 299, 2 lines: the pace gate needs two lines), sp03 9.8 -> 4.9 s.

### Sangat view (sangat-score.js, line level, aligned truth, % of voiced time)

| clip | sangat sees the right pangti % (ON + catching up) | ON % | behind % | wrong % | blank % | catch-up lag p50 / p90 s | lines missed | longest not ON s |
|---|---|---|---|---|---|---|---|---|
| sp01 | 77.5 -> 98.4 | 53.5 -> 87.0 | 18.8 -> 1.1 | 0.6 -> 0 | 1.1 -> 0.5 | 1.76 / 2.24 -> 0.40 / 0.88 | 19 -> 3 | 9.4 -> 5.7 |
| sp02 | 76.4 -> 98.1 | 52.2 -> 87.7 | 19.9 -> 1.1 | 0 -> 0 | 2.1 -> 0.7 | 1.82 / 2.22 -> 0.38 / 0.90 | 15 -> 1 | 7.2 -> 4.1 |
| sp03 | 75.1 -> 97.8 | 52.2 -> 87.6 | 21.6 -> 1.5 | 0.3 -> 0 | 1.7 -> 0.6 | 2.02 / 2.64 -> 0.40 / 1.04 | 11 -> 1 | 9.0 -> 4.2 |

## Regression (vf-check full tier, Bani routes ON, base -> this)

| suite | clips | screen events differ | headline metrics |
|---|---|---|---|
| l2 (kirtan) | 41 (40 replayed) | 0 of 1010 | right 97.54 / wrong 1.64 / searching 0.83 %, found <=10 s 35: identical |
| paath (60) | 60 | 0 of 1131 | Bani 69.3 / wrong 2.9 / none 14.9 %: identical |
| aarti (50) | 50 | 0 of 986 | right 85.3 / wrong 0.2 %, found 43: identical |
| fremont | 5 | 0 of 126 | shabad right 84.96, line exact 57.03: identical |
| renton rt11 | 7 | 0 of 629 | Rehras exact 77.8 / lag 0.4; Sohila exact 84.1 / lag 0.4: identical |
| asa | 6 (+1 not run) | 0 of 364 | identical |

Sangat view (vf-check's own): every suite identical base -> this (L2 Shabad 98.6, paath 91.7, Aarti 81.4, Renton line 89.3 %).
Not replayed, both sides alike: L2 clip35 (cache miss on the base code too; not filled, since --fill was limited to the
sequence clips) and asa `nw11_session` (fails in 0.2 s on both sides, a harness input issue). vf-check prints FAIL only
because of these two "not replayed" rows; no metric differs.

## Open
- ps02 above: the id scorer of paath-seq-bench treats Raag Asa copies of Rehras Shabads as wrong; with Bani routes off sequence
  mode can carry through such a copy run (1370 -> 1371). Text-wise correct; in the app the Rehras route claims it first.
- The sequence sets are not in vf-check yet (manifest: sp02/sp03 `cache=no`, no bn01-04 rows; sp03's and bn01-04's cache
  entries now exist from this run): reproducible only through paath-seq-bench by hand.
- Same as AKHAND-9: a reader at kirtan pace (ps04) never enters sequence mode; the Akhand Paatt view setting opens a window
  from the first lock without the pace gate; no hall-acoustic Akhand Paath clip yet.
