# MVP 9.0 — release report

Branch `vf-mvp-9.0` (worktree ~/personal/sttm-release). Base = tonight's build, 265da34e.
All runs on this Mac, headless, one job at a time (`lockf` + `nice 19`). No AWS. package.json untouched.
Status: IN PROGRESS. Rows marked "pending" are still queued.

Final candidate: 9f3502ed = bounded-lag 48967e02 (+ tools 0b116930) + Stop ed954ced + paath FINAL 61488e2c
(paath follower for every Bani incl. Aarti, Rehras at extra-long, 0.25 s step) + kirtan FINAL f4cadff6 (Start keeps the
hidden run; Paath pool needs full-text agreement; panel honesty; no one-pangti lock) + merge fix 605b000c + bench-driver fix.
Not taken: 73252afc (model-window memo; withdrawn by its owner, not verified).
Slowdown stress rows were measured on dfc22708 (same code minus f4cadff6, which only changes search-phase locking).

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
Line level under the same slowdown, with the real paath follower (dfc22708). Rehras scored on the truth realigned
at extra-long (results/rt11_rehrasX.truth.json). Both builds had a brief wrong page 9475 near 106 s.
Aarti scoring counts Sohila's Gagan mai thaal (shabad 51, same text) as right; its lines carry Sohila verse ids, so
the 25-122 s stretch on 51 counts as off the line in both builds (longest off-line 150 s in both).

| Rehras / Aarti line lag, slowed PC | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras median line lag (lines reached within 60 s) | 39 s | 1.2 s | PASS |
| Rehras p90 line lag | 57 s | 1.8 s | PASS |
| Rehras lines reached within 60 s | 46/121 | 114/121 | PASS |
| Rehras line exact | 0.2% | 64.7% | PASS |
| Rehras line within 1 of the reader | 3.5% | 88.2% | PASS |
| Rehras longest stretch off the read line | 489 s | 22 s | PASS |
| Rehras right Bani / wrong page | 98.0% / 1.9% | 98.3% / 1.6% | PASS |
| Aarti median line lag | 30.4 s | 2.0 s | PASS |
| Aarti p90 line lag | 56.1 s | 3.7 s | PASS |
| Aarti lines reached within 60 s | 26/47 | 46/47 | PASS |
| Aarti line within 1 | 10.5% | 45.6% | PASS |
| Aarti right Bani / wrong page | 98.6% / 0% | 98.6% / 0% | PASS (equal) |

What the sangat saw tonight (real screen log, same scoring): Rehras median line lag 8.1 s, p90 29 s,
line within 1 28.5%, longest off-line 256 s; Aarti lag 5.1 s, within 1 33.4%, wrong page 5.2%;
Sohila lag 6 s, within 1 14.4%.

## 2. Renton parts, normal speed (no handicap; follower logic alone)

