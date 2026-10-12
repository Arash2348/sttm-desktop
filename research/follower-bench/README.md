# Follower benchmark (line level, recited Banis)

How well a follower keeps the right line on screen while a Bani is recited, measured
against line-level truth.

## Data
- 55 recitation clips, 7 Banis: Japji, Jaap, Tav Prasad Savaiye, Chaupai, Anand,
  Rehras, Sohila (`clips.json`: clip -> BaniDB Bani ID). Audio:
  `~/personal/live-darbar-venues/clips` (bn01-06 full recordings, pt* 55-70 s cuts).
- `clips-kirtan.json`: two sung Aarti recordings (kirtan sanity check).
- `banis/<id>.json`: Bani text from api.banidb.com (`fetch-banis.js`).

## Pipeline
1. `precompute.js <wav...>`: transcript of every streaming window the follower sees
   (4 s, every 0.25 s) -> `cache/<clip>.hyps.json`.
2. `emis.js <wav...>`: full-clip model output from 10 s chunks (middle 6 s kept; the
   model drops words on long inputs) -> `cache/<clip>.emis.f32`.
3. `align.js <clip> <baniId>` (or `identify.js` to pick the Bani): line truth by
   offline CTC forced alignment of the whole clip against the Bani, in order. Allows a
   mid-Bani start, unscripted audio before/after, skipped header lines, long known
   skips (6-pauri Anand), and repeats. Robust to the CTC "blank absorbs a line"
   failure (blank scaled x3, misheard syllables floored). Text is aligned as spoken
   (`spoken.js`: ੴ, ਮਹਲਾ ੧ -> ਮਹਲਾ ਪਹਿਲਾ ...).
4. `bench.js [variant...]`: replays each follower over the cached windows and scores
   it (`replay.js`). Truth segments count only if a window around their start heard
   that line (independent check); unconfirmed time is not scored.
5. `foreign.js <variant>`: every clip played to a follower holding a DIFFERENT Bani;
   measures how often it shows anything (should be ~never).
6. `sweep.js '<json opts>'`, `errors.js`, `timeline.js`: tuning and diagnosis.

Heavy runs go on the EC2 bench box (32 cores); `infer.js` caps threads (BENCH_THREADS).

## Metrics
- within1s: share of recited time the right line is shown, allowing 1 s per change.
- steady: the same, leaving out each clip's first 5 s (start-up).
- wrongShown: time showing a line that is neither the current nor the previous one.
- lagMedian: seconds from a line starting to it being shown.

## Results (2026-10-01, after independent review; time-weighted, hand-checked truth overrides)
Both followers at the same 0.25 s step:

| Follower | steady (within 1 s) | steady wrong | median lag | p90 lag | wrong-Bani shown (strict / standard) |
|---|---|---|---|---|---|
| Cycle 8 line follower | 68.6% | 4.3% | 1.88 s | 2.75 s | 13.4% / 13.4% |
| follower2 | 98.6% | 0.48% | 0.35 s | 0.92 s | 4.4% / 2.2% |

"Strict" removes the recited Bani from follower2's comparison set (no hint). follower2 beats
Cycle 8 on every one of the 22 source videos. Earlier figures in commit messages (98.5 vs
55.8) were line-weighted, which over-weights Jaap; these replace them.

Known limits: truth comes from the same speech model (CTC alignment), verified against the
streaming windows and a 637-segment spot-check (93% confirmed; faults in
truth-overrides.json); tuned on these clips (parameter choice moves ~1 point); sung kirtan
(Aarti) still favours Cycle 8 on wrong lines (5.6% vs 1.8%). Next: hand-labelled line
starts on ~6 clips, held-out recordings, non-Nitnem audio in the wrong-Bani test.
The shipped engine runs at a 0.125 s step (re-check pending: `HOP=0.125 node precompute.js`).
