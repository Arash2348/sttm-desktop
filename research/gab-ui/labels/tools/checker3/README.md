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
