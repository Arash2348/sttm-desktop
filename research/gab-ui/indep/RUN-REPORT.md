# Independent pangti keys: full run and re-score (2026-10-23)

**What was done.** The independent labeller ran over every non-test GAB recording that has a human Shabad-level key,
or a broadcast-caption key for Sehaj / Akhand Paath, and has audio on this Mac. The labeller is Meta MMS_FA plus
MMS-1B-all with the Punjabi adapter, and it keeps a second only when both models name the same pangti. The order was
Paath, Kirtan, Akhand Kirtan, then Sung Bani.

Settings were frozen as in FEASIBILITY.md: blank penalty 3, partial −10, any-jump −10. The confidence bar was 0.95 for
Paath, 0.99 for Kirtan and Akhand Kirtan, and 0.99 for Sung Bani, which is marked unproven. The app's speech model,
its caches, the aligned-2model output and the checker votes were not used anywhere.

Builds 9.0.5, 10.0.4, 10.0.5 and 9.0.8 were then re-scored at pangti level. The only keys used were these independent
keys plus the existing human and broadcast-caption keys. The same 60% coverage rule as before was applied.

## Labels per form

"Labelled" means seconds inside an accepted span, i.e. sung or read time with a pangti named. "≥ 60%" means the
recording's spans cover at least 60% of its human-keyed Shabad time.

| Form | Recordings labelled | Audio h | Keyed h | Labelled h | Share of keyed | Recordings ≥ 60% | Rows |
|---|---|---|---|---|---|---|---|
| Paath | 53 | 2.02 | 1.46 | 0.97 | 67% | 38 | 1,224 |
| – Banis read (Japji, Jaap, Rehras, Sohila, Anand, Chaupai, Tav Prasad Savaiye) | 45 | | 0.38 | 0.23 | 61% | 30 | |
| – Sehaj / Akhand Paath (broadcast-caption key; scoring keeps the caption key) | 8 | | 1.08 | 0.75 | 69% | 8 | |
| Kirtan (main) | 129 | 16.65 | 15.07 | 8.23 | 55% | 66 | 1,905 |
| – of which already human pangti-keyed (Fremont, kept as human) | 20 | | 2.61 | 0.77 | 29% | 5 | |
| Akhand Kirtan | 24 | 1.71 | 1.54 | 0.66 | 43% | 6 | 294 |
| Sung Bani (**unproven**) | 51 | 2.19 | 1.78 | 0.75 | 42% | 16 | 547 |
| **Total** | **257** | **22.57** | **19.85** | **10.61** | 53% | 126 | 3,970 |

**Database check** (`labels/tools/validate-banidb.py`). 3,978 spans went in and 3,970 were kept. The 8 that were
dropped were never edited. All 8 are Sehaj Paath spans (ytap_q_dwf8 ×7, ytap_5N6C ×1) where the pangti belongs to the
next keyed Shabad of the Ang range, just outside the ±3 s window.

**Sanity check against human or caption keys** (same frozen settings; these keys were read only for this check):

| Set | Precision (±2 s) | Span precision | Coverage |
|---|---|---|---|
| Sehaj Paath, 8 recordings, thr 0.95 | 100.0% | 100% (913 spans, LB 99.6%) | 71% |
| Fremont Kirtan train+dev, 20 recordings, thr 0.99 | 98.5% | 99.5% (214 spans, LB 97.4%) | 29.5% |
| kh23 Aarti, thr 0.99 | 100% | 100% (40 spans, LB 91%) | 73% |

These match FEASIBILITY.md. Akhand Kirtan and Banis-read Paath have no human pangti key, so their precision is not
measured. The Banis use the same Paath method, with candidates taken in the Bani's own database order.

## Re-score: right pangti % per build (`timeline-indep/`)

| Set (key) | Recordings scored | Scored pangti h | 9.0.5 | 10.0.4 | 10.0.5 | 9.0.8 |
|---|---|---|---|---|---|---|
| Paath, Banis read (indep) | 30 / 45 | 0.18 | 98.3 | 98.3 | 98.3 | 98.3 |
| Sehaj / Akhand Paath (caption) | 8 / 8 (9.0.8: 5 ‡) | 1.08 | 95.8 | 95.9 | 95.8 | 97.5 ‡ |
| Kirtan main (indep + 20 human) | 61 / 107 † | 5.04 | 89.5 | 90.2 † | 89.5 | 89.5 |
| Akhand Kirtan (indep) | 6 / 24 | 0.29 | 75.1 | 75.2 | 75.1 | 75.1 |
| Sung Bani (indep, **unproven**) | 16 / 45 | 0.23 | 80.5 | 80.5 | 80.5 | 80.5 |
| Karanbir v1 (human, unchanged) | 12 / 12 | 0.78 | 88.3 | 88.3 | 88.3 | 88.3 |

† The build clip lists differ slightly: 9.0.5 scores 62 recordings, 10.0.4 scores 60 and 10.0.5 scores 61. 9.0.8 uses
the 10.0.5 list. gab-quick's own 10.0.5 baseline reproduces 89.5.

‡ 9.0.8 has a cache miss on 3 Sehaj Paath recordings (ytap_PB6n_x1.35, ytap_q_dwf8, ytap_q_dwf8_x1.35), the same as
in the v3 run. On the 5 recordings both builds scored, 9.0.8 gets 97.5 against 97.4 for 10.0.5.

**Compared with the current viewer** (site/timeline: pre-upload keys including aligned-2model):

