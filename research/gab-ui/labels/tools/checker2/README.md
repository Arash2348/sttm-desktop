# Checker 2 (label batch 1): how the votes were made

Independent of the aligner's output: fresh full-clip emissions of the app's speech model (`labels/tools/emis2.js karanbir`,
no Surinder ONNX is on this Mac, so the second model could not be used) decoded greedily into timed tokens.

Per candidate span, `identify.py`:
1. IDENTIFY: heard text in [start-0.3, end+0.3] is scored against every pangti of the keyed Shabad, every pangti any
   candidate in the recording names, and the top 25 pangtis of the whole corpus by a trigram search over the heard text.
   Score = how much of the heard text the pangti explains (greedy match of the pangti or a word-boundary prefix/suffix/
   half of it, repeated, blanked out; or plain ratio against the pangti sung 1-4 times). Also a free-boundary CTC forced
   alignment with repeats (explanatory gain over a garbage baseline), kept only as a second opinion on timing.
2. LENS B timing: heard tokens inside [start-6, end+6] (clipped 1.5 s into the neighbouring spans) whose 5/7-piece
   context matches the pangti form runs (gap <= 5 s, stray single end hits trimmed); the run overlapping the candidate
   is the best-fit span.

`decide.py`: my pangti = best score (keyed-Shabad pangtis get +4, +8 when they already score >= 80; identical texts in
other Shabads are the same identity; a near-duplicate one matra apart does not beat the keyed Shabad's copy); 'none'
(null) when little is heard, the heard text is Vaheguru simran / jaikara, or no pangti scores >= 45. Confidence: 0.97
needs score >= 80, margin >= 20 over the best pangti with different text, >= 70% of the pangti heard; 0.9 / 0.8 / 0.65
below that; a shared phrase resolved only by Shabad context is capped at 0.9. Timing: approvable only if the heard-token
fit is within 1.5 s (start) / 3.0 s (end) of the candidate and the span does not overlap a neighbour by > 1 s; a boundary
the same pangti continues across (repetition split into two spans, pause <= 3 s) is not an error. Timing failures cap
confidence at 0.85-0.9 (never approvable). Approved = agrees and confidence >= 0.95.

## Batch 2 (2026-10-23)

Same method, `BATCH=batch2` for both tools; fresh app-model emissions (`emis2.js karanbir`) for the 15 batch-2 Kirtan
recordings (the Surinder ONNX dirs under ~/AAI/models/surinder-kirtan are empty, so again no second model on this Mac;
the forced CTC alignment is therefore treated as non-independent and only the greedy heard-token fit decides timing).
Result: 948 spans, 197 approved (agree and confidence >= 0.95; all tier A), 251 agree but under the bar (timing off /
shared phrase / little heard), 284 identified as a different pangti, 51 'none' (alaap / simran / silence). Heard-token
timing within 1.5 s start / 3 s end for 59% of tier A, 46% B, 12% C, 17% D.

## Batch 3 (2026-10-23, Akhand Kirtan, folder 5)

Same method, `BATCH=batch3`; fresh app-model emissions (`emis2.js karanbir`, int8) for the 12 batch-3 recordings
(still no second model on this Mac: the Surinder ONNX dirs are empty and `indic-conformer-600m` uses another
vocabulary, so only the greedy heard-token fit decides timing; the forced alignment is a non-independent second opinion).
Result: 443 spans, 14 approved (agree and confidence >= 0.95; all tier A), 185 agree but under the bar (Akhand Kirtan
hearing is weaker: text match mostly 50-80, overlapping candidate spans, timing off), 178 identified as a different
pangti, 66 'none' (Vaheguru simran / alaap / silence). Heard-token timing within 1.5 s start / 3 s end for 47% of
tier A, 20% B, 13% C, 21% D. Candidate spans in this batch overlap each other often (10th percentile gap to the next
tier A span = -4.4 s), which alone blocks approval under the no-overlap rule.

## Batch 4 (2026-10-23, Paath folder 2 + Sung Bani folder 3)

Same method, `BATCH=batch4`; fresh app-model emissions (`emis2.js karanbir`, int8) for the 15 batch-4 recordings (still
no second model on this Mac). Two changes to the tools: `identify.py` reads `labels/bani-verse-cache.json` so a `bani:<id>`
key gives the Bani's pangtis (Japji 385, Jaap 808, Aarti 230), and with a pool over 48 pangtis the slow forced alignment
runs only for the 40 best text matches (+ near ties + the candidate's own pangti); `decide.py` takes the candidate's place
when the same words stand at several places of one Bani (Jaap Sahib) and caps that at 0.9 (reading order only).
Result: 298 spans, 6 approved (agree and confidence >= 0.95: pt34 74896, pt38 29924/29926, aa05 78280/75017, aa49 87332),
95 agree but under the bar, 144 a different pangti, 53 'none'. Paath (75): 1 approved, 27 agree under the bar: Jaap Sahib
pangtis are 2-4 words, the int8 model hears them only partly (text match 55-80, neighbours bleed into the +-0.3 s window)
and pt34 is read so fast that 15 spans have almost nothing heard; pt01 Japji rows are heard well (3, 4, 5 at 0.9) but the
heard-token fit disagrees with the span end. Sung Bani (223): 5 approved; candidate spans overlap each other heavily
(aa16-aa20, aa26, aa27: 10th percentile gap -5.2 s) and the Aarti alaap is long, so most rows fail the no-overlap rule or
hear 'none'. aa27: the hearing says Shabad 880 (11586 "ਸਰਣਿ ਤੁਮੑਾਰੀ ਆਇਓ ...") at 100-125 s, i.e. the current key, not
the Aarti text the aligner placed there; all 11 aa27 rows rejected. Heard-token timing within 1.5 s start / 3 s end for
66% of tier A, 52% B, 12% C, 50% D.
