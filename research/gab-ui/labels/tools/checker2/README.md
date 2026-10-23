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