Section 1 used an artificial handicap (1 thread + 120 ms per model pass) to reproduce the slow PC. Here the same
parts run un-handicapped: fresh Start at the start of each part, `--fast` (every chunk awaited, so no backlog).
MVP 9.0 = 9f3502ed. Rehras scored on the truth realigned at extra-long. Lines the app has no id for (extra-long
Chaupai pauris absent from the app's text map) count as "off the line" for both builds.

| part / metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras median / p90 line lag | 1.9 / 2.8 s | 0.4 / 0.9 s | PASS (target < 1 s met) |
| Rehras line exact | 43.7% | 64.9% | PASS |
| Rehras line within 1 | 74.1% | 72.8% | FAIL (small) |
| Rehras lines reached | 311/346 | 320/346 | PASS |
| Rehras stretches > 5 s off the line | 11 (longest 74 s) | 16 (longest 79 s) | FAIL |
| Rehras right Bani | 97.7% | 97.3% | FAIL (small, = the 30080 page) |
| Rehras wrong page | 0.6% (9475, 10 s) | 0.9% (9475 10 s + 30080 5.7 s) | FAIL — sent to paath |
| Aarti median / p90 line lag | 2.3 / 3.3 s | 1.0 / 2.8 s | PASS |
| Aarti line exact | 31.9% | 38.2% | PASS |
| Aarti line within 1 | 45.1% | 45.0% | equal |
| Aarti right Bani / wrong | 98.0% / 0% | 98.0% / 0% | PASS (equal) |
| Sohila median / p90 line lag | 1.9 / 2.7 s | 0.4 / 0.9 s | PASS |
| Sohila line exact | 60.4% | 84.1% | PASS |
| Sohila line within 1 | 93.3% | 93.5% | PASS |
| Sohila right Bani / wrong | 99.8% / 0% | 99.8% / 0% | PASS (equal) |

New wrong page on Rehras: at 653-658 s the reader says "Ik Oankar Sri Vaheguru ji ki fateh, Patshahi 10" and goes
into the extra-long Chaupai. The follower lets go, the search locks Bhai Nand Lal's Ganj Nama (30080) on "Vaheguru"
for 5.7 s, then the Bani comes back at the new line (base stays on the Bani but shows a stale line: it has no
extra-long lines). Sent to the paath agent.

| Kirtan Shabad (S2 seconds) | sung from | tonight on screen | Base | MVP 9.0 |
|---|---|---|---|---|
| 2053 (sung before recording) | - | 98.5 | 9.3 | 9.3 |
| 5299 Fareed (fresh Start at 510) | 544 | 727.3 (tap) | 527.4 | 527.4 |
| 5238 Fareed | 1028.5 | 1091.5 (tap) | 1039.3 | 1039.3 |
| 3048 Hukamnama | 3913.8 | 3941.4 | 3945.2 | 3945.2 |
| Sohila 49 | 4228 | 4229.6 | 4228.3 | 4228.3 |
| wrong page in kirtan parts | | | 12.3 s (3442 in Fareed 1) | 12.3 s (same) |

Kirtan parts: identical events in both builds (all four kirtan parts, Hukamnama included).

Fresh visible Start at 551 s with no hidden run (kirtan agent, tools/window-run.js on the S2 audio, 551-745 s):
base locks 8875 and opens Aarti (Bani 22) at 642.6 s, a 95 s wrong page, and reaches 5299 only at 737 s.
MVP 9.0 shows no wrong page and has not reached 5299 by 745 s. In the app 5299 reaches the screen at 551 s because
Start adopts the hidden run that had locked it at 523.7 s.

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
| Rehras screen behind the reader | median line lag | tonight 8.1 s (real screen); slowed bench 39 s; normal bench 1.9 s | slowed 1.2 s; normal 0.4 s | YES (< 1 s at normal speed) |
| Rehras > 1 line behind for > 5 s | stretches off the line | tonight 26, longest 256 s; slowed bench longest 489 s | slowed longest 22 s; normal 16 stretches (base 11), longest 79 s | PARTLY (most are extra-long lines with no app id; see 2) |
| Aarti behind / wrong page | median line lag; wrong page | tonight 5.1 s, 5.2% wrong; slowed 30.4 s; normal 2.3 s | slowed 2.0 s; normal 1.0 s; 0% wrong | YES |
| Kirtan taps (5299, 5238) | first on screen | 727 / 1091 s (taps) | 5299 at 551 via Start keeping the hidden lock; 5238 1039 s | YES |
| Hukamnama stays good | first on screen, wrong page | 3945.2 s, 0 | 3945.2 s, 0 (identical) | YES |
| Stop moves the screen | stop-keeps-screen test | moves (base restores length) | pending | pending |
| Renton reads Rehras extra-long | lines the app can show | long (442 rows) | extra-long (61488e2c) | YES (code) |
| New: Rehras wrong page at the Fateh before extra-long Chaupai | wrong page | 0.6% | 0.9% (30080, 5.7 s) | REGRESSION, with paath agent |

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
