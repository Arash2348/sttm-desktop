# MVP 9.0 — release report (in progress)

Branch `vf-mvp-9.0` (worktree ~/personal/sttm-release). Base = tonight's build, 265da34e.
All runs on this Mac, headless, one job at a time (`lockf` + `nice 19`). No AWS.
Status: PROVISIONAL. Numbers below are for 605b000c (merge of bounded-lag 48967e02, stop ed954ced,
paath e635e3c8, kirtan 326643e0 + one merge fix). Newer fix commits are not in these numbers yet.

## 1. The #1 Renton problem: paath and Aarti slow and behind on the Gurdwara PC

Tonight's PC decoded at ~0.85-0.9x real time. The app queued every audio chunk with no limit,
so the screen fell further behind each minute until someone pressed Stop/Start.

Test: the real audio, fed at microphone pace (the app never gets to wait), on a slowed engine
(1 thread + 120 ms extra per model pass = slower than real time, like the PC).
Screen events are stamped at wall time, so a late screen shows as lag.
Rehras = first 600 s of tonight's Rehras. Aarti = tonight's whole Aarti part (727 s).

| Rehras, slowed PC | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| audio waiting to be decoded, max | 153.6 s | 1.7 s | PASS |
| waiting at the end | 153.6 s | 0.5 s | PASS |
| median line lag (lines reached within 60 s) | 39 s | 2.8 s | PASS |
| p90 line lag | 57 s | 3.8 s | PASS |
| lines reached within 60 s | 46/121 | 54/121 | PASS |
| line within 1 of the reader | 3.5% | 51.1% | PASS |
| longest stretch off the read line | 489 s | 80 s | better, not solved |
| right Bani on screen | 98.0% | 83.9% | FAIL (see 4) |
| wrong page | 1.9% | 8.7% | FAIL (see 4) |

| Aarti, slowed PC | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| audio waiting, max | 159.2 s | 1.4 s | PASS |
| median line lag | 30.4 s | 3.4 s | PASS |
| p90 line lag | 56.1 s | 6.6 s | PASS |
| lines reached within 60 s | 26/47 | 35/47 | PASS |
| line within 1 | 4.2% | 27.2% | PASS |
| right Bani on screen | 81.2% | 83.1% | PASS |
| wrong page | 17.3% | 13.7% | PASS |

Kirtan under the same slowdown (Fareed 2): audio waiting max 73.1 s -> 0.9 s; Shabad 5238 found at 1040 s in both.

Tonight's real screen, same scoring (what the sangat saw): Rehras median line lag 8.1 s, p90 29 s,
line within 1 28.5%; Aarti lag 5.1 s, within 1 24.2%, wrong page 15.7%; Sohila lag 6 s, within 1 14.4%.

## 2. Renton parts, normal speed (follower logic alone, no backlog possible)

Fresh Start at the start of each part, `--fast` (every chunk awaited).

| part / metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras right Bani | 97.7% | 90.6% | FAIL |
| Rehras wrong page | 0.6% | 5.6% | FAIL |
| Rehras line within 1 | 74.1% | 59.5% | FAIL |
| Rehras median / p90 line lag | 1.9 / 2.8 s | 1.7 / 2.6 s | PASS |
| Aarti right Bani | 85.1% | 84.2% | FAIL (small) |
| Aarti line within 1 | 32.6% | 29.0% | FAIL |
| Aarti median line lag | 2.3 s | 2.5 s | FAIL (small) |
| Sohila right Bani | 99.8% | 71.0% | FAIL |
| Sohila wrong page | 0% | 25.3% (shabad 644 for 91 s) | FAIL |

Cause (found): the kirtan change's new first-lock route locks a single Shabad of the Bani
(Rehras shabad 40 at 17.5 s; Sohila 49, 50, 51, 52, then wrong 644) before the Bani opens.
Sent to the kirtan agent with clips and numbers. Fix pending.

