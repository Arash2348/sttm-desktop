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

## Batch 3 (Akhand Kirtan, folder 5; same lens, same tool: `vote.py batch3`)
Decoded the 12 batch-3 recordings (`l3clip*`; their x86 cache entries are symlinks to the q16 Mac cache, 93-100% of
each span covered) with `/usr/bin/python3`. Output `labels/votes/batch3-checker1.json`: 443 spans, 101 agree,
56 approved (agree and confidence >= 0.95); by tier A 35/148, B 1/32, C 19/154, D 1/109. The speech model hears
Akhand Kirtan (fast, sangat singing along) only in fragments: 178 spans where I hear no pangti or too little
(< 10 chars, alaap/simran, or no pangti explains >= 50 of the hearing), 268 where the best match lies outside the
keyed Shabad with no clear margin, 61 same-Shabad other pangti. Strict by design: a tie between the candidate and
a corpus competitor is a reject. Confidence calibration is still the Karanbir v1 Kirtan set (no human Akhand Kirtan
keys exist yet); the 37 approvals that overlap a current HF key line all name the same pangti, but that key is
aligner-made (`aligned-2model-audited`), not human, so this is consistency, not truth.
