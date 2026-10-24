# Independent pangti keys for GAB (source = indep-mms2-agree)

Machine pangti timings made WITHOUT Voice Autopilot's own speech model. Two public models, Meta MMS_FA (torchaudio) and
Meta MMS-1B-all with its Punjabi adapter, each score the pangtis of the Shabad/Bani named by the human (or broadcast-
caption) Shabad-level key; a span is kept only where both models name the same pangti at confidence >= 0.95 (Paath) or
>= 0.99 (Kirtan, Akhand Kirtan, Sung Bani). Labels are verseIds from the STTM/BaniDB Gurbani database; no Gurbani text
is generated or altered.

Measured precision against human or broadcast-caption pangti keys (span level, 95% Wilson lower bound):
Sehaj/Akhand Paath 100% (LB 99.6%); Kirtan held-out 99.4% (LB 96.5%). Sung Bani is UNPROVEN (one 5-min recording);
Akhand Kirtan and the read Banis (Paath) have no human pangti key, so their precision is not measured.

Licence note: the MMS model checkpoints are CC-BY-NC 4.0; these labels were made with them for Khalis Foundation's
non-commercial benchmark.
