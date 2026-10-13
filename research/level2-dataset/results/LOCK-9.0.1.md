# MVP 9.0.1 — the Aarti / Rehras handover that never switched (Oct 13 user test)

Branch `vf-mvp-9.0.1` from 4ff68d0d (MVP 9.0, tag mvp-9.0-final). Worktree ~/personal/sttm-901.

## The bug, reproduced from the user's own session audio

Two shadow sessions of the same singing, recorded at the same time by the MVP 9.0 app and the 9.1 candidate
(~/personal/sttm-usertest-9.0/.../2026-10-13T10-50-03-213Z and sttm-usertest-9.1/.../2026-10-13T10-50-25-631Z, the 9.1
one started 22.4 s later). Stitched into one 16 kHz wav each (segments at their `audio_segment` times, pre-roll before
`session_start`): `~/personal/live-darbar-venues/clips/ut13_s90.wav` (856 s) and `ut13_s91.wav` (834 s). Truth
(what was sung when, from the PC's own live transcript in activity.jsonl + human.jsonl): `research/level2-dataset/ut13-truth.json`.
Runner/scorer: `research/level2-dataset/tools/ut13-bench.js`.

What happened (session 9.0 times; 9.1 = minus 22.4 s):

| t (s) | sung | on screen (human.jsonl) |
|---|---|---|
| 36-43 | Fareed salok 5299 | 5299 @40.3 (right) |
| 44-85 | **So Dar** (Rehras shabad 40 = its Asa original 1368), 9 pangtis, while 5299 was on screen | nothing; Waheguru slide @72; 1721 only @89 when the next salok began |
| 86-115 | "Dukh daroo" salok 1721 | 1721 @89 (3 s), Rehras Bani 21 @116 |
| 401-439 | Poota mata ki asees 1839 (after a Stop/Start) | 1839 @406 (right; the line shown at the end, "Amrit peevahu sada chir jeevahu", is 1839's 5th line, not a Bani) |
| 497-519 | **Aarti** "Gagan mai thaal" (shabad 51 = Sohila copy 2533): Gagan @497, Dhoop @507, Kaisi aarti @514 | **never**; stayed on 1839 (panel: POSSIBLE NEW SHABAD 75-95%, following 18-24%) |
| 633-637 | Tumri saran 2567 | 2567 @637.8 |

So the "Anand Sahib line 8" the user remembered was 1839's "Amrit peevahu" line (a Shabad on screen, not a Bani), and the
"cold mid-Rehras pangti" was So Dar sung for 41 s while 5299 stayed on screen. Both are the SAME gate.

## The gate (traced on the headless replay of the base, MVP 9.0 @4ff68d0d)

`VoiceFollow.jsx`, FOLLOWING-phase switch judge, `tiedLeaderIds` / `stepSlot`:

```
if (|textCandidates[0].score - textCandidates[1].score| < 1e-9) every tied leader -> tiedLeaderIds, bsWins deleted
stepSlot: if (tiedLeaderIds.has(slot.shabadId) || vetoed) { slot.wins = 0; return false; }
```

The full-text search returns the two stored copies of the same Gurbani with IDENTICAL scores on every decode
(Aarti: shabad 51 Dhanasari M1 and 2533 Sohila; So Dar: 40 and 1368 Asa M1, plus Japji pauri 27 on some decodes), so
both copies are "tied leaders" and the judge resets their wins to 0 BEFORE `nextSwitchWins` runs. The panel keeps
showing the candidate's match score (lastScore), hence 75-95% with no progress, for as long as the tie lasts (= the whole
Shabad, since every line of it is stored twice).

Trace, session 9.0, Aarti stretch (base; `ut13_s90.events.jsonl`): 37 consecutive decodes 497.7-515.6 s with retrieval
`51:x 2533:x` tied (x = 0.29 ... 1.00), candidate score 0.69-0.93 (2533 then 51) vs current 1839 at 0.33-0.46, `wins: 0`
on every one, and no `judge` trace for 51/2533 at all (the veto returns before the judge). Without the veto those decodes
are STRONG wins (>= 0.8 and margin >= 0.3 count double): the switch would commit in ~1 s, as it does for any other Shabad.
Session 9.1, So Dar stretch: 40/1368 tied 23.6-62 s, candidate 40 at 0.72-0.95 vs current 5299 at 0.23-0.35, wins 0; it
reaches 1-2 wins only on the odd decode where the tie breaks, never 3 in a row.

Not the gate: Bani veto (`curBaniShabadsRef` is null, 1839 is a plain Shabad), posterior/ADOPT (search phase only),
same-Gurbani lock (search phase only; the following phase had no copy-awareness), tap veto, promote window.

The search-phase lock already had this fixed in 9.0 (`DUP_AWARE_LOCK`, `distinctLeaders`, `isSameGurbani`); the
following-phase judge did not.

## The fix (commit on vf-mvp-9.0.1)

`VoiceFollow.jsx` tie block: when every tied leader is a known copy of the first (`knownSame`, the synchronous view of
`isSameGurbani` already used by `stepSlot` for the current shabad), the tie is NOT a veto: no id goes into
`tiedLeaderIds`, no banked wins are deleted, and the copies are judged like any other candidate (3 wins at >= 0.65 and
+0.15 over the current, strong wins double). A tie between DIFFERENT shabads (a shared line) still vetoes them all, as
before. Nothing else changes: no threshold moved, no new rule.

## Results

### The user's sessions (headless replay, fresh Start at t=0, real model; same machine for base and fix)

Seconds from the first sung word of the stretch until the right page is on screen. "wrong switches" = a page
that is not the sung Gurbani put up INSIDE the stretch (none new anywhere; the one in both columns, 41562 at
692.7 s / 671 s, is an unrelated tail the base already had).

| stretch | base 4ff68d0d | fix 5f594b8b |
|---|---|---|
| ut13_s90 (MVP 9.0 session) Aarti "Gagan mai thaal" after Shabad 1839, 497-519 s | NEVER (1839 stayed 22 s; real app: never) | **+1.7 s** (2533, then Aarti Bani 22 opened at once) |
| ut13_s91 (9.1 session) same Aarti, 477-496 s | NEVER (real app: never) | **+0 s** (2533 @476.9) |
| ut13_s90 So Dar cold after Shabad 5299, 44-85 s | +1.6 s (return slot: the headless run had shown 40 at 8.7 s; real app: 45 s, nothing until the next salok) | +1.6 s |
| ut13_s91 So Dar cold after 5299, 21-62 s | NEVER (5299 stayed 35 s; real app: 45 s) | **+3.6 s** (40; Rehras Bani opened at 37.6 s vs 87.6 s) |
| rt11_handover (Renton Oct 11, S1 1500-1900 s): Rehras Bani 21 on screen -> Aarti 279-300 s | NEVER inside the stretch; Aarti only at +95 s (51 @374) | **+3.9 s** (51 @282.9; Aarti Bani 22 at 381 in both) |
| every other stretch of the two sessions (5299, 1721, Rehras, 1839, 2567, 628) | | identical to base |

The Renton handover clip is the real evening case the user described: a Bani (Rehras) on screen with low line
confidence, the sangat starts the Aarti. Base: 95 s. Fix: 3.9 s.

### No-regression (cached deterministic replay on the Mac, vf-check, base = sttm-release @4ff68d0d vs sttm-901)

Smoke tier (10 clips across L2, paath, Aarti, Fremont, Renton): PASS, every metric identical, screen events
identical on 10/10 clips (pt28: 47 judge-trace events differ, 0 screen events).

Cached suites on the Mac (vf-check, `--only` the clips present in the local cache after `cache pull`, which added
only pt52; the other agent's recording still holds the bench lock, so nothing new was recorded here):

| suite (clips replayed) | base -> fix | screen events |
|---|---|---|
| L2 kirtan 39 of 41 (clip34, clip37 not cached) | 38 clips identical; clip35 differs: the fix switches to So Purakh 53 at 902.7 s where the base vetoed the 53/644 tie, showed a WRONG 1658 at 911.9 s and reached 53 only at 929.8 s. The candidate's replay then hit a cache miss (new follower windows), so its clip35 tail is unscored until the `--fill` queued on the lock completes (see below) | 38/39 identical |
| Aarti 21 of 50 (aa01-08, 11, 14-18, 20, 21, 24-26, 28, 41) | identical, every metric same | 21/21, 0 of 543 events differ |
| paath 6 of 65 (pt01, 19, 28, 35, 52, 54) | identical (wrong 0 -> 0) | 6/6 |
| Fremont 5 | identical | 5/5, 0 of 126 |
| Renton Oct 11 parts 7 | identical | 7/7, 0 of 629 |
| smoke tier 10 | identical | 10/10 |

