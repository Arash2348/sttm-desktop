# Checker 3 (lens C, structure) for label batch 2

Independent of the aligner and of the other checkers. `decode.py` greedy-decodes the cached x86 speech-model output
(Azure bench-cache pull, no model run) into timed tokens per recording (`tok/<id>.json`, not committed).
`lib3.py` scores a pangti by how much of the heard text for exactly the candidate span it explains: character
alignment with free start/end, a free full repeat and restarts anywhere in the text at a fixed cost (kirtan repeats
half-pangtis); `decide()` identifies the pangti among every pangti of every keyed Shabad of the recording (parmaans
included) plus the best competing pangtis of the whole Gurbani corpus (trigram retrieval), keeping the keyed Shabad's
pangti unless a corpus pangti explains the hearing clearly better (> 10 points). `calib.py` measures the rule on
windows cut from the Karanbir v1 human pangti keys: picks inside the keyed Shabad 99.7% right at >= 10 heard chars
and in-Shabad margin >= 5 (n=717), 100% at >= 16 chars and margin >= 10 (n=405); picks outside the keyed Shabad were
wrong every time (207), so those never pass. `vote3.py` then applies the recording-level checks (lens C): Shabad order
with plausible kirtan returns (rahao, first line, or the two lines the ragi returns to most in this recording),
duration >= 2.5 s, inside the keyed Shabad row, no conflict with a confident existing key row, no overlap with a
candidate naming a different pangti unless the hearing is strong, title lines only on strong evidence, Vaheguru simran
/ alaap / too little heard = none. Confidence is reported BELOW the measured rate (0.95 / 0.96 / 0.97) and only after
all checks; the candidate's verseId is compared last. Output `labels/votes/batch2-checker3.json`.
Run: `python decode.py tok <id>=<cache dir>=<audio.wav> ...; python calib.py; python vote3.py batch2` (needs numpy).

## Batch 3 (Akhand Kirtan, folder 5; `vote3.py batch3`, 2026-10-23)

Decoded the 12 batch-3 recordings from the local q16 cache of the same speech model (`~/personal/live-darbar-venues/cache/5f9e41d867de-q16/l3clip*`, no model run; the x86 namespace holds no l3clip caches). Same scorer and calibration (Kirtan, kbv1) used as a prior only; lens C additions for Akhand Kirtan: the Shabad-row check uses the row of the Shabad my pick belongs to (a recording may hold two keyed Shabads), Vaheguru simran is detected on 'ਵਾਹਿ' pieces (the model drops matras), a span longer than 8 s with under 1.2 heard chars per second is capped at 0.9 (most of it is unheard: sangat, alaap, simran), and a pick that a different-text corpus pangti explains as well (corpus margin < 3) is capped at 0.94 unless a confident neighbour from the same Shabad within 30 s supports it. Hearing is much sparser than Kirtan (about 1.7 tokens/s), so most spans fall under the bar.
Result: 443 spans, 153 agree, 49 approved (agree and confidence >= 0.95; A 36, B 1, C 11, D 1), 175 'none' (simran / alaap / too little heard / cache gap at l3clip32 0-16 s), 115 a different pangti (mostly a corpus pangti explaining a short hearing better; also l3clip34 61-77 s heard as 20634 not 20633). Output `labels/votes/batch3-checker3.json`.

## Batch 4 (Paath + Sung Bani; `lib4.py`, `calib4.py`, `vote4.py batch4`, 2026-10-23)

15 recordings: Japji / Jaap Sahib paath (pt01, pt05, pt06, pt07, pt34), Aarti sung as kirtan (pt38, aa05, aa16-20,
aa26, aa27, aa49). Hearing: `decode.py` on the x86 q16 cache (`~/personal/live-darbar-venues/cache/5f9e41d867de-q16-x86`,
tok4/), gaps filled from the Mac q16 decode of the same model (tok4mac/); no model run. Bani membership and order
from `labels/bani-verse-cache.json` (bani:2, bani:4, bani:22) joined into lib3's Shabad table; keys read from the HF
dataset copy (`~/personal/vf-benchmark/<folder>/<rec>`). `calib4.py` re-measured the scorer on short windows cut
from the Karanbir v1 human keys (Paath pangtis are 1-3 s, 8-15 heard chars): in-Shabad picks are right 100% at
8-10 heard chars with in-Shabad margin >= 5 and explain >= 60 (n=207), 100% at 10-16 chars with margin >= 10
(n=357), at most 97% under 8 chars (never above 0.9 here); the 15 human-confirmed rt11_sohila rows: 11 right, the
4 wrong were all picks outside the keyed Shabad (capped 0.85, never approved). Because the Bani pools are large
(Jaap Sahib 808 pangtis, many near-identical "ਨਮਸਤੰ ..." lines) the in-Bani margin must be >= 10 for anything
above 0.95.
Lens C for Paath (reading): a pick needs a confident neighbour within 6 s that sits in Bani order (repeat, step back
<= 2, skip <= 3, or more short lines when the time gap allows); a confident neighbour far away in the Bani caps 0.85,
no neighbour caps 0.9 (isolated); reading rate and duration must fit the text; a span that holds only the end of a
long pangti (Mool Mantar) is a late start, not an identity doubt; headers may be read aloud but need strong evidence.
Lens C for Sung Bani (Aarti as kirtan): batch 2/3 kirtan rules (returns to the asthai, heard density, simran = none,
row and existing-key consistency) plus: a composition start inside the Bani (first pangti after a header) is a legal
jump target, the previous OR the next confident pangti may support the move, Aarti is often sung briskly so 1.5-2.5 s
caps 0.95 instead of rejecting, and an overlap with a candidate naming another pangti counts against only when my own
hearing of that span is confident and different (0.9); when my hearing there is weak it caps 0.95, when I hear the same
pangti there it is no conflict. Structural findings: aa05 0-30 s is Shabad 2513 (ਦੁਇ ਸੇਰ ਮਾਂਗਉ ਚੂਨਾ ... ਖਾਟ ਮਾਂਗਉ
ਚਉਪਾਈ), not the keyed 2642, and 2513 is sung again 28-48 s; the 2513 row 30-90 s yielded tier D candidates over
50-90 s where the Dasam Aarti (ਯਾ ਤੇ ਪ੍ਰਸੰਨ ਭਏ ... ਆਰਤੀ ਕੋਟਿ ਕਰੈ) is actually sung, all rejected as a different pangti;
aa27's key names Shabad 880 while the aligner's candidates come from bani:22 (key mismatch, every span capped 0.85);
aa16-20 / aa26 (Renton hall Aarti) are heard too sparsely to confirm any pangti; pt34 (fast live Jaap Sahib) has
20 spans with nothing heard at all in the cache window 29-37 s and 48-59 s.
Result: 298 spans, 89 agree, 52 approved (agree and confidence >= 0.95; A 42, B 1, C 2, D 7), 131 none, 78 a
different pangti. Output `labels/votes/batch4-checker3.json`.

