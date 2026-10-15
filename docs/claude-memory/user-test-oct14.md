---
name: user-test-oct14
description: User's live test of 9.0.3 on Oct 14 2026 (local session, not uploaded) — Level 3 audio poor; 6 product problems (candidate confidence collapse on pauses, sevadaar override not respected, candidates flicker, grey bar clipping, auto-scroll pulls view, theme switch issues)
metadata:
  type: project
---

Session: ~/personal/sttm-usertest-profile/voice-follow/shadow/2026-10-14T23-50-37-908Z (38 min, MacBook mic, YouTube playback; local dev build had no upload key so NOT in Azure; copy kept in ~/personal/vf-benchmark-additions/sessions/2026-10-14-user-test/). Good on clear audio; "extremely not good" on Level-3-like smagam audio (e.g. youtube 8uANVMLc0D0 t=220).

Problems reported (user's priorities for the product):
1. A cleanly heard pangti builds a "possible new Shabad" to ~99%, then a 2-3 s pause makes it vanish; the next pangti of the same Shabad starts from zero. Consecutive pangtis should reinforce, not reset.
2. Grey next-pangti bar sometimes not fully shown.
3. Auto-follow scrolls the sevadaar's view back while they are looking around.
4. Sevadaar LINE moves aren't respected (clarified by the user): when the sevadaar moves a couple of pangtis within the Shabad in the bottom-right pane (the Shabad's line list), Autopilot should take that as the new position and continue following from there, but it pulls the screen back to the line it thinks. (Not mainly about manual Shabad switching.)
5. Possible new Shabads appear and vanish too fast to help; keep them longer and show more (panel has space).
6. Switching themes (e.g. Floral) with Autopilot on caused problems.

**How to apply:** these are the product backlog for the next versions after 9.0.4; measure each with GAB (and new measures for override-respect and candidate visibility). See [[user-test-oct13]], [[gab]].
