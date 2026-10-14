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
