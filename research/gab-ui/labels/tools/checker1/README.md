# Checker 1 (lens A, text match) for label batch 1

Independent of the aligner. `decode1.py` greedy-decodes the cached x86 speech-model output (no model run) into a
timed token stream; `lib.py` scores a pangti by how much of the heard text for exactly the candidate span it
explains (character alignment with free start/end and restarts, because kirtan repeats half-pangtis) against
every pangti of the keyed Shabad plus the best 60 competing pangtis of the whole Gurbani corpus (trigram
retrieval); `vote.py` picks my pangti BEFORE reading the candidate's verseId, gives a confidence calibrated on
windows cut from the Karanbir v1 human pangti keys (cumulative length x margin bins, 90% Wilson lower bound;
short hearings capped at 0.94, partial cache cover at 0.90), then records `agrees`.
Output: `labels/votes/batch1-checker1.json`. Approve = agrees and confidence >= 0.95.