| Kirtan Shabad (S2 seconds) | sung from | tonight on screen | Base | MVP 9.0 |
|---|---|---|---|---|
| 2053 (sung before recording) | - | 98.5 | 9.3 | 9.3 |
| 5299 Fareed (fresh Start at 510) | 544 | 727.3 (tap) | 527.4 | 527.4 |
| 5238 Fareed | 1028.5 | 1091.5 (tap) | 1039.3 | 1039.3 |
| 3048 Hukamnama | 3913.8 | 3941.4 | 3945.2 | 3943.6 |
| 1958 (read 2 s after the clip start; not a fair lock target) | 4217 | 4226.3 | 4222.7 | 4222.7 |
| Sohila 49 | 4228 | 4229.6 | 4228.3 | 4228.3 |

Note: a fresh Start at the clip start is not the same as tonight's later visible Start.
Both builds lock 5299 and 5238 long before the taps; the taps came after a Start that discarded the
hidden run's lock (the kirtan change keeps it).

## 3. Fremont (Jaspal's 5 recordings, line level)

| metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Shabad right | 86.1% | 91.2% | PASS |
| wrong | 4.6% | 4.6% | PASS (equal) |
| searching | 9.3% | 4.2% | PASS |
| line same (arbiter) | 46.6% | 51.3% | PASS |
| line within 1 | 66.3% | 70.1% | PASS |
| verses reached | 54/85 | 61/85 | PASS |
| median line lag | 3.1 s | 3.0 s | PASS |

## 4. Level-2 kirtan, 41 clips (Mac, --fast, copy-aware rescore)

Base = the Oct 6 same-Mac run of the 8.7 engine. 265da34e reproduces it event-for-event on a
12-clip subset (clip01/05/09/12/13/17/21/25/29/33/37/41: 12 of 12 identical), so it stands for base.

| metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| right | 97.51% | 97.43% | FAIL (small) |
| wrong | 0.84% | 0.99% | FAIL (small) |
| searching | 1.67% | 1.60% | PASS |
| found <= 10 s | 35/41 | 36/41 | PASS |
| found <= 20 s | 39/41 | 38/41 | FAIL |
| never found | 1 | 1 | equal |

Changed clips: clip05 better (wrong 8.3% -> 0), clip32 better (found 10.6 s -> 0), clip15 0.5 s later,
clip20 WORSE: a wrong lock on 2072 in the lead-in, 29 s wrong (5%) before 2791. Sent to the kirtan agent.

## 5. Paath 65 / Aarti 50 / Stop tests

Pending (paath-65 on 9.0 running now; Aarti-50 and stop tests queued).

## Problems from Renton

| problem | measure | before | after | solved? |
|---|---|---|---|---|
| Paath/Aarti slow and behind on the PC (backlog) | audio waiting, slowed PC, Rehras / Aarti | 154 s / 159 s and growing | 1.7 s / 1.4 s, bounded | YES |
| Rehras screen behind the reader | median line lag, slowed PC | 39 s (tonight's real screen 8.1 s) | 2.8 s | lag < 1 s target: NO (2.8 s); much better |
| Rehras > 1 line behind for > 5 s | stretches, slowed PC (600 s) | 5 stretches, longest 489 s | 9 stretches, longest 80 s | NO |
| Aarti behind | median line lag, slowed PC | 30.4 s | 3.4 s | better, not < 1 s |
| Kirtan taps (5299, 5238) | first on screen | 727 s / 1091 s (taps) | 527 s / 1039 s on a fresh Start | YES (Start keeps the hidden lock) |
| Hukamnama stays good | first on screen | 3945.2 s | 3943.6 s | YES |
| Stop moves the screen | stop-keeps-screen test | fails on base | pending | pending |
| Rehras length: PC reads extra-long | lines reachable | long (442) | extra-long fix 430318a6 not yet merged | pending |

## Commits (so far)

48967e02 bounded audio backlog · ed954ced Stop keeps the screen · 66652135 + e635e3c8 paath follower ·
ec919ac1 + 326643e0 kirtan first lock / Start adopts hidden run · 605b000c merge fix (Start-adopt records the length raise so Stop parks it) ·
679c0095 and later: release tools (renton-bench/score/tonight/stress, run-release.sh).