- Kirtan: 7 → 61 recordings and 0.25 → 5.04 scored h. Right pangti 87.7 → 89.5 (10.0.4 is 90.2).
- Paath (Banis): 40 → 30 recordings, 94.6 → 98.3.
- Sung Bani: 11 → 16 recordings, 90.7 → 80.5.
- Akhand Kirtan: 5 → 6 recordings, about 92 → 75.

The four builds are within 0.7 points of each other on every set.

**Where to look first:**

- **Akhand Kirtan.** l3clip16 (16% right, 97 s on another Shabad) pulls the Akhand Kirtan number down.
- **Sung Bani.** aa23 (1% right, 68 s blank screen) does the same for Sung Bani.
- Both are worth a person checking the Shabad key against the screen before anyone reads too much into the drop.

## Skipped or not scored

- **Held-out test split:** no labels were made or exported for it, and nothing from it is in keys/ or timeline-indep/. Correction (audit): the earlier feasibility stage ran the models on 4 Sehaj Paath recordings that the HF manifest marks as test (ytap_-1yA1ufOku0_2000-2600, ytap_DDHRQqbEnyo_1200-1800, ytap_OrG2-IsMDfg_1500-2100, ytap_cKpg64jaTAo_1200-1800) because the local manifest listed them as train/dev; the FEASIBILITY Paath row was measured partly on them. No thresholds were tuned on Paath, and their files have been deleted from out/.
- **No human Shabad key file and no local audio (44).** 29 Kirtan YouTube broadcast-caption recordings (ytgr_* ×14,
  ytraji_* ×15). 15 Sung Bani recordings: ytaarti_807iTL4sFwM ×2, ytasa_zBJgPM2uR0Y ×9 (Asa di Vaar),
  ytrehras_g0RkPeycOCU ×3 and ytsalokm9_QjnT83rU4so ×1. Wherever a broadcast-caption key exists, it is still used in
  scoring.
- **kh16 (Asa di Vaar, Akhand Kirtan): audio missing on this Mac.** It is not in this snapshot's keys either.
- **sp01, sp02, sp03 (Sehaj Paath):** the human key lists the Ang-range Shabads without start or end times, so there is
  no keyed time to label or score.
- **Karanbir v1 (12):** a separate set that already has human pangti keys, so it was not labelled.
- **Left out of scoring:** rt11_rehras, rt11_aarti, rt11_sohila and ytasa1_4IXk2t_Irqo_900-1620. The replay tools
  (sangat-score.js ALIGN_OVERRIDE) swap in a saved app-model alignment for these ids. ytasa1 was labelled, and its keys
  are in `keys/`.
- Recordings below 60% coverage are dropped by the usual rule: Kirtan 46, Paath 15, Akhand Kirtan 17 and Sung Bani 24.
  12 labelled recordings have no accepted span (0 rows): Sung Bani aa17-aa22, pt37, pt41, pt42, pt46, and Kirtan kh24, kh30 (their human key is kept in scoring).

## Run time (Mac, nice 19, 4 threads, one job at a time)

| Form | MMS_FA emissions | MMS-1B emissions | HMM ×2 + agree | Total |
|---|---|---|---|---|
| Paath (2.02 h audio) | 16 min combined with MMS-1B | (included) | 28 min | 45 min |
| Kirtan (16.65 h) | 28 min | 117 min | 23 min | 2 h 48 min |
| Akhand Kirtan (1.71 h) | 7 min | 14 min | 19 min | 40 min |
| Sung Bani (2.19 h) | 8 min | 18 min | 32 min | 58 min |
| Export + BaniDB check | | | | 1 min |
| Re-score (pangti-timeline + gab-quick 9.0.8 with 10.0.5 baseline, replays only) | | | | 6 min |
| **Total** | | | | **about 5 h 20 min** |

Disk used: emissions 1.0 GB in `out/` (git-ignored, kept for re-runs) and keys 2.2 MB. Replay scratch in quick-out was
deleted.

## Files

- `keys/<content_folder>/<id>/lines.csv` holds `verseId,start_s,end_s,confidence,source=indep-mms2-agree`.
  Confidence is the lowest second in the span.
- `keys/<content_folder>/<id>/shabads.csv` is a byte copy of the human or caption Shabad key.
- `keys/manifest.csv` has the HF manifest rows with `lines_source=indep-mms2-agree` and `indep_form`, `indep_thr` and
  `indep_status`.
- Scripts:
  - `jobs.py`: the recording list and skips.
  - `bani_dump.js`: ordered Bani pangtis from the STTM database.
  - `full-run.sh`: the labelling run.
  - `export.py`: spans, the database check and the stats.
  - `overlay.py`: the scoring copy `gen/indep-ds`, with human, caption and indep keys only.
  - `rescore.sh`: the re-score.
  - `report_tables.py`: the tables in this report.
- `label.py` has two small changes: it takes the job list, and a Bani keeps its own pangti order. `validate-banidb.py`
  gained `--in` / `--report`, and its defaults are unchanged. `labels/bani-verse-cache.json` gained 6 Banis.
- Outputs:
  - `../timeline-indep/`: viewer JSON for 4 builds × 6 sets, `index.json` (four-build tiers) and
    `rescore-report.json`.
  - `out/validation-report.json`, `out/export-stats.json` and `out/gab-quick-908-report.md`.
- MMS checkpoints are CC-BY-NC 4.0, which is fine for Khalis Foundation's non-commercial benchmark labels.
- Nothing was uploaded to Hugging Face.
