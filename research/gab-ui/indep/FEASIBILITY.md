# Independent pangti timings for GAB: feasibility test (2026-10-23)

**Question.** Can we produce trustworthy pangti-level timings for GAB recordings without the app's speech model in
any form? That rules out Karanbir's IndicConformer, its cached hearing, the aligned-2model output and the overnight
checker votes.

**Answer.**

| Form | Works? | Precision on what it labels (±2 s) | Coverage of keyed time | Evidence |
|---|---|---|---|---|
| Paath (read) | ✅ yes | 100.0% (Wilson 95% LB 99.9% per second, 99.6% per span) | 72% (98% with no threshold, at 99.9%) | 8 Sehaj Paath clips, 1.2 h, 954 spans |
| Kirtan | ✅ yes, partial coverage | 97.4% at thr 0.95 (span LB 93.7%); 98.9% at thr 0.99 (span LB 96.5%) | 51% / 45% | held-out: 11 Fremont dev + 4 Karanbir v1, 1.6 h |
| Sung Bani | ⚠️ promising, not proven | 100% (span LB 91%) | 82% | only 1 recording (Fremont Aarti, 5 min) |

For Kirtan, 95% precision holds only when two independent models agree. Either model on its own reaches 77–87%.
Recommended operating point: thr 0.99 for Kirtan, 0.95 for Paath.

## Method (code in this folder)

1. `emit.py`: frame log-probabilities (50 frames/s) from **Meta MMS_FA**, the public torchaudio forced-alignment
   model trained on generic multilingual read speech, using the uroman alphabet.
   `emit_mms1b.py`: the same from **Meta MMS-1B-all + Punjabi adapter** (`facebook/mms-1b-all@3d33597`), which
   uses Gurmukhi letters. Both come only from official hubs (download.pytorch.org / dl.fbaipublicfiles and
   huggingface.co). Weights are in `models/` and are git-ignored.
2. `hmm.py`: a frame-level HMM. Each candidate pangti is a CTC chain; there is also one filler state (alaap,
   music, talk). It can enter or leave a pangti at its start/end at no cost, or at a word boundary at a penalty,
   so half-pangtis are allowed and no word is ever cut. Moves between pangtis: repeat, next, back to rahao, any
   other pangti, or filler. Kirtan is not treated as monotonic. Forward-backward gives each pangti's probability
   per second.
3. `label.py`: picks the candidates.
   - Kirtan / Sung Bani: the pangtis of the Shabad named by the human Shabad-level key. Display-only headings
     such as "ਧਨਾਸਰੀ ਮਹਲਾ ੪ ॥" are left out because they are not sung.
   - Paath: every pangti of the clip's Ang range, with a sequential prior.

   Text comes only from the STTM database corpus, looked up by verseId. It is romanised internally for scoring
   only. Labels are verseIds, and no Gurbani text is written or changed. Human `lines.csv` is read only by `eval`.
4. `label.py combine`: keeps a second only when both models name the same pangti. Confidence = the lower of the
   two.

**Tuning.** All parameters were tuned on Kirtan **train** only: 9 Fremont recordings. The values are blank
penalty 3, partial-entry −10, any-jump −10, and the same for both models. Dev, Karanbir v1, Paath and Sung Bani
were run once with those frozen values. The test split was never read.

## Numbers (frozen parameters)

Precision allows ±2 s against the human key; "exact" means the same second. The per-second Wilson bound is
optimistic because neighbouring seconds are correlated. The per-span bound is the honest one.

