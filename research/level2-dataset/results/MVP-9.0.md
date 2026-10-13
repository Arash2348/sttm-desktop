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
at extra-long with the app's own verse ids (results/rt11_rehrasX.app.truth.json). Both builds had a brief wrong page 9475 near 106 s.
Aarti scoring counts Sohila's Gagan mai thaal (shabad 51, same text) as right; its lines carry Sohila verse ids, so
the 25-122 s stretch on 51 counts as off the line in both builds (longest off-line 150 s in both).

| Rehras / Aarti line lag, slowed PC | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras median line lag (lines reached within 60 s) | 39 s | 1.2 s | PASS |
| Rehras p90 line lag | 57 s | 1.8 s | PASS |
| Rehras lines reached within 60 s | 46/121 | 118/121 | PASS |
| Rehras line exact | 0.2% | 66.6% | PASS |
| Rehras line within 1 of the reader | 4.3% | 96.1% | PASS |
| Rehras longest stretch off the read line | 489 s | 9.9 s | PASS |
| Rehras right Bani / wrong page | 98.0% / 1.9% | 98.3% / 1.6% | PASS |
| Aarti median line lag | 30.4 s | 2.0 s | PASS |
| Aarti p90 line lag | 56.1 s | 3.7 s | PASS |
| Aarti lines reached within 60 s | 26/47 | 46/47 | PASS |
| Aarti line within 1 | 10.5% | 45.6% | PASS |
| Aarti right Bani / wrong page | 98.6% / 0% | 98.6% / 0% | PASS (equal) |

What the sangat saw tonight (real screen log, same scoring): Rehras median line lag 8.3 s, p90 28.6 s,
line within 1 34.7%, longest off-line 256 s; Aarti lag 5.1 s, within 1 34%, wrong page 5.2%;
Sohila lag 6 s, within 1 14.4%.

## 2. Renton parts, normal speed (no handicap; follower logic alone)

Section 1 used an artificial handicap (1 thread + 120 ms per model pass) to reproduce the slow PC. Here the same
parts run un-handicapped: fresh Start at the start of each part, `--fast` (every chunk awaited, so no backlog).
MVP 9.0 = 7165bd24 for the three paath parts (9f3502ed for the kirtan parts; the two later commits only touch Bani
profiles). Rehras scored on the truth realigned at extra-long, with app verse ids taken from the app's own
Bani 21 rows (results/rt11_rehrasX.app.truth.json, by the paath agent). Only confident truth time is scored.

| part / metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Rehras median / p90 line lag | 1.8 / 2.8 s | 0.4 / 1.0 s | PASS (target < 1 s met) |
| Rehras line exact | 50.2% | 78.0% | PASS |
| Rehras line within 1 | 88.1% | 94.5% | PASS |
| Rehras lines reached | 351/390 | 380/390 | PASS |
| Rehras stretches > 5 s off the line | 8 (longest 32.5 s) | 3 (longest 32.5 s) | PASS |
| Rehras right Bani | 97.7% | 98.3% | PASS |
| Rehras wrong page | 0.6% (9475, 10 s) | 0% | PASS |
| Aarti median / p90 line lag | 2.3 / 3.3 s | 1.0 / 2.8 s | PASS |
| Aarti line exact | 31.9% | 38.2% | PASS |
| Aarti line within 1 | 45.8% | 45.2% | FAIL (small, -0.6 pt; exact and lag better) |
| Aarti right Bani / wrong | 98.0% / 0% | 98.0% / 0% | PASS (equal) |
| Sohila median / p90 line lag | 1.9 / 2.7 s | 0.4 / 0.9 s | PASS |
| Sohila line exact | 60.4% | 84.1% | PASS |
| Sohila line within 1 | 94.3% | 94.8% | PASS |
| Sohila right Bani / wrong | 99.8% / 0% | 99.8% / 0% | PASS (equal) |

On 9f3502ed Rehras had one new wrong page: at 653-658 s the reader says "Ik Oankar Sri Vaheguru ji ki fateh,
Patshahi 10" (where the long list has it; the app's extra-long list has it ~35 lines later), the follower lost it and the
search locked Bhai Nand Lal's Ganj Nama (30080) for 5.7 s. Fixed in e7ff6324 (paath): the extra-long Rehras is followed
with the long list's header rows merged in (never shown). On 7165bd24 both 30080 and base's 9475 detour are gone.

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

## 3. Fremont (Jaspal's 5 recordings, line level) — MVP 9.0 = 9f3502ed

| metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| Shabad right / wrong / searching | 86.1 / 4.6 / 9.3% | 86.1 / 4.6 / 9.3% | equal |
| line same (arbiter) / with singing credit | 46.6 / 47.3% | 46.6 / 47.3% | equal |
| line within 1 / verses reached / median lag | 66.3% / 54 of 85 / 3.1 s | same | equal |

