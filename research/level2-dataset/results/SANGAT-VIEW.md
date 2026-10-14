# Sangat view — one honest scorer for Voice-Follow (Oct 13 2026)

**What it measures:** what the people in the hall see while a pangti is being sung or read, time-weighted over the
seconds the answer key says a pangti is voiced. The screen is compared by **text**, not verse id. Gurmukhi is
normalised: no vishraams, no ॥੧॥ numerals, no punctuation or spaces. Copies that differ by a letter or a vowel sign
also count: Shabad 51 vs the Aarti Bani rows, the Kabir salok in Shabad 2129 vs 4997. Two texts that both occur in
one Shabad or Bani never count as the same pangti; this keeps Jaap Sahib's short half-lines apart.
Buckets: **ON**; **CATCHING UP** (the previous pangti, true one started < 1.0 s ago, or the next one starting in
< 1.0 s); **BEHIND/AHEAD** (one pangti off for longer); **LOST** (same Shabad/Bani, 2+ away); **WRONG PAGE**; **BLANK**
(nothing or the Waheguru slide). Headline **"sangat sees the right pangti" = ON + CATCHING UP**.
Code: `tools/sangat-score.js` (library + CLI). It is wired into `vf-check` (base -> cand table, information only)
and into the `--manifest` scorecard as question 2. `--from <dir>` rescores an existing replay; see `tools/RUNNING.md`.

