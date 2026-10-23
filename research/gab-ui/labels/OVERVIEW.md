# Overnight pangti labelling: overview (2026-10-23)

**In short:** the three checkers accepted 299 pangti labels of Guru's Bani. Of those, 295 confirm pangti timings the
benchmark already had, and only 4 are new (32 seconds of sung Bani). One recording (aa05, Aarti) now reaches the 60%
coverage bar and joins the Sung Bani set. Every other benchmark number is unchanged. The strict rule, which needs all
3 checkers to name the same pangti and each to be at least 95% sure, works as a confirmation step. It does not add
much new coverage: the hard, unkeyed parts of recordings almost never pass it. Nothing has been uploaded. The upload
plan waits for your sign-off (`labels/UPLOAD-PLAN.md`).

## How a label was made and checked

1. **Candidate:** two speech-model forced alignments (Karanbir's and Surinder's model, the saved cloud run of
   Oct 15) suggest when each pangti is sung. These are machine timings only; no model was re-run.
2. **3 independent checks:** three checkers each picked their own pangti for every span, using a different method
   each: text match against the speech-model hearing, timing from fresh model output, and recording structure
   (Shabad order, durations, overlaps).
3. **Accepted only when** all 3 checkers named the **same pangti** as the candidate **and** each checker's
   confidence was **≥ 0.95**. Otherwise the span is left for a person to decide.
4. **Merged** into the existing keys without changing any existing row. A label that overlaps a human row, or a row
   with a different pangti, is not added and is reported as a conflict (there were none).

## Labels per form of Guru's Bani

| form of Guru's Bani | recordings | spans checked by all 3 | all 3 named the same pangti | accepted (≥ 0.95 each) | acceptance rate | accepted sung time | new to the key / confirm existing |
|---|---|---|---|---|---|---|---|
| Kirtan | 58 (43 fully checked) | 2,125 | 1,076 (51%) | 289 | 13.6% | 37.6 min | 3 new (28 s) / 286 confirm |
| Akhand Kirtan | 12 | 443 | 94 (21%) | 7 | 1.6% | 0.6 min | 0 / 7 |
| Sung Bani | 10 | 223 | 48 (22%) | 3 | 1.3% | 0.2 min | 1 new (4 s) / 2 |
| Paath | 5 | 75 | 9 (12%) | 0 | 0% | 0 | 0 / 0 |
| **All** | **85** | **2,866** | **1,227 (43%)** | **299** | **10.4%** | **38.5 min** | **4 new / 295 confirm** |

- 928 spans had all 3 checkers name the same pangti but missed **only** the 0.95 confidence bar. These are the best
  pile for a quick human pass.
- Batch 5 (15 Kirtan recordings, 909 spans) has votes from only 2 checkers. Under the rule it is undecided, so it
  is not in the table.
- 288 of the 299 accepted labels are tier A, where both aligners already agreed. Of the 1,500 candidates the key did
  not already have, the checkers accepted just 2. (The other 2 new rows covered spans where the key's own row was
  below the 0.6 scoring bar.)

## What the benchmark looks like after

Pangti level, using the owner's rule. "Passing" = a recording whose scored pangti spans cover at least 60% of its
keyed time. "Sung hours keyed" = scored pangti time over every recording with a key and a saved replay.

| form of Guru's Bani | recordings passing 60% | sung hours keyed (all) | scored hours in the benchmark |
|---|---|---|---|
| Kirtan | 7 of 107 -> 7 | 4.254 -> 4.261 | 0.242 -> 0.242 |
| Paath | 40 of 45 -> 40 | 0.323 -> 0.323 | 0.302 -> 0.302 |
| Sung Bani | 28 of 45 -> **29** (aa05: 58.7% -> 60.0%) | 0.887 -> 0.889 | 0.783 -> **0.833** |
| Sehaj / Akhand Paath | 8 of 8 -> 8 | 1.043 -> 1.043 | 1.043 -> 1.043 |
| Akhand Kirtan | 5 of 24 -> 5 | 0.513 -> 0.513 | 0.230 -> 0.230 |
| Karanbir v1 | 12 of 12 -> 12 | 0.779 -> 0.779 | 0.779 -> 0.779 |

Right pangti % (before -> after):

| form of Guru's Bani | 9.0.5 | 10.0.4 | 10.0.5 | 9.0.8 (upstream experimental) |
|---|---|---|---|---|
| Kirtan | 87.7 -> 87.7 | 87.7 -> 87.7 | 87.7 -> 87.7 | 87.7 -> 87.7 |
| Paath | 94.6 -> 94.6 | 94.6 -> 94.6 | 94.6 -> 94.6 | 94.6 -> 94.6 |
| Sung Bani | 80.2 -> 79.4 | 82.4 -> 81.4 | 82.3 -> 81.3 | 80.2 -> 79.4 |
| Sehaj / Akhand Paath | 95.8 -> 95.8 | 95.9 -> 95.9 | 95.8 -> 95.8 | 97.5 -> 97.5 (5 of 8 scored ⚠️) |
| Akhand Kirtan | 91.8 -> 91.8 | 92.8 -> 92.8 | 92.7 -> 92.7 | 91.8 -> 91.8 |
| Karanbir v1 | 88.3 -> 88.3 | 88.3 -> 88.3 | 88.3 -> 88.3 | 88.3 -> 88.3 |

Sung Bani drops about 1 point in every build. No build got worse: the drop comes from the set gaining aa05, an Aarti
recording where every build scores 67.2%. The ranking between builds stays the same (10.0.4 ≈ 10.0.5 > 9.0.5 =
9.0.8). The 9.0.8 Sehaj / Akhand Paath result covers only 5 of its 8 recordings, because 3 recordings miss the
model-output cache.

## Caveats

- **Not human.** The basis is `aligned-3check`: machine timing that 3 automated checks confirmed. Headline numbers
  should still rest on human labels; these rows are tagged so that they can be filtered out.
- **Checker bias toward audio the model hears well.** All three checkers look at what the speech model heard, so a
  pangti the model hears clearly gets accepted, and a pangti it hears badly (Akhand Kirtan, Aarti, alaap) does not.
  Accepted labels are therefore concentrated where Voice Autopilot already does well. Kirtan is 13.6% accepted;
  Akhand Kirtan, Sung Bani and Paath are 0-2%. For that reason they should not be used to "prove" gains on hard audio.
- **The timing is the aligner's.** The checkers confirmed the pangti, not the exact start. Start times are within
  about 1 s for tier A.
- **Flagged recordings stay with a person:** clip17 and clip12 (which Shabad is sung where), and rows in aa27, rn67,
  rn14, rn09 and rn80 where the key and the alignment disagree.

## Files

- `labels/keys-final/`: the merged keys in the HF layout (`<folder>/<id>/lines.csv` + `shabads.csv`), the updated
  `manifest.csv`, `confirmed-3check.csv` (the 295 confirmations) and `merge-report.json`. Made by
  `labels/tools/merge-keys.py`.
- `timeline-pangti-v2/`: the viewer timelines for 9.0.5, 10.0.4, 10.0.5 and 9.0.8 with these keys, plus
  `rescore-report.json`.
- `labels/UPLOAD-PLAN.md`: what would go to the dataset and the Spaces, with the exact commands (not run).
