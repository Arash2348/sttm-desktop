# Kirtan that generalises: Fremont-style darbars (branch vf-kirtan-general)

Base: vf-kirtan-line-hold @ 747cb093 (kirtan line follower: re-lock by votes, next line needs 6+ letters and two decodes).
Scope: kirtan Shabad finding, parmaan detours, line following. follower2 (paath) and read-Bani paths untouched.

## Phase 1: data (done first, it decides whether anything generalises)

### Source and tools

Jaspal's line-labelled recordings: Hugging Face `khalisfoundation/sttm_desktop_*` (STTM Desktop on the sevadaar's
laptop in the hall; audio parquet + `verse_timestamps.csv` = the verse the sevadaar had on screen; README front matter
collection / duration / dataset_type). Pulled with the new, re-runnable pipeline on `vf-cached-replay`
(~/personal/sttm-replay, commit 877a54ef, documented in research/level2-dataset/tools/REPLAY.md
"New recordings join the benchmark by themselves"):

* `hf-ingest.js`: lists the org fresh every run, pulls only new / changed datasets (dataset id + revision sha),
  16 kHz mono wav (`~/personal/live-darbar-venues/hf-jaspal/<dataset>/`, parquet deleted), truth rows in
  `khalis-tests.json` (verse -> Shabad + line from BaniDB; kh01-kh06 rebuilt **identical** to the earlier rows),
  Gurdwara / date / mic / type / content tags, session + frozen split, ledger `hf-jaspal/ledger.json`.
* `vf-benchmark-build.js`: manifest rows + clip folders in ~/personal/vf-benchmark, provenance
  "sevadaar screen (human, may lag)", `session` column.
* `vf-check.js --fill-new [--push]`, `--split train,dev`; suite `jaspal`; `kirtan-score.js` (Shabad level, sangat line
  level, find time, parmaan follow / return, wrong s/h, wrong switches; per split and per Gurdwara).

### Inventory (listed fresh Oct 13 22:00 PT: 54 datasets, newest 2026-10-14T03:13Z = Oct 13 evening PT)

| what | datasets | hours | note |
|---|---|---|---|
| Fremont kirtan, pulled | 32 | 5.30 | 30 kirtan-Shabad clips (4.08 h) + Asa di Vaar morning kh16 (1.14 h) + Aarti kh23 (0.09 h), filed under 3-bani-sung |
| Fremont paath | 4 | 0.08 | inventoried, not pulled (not kirtan) |
| Fremont empty (no audio) | 2 | 0 | |
| `test_gurdwara_sahib` / `unknown_gurdwara` | 15 + 1 | 0.64 | the user's own installer tests on his Mac (session.json: host asingh02-mac, "Visible Installer Test"); verse file = the app's own screen, not a sevadaar: excluded |

