# Pankti Cumulation (Voice Autopilot 10.0.x): what was tried and what the numbers say

Compiled 2026-10-29 from the GAB scorecards in `~/personal/gab-builds/v1005-work/cards` (report.py), PR #2246 and
PR #2253, the pangti-level re-scores in `sttm-ws3/research/gab-ui` (timeline-pangti-v3, timeline-indep) and the
session transcripts of Oct 17-23. Baseline for every 10.0.x number is the x86 card of 9.0.4 (28025260), which is the
exact Shabad/pangti logic `experimental-release` ran as 9.0.5. `experimental-release` today is VF 9.0.20 (after
PR #2289); its logic has moved on since (katha hold 9.0.15-17, sung Aarti 9.0.22, Akhand Paath 9.0.23), and no 10.0.x
build has been scored against it.

## The line of builds

| Build | Date | What it adds on top of 9.0.4 | Branch / PR |
|---|---|---|---|
| 10.0.1 | Oct 17 | **Pankti Cumulation (switch)**: a new Shabad switches in once 3 different pangtis of it are heard; pauses freeze the count; shared pangtis count ~0. **End-of-Aarti exit.** New evidence panel. First-find and follower pieces ship off. | `vf-10.0.1-pr` → PR #2246 (open, superseded) |
| 10.0.2 | Oct 17 | Fragment confirm, first cut (short pieces of the next pangti add weight to Shabads on the board) | `vf-10.0.2` (no PR) |
| 10.0.3 | Oct 17 | Fragment confirm + **judge assist ON** (a verbatim fragment hit lets a switch commit one vote early); one confirm per 8 s; pieces < 8 letters must match verbatim | `vf-10.0.3` (no PR) |
| 10.0.4 | Oct 18 | 10.0.3 + crash fix (fragment confirm skipped Bani cards; string id crashed `loadShabad` on 30 GAB recordings). Same decision logic as 10.0.3. | `vf-10.0.3` tip |
| 10.0.5 | Oct 21 | **Judge assist OFF** (`PC_FRAGMENT_ASSIST_S = 0`); fragment confirm counts only pangtis heard in the last 20 s | `vf-10.0.5-pr` → PR #2253 (draft, open) |
| 10.0.5+FIND | Oct 19 | 10.0.5 with Pankti Cumulation (first find) switched on | experiment only |

## GAB, same replay cache (x86 windows), manifest 701fee8e59c4 — right Shabad/Bani % / right pangti % / wrong Shabad s per hour

Experimental column = 9.0.4 logic (card r904, from PR #2253). 10.0.x columns from `report.py`, clips common to 10.0.1
and 10.0.5. 10.0.4 is on a smaller common clip set (first report.py table), so its Kirtan dev row is not strictly
comparable; its Hard rows are on identical clips.

| Tier / split | Clips · h | Experimental (9.0.4 logic) | 10.0.1 | 10.0.4 (= 10.0.3 logic) | 10.0.5 | 10.0.5+FIND |
|---|---|---|---|---|---|---|
| GAB-Hard (Fremont hall) **test** | 9 · 1.2 | 85.0 / 64.9 / 188.0 | 85.0 / 64.9 / 188.0 | 81.3 / 61.7 / **355** ❌ | 85.0 / 64.9 / 188.0 | not run |
| GAB-Hard dev | 19 · 2.2 | 56.9 / 51.3 / 201.5 | 56.9 / 51.3 / 201.5 | 53.2 / 47.0 / **555** ❌ | 56.9 / 51.3 / 201.5 | not run |
| Kirtan dev | 100-103 · 13 | 92.8 / 87.3 / 118.5 | 93.1 / 87.4 / 112.8 | 95.3 / 87.7 / 77.7 (74 clips) | 93.2 / 87.5 / 111.4 | 93.2 / 87.5 / 111.4 |
| Kirtan **test** (held out) | — | not run | not run | not run | not run | not run |
| Bani sung dev | 45 · 1.9 | 83.6 / 74.1 / 20.2 | **84.6 / 75.3 / 16.0** ✅ | 85.5 / 82.6 / 18.6 | 84.6 / 75.3 / 16.0 | 84.6 / 75.3 / 16.0 |
| Bani sung **test** | — | not run | not run | not run | not run | not run |
| Paath dev | 45 · 0.9 | 96.7 / 96.5 / 0.0 | 96.7 / 96.5 / 0.0 | 96.7 / 96.8 / 0 | 96.7 / 96.5 / 0.0 | 96.7 / 96.5 / 0.0 |
| Paath **test** | — | not run | not run | not run | not run | not run |
| Akhand Paath dev | 8 · 1.2 | 97.7 / 95.9 / 34.3 | 97.7 / 95.9 / 34.3 | 97.8 / 96.0 / 34.4 | 97.7 / 95.9 / 34.3 | 97.7 / 95.9 / 34.3 |
| Akhand Kirtan **test** | 10 · 1.5 | 86.3 / 74.6 / 240.4 | 86.3 / 74.6 / 240.4 | 85.4 / 74.6 / **288.9** ❌ | 86.4 / 74.6 / **242.1** ⚠️ | 86.4 / 74.6 / 242.1 ⚠️ |
| Akhand Kirtan dev | 24 · 1.7 | 80.6 / 76.0 / 339.8 | 80.6 / 76.0 / 339.8 | 83.0 / 81.1 / 348.3 | 80.8 / 76.8 / 330.3 | 81.7 / 76.2 / 330.3 |

Other numbers on record:
- Find time (Kirtan dev, 100 clips): 10.0.5 p50 / p90 = 7.2 / 28.2 s, 3 never found; +FIND 7.2 / 27.6 s. Experimental 7.2 / 27.6 s, 4 not found (103 clips).
- Switches found within 10 s: Bani sung dev 3 of 13 (experimental) → 4 of 13 (10.0.1 and 10.0.5); every other tier unchanged.
- Owner's live darbar session of Oct 17, replayed offline: slowest switch (Shabad 2621) came **77 s sooner** with 10.0.1, 0 wrong switches. Smoke set: 7 of 8 clips identical, clip34 right pangti 19.7 → 46.2 %.
- Panel flicker (cards blinking in/out): 0.70/min → 0.18/min with the 10.0.1 panel.

## Per clip (10.0.5 against 10.0.1, 263 common clips)

| Clip | Tier | Minutes | Shabad % | Pangti % | Wrong s/h | Direction |
|---|---|---|---|---|---|---|
| l3clip35 | Akhand Kirtan dev | 1.2 | 27.4 → 50.1 | 0 → 50 | 2031 → 1214 | ✅ (the Shabad change experimental never follows; 10.0.5 switches in 14 s, confirmed live 3 of 3) |
| l3clip10 | Akhand Kirtan test | 2.4 | 89.2 → 92.4 | 86.8 | 71.9 → 20.6 | ✅ |
| clip12 | Kirtan dev | 19.8 | 97.4 → 100 | 94.7 | 87.8 → 0 | ✅ |
| clip10 | Kirtan dev | 9.0 | 99.8 | 82.7 → 91.0 | 0 | ✅ |
| clip40 | Kirtan dev | 4.8 | 90.1 → 90.8 | 64.6 → 66.8 | 330 → 310 | ✅ |
| clip35 | Kirtan dev | 19.8 | 97.2 → 96.2 | 85.7 | 58.9 → 95.7 | ❌ |
| l3clip14 | Akhand Kirtan test | 20.4 | 84.4 | 82.9 | 491 → 505 | ❌ (this is the whole +1.7 s/h on Akhand Kirtan test) |

The large per-clip losses named in PR #2253 against experimental, **rn19** (right pangti 100 → 12.7 %, single-Shabad
kirtan), **rn61** (right Shabad 84.3 → 76.5 %, Mool Mantar kirtan whose pangtis appear in many Banis) and **l3clip27**
(pangti 86 → 70 %), are identical in 10.0.1, 10.0.4 and 10.0.5: they come from the 10.0.1 switch rule itself, not from
fragment confirm. PR #2246 reported "no track worse" at tier level, which is true; per clip it is not.

## Earlier runs on the held-back splits (Oct 18, x86 cloud VMs, pangti basis of that day)

10.0.1 against 9.0.4, full GAB (session A, Oct 18 01:18): Kirtan practice 92.3 / 77.9 → 92.4 / 77.9 (wrong 94.6 → 94.3
s/h); **Kirtan held-back 91.2 / 79.5 → same**; Sung Bani practice 91.7 / 90.9 → 92.2 / 90.9 (wrong 31.3 → 29.4); Paath,
Akhand Paath, Akhand Kirtan, Fremont identical. Two noise-sized flags: Aarti subset 0.74 → 0.76 s behind; one Aarti
recording right pangti 65.4 → 65.0 %. Verdict then: "a small, safe step up".

10.0.3 / 10.0.4 (judge assist on), held-back test split (Oct 18 08:55-09:29):

| Tier | Metric | 9.0.4 | 10.0.1 | 10.0.3 / 10.0.4 |
|---|---|---|---|---|
| Kirtan (main) test | right Shabad / pangti %; wrong s/h | 91.2 / 79.5; 122.8 | same | 91.8 / 79.5; **108.7** ✅ |
| Bani sung test | right Bani / pangti %; wrong s/h | 95.0 / 89.6; 88.4 | same | 96.7 / 91.8; **24.0** ✅ |
| Paath, Akhand Paath | all | same | same | same |
| Akhand Kirtan test | right Shabad / pangti % | 78.2 / 72.8 | same | 85.8 / 79.1 ✅ (wrong s/h 551 → 584 ❌) |
| GAB-Hard test | right Shabad / pangti %; wrong s/h | 84.9 / 64.8; 185 | same | **81.3 / 61.7; 355** ❌ |
| GAB-Hard dev | wrong s/h | 316 | 316 | **856** ❌ |

(10.0.3 crashed on 30 of 394 recordings; 10.0.4 is the crash fix with the same logic.) Cause: a short parmaan was
treated as a full switch and never followed back (kh10, kh04, kh17, kh28, kh31 on GAB-Hard; rn13 Renton 72 → 37 %).
Six 10.0.5 candidates were then tried on a quick set; "judge assist off" was the single best change (GAB-Hard test back
to 84.9 / 185; Kirtan test 92.1 / 110; Bani sung test 96.1 / 10; Akhand Kirtan test 96.3 / 66 on that quick set), and
"fragment must be recent (20 s)" recovered kh10 and kh28. Both went into 10.0.5.

Owner's Oct 18 live session replayed offline (truth = what 10.0.3 showed on screen, so it favours 10.0.3/10.0.4):
9.0.4 40.7 % right Shabad, 12 of 19 Shabads found; 10.0.1 41.8 %, 12; 10.0.4 48.6 %, 13, 0.08 / 1.98 s behind.

Painful-moments replay (owner's Oct 17-18 darbars, seconds until the right Shabad): 9.0.4 → 10.0.1: 2 better (2621
545 → 422 s), 15 same, 0 worse. 9.0.4 → 10.0.2: 5 better (1804 605 → 566 s, 2879 never → 252 s), 10 same, **2 worse
(4814 and 2727 never found: tracker drifted to 520)**. Those two losses are what 10.0.3's judge assist tried to fix.

## Owner live tests (the deciding word)

| Date | Build | What the owner said | What followed |
|---|---|---|---|
| Oct 18 01:24 | 10.0.1 | "didn't work how I want it to … it started changing too once that the next pankti didn't help confirm it" (pangti 2 was heard only as 5-9 letter pieces, which neither rule counted) | fragment confirm built (10.0.2) |
| Oct 18 08:23 | 10.0.3 | "huge improvement finding shabads which is awesome but … in some cases the follower was worse" | follower file checked byte-identical; the Bani-card crash was the likely cause; 10.0.4 crash fix |
| Oct 19 05:25 | (Renton ran 9.0.5) | Savaiye 5394 cold-find miss; "10.0.5 as planned would not fix this" | — |
| Oct 19 21:36 | 10.0.5 | "why does 10.0.5 matter? … are we spending time for minimal gains" | benchmarking of 10.0.5 stopped; main held-out split never finished |
| Oct 21 23:48 | 10.0.5 | "show and record videos of why it's better than our current experimental and open a draft PR" | PR #2253 draft + l3clip35 video; the second case (aa07) showed no live difference |
| since | 10.0.5 | no live verdict recorded | #2253 stays a draft; #2246 to be closed as superseded |

## Pangti-level re-scores (sttm-ws3, Oct 22-23) — right pangti %

Calibrated 3-checker keys (timeline-pangti-v3):

| Form | 9.0.5 | 10.0.4 | 10.0.5 | 9.0.8 |
|---|---|---|---|---|
| Kirtan (19 rec.) | 89.9 | 89.6 (18 rec.) | 89.9 | 89.9 |
| Paath | 94.6 | 94.6 | 94.6 | 94.6 |
| Sung Bani | 79.4 | 81.4 | 81.3 | 79.4 |
| Sehaj / Akhand Paath | 95.8 | 95.9 | 95.8 | 97.5 (5 of 8) |
| Akhand Kirtan | 91.8 | 92.8 | 92.7 | 91.8 |
| Karanbir v1 | 88.3 | 88.3 | 88.3 | 88.3 |

Independent keys, no app model involved (timeline-indep, 61 Kirtan recordings): right pangti 9.0.5 89.5-90.2, 10.0.4
90.1-90.2, 10.0.5 89.5-90.2, 9.0.8 89.5-90.2 (two key sets); wrong Shabad s/h 9.0.5 18, 10.0.4 34, 10.0.5 21, 9.0.8 18.
Paath / Akhand Kirtan / Sung Bani / Karanbir v1: identical across builds. "The four versions score within 0.7 points of
each other everywhere"; 10.0.5 is ahead of 9.0.8 only on Sung Bani (about 2 points, 5 recordings).

## Answer

No 10.0.x build was shown to be better than experimental in every case with no degradation.

- **10.0.1** is the closest: equal or better on every dev tier and on both held-out tiers that were run (Hard test, Akhand
  Kirtan test), with real wins on sung Bani (Aarti exits) and the owner's own session. But (a) the main held-out test
  split (Kirtan / Bani sung / Paath test) was never run, (b) three clips regress hard (rn19, rn61, l3clip27), and
  (c) it was compared with 9.0.4, not with today's experimental (9.0.20).
- **10.0.3 / 10.0.4** (judge assist on) are clearly worse: wrong-Shabad time roughly doubled on GAB-Hard (188 → 355 test,
  201 → 555 dev) and rose on Akhand Kirtan test (240 → 289).
- **10.0.5** fixes that and is a small net gain over 10.0.1 (Kirtan dev wrong 112.8 → 111.4, Akhand Kirtan dev 339.8 →
  330.3, l3clip35 found), but adds +1.7 s/h wrong Shabad on Akhand Kirtan test (l3clip14) and the clip35 loss, and the
  held-out main split is still missing (run paused by the owner 2026-10-19). PR #2253 is a draft awaiting the owner's
  live test; it was then parked behind Shadower / Sung Bani work (priorities of Oct 22).
- Pangti-level re-scores with model-free keys say the whole line is a wash on following (±0.7 pt), as expected: Pankti
  Cumulation changes switching, not following.

## Files

- Scorecards: `~/personal/gab-builds/v1005-work/cards/{v1001,v1004,c1,c1f}*`, `report.py`, `STATE.md`
- PRs: https://github.com/KhalisFoundation/sttm-desktop/pull/2246, https://github.com/KhalisFoundation/sttm-desktop/pull/2253
- Video (l3clip35, experimental vs 10.0.5): GitHub release `pr-video-vf-10.0.5` on Arash2348/sttm-desktop
- Re-scores: `sttm-ws3/research/gab-ui/labels/OVERVIEW.md`, `sttm-ws3/research/gab-ui/indep/RUN-REPORT.md`
