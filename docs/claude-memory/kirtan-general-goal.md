---
name: kirtan-general-goal
description: User goal (Oct 13 2026): generalising kirtan quality on Fremont-style recordings (laptop mic in hall, parmaans) with a train/dev/test split by recording session, quick finding, parmaan follow/return, line following; other kirtan sets must not regress
metadata:
  type: project
---

Program branch vf-kirtan-general (worktree ~/personal/sttm-kirtan-general), built on
vf-kirtan-line-hold (Fremont line 59 -> 70 %). Data: Jaspal's ~51 khalisfoundation HF datasets
sttm_desktop_<ts> (sevadaar-screen verse timestamps; kh01-kh06 come from them), split TRAIN / DEV /
TEST by recording session, stratified by Gurdwara; TEST touched once at the end. Fixes in order:
quick safe finding (one-pangti lock with a safety check), parmaan detour follow + return, lines
sharing most words (weight differing words). Guardrails: L2-41, Aarti-50, Renton, Newton, the
30 Fremont ear-check moments. Report: KIRTAN-GENERAL.md.

Why: Fremont Shabad-level is only 85 % (11 % searching at start, 4 % parmaans), capping line
following; the user wants it to generalise, not overfit 5 clips. See [[five-behaviours]],
[[human-labels-first]], [[sangat-view-metric]], [[paath-conventions]].

**Sustainability requirement (user, same day):** "the way we build should be sustainable, and make
benchmarking and iterations get better in the future." Data work must be reusable tools in
sttm-replay tools/ (hf-ingest incremental pull of Jaspal's datasets, deterministic hash split by
session so new recordings auto-join and nothing moves, manifest + HF dataset upload, vf-check
--fill-new + Azure cache push, scorecard per split and Gurdwara), documented in REPLAY.md. Prefer
building the tool over doing a task by hand, every time.