| Set | Model | thr | Coverage | Precision | Exact | Span precision (n) | Span 95% LB | Median boundary error |
|---|---|---|---|---|---|---|---|---|
| Kirtan held-out (dev+kbv1) | MMS_FA | 0.95 | 79% | 77.1% | 74.5% | 81.8% (192) | 75.7% | 3 s |
| Kirtan held-out | MMS-1B pan | 0.95 | 75% | 87.2% | 84.8% | 85.3% (197) | 79.7% | 2 s |
| Kirtan held-out | **agree** | 0.95 | **51%** | **97.4%** | 94.7% | 97.5% (160) | 93.7% | 2 s |
| Kirtan held-out | **agree** | 0.99 | **45%** | **98.9%** | 96.4% | 99.4% (156) | 96.5% | 2 s |
| – of which Karanbir v1 (4) | agree | 0.95 | 81% | 100% | 100% | 100% (58) | 93.8% | 0 s |
| – of which Fremont dev (11) | agree | 0.99 | 34% | 98.1% | 93.7% | 99.0% (98) | 94.4% | 2 s |
| Kirtan train (tuning set) | agree | 0.95 | 31% | 98.9% | 94.3% | 100% (129) | 97.1% | 1 s |
| Paath (8 Sehaj Paath clips) | agree | 0.95 | 72% | 100.0% | 99.9% | 100% (954) | 99.6% | 0 s |
| Paath | MMS_FA alone | 0.00 | 100% | 99.6% | 93.2% | 98.6% (970) | 97.6% | 0 s |
| Sung Bani (Aarti kh23) | agree | 0.95 | 82% | 100% | 94.1% | 100% (41) | 91.4% | 1 s |

What the numbers show:

- **Kirtan errors.** In Fremont dev, 43 of the 75 wrong seconds are within 3–10 s of the key's own change. Those
  are likely timing (the sevadaar's screen lags). The other 32 seconds name another pangti of the same Shabad.
  Karanbir v1 has no errors.
- **Kirtan coverage varies by recording,** from 0% to 92%. It is lowest on laptop-mic hall audio with long alaap,
  and on Bhai Gurdas Kabits (kh22). Most of the unlabelled time is held vowels, where neither model hears letters.
- **Paath is easy** for a generic read-speech model. Even one model with no threshold gets 99.6%.

## Run time (Mac, nice 19, 4 threads, one job)

| Step | Minutes per hour of audio |
|---|---|
| MMS_FA emissions | ~3 |
| MMS-1B pan emissions | ~7 |
| HMM, both models | ~1 for Kirtan, ~10 for Paath (more candidates) |
| **Total** | **~11 for Kirtan, ~20 for Paath** |

Emissions on disk: about 45 MB per hour of audio. Model weights: 1.2 GB + 3.6 GB.

## What a full overnight run needs

- **Time.** All ~20 h of GAB is about 4–5 h on the Mac, as one job at a time. No cloud is needed.
- **Shabad-level keys.** Every recording needs one. Recordings without one (most of the 1-kirtan-shabad "none"
  rows) need a human Shabad key first. The method assumes the Shabad is known.
- **Missing audio.** The kh16 (Asa di Vaar) audio is not on this Mac: the symlink target was deleted. Restore it
  before the full run. Sung Bani needs more human-keyed recordings before we can claim ≥95% there.
- **Export.** Spans (consecutive seconds with the same agreed verseId, conf ≥ thr) go to the HF `lines.csv`
  layout with `source=indep-mms-agree` and their confidence. Then run `validate-banidb.py`, and have a person
  spot-check a sample before anything is uploaded.

## Independence and caveats

- Neither model is the app's model, and nothing from its caches, alignments or votes is used.
- MMS pretraining includes VoxLingua-107 (YouTube clips). Overlap with these exact recordings is very unlikely,
  but it cannot be ruled out completely.
- Jaspal's and Surinder's models were not used.
- **License.** Both MMS checkpoints are **CC-BY-NC 4.0**. They are fine for Khalis Foundation's non-commercial
  benchmark labels, but this should be noted wherever the labels are published.
- **Paath truth** comes from broadcast captions (OCR). The Paath candidate list is the Ang range taken from the
  same caption key.
- **Thin evidence.** Sung Bani has one 5-minute recording. Kirtan held-out has 15 recordings from 2 sources.
