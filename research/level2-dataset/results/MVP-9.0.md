# MVP 9.0 — release report

Branch `vf-mvp-9.0` (worktree ~/personal/sttm-release). Base = tonight's build, 265da34e.
All runs on this Mac, headless, one job at a time (`lockf` + `nice 19`). No AWS. package.json untouched.
Status: IN PROGRESS. Rows marked "pending" are still queued.

Head being measured now: dfc22708 = bounded-lag 48967e02 (+ tools 0b116930) + Stop ed954ced + paath FINAL 61488e2c
(paath follower, Rehras at extra-long, 0.25 s step) + kirtan 326643e0 (not FINAL) + merge fix 605b000c.
Waiting: kirtan FINAL (removes the "many wins, small margin" first lock that wrong-locked Sep 27 Aarti and L2 clip20).
Not taken: 73252afc (model-window memo; withdrawn by its owner, not verified).

## 1. The #1 Renton problem: paath and Aarti slow and behind on the Gurdwara PC — PROVEN FIXED

Tonight's PC decoded at ~0.85-0.9x real time. The app queued every audio chunk with no limit,
so the screen fell further behind each minute until someone pressed Stop/Start.

Test: tonight's audio fed at microphone pace (the app never waits), on an engine slowed below real time
(1 thread + 120 ms extra per model pass), like the PC. Screen events are stamped at wall time.

| audio waiting to be decoded (max) | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras, first 600 s | 153.6 s (still growing at the end) | 1.7 s | PASS |
| Aarti, whole part (727 s) | 159.2 s (still growing) | 1.4 s | PASS |
| Kirtan, Fareed 2 (435 s) | 73.1 s (still growing) | 0.9 s | PASS |

MVP 9.0 column above = bounded-lag build (measured on 605b000c; the queue code is unchanged since).
Line-level lag under the same slowdown with the real paath follower: pending (re-running on dfc22708).

| Rehras / Aarti line lag, slowed PC | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras median line lag (lines reached within 60 s) | 39 s | pending | |
| Rehras p90 line lag | 57 s | pending | |
| Rehras line within 1 of the reader | 3.5% | pending | |
| Rehras longest stretch off the read line | 489 s | pending | |
| Aarti median line lag | 30.4 s | pending | |
| Aarti line within 1 | 4.2% | pending | |

What the sangat saw tonight (real screen log, same scoring): Rehras median line lag 8.1 s, p90 29 s,
line within 1 28.5%, longest off-line 256 s; Aarti lag 5.1 s, within 1 24.2%, wrong page 15.7%;
Sohila lag 6 s, within 1 14.4%.

## 2. Renton parts, normal speed (follower logic alone; no backlog possible)

Fresh Start at the start of each part, `--fast`. Base (tonight's build, 265da34e) is valid; MVP 9.0 pending.

| part / metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras right Bani | 97.7% | pending | |
| Rehras wrong page | 0.6% | pending | |
| Rehras line within 1 | 74.1% | pending | |
| Rehras median / p90 line lag | 1.9 / 2.8 s | pending | |
| Rehras stretches > 5 s off the line | 11 (longest 74 s) | pending | |
| Aarti right Bani | 85.1% | pending | |
| Aarti line within 1 | 32.6% | pending | |
| Aarti median line lag | 2.3 s | pending | |
| Sohila right Bani | 99.8% | pending | |
| Sohila line within 1 | 93.3% | pending | |

| Kirtan Shabad (S2 seconds) | sung from | tonight on screen | Base | MVP 9.0 |
|---|---|---|---|---|
| 2053 (sung before recording) | - | 98.5 | 9.3 | pending |
| 5299 Fareed (fresh Start at 510) | 544 | 727.3 (tap) | 527.4 | pending |
| 5238 Fareed | 1028.5 | 1091.5 (tap) | 1039.3 | pending |
| 3048 Hukamnama | 3913.8 | 3941.4 | 3945.2 | pending |
| Sohila 49 | 4228 | 4229.6 | 4228.3 | pending |

Note: base on a fresh Start already finds 5299 and 5238 long before tonight's taps. Tonight's taps came after a
visible Start that threw away the hidden run's lock; the kirtan change makes Start keep it.

## 3. Fremont (Jaspal's 5 recordings, line level) — pending on the kirtan FINAL head

Base (tonight's build, 265da34e): Shabad right 86.1%, wrong 4.6%, searching 9.3%, line same 46.6% (arbiter),
line within 1 66.3%, verses reached 54/85, median line lag 3.1 s.

## 4. Level-2 kirtan 41 / paath 60 / Aarti 50 — pending on the kirtan FINAL head

Base = the Oct 6 same-Mac runs of the same search code. 265da34e reproduces them event-for-event on a 12-clip
L2 subset (12 of 12 identical), so they stand for base.

| suite | Base (tonight's build, 265da34e) |
|---|---|
| L2 41 (copy-aware rescore) | right 97.51%, wrong 0.84%, searching 1.67%, found <= 10 s 35/41, <= 20 s 39/41, never 1 |
| paath (65 rows, 60 with audio) | Bani 68.8%, sub-Bani 3.2%, member shabad 5.2%, wrong 2.9%, none 13.9% |
| Aarti 50 (45 scored) | right (Aarti text up) 84.8%, wrong 0.3%, none 14.9%, found 42/45, median find 8 s |

Early 9.0 read (605b000c, broken driver, kirtan-only signal): L2 wrong 0.84 -> 0.99% because clip20 locks 2072 in
the lead-in (29 s wrong). Treated as a regression until the kirtan FINAL lands.

## 5. Stop keeps the screen — pending (stop-keeps-screen-test, short / medium / long)

## 6. Asa di Vaar (Newton) — pending (suite from the asa agent: base vs 9.0 vs 9.0 + asa)

## Problems from Renton

| problem | measure | before | after | solved? |
|---|---|---|---|---|
| Paath/Aarti slow and behind on the Gurdwara PC | audio waiting, slowed engine: Rehras / Aarti / kirtan | 154 / 159 / 73 s, growing without limit | 1.7 / 1.4 / 0.9 s, bounded | YES |
| Rehras screen behind the reader | median line lag | tonight 8.1 s (real screen); slowed bench 39 s | pending | pending |
| Rehras > 1 line behind for > 5 s | stretches off the line | tonight 26, longest 256 s | pending | pending |
| Aarti behind / wrong page | line lag, wrong page | tonight 5.1 s, 15.7% wrong | pending | pending |
| Kirtan taps (5299, 5238) | first on screen | 727 / 1091 s (taps) | pending | pending |
| Hukamnama stays good | first on screen | 3941.4 s | pending | pending |
| Stop moves the screen | stop-keeps-screen test | moves (base restores length) | pending | pending |
| Renton reads Rehras extra-long | lines the app can show | long (442 rows) | extra-long (61488e2c) | YES (code) |

## Commits on vf-mvp-9.0

| commit | what |
|---|---|
| 48967e02 | audio backlog bounded at 1 s (throughput) |
| 0b116930 | throughput measure tool fix (tools only) |
| ed954ced | Stop never moves the screen (stop) |
| 66652135, e635e3c8, 430318a6, 61488e2c | paath follower for Banis, Rehras at extra-long, 0.25 s step (paath) |
| ec919ac1, 326643e0 | kirtan: Start keeps the hidden run; one-pangti first lock; pool guard (kirtan, not FINAL) |
| 605b000c | merge fix: Start-adopt records the length raise, so Stop parks it |
| 679c0095 ... 222adf1c | release tools; bench driver provides the paath follower |
