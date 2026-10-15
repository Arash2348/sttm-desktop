---
name: aarti-87-work
description: "8.7 Aarti iteration (Oct 5-6 2026) — branch mvp-8.7-aarti, 50-clip cold-start Aarti set, baseline numbers, what fails and why"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-06T18:10:08.508Z
---

Goal set 2026-10-05: iterate 8.6 -> 8.7 so Aarti is found and followed at >=95% right text from many starting points, no regression elsewhere, Mac only (no AWS).

Branch `mvp-8.7-aarti` (worktree `~/personal/sttm-87-aarti`, from fa250815; node_modules symlinked from sttm-bani). Test set `research/level2-dataset/aarti/aarti-tests.json` (50 clips, `aaNN` names; clips in `~/personal/live-darbar-venues/clips/aaNN_*.wav`): Renton Wed Aarti r1 at 9 starts, Renton Fri r6 at 3, Sep 27 prod at 10, hall test at 5, YouTube pt35-53 (15), Renton Oct 5 shadow audio at 8 (downloaded from S3 with permission into `aarti/renton-oct5/`). Scorer `aarti/aarti-score.js` (skips pt37/42/46 not_bani and sep27@494/554 = kirtan; caps sep27@434 at 480 s). Never renumber the rows: result files are named by row index.

8.6 baseline (fast mode): RIGHT 72.3% over 45 clips; r1 96%, r6 98%, YouTube 99%, Oct 5 93%; Sep 27 14% and hall 0% because the recognizer output on those recordings (screen-recording audio, congregational singing) never resembles any line — acoustic, not rules. Rule bugs found: the Savaiya+Dohra pair (8095->8096) opened Rehras (bani 21) instead of Aarti (both Banis hold the pair); Gagan mai thaal locked as Sohila's copy 51 never opens the Aarti Bani.

8.7 first change (commit 376ae1a3): Aarti added to PAATH_POOL_BANIS; findBaniSequence prefers the Bani holding the recently shown shabads (then Aarti); a sung copy of an Aarti piece opens the Aarti Bani on a line repeat. Non-regression plan: `aarti/nonreg.sh` (L2 41 kirtan clips + 60 paath clips, 8.6 vs 8.7, same Mac, fast).

Interim (Oct 6, 8.7a vs 8.6, first 21 clips): the Aarti text-pool route rescues the acoustic clips (Sep 27 14% -> 66%, hall 0% -> 49% right text, found 6/7 and 2/2) with 0 wrong; Renton Wed moved 96% -> 92% but every loss is at the Jaap-passage/Phunhe (4967) transition where the following-phase judge (untouched) decides differently run to run (slide vs direct switch, 287 vs 4967) — machine-load noise; a same-conditions 8.6 rerun (results-86b) is the control. Benchmark hygiene: never use `taskpolicy -b` on the runner (starved it to 0% CPU); `pgrep -f "node bench-runner"` matches the zsh wrapper, use `ps -A -o command= | grep "[n]ode bench-runner"`.

Same-conditions A/B (Oct 6, 8.6 control = results-86b, identical to results-86 => 8.6 is deterministic; 8.7c = c5ff09ce incl. Aarti at extralong + 4-of-8 text route + tie-break): Bani-level right text 72.3% -> 84.8% over 45 clips, wrong 0.8% -> 0.3%, found 34 -> 42 of 45, within 30 s 29 -> 33. Per source: Oct 5 93.2 -> 98.7% (8/8 found, all <= 16 s), YouTube 98.9 -> 100, Renton Fri 98.1 -> 98.7, Renton Wed 96.0 -> 92.7 (losses only at the out-of-DB Jaap passage -> Phunhe 4967 hand-off: judge takes a 9 s detour via 5478 at r1@0; candidate stream differs from 8.6 from the first decode, timing-level), Sep 27 14 -> 67, hall 0 -> 40 (acoustic). Audio-word line check (strict, understates): Oct 5 73 -> 83%, Wed 74 -> 80%, Fri 98%, YouTube 93%. Non-regression run started Oct 6 16:25 (aarti/nonreg.sh: L2 41 kirtan + 60 paath, 8.7 then 8.6, results nonreg-l2-87/86, nonreg-pt-87/86).

Non-regression interim (Oct 6 evening, Mac fast): paath 60 clips 8.7 == 8.6 on every Bani (Japji 98, Jaap 77, Chaupai/Savaiye/Anand/Rehras/Sohila 100), Aarti 74 -> 79. L2 kirtan 41 clips raw scorer: 8.7 right 87.6 / wrong 10.8; vs the 8.6 EC2 control the only per-clip differences are clip05 (8.7 shows the Aarti Bani instead of Dohra 8096 for the 13 s before 628 locks: same text, scorer not Bani-aware) and clip38 (copy 2129 of 4997: same text); clips 12/17/22/31 are wrong identically in both (known 8.6 failures). Same-machine 8.6 L2 run in progress (nonreg-l2-86). Hall test declared not a valid Aarti source by the user (congregational screen-recording audio); goal sources = Oct 5, Renton Fri, Renton Wed, YouTube.

Non-regression FINAL (Oct 6, same Mac, fast, rescored): L2 kirtan 41 clips 8.6 == 8.7 on every number (right 97.51, wrong 0.84, found <=10 s 35/41, never 1 = clip38 copy 2129 on both); paath 60 clips identical on every Bani, Aarti 74 -> 79. => no degradation elsewhere. Real-time replays of the full Oct 5 Aarti (8.6 then 8.7, results aarti/rt-86, rt-87) run after it.

Open: the live Oct 5 shadow session showed nothing for 177 s on audio the harness locks in 6 s (unexplained; the shadow build logs no candidates).

Surat-style UI (Oct 7): branch mvp-8.7-ui (worktree ~/personal/sttm-87-ui) = 8.7c + live calibrated % (red <40, yellow 40-80, green >=80; card tint follows its own %; shown cards normalized to <=100%), top-3 tappable candidates, what-it-hears strip with eye toggle, optional next-lines (localStorage vf-next-lines). Same UI on 8.6c at mvp-8.6c-ui. Display-only: Oct 5 Aarti 8 clips identical event-for-event to 8.7c (results-87ui). Demo recipe: scratchpad launch.sh/ready.js/rec.js (VF_DEMO_WAV + isolated --user-data-dir + CDP screencast).

Lead on the Renton 177 s miss (Oct 8): in the packaged 8.6c-shadow app on a fresh install, the full-text retrieval worker failed to prepare at 5 s ("vf_retrieval_failed stage prepare", DB not ready yet) and the hidden VF found the Aarti only at 72 s, vs 17 s in a dev run with the DB present. Retrieval prepare failure/late retry is the likely mechanism; the 8.7 tester build should warm the index at launch, retry prepare quickly after the DB is ready, and log readiness.