Hours per Gurdwara: **Gurdwara Sahib Fremont (Jaspal) 5.38 h (kirtan 5.30 h; kirtan-Shabad content 4.08 h)**; no other
Gurdwara has sevadaar-screen recordings yet, so the "stratified by Gurdwara" rule currently has one stratum (it is
implemented, so a second Gurdwara's sessions get the same 60/20/20 rule). Mic: every recording is the STTM Desktop
capture on the sevadaar's laptop in the hall (laptop mic; same machine each day).

### Split (by recording session, decided once, frozen in the ledger)

Session = recordings of one Gurdwara less than 2 h apart (one darbar). Pinned: kh01-kh05's session and kh06's session
(which also holds kh07-kh10, recorded the same evening) -> TEST, so today's numbers stay comparable. Other sessions:
`sha1("vf-kirtan-split-2026-10-13" + session) % 100` < 60 train, < 80 dev, else test. The rule ran once, before any
tuning; it is not re-salted (the hash happened to send 3 of the 5 free sessions to dev: dev has more sessions than
train, but kirtan hours are about equal).

| split | sessions (PT) | kirtan-Shabad clips | kirtan hours | parmaan detours | new-Shabad starts |
|---|---|---|---|---|---|
| TRAIN (tune on) | Oct 11 11:10-13:40 (Sunday diwan), Oct 13 evening | 9: kh17-kh22, kh30-kh32 | 1.48 | 5 (kh17 2, kh20 3) | 11 |
| DEV (check while iterating) | Oct 10 evening, Oct 11 morning, Oct 12 evening | 11: kh11-kh15, kh24-kh29 | 1.31 | 1 (kh27) | 12 |
| TEST (once, at the end) | Oct 7 evening (kh01-kh05), Oct 8 evening (kh06-kh10) | 10: kh01-kh10 | 1.29 | 7 (kh04 3, kh06 2, kh10 2) | 12 |

Sung-Bani recordings of DEV sessions (kh16 Asa di Vaar 68 min, kh23 Aarti 5 min) are kept in the ledger and the
benchmark under 3-bani-sung/ but are not in the kirtan suite (the app follows them as Banis).
The 30 Fremont ear-check moments come from kh01-kh05 (TEST): used strictly as a no-regression guardrail, never as a
tuning signal.

Caveat, said up front: parmaan detours are few (5 train, 1 dev, 7 test), so detour numbers on DEV are anecdotes.

### Per clip

| clip | split | session (PT) | recorded (PT) | min | verse changes | Shabads | stretches: new / parmaan detours / returns | content |
|---|---|---|---|---|---|---|---|---|
| kh01 | test | 10-07 20:18 | 10-07 20:18 | 9.5 | 27 | 1 | 1 / 0 / 0 | kirtan |
| kh02 | test | 10-07 20:18 | 10-07 20:30 | 9.9 | 7 | 1 | 1 / 0 / 0 | kirtan |
| kh03 | test | 10-07 20:18 | 10-07 20:40 | 8.8 | 17 | 1 | 1 / 0 / 0 | kirtan |
| kh04 | test | 10-07 20:18 | 10-07 20:51 | 13.2 | 29 | 4 | 1 / 3 / 2 | kirtan |
| kh05 | test | 10-07 20:18 | 10-07 21:05 | 3.2 | 5 | 1 | 1 / 0 / 0 | kirtan |
| kh06 | test | 10-08 20:14 | 10-08 20:56 | 5.8 | 16 | 3 | 1 / 2 / 2 | kirtan |
| kh07 | test | 10-08 20:14 | 10-08 20:14 | 2.2 | 3 | 2 | 2 / 0 / 0 | kirtan |
| kh08 | test | 10-08 20:14 | 10-08 20:27 | 10.6 | 26 | 1 | 1 / 0 / 0 | kirtan |
| kh09 | test | 10-08 20:14 | 10-08 20:39 | 1.6 | 4 | 2 | 2 / 0 / 0 | kirtan |
| kh10 | test | 10-08 20:14 | 10-08 20:42 | 12.3 | 17 | 3 | 1 / 2 / 3 | kirtan |
| kh11 | dev | 10-10 19:40 | 10-10 19:40 | 8.3 | 22 | 1 | 1 / 0 / 0 | kirtan |
| kh12 | dev | 10-10 19:40 | 10-10 19:50 | 15.1 | 21 | 1 | 1 / 0 / 0 | kirtan |
| kh13 | dev | 10-10 19:40 | 10-10 20:07 | 8.2 | 9 | 1 | 1 / 0 / 0 | kirtan |
| kh14 | dev | 10-11 06:42 | 10-11 06:42 | 1.3 | 1 | 1 | 1 / 0 / 0 | kirtan |
| kh15 | dev | 10-11 06:42 | 10-11 06:45 | 6.9 | 11 | 1 | 1 / 0 / 0 | kirtan |
| kh16 | dev | 10-11 06:42 | 10-11 06:52 | 68.3 | 283 | 28 | 8 / 20 / 6 | sung Bani: asa-di-vaar |
| kh17 | train | 10-11 11:10 | 10-11 11:10 | 16.4 | 13 | 3 | 1 / 2 / 1 | kirtan |
| kh18 | train | 10-11 11:10 | 10-11 13:00 | 7.0 | 8 | 1 | 1 / 0 / 0 | kirtan |
| kh19 | train | 10-11 11:10 | 10-11 13:08 | 6.8 | 22 | 1 | 1 / 0 / 0 | kirtan |
| kh20 | train | 10-11 11:10 | 10-11 13:15 | 12.6 | 63 | 4 | 1 / 3 / 3 | kirtan |
| kh21 | train | 10-11 11:10 | 10-11 13:29 | 6.3 | 6 | 1 | 1 / 0 / 0 | kirtan |
| kh22 | train | 10-11 11:10 | 10-11 13:36 | 3.7 | 6 | 1 | 1 / 0 / 0 | kirtan |
| kh23 | dev | 10-12 18:50 | 10-12 18:50 | 5.2 | 48 | 6 | 5 / 1 / 2 | sung Bani: aarti |
| kh24 | dev | 10-12 18:50 | 10-12 19:34 | 2.7 | 2 | 1 | 1 / 0 / 0 | kirtan |
| kh25 | dev | 10-12 18:50 | 10-12 19:37 | 4.8 | 2 | 1 | 1 / 0 / 0 | kirtan |
| kh26 | dev | 10-12 18:50 | 10-12 19:43 | 4.4 | 2 | 2 | 2 / 0 / 0 | kirtan |
| kh27 | dev | 10-12 18:50 | 10-12 19:48 | 11.4 | 32 | 2 | 1 / 1 / 1 | kirtan |
| kh28 | dev | 10-12 18:50 | 10-12 20:01 | 11.9 | 10 | 1 | 1 / 0 / 0 | kirtan |
| kh29 | dev | 10-12 18:50 | 10-12 20:13 | 3.9 | 13 | 1 | 1 / 0 / 0 | kirtan |
| kh30 | train | 10-13 19:35 | 10-13 19:35 | 2.1 | 1 | 1 | 1 / 0 / 0 | kirtan |
| kh31 | train | 10-13 19:35 | 10-13 19:38 | 33.2 | 91 | 3 | 3 / 0 / 0 | kirtan |
| kh32 | train | 10-13 19:35 | 10-13 20:11 | 0.6 | 3 | 1 | 1 / 0 / 0 | kirtan |

Sparse truth (1-2 verse changes): kh14, kh24, kh25, kh26, kh30 (the sevadaar held one line or left the Shabad's first
line up); they count at Shabad level and barely at line level.

### Update after ingest checks

* **kh06 is an audio problem**: the recording on the Hub is digital silence (max |sample| 9 of 32768, rms -119 dBFS), not
  a model or logic failure. hf-ingest.js now measures every recording and keeps such files out of scoring
  (`audioProblem` in the ledger). TEST is therefore 9 scored clips (1.19 h, 5 parmaan detours). All other recordings
  are -15 to -33 dBFS with no clipping.
* Uploads (approved by the coordinator under the user's instructions): the new clip folders + manifest/README are in the
  private HF benchmark (now `khalisfoundation/GurbaniAutopilotBench`), and the new cache entries (TRAIN, DEV, TEST, both
  roots) are on the Khalis Azure bench-cache (10.7 GB total there).

## Phase 2: stopped by the user (audio is the main limit); no app code changed on this branch

What was tried, offline only (tools/search-sim.js replays the search phase's first-lock decision from traces;
nothing shipped):

| first-lock rule (TRAIN+DEV episodes, + L2-41 / Aarti-50 / Renton for safety) | locks earlier | new wrong locks | note |
|---|---|---|---|
| one pangti (two-verse gate dropped) | 6 | 2 Fremont + aa18 (3732) | the known aa18 wrong lock |
| one pangti + acoustic check (winner's best line CTC beats the other text candidates' by >= 0.05) | 3 Fremont, 3 L2 | 0 anywhere | saves 0.5-2.6 s only |
| breadth of verses over 20-30 s (with or without the acoustic check) | 0-4 | 1-3 (a long generic Shabad, 3406) | rejected |
| sub-window / adjacent-line-pair text queries | | | truth rank worse (top-1 6.7 -> 4.7 %) |

## Held-out scoring of the line-hold fix (747cb093) vs upstream experimental-release (2cb8b003)

Cached replay, jaspal suite (`vf-check --suites jaspal --split dev,test --fill`), honest scorers: kirtan-score.js
(Shabad level copy/Bani-aware; line level = sangat-score ON + catching up within 1 s, sevadaar-screen truth).

| split | clips / h | Shabad right % | Shabad wrong % | searching % | sangat line % (right pangti) | catch-up lag p50 s | find median / p90 s | not found | wrong switches |
|---|---|---|---|---|---|---|---|---|---|
| DEV upstream | 11 / 1.31 | 61.1 | 6.8 | 32.1 | 64.0 | 2.13 | 14.9 / 51.7 | 6 | 0 |
| DEV 747cb093 | | 61.1 | 6.8 | 32.1 | **73.1** | 1.66 | same | 6 | 0 |
| TEST upstream | 9 / 1.19 | 85.7 | 5.2 | 9.2 | 65.5 | 1.47 | 8 / 91.9 | 2 | 0 |
| TEST 747cb093 | | 85.7 | 5.2 | 9.2 | **72.7** | 1.13 | same | 2 | 0 |

Per clip (sangat line %, upstream -> 747cb093): TEST kh01 35.5->51.6, kh02 81.6->81.4, kh03 74.9->78.1, kh04 54.5->76.1,
kh05 47.3->51.5, and the never-seen kh07 37.2->40.7, kh08 81.5->82.7, kh09 16.6->18.0, kh10 84.5->84.6; DEV kh12
71.5->82.2, kh15 70.5->93.9, kh26 26.6->26.6, kh27 49.6->58.8, kh28 88.0->89.3, kh29 44.5->54.0 (kh11/13/14/24/25:
Shabad never found, no line level). No clip is worse by more than 0.2 pt; the fix changes only the line follower, so
Shabad level, finding, parmaan and wrong switches are identical. **TEST agrees with DEV** (+7.2 vs +9.1 pt), including the
four TEST clips nobody tuned on (kh07-kh10: all equal or better).

30 ear-check moments (tools/ear-check.js, re-scored on the same replays): sevadaar-right moments now right 0/25 ->
14/25 (8 -> 243 s on the sevadaar's line); "instruments only, keep the line" 3/3 -> 2/3 (scored as "the line did not
change during the window"); 2 unsure. These come from kh01-kh05 (TEST) and were tuned on by the line-hold work, so they
are a no-regression check, not held-out evidence; kh07-kh10 and DEV are the held-out evidence.

## Model vs logic (tools/kirtan-ceiling.js)

Over the app's search decodes (nothing locked, or the Waheguru slide up), how often was the sevadaar's Shabad among
the candidates the lock logic sees (search top-4), or anywhere a better logic could see it (text index top-60)?

| clip | split | min | heard chars/min | search decodes | sevadaar Shabad top-1 / top-4 / top-60 (%) | time to find each new Shabad (s) | Shabad right % |
|---|---|---|---|---|---|---|---|
| kh11 | dev | 7.7 | 1929 | 740 | 4 / 8 / 18 | never | 0 |
| kh12 | dev | 14.4 | 588 | 16 | 13 / 38 / 50 | 0 | 97.8 |
| kh13 | dev | 8.1 | 1263 | 654 | 6 / 10 / 22 | never | 0 |
| kh14 | dev | 1.0 | 990 | 66 | 18 / 18 / 42 | never | 0 |
| kh15 | dev | 6.5 | 810 | 24 | 25 / 33 / 50 | 12.5 | 96.8 |
| kh17 | train | 15.2 | 1042 | 220 | 22 / 32 / 57 | 98.4 | 67.1 |
| kh18 | train | 6.9 | 1889 | 648 | 2 / 5 / 12 | never | 0 |
| kh19 | train | 6.7 | 1407 | 158 | 18 / 23 / 57 | 87.4 | 78.3 |
| kh20 | train | 12.5 | 1045 | 314 | 7 / 14 / 36 | 206.7 | 64.0 |
| kh21 | train | 6.0 | 1204 | 208 | 18 / 28 / 50 | 125.5 | 65.0 |
| kh22 | train | 3.5 | 1580 | 266 | 0 / 4 / 8 | never | 0 |
| kh24 | dev | 2.4 | 827 | 102 | 0 / 0 / 0 | never | 0 |
| kh25 | dev | 1.5 | 1428 | 136 | 0 / 3 / 22 | never | 0 |
| kh26 | dev | 4.2 | 591 | 30 | 40 / 40 / 67 | 14.9, never | 26.2 |
| kh27 | dev | 11.0 | 845 | 90 | 9 / 11 / 56 | 51.7 | 74.5 |
| kh28 | dev | 10.0 | 515 | 0 | - | 0 | 100 |
| kh29 | dev | 3.8 | 766 | 18 | 33 / 56 / 67 | 16.9 | 92.5 |
| kh30 | train | 1.2 | 772 | 52 | 0 / 0 / 0 | never | 0 |
| kh31 | train | 32.9 | 548 | 432 | 2 / 3 / 11 | 100.4, 518.1, never | 36.5 |
| kh32 | train | 0.6 | 1624 | 56 | 0 / 0 / 7 | never | 0 |
| kh01 | test | 9.3 | 1102 | 158 | 10 / 19 / 48 | 91.9 | 83.6 |
| kh03 | test | 8.7 | 869 | 110 | 18 / 25 / 51 | 59.1 | 88.7 |
| kh04 | test | 12.7 | 760 | 48 | 8 / 13 / 21 | 0 | 80.7 |
| kh05 | test | 3.0 | 1922 | 160 | 13 / 18 / 31 | 81.3 | 55.6 |
| kh07 | test | 1.9 | 905 | 80 | 20 / 23 / 43 | never, 4.6 | 52.4 |
| kh08 | test | 10.4 | 692 | 8 | 75 / 100 / 100 | 5.6 | 99.1 |
| kh09 | test | 1.5 | 903 | 16 | 63 / 75 / 88 | 8, never | 25.8 |

Reading it: the recognizer is not silent (500-1900 chars/min), but what it hears rarely retrieves the Shabad being
sung. Every clip whose Shabad is in the search's top 4 in >= 25% of search decodes is found (0-17 s, kh17/kh21 slower);
every clip at <= 10% is never found or takes minutes (kh11, kh13, kh18, kh22, kh24, kh25, kh30, kh31, kh32: 9 of 20
TRAIN+DEV clips). Over all TRAIN+DEV search decodes the sevadaar's Shabad is top-1 in ~7%, top-4 in ~11%, top-60 in
~26%. Parmaan detours are mostly not heard at all (kh27's 117 s quote: 1-3 letters per 4 s window).

**Model vs logic:** about half of the Fremont Shabad-finding loss (the 9 never-found clips, ~0.45 h of 2.8 h) is the model:
the sung Shabad never reaches the search's candidates. The rest (finds that take 50-200 s with the Shabad in the top 4
14-32% of the time) is logic-addressable, but every text-only lock rule tried there added wrong locks elsewhere; an
acoustic check makes earlier locks safe yet saved only seconds.

## What limited this work

* Audio/model: see the table. Fremont laptop-mic kirtan transcripts rarely contain retrievable text for the sung
  Shabad; parmaan quotes are often inaudible to the model. A better kirtan model (or front-end) is the lever.
* Data: one Gurdwara only; 7 sessions (2 train, 3 dev, 2 test); 11 parmaan detours in total (5 train, 1 dev, 5 test).
* Phase 2 tuning was stopped by the user after the data showed the model limit; no app code changed on this branch.
