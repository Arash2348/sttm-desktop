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

## Batch 5 note

`identify.py` now takes a key window with two possible Shabads (`2819|40621`): both Shabads' pangtis are the keyed pool
(`in_shabad`). No batch-5 votes were made by this checker (its emission run did not finish); the tool change is kept.

## Batch 6 (2026-10-23, Kirtan folder 1, the 15 remaining recordings below the 60% bar)

Same method, `BATCH=batch6`; fresh app-model emissions (`emis2.js karanbir`, int8, 4 threads, nice 19; 4-19 s per
recording) for clip38, rn50, clip34, clip09, rn14, clip01, clip17, clip25, rn09, rn60, rn80, clip26, rn21, rn73,
clip32. Still no second model on this Mac (the Surinder ONNX int8 dirs are empty), so the forced CTC alignment is a
non-independent second opinion and only the greedy heard-token fit decides timing; the candidate's verseId is read
only after my pick is made. Approve = same pangti and confidence >= 0.95 (the owner's rule: every checker names the
same pangti, each >= 0.95).
Result: 677 spans, 75 approved (agree and confidence >= 0.95; A 74, D 1), 266 agree but under the bar, 289 a
different pangti, 47 'none' (Vaheguru simran / jaikara / alaap / too little heard). Per recording (approved/spans):
clip01 6/22, clip09 3/46, clip17 4/156, clip25 10/38, clip26 2/17, clip32 8/73, clip34 2/10, clip38 0/11, rn09 0/41,
rn14 0/61, rn21 12/41, rn50 20/65, rn60 2/26, rn73 3/17, rn80 3/53. Heard-token timing within 1.5 s start / 3 s end
for 44% of tier A, 27% B, 9% C, 9% D; 474 spans fail timing or overlap a neighbour by > 1 s (the tier A gap to the
next candidate is 0.08 s at the 10th percentile; clip17 has 102 overlapping pairs, clip32 36, rn80 27).
Findings: clip17 (keyed Shabad 3085) is heard as Shabad 3085 only in its first part; from ~460 s to ~853 s the
hearing is "ਧੰਨੁ ਧੰਨੁ ਰਾਮਦਾਸ ਗੁਰੁ" (41412-41419, Shabad 3590; 57 spans), ~858-926 s "ਵਡੀ ਹੂ ਵਡਾ ਅਪਾਰੁ ਤੇਰਾ ਮਰਤਬਾ"
(Shabad 3571, 13 spans) and ~934-972 s "ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ" (Shabad 39, the Japji Sahib salok, 7 spans): the key
needs more rows before clip17's 114 outside-key candidates mean anything (as the batch note already flagged, 84 of
its rows are tier D). rn80 535-579 s is heard as a title line (Shabad 40545 "ਗੁਰੂ ਅਰਜਨ ਦੇਵ", 7 spans, low confidence)
rather than Shabad 499. rn14 0-21 s is the jaikara / Vaheguru simran (none); its 8 key-mismatch rows and rn09's 6,
rn80's 5 were not approved. clip38: the candidates at 28-40 s naming 58102 "ਐਸੇ ਮਰਨੇ ਜੋ ਮਰੈ" are heard as the first
half of the salok, 58101 "ਕਬੀਰ ਮਰਤਾ ਮਰਤਾ ਜਗੁ ਮੂਆ" (0 approved). rn09 0-24 s is heard as the rahao 34271 "ਕਵਨ ਸੁ ਮਤਿ
ਜਿਤੁ ਪ੍ਰੀਤਮੁ ਪਾਵਉ" at low confidence where the candidates name 50503/50504.
Output `labels/votes/batch6-checker2.json`; working files (emissions, feats-*.json) in the session scratchpad only.

## Batch 5 (2026-10-23, finished) and calibration

Batch 5: the 8 missing emissions were made (`emis2.js karanbir`, int8, nice 19). The node process aborts on exit with a libc++
mutex error AFTER the output is written; clip20 and rn67 were kept after a size check (frames x 257 x 4 bytes). Same
`identify.py` / `decide.py` with `BATCH=batch5`: 909 spans, 473 agree, 124 approved (all tier A). Output `votes/batch5-checker2.json`.
Calibration: `BATCH=calib-gabhard` on the 20 non-test GAB-Hard / Fremont recordings (human pangti keys hidden from the
checker): 897 spans, 273 agree, 3 approved. See `labels/CALIBRATION.md`.
