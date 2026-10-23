# Pangti labels with the calibrated 3-checker rule: overview (2026-10-23)

**In short:** all six overnight batches were re-merged with the calibrated rule. For Kirtan, 1,384 pangti labels of
Guru's Bani are now accepted (up from 289). Of these, 160 are new to the answer key (30 sung minutes) and 1,148
confirm pangti timings the key already had. 12 more Kirtan recordings now reach the 60% coverage bar, so the scored
Kirtan set grows from 7 to 19 recordings (0.25 -> 1.02 scored hours). Every label passed a database check: the
verseId exists in BaniDB or the STTM Gurbani database, it belongs to the Shabad / Bani keyed at that time, and any
stored text equals the database text exactly. No row failed, so none was dropped. No existing key row was changed.
Nothing has been uploaded (`labels/UPLOAD-PLAN.md` waits for your sign-off).

## The rule

| form of Guru's Bani | rule used | why |
|---|---|---|
| Kirtan | **calibrated**: all 3 checkers name the candidate pangti, aligner tier A/B/C (not D), no key mismatch, no confidence bar | measured on human pangti keys: 57 of 58 right (98.3%, 95% lower bound 90.9%) |
| Akhand Kirtan, Paath, Sung Bani | **strict**: all 3 name the candidate pangti, each confidence ≥ 0.95 | the calibrated rule was not measured on these forms (`calibrated-rule.json` scope) |

A span where the checkers name different pangtis is never accepted. Each Kirtan label carries basis
`aligned-3check-calibrated` and a per-span score, which is the measured right-pangti rate for its tier: A 1.000
(31/31), C 0.963 (26/27), and B 0.983 (pooled A/B/C, because the calibration set had no tier B span). In the key's
`confidence` column, Kirtan rows hold this score and strict rows hold the lowest checker confidence.

## Labels per form of Guru's Bani

| form of Guru's Bani | spans checked (recordings) | all 3 named the same pangti | accepted (sung min) | new to the key / confirm existing |
|---|---|---|---|---|
| Kirtan | 3,034 (58) | 1,468 (48%) | **1,384** (180.9) | **160 (30.0 min)** / 1,148 |
| Akhand Kirtan | 443 (12) | 94 (21%) | 7 (0.6) | 0 / 7 |
| Sung Bani | 223 (10) | 48 (22%) | 3 (0.2) | 1 (4 s) / 2 |
| Paath | 75 (5) | 9 (12%) | 0 | 0 / 0 |

- The accepted Kirtan labels by tier are A 1,179, C 196 and B 9.
- Batch 5 now has all 3 checkers' votes and contributes 359 Kirtan labels.
- Merge: 2 labels touch the neighbouring pangti's existing row by 1-3 s (clip41, rn63) and 74 overlap another
  accepted label (mostly the same pangti found once by each aligner). In each case the existing or first row was kept.
  No human row was touched.
- Under the calibrated rule, Akhand Kirtan would have added 94 labels and Paath / Sung Bani 50. These were **not**
  accepted, because the rule is unmeasured on those forms.

## What the benchmark looks like after

"Before" = the strict-rule keys (`timeline-pangti-v2`). "After" = these keys (`timeline-pangti-v3`). A recording is
scored when its pangti spans cover ≥ 60% of its keyed time. Scored hours = seconds where a pangti is being sung or
read (10.0.5).

| form of Guru's Bani | recordings scored | scored hours | newly passing 60% |
|---|---|---|---|
| Kirtan | 7 -> **19** | 0.246 -> **1.015** | clip06, clip07, clip13, clip17 ⚠️, clip18, clip19, clip28, clip41, rn10, rn52, rn61, rn80 |
| Paath | 40 -> 40 | 0.313 -> 0.313 | none |
| Sung Bani | 29 -> 29 | 0.849 -> 0.849 | none (aa05 already joined with the strict rule) |
| Sehaj / Akhand Paath | 8 -> 8 | 1.076 -> 1.076 | none |
| Akhand Kirtan | 5 -> 5 | 0.231 -> 0.231 | none |
| Karanbir v1 | 12 -> 12 | 0.777 -> 0.777 | none |
| **All** | 101 -> **113** | 3.49 -> **4.26** | 12 |