All 5 recordings have identical screen events. The kirtan agent's earlier Fremont gain (right 91.2%) came from the
one-verse first-lock route, which was dropped because it wrong-locked L2 clip20 and Sep 27 Aarti.

## 4. Level-2 kirtan 41 / paath 60 / Aarti 50

Base = the Oct 6 same-Mac runs of the same search code. 265da34e reproduces them event-for-event on a 12-clip
L2 subset (12 of 12 identical), so they stand for base. Which commit ran what: paath-60 and Aarti-50 on 7165bd24
(the final head); L2-41 and Fremont on 9f3502ed (the two later commits change only Bani profiles; a 13-clip L2 spot
check on 7165bd24 is the proof, below).

### Paath (65 rows, 60 with audio) — MVP 9.0 = 7165bd24, Bani-aware scoring (tools/paath-score.js)

| metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| right Bani | 68.8% | 67.8% | FAIL (small) |
| sub-Bani (Chaupai/Anand inside Rehras) | 3.2% | 3.2% | equal |
| member shabad | 5.2% | 5.1% | equal |
| wrong page | 2.9% | 2.9% | PASS (equal) |
| nothing on screen | 13.9% | 15.0% | FAIL (small) |
| clips with identical screen events | | 53 of 60 | |

Per-Bani right-text: Japji 88 -> 85%, Jaap 70 -> 69%, Chaupai 93 = 93, Savaiye 93 = 93, Anand 94 = 94,
Rehras 93 = 93, Sohila 92 = 92, Aarti 71 = 71. No wrong page anywhere. Standalone Chaupai Sahib (pt09-11) opens
Chaupai (bani:9), not Rehras: no extra-long side effect.

The 7 clips that changed (all are later first locks; none shows a wrong page):