**Truth provenance.** Every row says whether its answer key is **human** or **aligned** (forced alignment with our
own model). Only human rows are headlines (bold).
- Human **line-level** truth exists for only **5 clips** (Fremont kh01–kh05, the operator's screen line), so the
  human line headline rests on those 5.
- Renton Rehras, Sohila and Aarti and Asa di Vaar are aligned at line level and human only at Bani level.
- Level-2-41, Aarti-50 and paath are human at Shabad/Bani level only; line level is not available there.

## Result (rescored, nothing replayed)

Scored from the newest full-tier replays.
- `scratchpad/tp2/vf5-full`: experimental-release (sttm-er-bench, www tree d25b6bd1af) vs the slow-PC tiers branch
  (sttm-slowpc vf-slow-pc-tiers, www tree 00b6cbe13f).
- `results/vf-check/2026-10-13-22-15`: vf-mvp-9.0.1 (www tree a47a0c27bd) vs mvp-9.0.1-pr (www tree 44f18ee329).

The two sides of each run are event-identical, because the tiers change only live pacing. Their sangat tables are
**identical** too, so one table stands for all four builds. "Old metric" is what that run's `report.json` or
scorecard showed.

| row | truth, level | clips | old metric | **sangat sees right pangti** | ON / catching / behind+ahead / lost / wrong / blank % | wrong page s/h | catch-up lag p50 / p90 s | longest not-ON s | stuck >3 s |
|---|---|---|---|---|---|---|---|---|---|
| Renton Rehras | aligned, line | 1 | within 1 line 94.6% | 94.1% | 78.1 / 16.0 / 1.9 / 1.5 / 0 / 2.5 | 0 | 0.44 / 0.96 | 27.8 | 5 |
| Renton Rehras | human, Bani | 1 | Bani right 98.3% | **97.1%** | 97.1 / - / - / - / 0.2 / 2.7 | 7.1 | n/a | 46.1 | 2 |
| Renton Sohila | aligned, line | 1 | within 1 line 94.8% | 94.7% | 84.7 / 10.0 / 3.7 / 1.4 / 0 / 0.2 | 0 | 0.44 / 1.02 | 5.6 | 3 |
| Renton Sohila | human, Bani | 1 | Bani right 99.8% | **97.5%** | 97.5 / - / - / - / 0 / 2.5 | 0 | n/a | 7.7 | 1 |
| Renton Aarti | aligned, line | 1 | within 1 line 46.2% | 75.1% | 61.8 / 13.3 / 19.1 / 2.8 / 0 / 3.0 | 0 | 2.46 / 3.38 | 13.8 | 14 |
| Renton Aarti | human, Bani | 1 | Bani right 98.5% | **96.3%** | 96.3 / - / - / - / 0 / 3.7 | 0 | n/a | 26.2 | 1 |
| Renton kirtan1 (2053) | human, Shabad | 1 | first on screen 9.2 s, wrong 0 s | **98.1%** | 98.1 / - / - / - / 0 / 1.9 | 0 | n/a | 9.3 | 1 |
| Aarti-50 (45 scored) | human, Shabad | 45 | Aarti text up 85.3%, wrong 0.2% | **83.5%** | 83.5 / - / - / - / 1.2 / 15.4 | 42.7 | n/a | 120.1 | 30 |
| L2-41 kirtan | human, Shabad | 41 | right 97.54%, wrong 1.6% | **98.5%** | 98.5 / - / - / - / 0.7 / 0.9 | 23.6 | n/a | 40.2 | 17 |
| L2 clip05 (only L2 clip with line truth) | aligned, line | 1 | - | 45.7% | 33.5 / 12.2 / 14.6 / 27.1 / 0 / 12.6 | 0 | 2.24 / 3.54 | 13.9 | 3 |
| Fremont kh01–05 | human, line | 5 | within 1 line 71.7% (exact 57.0%) | **59.3%** | 57.7 / 1.6 / 16.7 / 12.5 / 0 / 11.4 | 0 | 1.47 / 6.76 | 103.0 | 40 |
| Fremont kh01–05 | human, Shabad | 5 | Shabad right 85.0% | **85.0%** | 85.0 / - / - / - / 3.6 / 11.4 | 129.4 | n/a | 91.9 | 5 |
| `1-kirtan-shabad` | human, line | 5 | line within 1 71.7% (Fremont) | **59.3%** | 57.7 / 1.6 / 16.7 / 12.5 / 0 / 11.4 | 0 | 1.47 / 6.76 | 103.0 | 40 |
| `1-kirtan-shabad` | human, Shabad | 50 | (Q1 only) | **96.6%** | 96.6 / - / - / - / 1.1 / 2.3 | 39.6 | n/a | 91.9 | 28 |
| `1-kirtan-shabad` | aligned, line / Shabad | 1 / 1 | - | 45.7% / 86.3% | | 0 / 0 | 2.24 / 3.54 | 13.9 / 31.3 | 3 / 1 |
| `2-paath-bani/japji` | human, Bani | 16 | not measured | **97.2%** | 97.2 / - / - / - / 0 / 2.8 | 0 | n/a | 13.6 | 1 |
| `2-paath-bani/japji` | aligned, line (pt54) | 1 | not measured | 70.9% | 61.1 / 9.7 / 1.3 / 1.3 / 0 / 26.5 | 0 | 0.44 / 1.66 | 12.0 | 1 |
| `2-paath-bani/jaap` | human, Bani | 8 | not measured | **81.2%** | 81.2 / - / - / - / 0 / 18.8 | 0 | n/a | 30.0 | 2 |
| `2-paath-bani/anand-40`, `chaupai`, `tav-prasad-savaiye` | human, Bani | 4 + 3 + 3 | not measured | **100%** each | 100 / - / - / - / 0 / 0 | 0 | n/a | 0 | 0 |
| `2-paath-bani/rehras` | human, Bani | 9 | not measured | **97.5%** | 97.5 / - / - / - / 0.2 / 2.4 | 6.3 | n/a | 46.1 | 2 |
| `2-paath-bani/rehras` | aligned, line (rt11) | 1 | within 1 line 94.6% | 94.1% | as Renton Rehras | 0 | 0.44 / 0.96 | 27.8 | 5 |
| `2-paath-bani/sohila` | human, Bani | 4 | not measured | **98.0%** | 98.0 / - / - / - / 0 / 2.0 | 0 | n/a | 7.7 | 1 |
| `2-paath-bani/sohila` | aligned, line (rt11) | 1 | within 1 line 94.8% | 94.7% | as Renton Sohila | 0 | 0.44 / 1.02 | 5.6 | 3 |
| `3-bani-sung/aarti` | human, Bani | 51 | heard line 73.4%, piece exact 60.2% | **82.9%** | 82.9 / - / - / - / 3.2 / 14.0 | 114.5 | n/a | 120.1 | 36 |
| `3-bani-sung/aarti` | aligned, line (rt11) | 1 | within 1 line 46.2% | 75.1% | as Renton Aarti | 0 | 2.46 / 3.38 | 13.8 | 14 |
| `3-bani-sung/asa-di-vaar` | human (operator taps), Shabad | 4 | Bani right 92.5–100% | **70.9%** | 70.9 / - / - / - / 17.1 / 12.1 | 614.1 | n/a | 795.5 | 15 |
| `3-bani-sung/asa-di-vaar` | aligned, line | 4 | within 1 line 15.6–95.9% per clip | 72.7% | 61.0 / 11.6 / 3.9 / 9.4 / 0 / 14.1 | 0 | 0.60 / 1.64 | 17.3 | 22 |
| `3-bani-sung/saloks-sung` | aligned / human+aligned, Shabad | 2 | first on screen 527 s / 1039 s | 97.4% / 97.1% | | 0 / 101.6 | n/a | 10.7 / 12.8 | 1 / 1 |

### Other outputs rescored (sttm-release `results/`, JSON outputs, no traces)

| output | clip | old metric (stored) | sangat sees right pangti | truth, level | wrong page s/h | catch-up lag p50 / p90 s | longest not-ON s |
|---|---|---|---|---|---|---|---|
| renton-tonight (the Oct 11 production night, live) | Rehras | within 1 line 34.7% | 23.2% (Bani: **94.3%**) | aligned line / human Bani | 104.4 | 1.16 / 3.14 | 169.8 |
| renton-tonight | Sohila | within 1 line 14.4% | 4.4% (Bani: **100%**) | aligned / human | 0 | 4.5 / 5.0 | 189.5 |
| renton-tonight | Aarti | within 1 line 34.0% | 34.8% (Bani: **92.8%**) | aligned / human | 283.0 | 3.3 / 7.04 | 39.9 |
| renton-tonight | kirtan1 | first on screen 98.5 s | **80.3%** | human, Shabad | 0 | n/a | 98.6 |
| renton-mvp90 | Rehras | within 1 line 93.5% | 93.4% (Bani: **96.2%**) | aligned / human | 28.5 | 0.44 / 1.0 | 28.0 |
| renton-mvp90 | Aarti | within 1 line 45.2% | 87.9% (Bani: **95.8%**) | aligned / human | 0 | 1.06 / 2.9 | 13.9 |
| stress-base (slowed PC, old build, Rehras 0–600 s) | Rehras | within 1 line 4.3% | 0.5% (Bani: **95.9%**) | aligned / human | 66.9 | 10.94 / 10.94 | 270.7 |
| stress-mvp90 (slowed PC, MVP 9.0, Rehras 0–600 s) | Rehras | within 1 line 96.1% | 86.8% (Bani: **96.2%**) | aligned / human | 40.3 | 1.2 / 1.68 | 9.6 |
| stress-mvp90 | Aarti | within 1 line 45.8% | 81.4% (Bani: **96.4%**) | aligned / human | 0 | 1.84 / 3.76 | 12.9 |
| kh-mvp90 | Fremont kh01–05 | within 1 line 66.3% | **50.5%** | human, line | 0 | 2.04 / 9.42 | 100.6 |
| l2-mvp90 | L2-41 | right 87.6% (raw, without clip-notes) | **98.3%** | human, Shabad (no verse ids: Shabad text overlap) | 2.6 | n/a | 100.3 |

Not rescored:
- `sttm-throughput2/research/level2-dataset/results/` holds only `THROUGHPUT-2.md`, with no event outputs.
- aa30, aa35 and aa39 are not in the dataset (not Aarti).
- clip37 and pt29 have traces but no runner JSON in vf5, so the scorecard lists them as errors. sangat-score.js
  itself scores them from the trace.

## Sanity checks

- **(a) Renton Aarti, 26–121 s, Shabad 51 on screen.** By exact text this window had 32.3 s WRONG PAGE: Sohila's copy
  spells ਕਵਲ / ਨਾਇ / ਹਹਿ where the Aarti Bani has ਕਮਲ / ਨਾਮਿ / ਹੈ. With the copy rule it is ON 51.8 s,
  CATCHING UP 11.2, BEHIND 16.7, LOST 2.1, WRONG 0, BLANK 0.7.
- **(b) Renton Rehras.** On the same output MVP-9.0.md used (`renton-mvp90/rt11_rehras.json`), the old "within one
  line" is 93.5% (the 94.5% in MVP-9.0.md came from an earlier commit's run). The new ON + CATCHING UP is 93.4%. On
  the full-tier replay it is 94.6% old vs 94.1% new. Where the two diverge, the gap is BEHIND: on stress-mvp90,
  9.7% of the time the screen sat one line behind for more than 1 s, which "within 1" counted as fine.
- **(c) Hand check, rt11_aarti.** 5 random seconds per bucket (`--explain`), truth text vs screen text, all 30 read
  correctly:
  - ON: includes the Shabad 51 copies.
  - CATCHING UP: the previous pangti, < 1 s into the new one.
  - BEHIND: e.g. ਨਾਮ ਤੇਰੇ ਕੀ ਜੋਤਿ still up while ਨਾਮੁ ਤੇਰੋ ਤਾਗਾ is sung.
  - LOST: the next Shabad's header ਧੰਨਾ shown early.
  - BLANK: before the first lock at 26 s.

## Why the numbers moved, and caveats

- **Voiced time only.** The old Renton scorer counted every second from the first to the last line, gaps included;
  this one counts only the seconds a pangti is voiced. Rehras: 1124 s voiced vs 1688 s.
- **Text, not id.** Renton Aarti went from 46% to 75% at line level (and renton-mvp90 from 45% to 88%) for three
  reasons:
  - the Shabad 51 copy now counts;
  - 31 aligned rows without an app verse id are now scored, e.g. ਧਨਾਸਰੀ ਮਹਲਾ ੧ ਆਰਤੀ (70 lines instead of 47). The
    dataset's `lines.csv` drops them, so the rt11 parts read the aligner's own JSON;
  - the kirtan repeats of one pangti count as one.
- **L2-41:** 97.5% -> 98.5%. clip38's Kabir salok is shown from Shabad 2129 while 4997 is sung, the same couplet with
  variant spellings.
  - Dataset bug: the dataset's `shabads.csv` lacks the user's `end_override_s` corrections for clip12 and clip17.
    The scorer applies them from `clip-notes.json`. The v0.1 dataset on Hugging Face should be fixed.
- **Aarti-50:** "Aarti text up" is scored at Bani level, so which piece is up is not scored. 1.2% wrong page is new;
  it is mostly a non-Aarti Shabad shown after the Aarti ends inside the clip window (aa07: Shabad 287 while 4967
  is sung). aarti-score ignored that window.
- **Fremont 71.7% -> 59.3%.** "Within 1" credited sitting one line behind or ahead indefinitely: that is 16.7%
  BEHIND/AHEAD here, plus 12.5% LOST. These 5 clips are the only human line-level truth.
- **Asa di Vaar Shabad truth = the operator's taps.** They record what his screen showed, lagged, not when each Shabad
  was sung. Its 17% wrong page partly measures disagreement with his screen.
- **The replays here are `--fast`.** No audio backlog, so the slow-PC problem shows only in the live / stress
  outputs (renton-tonight, stress-*).
