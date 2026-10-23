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
and the aligner) names the SAME pangti (verseId) for the span AND the agreement score is >= 0.95. Otherwise a person
decides. Every row carries `verify: {pangti_must_match, min_agreement: 0.95, agreement_prior}`.
