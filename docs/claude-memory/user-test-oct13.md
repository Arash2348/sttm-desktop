---
name: user-test-oct13
description: "Oct 13 2026 user side-by-side test of MVP 9.0 (4ff68d0d) vs 9.1 (337242ea): comparable; 9.1 page-turn anticipation felt like false positives (parked as future opt-in); both failed to switch from a followed Bani to a sung Aarti Shabad at 75-95% even after 3 pangtis; sessions with audio saved"
metadata:
  type: project
---

Oct 13 2026 the user ran both builds live (profiles ~/personal/sttm-usertest-9.0 and -9.1, launcher
scratchpad usertest/launch.sh 9.0|9.1). Verdict: comparable; preferred 9.0. The 9.1 page-turn
anticipation (next line shown in the breath) felt like a "skip ahead one line" false positive even
though metrics called it correct -> the user's ear wins; anticipation is PARKED (branch vf-mvp-9.1,
tag mvp-9.1-candidate on the fork), only as an off-by-default setting if ever revived. The
re-acquire-after-skips half may ship alone (measure first).

Bug found by the user in BOTH builds: while following Anand Sahib line 8 at 18-24%, singing the
Aarti Shabad "Dhoop malaanlo" (3 different pangtis in a row) showed POSSIBLE NEW SHABAD at 75-95%
but never switched. Also a cold mid-Rehras sung pangti never locked. Same root as the kirtan
"never locks by itself" problem; it is the evening Rehras -> Aarti handover, so it is critical.
Sessions with audio: ~/personal/sttm-usertest-9.0/voice-follow/shadow/2026-10-13T10-50-03-213Z and
~/personal/sttm-usertest-9.1/voice-follow/shadow/2026-10-13T10-50-25-631Z (audio-00N.wav at
audio_segment times, human.jsonl: Shabad 1839 verses 22189-22191 ~417-435 s). Fix branch
vf-mvp-9.0.1 (worktree ~/personal/sttm-901), results LOCK-9.0.1.md.

**How to apply:** test clips ut13_s90/ut13_s91 from these sessions are the regression test for the
Bani -> sung Shabad handover. See [[mvp-9-0-checkpoint]], [[paath-conventions]], [[north-star-goals]].

**Follow-up idea from the user (same day):** they do like 9.1's speed for fast paath. Build
pace-adaptive anticipation: measure the reader's pace live (rolling median pause between lines);
fast reader -> 9.1 breath-flip, slower reader -> 9.0 flip-when-heard. New scorer bucket "early
flips" (> 0.3 s before the next line's start) is the user's false-positive proxy. Branch
vf-paath-adaptive (worktree ~/personal/sttm-adaptive), results ADAPTIVE.md.