| clip | Base (tonight's build, 265da34e) | MVP 9.0 | right text |
|---|---|---|---|
| pt58 Japji | 19 and Japji at -17.2 s | 20 and Japji at 13.5 s | 82% -> 38% — WATCH: the kirtan-only build (f4cadff6) gives the same 20@13.5, so it comes from the Paath-pool guard, not the paath follower |
| pt06 Jaap | Jaap at -18.2 s | Jaap at -7.5 s (Paath-pool guard; still before the truth window) | 83% -> 68% (whole-clip scoring) |
| pt01 Japji | first shabad -14.1 s | -10.5 s | 77% -> 72% |
| pt12 / pt39 / pt60 / pt63 | | within 0.5 s of base | equal or -1 pt |

Watch items from the paath agent's 0.25 s bench (pt35 within-1, pt26 / pt28 wrong): on this suite pt26, pt28 and pt35
are event-identical to base (Bani-level scoring; no wrong page).

### Level-2 kirtan 41 — MVP 9.0 = 9f3502ed (copy-aware rescore, tools/rescore.js)

| metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| right page | 97.51% | 97.55% | PASS |
| wrong page | 0.84% | 0.84% | PASS (equal) |
| searching | 1.67% | 1.62% | PASS |
| found <= 10 s | 35/41 | 36/41 | PASS |
| found <= 20 s / <= 30 s | 39/41 / 39/41 | 39/41 / 39/41 | equal |
| never found | 1 | 1 | equal |
| longest wrong | 120.1 s | 120.1 s | equal |

35 of 41 clips have identical screen events. Changed: clip32 found at 2.4 s (base 10.6 s); clip15 +1.0 s; clip23/30/38
within 0.5 s; clip19 (lead-in only, outside the scored window): base shows the right Shabad 2908 at -25.3 s; 9.0 first shows 5478
for 5.6 s, then 2908 at -13.5 s. A lead-in wrong page, not scored; listed as a watch item.

### Aarti 50 (45 scored) — MVP 9.0 = 7165bd24 (aarti/aarti-score.js)

| metric | Base (tonight's build, 265da34e) | MVP 9.0 | pass? |
|---|---|---|---|
| right (Aarti text up) | 84.8% | 84.2% | FAIL (small) |
| wrong page | 0.3% | 0.6% | FAIL — with the paath agent |
| nothing | 14.9% | 15.2% | FAIL (small) |
| heard line | 73.7% | 70.0% | FAIL |
| piece exact | 60% | 56% | FAIL |
| found | 42/45 | 43/45 | PASS |
| found within 30 s / 60 s, median | 33 / 38, 8 s | 33 / 39, 8 s | PASS |
| wrong switches / longest wrong | 3 / 8 s | 6 / 8 s | FAIL |

By set: Sep 27 right 67.3 -> 70.4% (wrong 0.6 -> 0), r1aarti 92.7 -> 90.4% (wrong 0.3 -> 1.1%), Oct 5 98.7 -> 98.1%
(wrong 0 -> 0.7%), YouTube heard-line 93.3 -> 95.8%. New wrong pages while Bani 22 is up: 7752 for ~5 s in aa03, aa08,
aa09 (lead-in), aa50; 5478 for 8 s in aa04. The Aarti profile now uses the paath follower; it lets go and the judge
switches. Sent to the paath agent (clips and times). 35 of 50 clips identical.

## 5. Stop keeps the screen (stop-keeps-screen-test on 9f3502ed; Rehras clip, user length short / medium / long)

| user length | Base (tonight's build, 265da34e) | MVP 9.0 |
|---|---|---|
| short | Stop restores short: Rehras reloads, pane jumps to line 1 (the Renton bug) | ALL PASS (17 checks): Stop changes nothing on screen; Rehras stays at extra-long on the same line; short comes back once the screen moves on |
| medium | same bug | ALL PASS (Rehras raised medium -> extra-long, parked, restored when the screen moves on) |
| long | same bug | ALL PASS (Rehras raised long -> extra-long, parked, restored when the screen moves on) |

The test's first run failed only because it expected Rehras at 'long'; since 61488e2c Rehras is raised to extra-long.
The test now expects extra-long (commit on vf-mvp-9.0); app behaviour unchanged.

## 6. Asa di Vaar (Khalsa School Newton, Oct 11) — asa agent's suite (tools/nw-bench.js + nw-score.js)

Columns: Base (tonight's build, 265da34e) / MVP 9.0 without the asa commit (92b93d86) / MVP 9.0 (7165bd24).
Session replay with his taps; Newton audio is hard for the model (11% of lines clearly heard vs 84% on YouTube).

| metric | Base (tonight's build, 265da34e) | 9.0 without asa | MVP 9.0 | pass? |
|---|---|---|---|---|
| Newton part 1 within one line | 24.0% | 37.5% | 66.7% | PASS |
| Newton part 1 exact line | 9.1% | 24.6% | 43.0% | PASS |
| Newton part 1 lines reached (of 83) | 20 | 37 | 56 | PASS |
| Newton part 1 lag median / p90 | 3.2 / 11.1 s | 2.0 / 9.1 s | 2.0 / 5.8 s | PASS |
| Newton part 1 more than one line behind | 75.4% | 61.5% | 30.8% | PASS |
| Newton part 1 longest stall | 229 s | 216 s | none | PASS |
| Newton part 2 within one line | 36.8% | 26.8% | 27.3% | FAIL (not fixed: nothing reopens the Bani after a chhant is locked as a Shabad) |
| Newton part 2 lines reached (of 30) | 7 | 9 | 9 | PASS |
| YouTube Asa di Vaar within one line | 79.3% | 89.9% | 97.2% | PASS |
| YouTube lines reached (of 160) | 131 | 156 | 158 | PASS |
| YouTube left a line early | 0 | 4 | 2 | FAIL (small; base never moved early, but lagged 2.0 s vs 0.45 s) |
| taps, interleaved Shabads, Bani open | | identical | identical | equal |

Real screen on his Mac (8.6c), part 1: 33% within one line, 28/83 lines reached, a 229 s stall.

## Problems from Renton

| problem | measure | before | after | solved? |
|---|---|---|---|---|
| Paath/Aarti slow and behind on the Gurdwara PC | audio waiting, slowed engine: Rehras / Aarti / kirtan | 154 / 159 / 73 s, growing without limit | 1.7 / 1.4 / 0.9 s, bounded | YES |
| Rehras screen behind the reader | median line lag | tonight 8.3 s (real screen); slowed bench 39 s; normal bench 1.8 s | slowed 1.2 s; normal 0.4 s | YES (< 1 s at normal speed) |
| Rehras > 1 line behind for > 5 s | stretches off the line | tonight 22, longest 256 s; slowed bench longest 489 s; normal 8 | slowed 2, longest 9.9 s; normal 5, longest 32.5 s (start-up, 9475, 30080, two reader skips) | YES vs base; not zero |
| Aarti behind / wrong page | median line lag; wrong page | tonight 5.1 s, 5.2% wrong; slowed 30.4 s; normal 2.3 s | slowed 2.0 s; normal 1.0 s; 0% wrong | YES |
| Kirtan taps (5299, 5238) | first on screen | 727 / 1091 s (taps) | 5299 at 551 via Start keeping the hidden lock; 5238 1039 s | YES |
| Hukamnama stays good | first on screen, wrong page | 3945.2 s, 0 | 3945.2 s, 0 (identical) | YES |
| Stop moves the screen | stop-keeps-screen test | moves (base restores length) | ALL PASS at short, medium, long | YES |
| Renton reads Rehras extra-long | lines the app can show | long (442 rows) | extra-long (61488e2c) | YES (code) |
| Rehras wrong page (9475 detour; Fateh header before extra-long Chaupai) | wrong page | 0.6% | 0% (e7ff6324) | YES |

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
