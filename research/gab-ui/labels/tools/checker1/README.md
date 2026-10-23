# Checker 1 (lens A, text match) for label batch 1

Independent of the aligner. `decode1.py` greedy-decodes the cached x86 speech-model output (no model run) into a
timed token stream; `lib.py` scores a pangti by how much of the heard text for exactly the candidate span it
explains (character alignment with free start/end and restarts, because kirtan repeats half-pangtis) against
every pangti of the keyed Shabad plus the best 60 competing pangtis of the whole Gurbani corpus (trigram
retrieval); `vote.py` picks my pangti BEFORE reading the candidate's verseId, gives a confidence calibrated on
windows cut from the Karanbir v1 human pangti keys (cumulative length x margin bins, 90% Wilson lower bound;
short hearings capped at 0.94, partial cache cover at 0.90), then records `agrees`.
Output: `labels/votes/batch1-checker1.json`. Approve = agrees and confidence >= 0.95.

## Batch 2 (same lens, same tool: `vote.py batch2`)
Decoded the 15 batch-2 Kirtan recordings (x86 cache; `rn*` caches are the Azure x86 pulls under the q16 dir) plus the
4 Karanbir v1 calibration recordings; 461 calibration windows. Output `labels/votes/batch2-checker1.json`:
948 spans, 516 agree, 362 approved (agree and confidence >= 0.95); by tier A 303/528, B 5/63, C 40/189, D 14/168.
272 spans where my best pangti lies outside the keyed Shabad (mostly parmaan detours or a different Shabad, e.g.
rn62 hears "ਮਨ ਰੇ ਕਿਉ ਛੂਟਹਿ ਬਿਨੁ ਪਿਆਰ" where the candidate is from Shabad 1591), 145 same-Shabad other pangti,
120 where I hear no pangti (alaap, simran, too little heard or the cache does not cover the span).