Right pangti % (before -> after):

| form of Guru's Bani | 9.0.5 | 10.0.4 | 10.0.5 | 9.0.8 |
|---|---|---|---|---|
| Kirtan | 87.7 -> **89.9** | 87.7 -> **89.6** (18 rec.) | 87.7 -> **89.9** | 87.7 -> **89.9** |
| Paath | 94.6 | 94.6 | 94.6 | 94.6 |
| Sung Bani | 79.4 | 81.4 | 81.3 | 79.4 |
| Sehaj / Akhand Paath | 95.8 | 95.9 | 95.8 | 97.5 (5 of 8 ⚠️) |
| Akhand Kirtan | 91.8 | 92.8 | 92.7 | 91.8 |
| Karanbir v1 | 88.3 | 88.3 | 88.3 | 88.3 |

Only Kirtan changes. The 4 builds score almost the same on the larger Kirtan set: 10.0.4 lacks a replay for one
recording, and 9.0.8 differs from 10.0.5 on one recording only. Most new recordings score 91-97%. The exceptions are
rn61 (61%: Kirtan of the Mool Mantar, whose pangtis appear in many Banis) and rn10 (80%). For 9.0.8, Sehaj / Akhand
Paath covers 5 of 8 recordings because 3 miss the model-output cache.

## Caveats

- **Measured precision is thin and covers Kirtan only.** The 98.3% (57/58) comes from 20 Fremont hall recordings.
  Its 95% interval is 90.9-99.7%, so somewhere between about 4 and 126 of the 1,384 Kirtan labels may be wrong (about
  24 at the point estimate). Tier B (9 labels) was not measured. Tier C (196) rests on 27 spans.
- **Not human.** These are machine timings confirmed by 3 automated checks, tagged so they can be filtered out. The
  headline numbers should still rest on human labels.
- **Checker bias toward audio the model hears well.** All 3 checkers use what the speech model heard. They agree on
  48% of Kirtan spans, 21-22% for Akhand Kirtan and Sung Bani, 12% for Paath, and only 7% on the Fremont calibration
  audio. So accepted labels cluster where Voice Autopilot already does well (most new recordings score 91-97%). The
  bigger Kirtan set is easier than real hall Kirtan and should not be used to prove gains on hard audio.
- **The timing is the aligner's.** The checkers confirm the pangti, not the exact start.
- **Recordings that need a person:** clip17 ⚠️ (now scored) is keyed as Shabad 3085 for 30-1000 s, but checker 3
  heard other Shabads from about 440 s. All its accepted labels are before 435 s, but the key window after that should
  be fixed. clip12 (two possible Shabads in one window; not scored) and aa27 / rn67 / rn14 / rn09 / rn80 (key and
  alignment disagree in places) also need a person. Their key-mismatch rows were never eligible.
- **Database:** 1,391 labels match BaniDB text exactly. Three Sung Bani (Aarti) labels use the STTM database's own Bani
  verseIds, which BaniDB does not list, and their text matches the STTM database exactly.

## Files

- `accepted/batch1-6.json` (`tools/merge-votes.py batchN --rule=calibrated`), `remerge/batchN.json` (counts),
  `remerge/validation-report.json` (`tools/validate-banidb.py`; BaniDB responses cached in `../verse-cache.json`).
- `keys-final/`: the merged keys in the HF layout for 39 recordings, `manifest.csv`, `confirmed-3check.csv` (1,157
  confirmations), and `merge-report.json` (conflicts listed). Made by `tools/merge-keys.py`.
- `../timeline-pangti-v3/`: viewer timelines for 9.0.5, 10.0.4, 10.0.5 and 9.0.8 with these keys, plus
  `rescore-report.json`. The 9.0.8 timelines come from `gab-quick f475fd9a --keys-cache gen/gab-cache-v3 --set all`.
