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

## Batch 4 (Paath folder 2 + Sung Bani folder 3; `vote.py batch4`, 2026-10-23)
Decoded the 15 batch-4 recordings (`pt01/05/06/07/34/38`, `aa05/16/17/18/19/20/26/27/49`): the Azure x86 pull first, the
local Mac q16 cache of the same model fills windows the pull lacks (`decode1.py` now merges both and keeps each second
once where cache windows overlap; `aa18`, `aa20`, `pt07` still have gaps). Banis (`bani:2` Japji Sahib, `bani:4` Jaap Sahib,
`bani:22` Aarti) take every pangti of the Bani as the keyed pool (`labels/bani-verse-cache.json`); all are in the corpus.
Output `labels/votes/batch4-checker1.json`: 298 spans, 60 agree, 43 approved (agree and confidence >= 0.95); by tier
A 36/122, B 1/49, C 1/53, D 5/74; by form Paath 3/75 (all Japji Sahib, pt01), Sung Bani 40/223 (aa05 33, aa49 6, aa18 1).
164 'none': the model hears fast Paath only in fragments (pt34 Jaap Sahib: 0-9 chars per 0.8 s pangti, long silent
stretches), and a Jaap Sahib pangti is 9-12 chars even when fully heard, under the 10-char floor and the 16-char 0.94
cap, so this lens cannot approve Jaap Sahib pangtis without a Paath calibration set (none human-keyed yet). 10 same-Bani other pangti. 64 where my
best match lies outside the keyed Shabad: in aa05 the candidates keyed to Shabad 2513 at 55-75 s, 126-152 s and 222-283 s
are heard as the Dasam Bani Aarti pangtis (78270-78280, 87326-87332, 95387-95389, 57964-57967, 75015-75017) with margins
of 10-38, i.e. the keyed Shabad is wrong there, not the timing. Calibration is still the Karanbir v1 Kirtan windows.

## Batch 5 (Kirtan folder 1, 15 recordings at 25-40% coverage; `vote.py batch5`, 2026-10-23)
Decoded `clip03/04/12/20/36/40`, `rn12/13/22/23/30/31/61/67/71` with `decode1.py` (x86 cache; the `rn*` x86 entries are
symlinks to the q16 pull; 96-100% of windows found). A span keyed under two Shabad ids (`2819|40621`, rn67) takes both
Shabads as the keyed pool. Output `labels/votes/batch5-checker1.json`: 909 spans, 402 agree, 269 approved (agree and
confidence >= 0.95); by tier A 200/358, B 0/47, C 43/190, D 26/314. Per recording (approved/spans): clip03 22/34,
clip04 23/65, clip12 12/143, clip20 26/51, clip36 39/85, clip40 2/52, rn12 21/45, rn13 2/44, rn22 10/36, rn23 9/31,
rn30 17/36, rn31 29/106, rn61 11/42, rn67 17/70, rn71 29/69. 162 'none' (alaap, simran, music, < 10 chars heard),
109 same-Shabad other pangti, 385 best match outside the keyed Shabad. The one systematic key error is clip12: its 143
candidates are keyed to Shabad 3014 but from ~314 s the hearing names "ਸੰਤਹੁ ਸੁਖੁ ਹੋਆ ਸਭ ਥਾਈ / ਤਿਨਿ ਸਗਲੀ ਚਿੰਤ ਮਿਟਾਈ"
(27216-27221) and from ~750 s "ਜਿਸ ਦਾ ਕਰਤਾ ਮਿਤ੍ਰੁ ਸਭਿ ਕਾਜ ਸਵਾਰਿਆ" (41026-41029) with margins 8-24, so the key, not the
timing, is wrong there (122 outside-key votes). rn67's five two-Shabad spans at 0-32 s are heard as the rahao
"ਜੋ ਹਮ ਕਉ ਹਰਿ ਨਾਮੁ ਚਿਤਾਰੇ" (31605, Shabad 2819's rahao pangti itself is not the candidate) and "ਸਾਜਨੁ ਮੀਤੁ ਪਿਆਰਾ"
(ties), none approved. 133 agree-but-below-0.95: 94 under the 16-char cap, 67 with margin < 10 (same calibration as
before: Karanbir v1 Kirtan windows, 461 of them). Strict by design: a tie or a thin margin is a reject.

## Batch 6 (Kirtan folder 1, the 15 remaining recordings below the 60% bar; `vote.py batch6`, 2026-10-23)
Decoded `clip01/09/17/25/26/32/34/38`, `rn09/14/21/50/60/73/80` with `decode1.py` (x86 cache, `rn*` entries are symlinks to the
q16 pull; 87-100% of windows found). Output `labels/votes/batch6-checker1.json`: 677 spans, 282 agree, 198 approved (agree
and confidence >= 0.95); by tier A 142/255, B 3/71, C 41/159, D 12/192. Per recording (approved/spans): clip01 9/22,
clip09 24/46, clip17 29/156, clip25 12/38, clip26 8/17, clip32 28/73, clip34 4/10, clip38 1/11, rn09 2/41, rn14 12/61,
rn21 11/41, rn50 17/65, rn60 13/26, rn73 3/17, rn80 25/53. 145 'none' (alaap, simran, music, < 10 chars heard or no
pangti explains >= 50), 121 same-Shabad other pangti, 258 best match outside the keyed Shabad. The one systematic key
error is clip17: its 156 candidates are keyed to Shabad 3085, which holds to ~425 s, but from ~438 s to 841 s the hearing
names "ਧੰਨੁ ਧੰਨੁ ਰਾਮਦਾਸ ਗੁਰੁ ਜਿਨਿ ਸਿਰਿਆ ਤਿਨੈ ਸਵਾਰਿਆ / ਪੂਰੀ ਹੋਈ ਕਰਾਮਾਤਿ" (41412-41419, Shabad 3590) in 57 spans, so the
key, not the timing, is wrong there (113 outside-key votes, 84 of them tier D as the candidate maker flagged). rn80 406-430 s
is heard as the Vaheguru swaiya 59394 (simran-like chant), 577-587 s as 55613 "ਐਸੇ ਗੁਰ ਕਉ ਬਲਿ ਬਲਿ ਜਾਈਐ"; rn09 is mostly
not heard (23 none of 41). 84 agree-but-below-0.95: 48 under the 16-char cap, 45 with margin < 10 (same calibration as
before: Karanbir v1 Kirtan windows, 461). Strict by design: a tie or a thin margin is a reject.
