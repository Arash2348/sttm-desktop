# GAB pangti label candidates

`candidates/batchN.json` = CANDIDATE pangti timings (not labels). `candidates/batchN-coverage.json` = per recording:
coverage before / after, candidate count by tier, and the gaps (alaap / simran / katha / silence or not aligned).
`accepted/` = rows a person or the verifier rule signed off (none yet).

Made by `tools/make-candidates.py` from the saved two-model forced alignment (`tools/line-build.js`, cloud run
2026-10-15, Azure `gab-lines/align/<model>/<id>.json`, pulled read-only with
`research/cloud-gab/results-sync.js pull --prefix gab-lines --dir <dir>`). No speech model was re-run.

Tiers: A both models, same pangti, start within 1 s, check >= 0.5 (~97% right pangti on GAB-Hard human keys);
B both agree, check < 0.5 (~65%); C one model only (~41%); D one model only and the other model put a different
pangti there (conflict).

Verification rule (owner, 2026-10-23): a candidate is accepted only when EVERY checker (each Fable / Opus verifier
and the aligner) names the SAME pangti (verseId) for the span AND each checker's confidence / the agreement score is >= 0.95. Otherwise a person
decides. Every row carries `verify: {pangti_must_match, min_agreement: 0.95, agreement_prior}`.

Batches: batch1 = Kirtan (folder 1) recordings at 50-60% coverage (13). batch2 = Kirtan recordings at 40-50% coverage
(15, closest to 50% first; 948 candidates, 492 tier A eligible for the 3-checker rule), same tool:
`make-candidates.py <gab-lines> candidates/batch2.json --lo 0.40 --hi 0.50 --max 15`.
batch3 = Akhand Kirtan (folder 5) recordings below the 60% bar (12 of 17 with a pangti key; l3clip36/38 have no
pangti key and were not picked; l3clip02/16/27/37/39 are lower than the 12 taken; all train split, none accepted):
443 candidates (A 148, B 32, C 154, D 109; 110 tier A eligible for the 3-checker rule; 295 new vs the current key),
`make-candidates.py <gab-lines> candidates/batch3.json --folder 5-akhand-kirtan --file c1-6a866c94-akhand.json
--lo 0 --hi 0.60 --max 12 --category "Akhand Kirtan"`. Tier precision figures were measured on Kirtan (GAB-Hard);
for Akhand Kirtan they are a prior only. Long Waheguru simran between pangtis is a gap, never a pangti.
batch4 = Paath (folder 2) and Sung Bani (folder 3) recordings below the 60% bar or with no pangti key (15, all dev
split, none accepted): Paath pt01, pt05, pt06, pt07, pt34; Sung Bani (Aarti) aa16-aa20, aa26, aa27 (no pangti key),
aa05, pt38, aa49. 298 candidates (Paath 75: A 55, B 16, C 4; Sung Bani 223: A 67, B 33, C 49, D 74); 101 tier A
eligible for the 3-checker rule; 176 new vs the current key. Same saved two-model alignment (no model re-run):
`make-candidates.py <gab-lines> candidates/batch4.json --ids pt01,pt05,pt06,pt07,pt34,aa16,aa17,aa18,aa19,aa20,aa26,aa27,aa05,pt38,aa49
--file c1-6a866c94-paath.json,c1-6a866c94-sungbani.json --hf-dir <HF dataset copy> --max 15`. Bani windows are
`bani:<id>` in shabads.csv; verse membership comes from `bani-verse-cache.json` (`tools/bani-verses.js` on a COPY of the
app's Gurbani database; bani:2 Japji, bani:4 Jaap, bani:22 Aarti, Shabads 880/2642/2513). aa27: the current key says
Shabad 880 for 39-138 s, but the 2026-10-15 run aligned the Aarti Bani text there; its 11 rows carry
`evidence.key_mismatch` and are not auto-accept eligible: a person decides the key first. Tier precision was measured on
Kirtan; for Paath and Sung Bani it is a prior only. Same verify rule: every checker names the same pangti, each >= 0.95.
batch5 = Kirtan (folder 1) recordings at 25-40% coverage (15 of 29 in the band, closest to 40% first; train 7, dev 8;
none held-out test, none accepted): clip04, rn22, clip36, clip20, rn13, rn67, rn23, rn61, clip03, clip12, rn12, rn71,
clip40, rn30, rn31. 909 candidates (A 358, B 47, C 190, D 314; 331 tier A eligible for the 3-checker rule; 551 new vs
the current key), same saved two-model alignment (no model re-run):
`make-candidates.py <gab-lines> candidates/batch5.json --lo 0.25 --hi 0.40 --max 15`.
clip12: its key is one 30-1170 s window with two possible Shabads (3014|2376); the recomputed coverage is 9% (report
says 35%) and 103 of its 143 rows are tier D (the two models aligned different pangtis): a person should settle which
Shabad is sung where before checkers vote. rn67: 5 rows carry `evidence.key_mismatch` (aligned text not in the current
key), not auto-accept eligible. Same verify rule: EVERY checker (each Fable / Opus verifier and the aligner) names the
same pangti, each with confidence / agreement >= 0.95; otherwise a person decides.
