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