## Batch 5 (Kirtan, folder 1, 25-40% coverage; `vote5.py batch5`, 2026-10-23)

15 recordings decoded from the x86 q16 cache (`decode.py tok5 ...`, `~/personal/live-darbar-venues/cache/5f9e41d867de-q16-x86`,
no model run; 93-100% of every recording covered). `lib3.py` reads the token directory from `TOKDIR` (default `tok`).
Same scorer; the kbv1 calibration re-read from `calib4.json`: in-Shabad picks with 10-15 heard chars, in-Shabad
margin >= 15, explain >= 60, corpus margin >= 0 are right 100% (n=281, 90% lower bound 0.994), so the floor for 0.95
is 10 heard chars (batch 2 used 16); 0.96 / 0.97 unchanged (>= 16 chars). Lens C additions: a span under 2.5 s is a
fragment unless most of the pangti's text was heard inside it (rn23 is brisk kirtan of 4-word pangtis, 2.2 s each, in
Shabad order); when two keyed Shabads hold near-identical pangtis (clip40: SGGS salok 'ਸਿਰੁ ਦੀਜੈ ਕਾਣਿ ਨ ਕੀਜੈ' 59694 and
Bhai Gurdas 'ਸਿਰੁ ਦੀਜੈ ਕਾਣ ਨ ਕੀਜੈ' 205113) the hearing cannot separate them, so the margin is re-measured against
different-text pangtis and the copy is settled only by confident neighbours of the same Shabad within 20 s (cap
0.95; no neighbour = 0.85, a person decides).
Structural findings: clip12 (key 3014|2376, one 30-1170 s window) is three Shabads: 3014 ਭੂਲੇ ਮਾਰਗੁ / ਸਿਮਰਿ ਮਨਾ ਰਾਮ
ਨਾਮੁ ਚਿਤਾਰੇ at 30-270 s (candidates right there, 19 approved), 2376 ਪਰਮੇਸਰਿ ਦਿਤਾ ਬੰਨਾ / ਧੁਰ ਕੀ ਬਾਣੀ ਆਈ at ~300-750 s
(every candidate there names a 3014 pangti: wrong), and an unkeyed third Shabad 3535 ਜਿਸ ਕਾ ਕਰਤਾ ਮਿਤ੍ਰ / ਜਿਸੁ ਤੂੰ ਆਵਹਿ
ਚਿਤਿ at ~750-1170 s (all candidates wrong; key needs a third row). clip40 (key 5475|5029|2289|40629) is a medley:
the SGGS salok at 30-60 s and 143-210 s, Shabad 2289 ਸਬਦਿ ਮਰਹੁ ਫਿਰਿ ਜੀਵਹੁ at 65-100 s and Kabir salok 5029 ਕਬੀਰ ਮੁਹਿ
ਮਰਨੇ ਕਾ ਚਾਉ at 100-130 s, where the candidates name 5475 pangtis (wrong). rn30 0-30 s is pauri 3950 (ਸਹਜੇ ਸਹਜਿ
ਖਿਲਾਇਦਾ), not the keyed 3375 pangtis the candidates name. rn67 440-495 s is Bhai Gurdas 40621 ਦਾਤਾ ਓਹੁ ਨ ਮੰਗੀਐ (keyed),
candidates name 2819 pangtis; its 5 key-mismatch rows (0-31 s) are heard as 31604/31605 at <= 0.93. clip04 87-115 s and
278-325 s is the second keyed Shabad 628 ਥਿਰੁ ਘਰਿ ਬੈਸਹੁ where candidates name 1944 pangtis. rn13 hears too little
(19 none). Vaheguru simran (clip04 76-90 s, 251-270 s, 354-365 s) and the closing jaikara / announcements (rn23 175-190 s,
rn12 403-480 s, rn61 287-315 s, rn13 194-250 s, rn31 280-335 s) are none.
Result: 909 spans, 458 agree, 362 approved (agree and confidence >= 0.95; A 283, B 0, C 61, D 18), 159 none, 292 a
different pangti; 47 agree but stay below 0.95 on the calibration alone (short or thin hearing). Output
`labels/votes/batch5-checker3.json`.
