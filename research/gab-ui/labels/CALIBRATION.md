# Calibrating the 3-checker rule against human pangti keys (2026-10-23)

**In short:** we tested the three checkers on spans whose pangti a person already confirmed, without letting them see
that answer. When all 3 checkers named the candidate's pangti, the candidate was right 62 times out of 64 (96.9%).
Leaving out tier D spans (where the two aligners put different pangtis at the same time) gave 57 right out of 58
(98.3%). The 0.95 confidence bar did not help. It kept just 1 of those 64 spans and did not separate right spans from
wrong ones. The proposed rule is: **all 3 checkers name the candidate pangti, and the aligner tier is A, B or C (not
D). There is no confidence bar.** Measured precision is **98.3% (57 of 58), with a 95% lower bound of 90.9%.**

**Not met:** we wanted a lower bound of at least 93% and at least 200 accepted spans. No rule reaches that, because
the human keys yield only 64 spans where all 3 checkers agree. The data is thin. The measurement covers Kirtan only
(Fremont hall audio). Nothing is merged or uploaded. The owner signs off first.

## What was measured

| step | what | output |
|---|---|---|
| calibration set | the 20 GAB-Hard / Fremont Kirtan recordings with a human pangti key (the sevadaar's screen, `source=human`) that are not in the held-out test split: kh11-15, kh17-22, kh24-32 | |
| candidates | `make-candidates.py --calib`: the same tool and the same saved two-model alignment (cloud run 2026-10-15) as batches 1-6. Each candidate keeps the verseId the aligner proposed, so wrong candidates are included. 897 spans (A 162, B 107, C 349, D 279) | `candidates/calib-gabhard.json` |
| blind | the tools read a key copy that has `shabads.csv` only (Shabad windows) and an empty `lines.csv`. No checker saw the human pangti key (checker 3 reads it through the new `KEYDIR` override) | |
| checker 1 | `checker1/decode1.py` + `vote.py calib-gabhard` (unchanged) | `votes/calib-gabhard-checker1.json` |
| checker 2 | fresh app-model emissions (`emis2.js karanbir`, int8, nice 19), `checker2/identify.py` + `decide.py` (unchanged) | `votes/calib-gabhard-checker2.json` |
| checker 3 | `checker3/decode.py` (x86 q16 cache) + `vote6.py calib-gabhard` (same as batch 6) | `votes/calib-gabhard-checker3.json` |
| scoring | `tools/calibrate.py` | `calibration-results.json`, `calibration-spans.json`, `calibrated-rule.json` |

**What counts as the right pangti:** the pangti the human screen showed for most of the span, after shifting the
span 2 s later. That shift allows for the sevadaar changing the screen a moment after the ragi starts the line. At
least half of the span must be covered. Two pangtis with the same Gurbani text count as one. 891 of the 897 spans
have a known answer. As checks, precision is also reported with no shift (lag 0), a 3 s shift, and a lenient match
(the candidate's pangti shown anywhere from 1 s before the span to 4 s after it).

**Karanbir v1 is not used.** There is no saved two-model alignment for it, the second model (Surinder's) is not on
this Mac, and checkers 1 and 3 set their confidence levels on its windows, so it would not be an independent test.
The human-keyed Fremont Asa di Vaar (kh16) and Aarti (kh23) have no saved alignment, so they are not used either.

## How right the candidates are before any checker (human truth, n = 891)

| aligner tier | right / known | precision |
|---|---|---|
| A (both models, same pangti, start within 1 s) | 160 / 162 | 98.8% |
| B | 67 / 105 | 63.8% |
| C (one model) | 228 / 347 | 65.7% |
| D (the models disagree) | 99 / 277 | 35.7% |

How many checkers named the candidate's pangti: none 581 (43.8% right), one 195 (94.9%), two 57 (96.5%), all three
64 (96.9%). On this hall audio the checkers often hear too little to name any pangti. Checker 1 agreed on 82 spans,
checker 2 on 273 and checker 3 on 146. Each checker reached ≥ 0.95 on only 41, 3 and 31 spans.

## Rules compared (all require the 3 checkers to name the candidate pangti)

Precision = right / accepted spans that have a human answer. Lower = 95% Wilson lower bound. Yield = accepted / all
897 calibration spans.

| rule | accepted | precision | 95% lower | yield | lag 0 | lenient |
|---|---|---|---|---|---|---|
| all 3 agree, no confidence bar | 64 | 96.9% | 89.3% | 7.1% | 93.8% | 100% |
| **all 3 agree, tier A/B/C (chosen)** | **58** | **98.3%** | **90.9%** | **6.5%** | 94.8% | 100% |
| all 3 agree, tier A (B adds none) | 31 | 100% | 89.0% | 3.5% | 96.8% | 100% |
| all 3 agree, min confidence ≥ 0.80 | 32 | 96.9% | 84.3% | 3.6% | 96.9% | 100% |
| all 3 agree, min confidence ≥ 0.85 | 16 | 93.8% | 71.7% | 1.8% | 93.8% | 100% |
| all 3 agree, min confidence ≥ 0.90 | 4 | 100% | 51.0% | 0.4% | 100% | 100% |
| all 3 agree, min confidence ≥ 0.95 (overnight rule) | 1 | 100% | 20.7% | 0.1% | 100% | 100% |
| all 3 agree, mean confidence ≥ 0.85 | 36 | 97.2% | 85.8% | 4.0% | 91.7% | 100% |
| all 3 agree, mean confidence ≥ 0.90 | 20 | 95.0% | 76.4% | 2.2% | 95.0% | 100% |
| all 3 agree, product of confidences ≥ 0.70 | 22 | 95.5% | 78.2% | 2.5% | 95.5% | 100% |
| all 3 agree, two ≥ 0.95 and the third ≥ 0.85 | 9 | 100% | 70.1% | 1.0% | 100% | 100% |
| all 3 agree, logistic score ≥ 0.97 (leave-one-recording-out) | 43 | 95.3% | 84.5% | 4.8% | 90.7% | 100% |

Every rule is in `calibration-results.json`. The logistic score combined the 3 confidences, the tier and the aligner
score. Fitted on all spans, every confidence weight is close to 0 and only tier A carries weight. So among spans
where all 3 checkers agree, confidence does not predict whether the pangti is right.

**Both wrong spans are long** (34 s and 19 s), and in both the human screen shows the candidate's pangti right next
to the span. That is why the lenient match scores 100%. Both are counted as wrong. One of them is tier D (kh20,
173-207 s: the candidate names 48691, the screen shows 48689). The other is tier C (kh31, 51-70 s: the candidate
names 7849, the screen shows 7847 until 67 s).

**Why tier D is left out:** when the two aligners put different pangtis at the same time, the candidate is right only
36% of the time (table above). Dropping tier D costs 6 of the 64 agreeing spans and removes 1 of the 2 errors. This
follows from the prior, so it is not a fit to the two errors.

### Reference only: these do not meet the owner's rule

Here, "no checker names a different pangti" means each checker either named the candidate's pangti or heard nothing.

| rule | accepted | precision | 95% lower | yield |
|---|---|---|---|---|
| no checker names a different pangti, ≥ 1 names the candidate | 178 | 95.5% | 91.4% | 19.8% |
| same, tier A/B/C | 165 | 97.0% | 93.1% | 18.4% |
| same, ≥ 2 name the candidate, tier A/B/C | 74 | 98.6% | 92.7% | 8.3% |
| aligner tier A alone, no checker | 162 | 98.8% | 95.6% | 18.1% |

These rules do reach a lower bound near 93%, and they have up to 3 times the yield. But they count "this checker
heard nothing" as agreement, which the owner's rule does not allow. They are listed only for the owner to weigh.

## What the chosen rule would do on the overnight batches (not applied; `accepted/` unchanged)

| batch | form | spans | all 3 agree | overnight rule (≥ 0.95 each) | chosen rule | chosen, new to the key | chosen, sung minutes |
|---|---|---|---|---|---|---|---|
| 1 | Kirtan | 500 | 303 | 88 | 294 | 20 | 40.0 |
| 2 | Kirtan | 948 | 504 | 154 | 484 | 63 | 64.4 |
| 3 | Akhand Kirtan | 443 | 94 | 7 | 94 ⚠️ | 28 | 13.9 |
| 4 | Paath + Sung Bani | 298 | 57 | 3 | 50 ⚠️ | 4 | 4.7 |
| 5 | Kirtan (3 checkers now) | 909 | 392 | 87 | 359 | 70 | 47.8 |
| 6 | Kirtan | 677 | 269 | 47 | 247 | 52 | 40.5 |

⚠️ These forms of Guru's Bani are not measured. Akhand Kirtan, Paath and Sung Bani have no human pangti keys
outside the test split, so `calibrated-rule.json` limits the rule to Kirtan. For the other forms, keep the strict
rule or send the spans to a person.

## Batch 5, checker 2 (done)

Same method as batch 6: fresh app-model emissions for the 8 missing recordings (clip03, rn12, rn67, clip20, clip36,
rn71, rn31, clip12; int8, nice 19), then `identify.py` and `decide.py` with `BATCH=batch5`. The node process crashes
on exit (libc++ mutex) after it has written the full output. That is probably why the overnight run stopped. Two
files had to be renamed from `.tmp` after a size check (frames x 257 x 4 bytes). Results: 909 spans, 473 agree,
124 approved (agree and ≥ 0.95, all tier A), 583 fail the timing or overlap check. Output:
`votes/batch5-checker2.json`. With all 3 checkers, batch 5 has 392 all-agree spans, and 87 pass the overnight rule.

## Caveats

- **Thin data:** 64 agreeing spans, 2 errors, 20 recordings from one Gurdwara Sahib. The 95% interval for the chosen
  rule is 90.9-99.7%.
- **The human screen lags:** the sevadaar switches the screen late, and sometimes skips a quick return to the asthai.
  With no lag shift, the chosen rule measures 94.8%.
- **Different audio:** Fremont recordings are heard much less well than the overnight Kirtan batches (all 3 agree on
  7% of spans here, against 40-55% there). Confidences are lower here, which is part of why the 0.95 bar fails.
- **Text:** every label keeps the database text for its verseId. Nothing is taken from model output.
