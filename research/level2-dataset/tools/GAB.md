# GAB: Gurbani Autopilot Bench

GAB is one named, repeatable test for STTM Voice-Follow. It plays the same recordings to any version of the app and
says, in a few numbers, how well the app kept the right Gurbani on screen. It uses saved speech-model outputs (the
cache), so a check takes seconds to minutes instead of hours, and the same build always gets the same numbers.

Dataset: Hugging Face `khalisfoundation/GurbaniAutopilotBench` (private). Tools: `research/level2-dataset/tools/`
on branch `vf-cached-replay` (`gab.js`, `gab-score.js`, `gab-harvest.js`, `gab-review.js`, `gab-publish.js`).
Version: every scorecard says `GAB v1.1` and the manifest hash it used. Leaderboard: the private Space
[khalisfoundation/GAB-leaderboard](https://huggingface.co/spaces/khalisfoundation/GAB-leaderboard) (static page; one
JSON per build; `gab publish` writes it).

## The questions, in plain words (GAB v1.1)

Rows are the four behaviours (Kirtan of a Shabad; Bani recited; Bani sung like kirtan; Akhand Paath), the Banis under
them (the user's list; a Bani with no clip reads "no clips yet"), and the named clip sets of earlier reports
(`gab-sets.json`: L2-41, Fremont dev / train, paath-60, Aarti-50) so an old number can be checked on its own clips.

| question | what is measured |
|---|---|
| Is the right Shabad or Bani on screen? | % of the voiced time that a line of the Shabad/Bani being sung or read is on screen (the Shabad-level sangat view). Human answer keys for every clip |
| Does the sangat see the right pangti? | ON + CATCHING UP (the previous pangti < 1 s into a new one) as % of voiced time, on the best line truth the row has: **human** (sevadaar screen, a person) > **aligned, ear-checked** (our aligner + an ear check of sampled line starts; the audit is printed, rejected lines are never scored) > **aligned** (our aligner only; shown, never a headline). Clips with line truth where the app never showed anything are counted apart ("+N never shown"); that loss is in the first question and in "not found" |
| How many seconds behind is it? | same truth basis: a new pangti starts -> first on screen (p50 / p90, n pangtis) |
| How long is a wrong Shabad up? | seconds per hour that a line from a different Shabad or Bani is on screen |
| How fast does it find a Shabad? | the first Shabad/Bani of each clip. Clips cut from inside a performance (L2, paath, Aarti, Asa di Vaar: `coldFirst` in gab-sets.json) are timed from t=0, when the app starts listening ("cold": Start pressed while it is sung); others from the truth start. p50 / p90, n, not found |
| How fast does it switch? | every later Shabad/Bani that differs from the one before it (a piece of a Bani counts as the Bani): from its start to on screen. p50 / p90, n, never |
| How much does each number rest on? | clips, hours, and the n under each number; fewer than 3 clips or events = **thin** |

Mic path (mixer feed / room mic / 50/50) stays as a second table. Which recording counts as which is in
`gab-micpath.json` (Fremont YouTube livestream = mixer feed; Jaspal's laptop recordings = room mic).
`4-akhand-paath` has no replay runner yet (the Sehaj clips have the order of Shabads but no times), so it reads "no
runner yet".

### v1.0 -> v1.1 (Oct 14 2026): why the v1.0 numbers did not match earlier reports

* **Sangat sees the pangti** (v1.0 37.6%): v1.0 averaged clips where the app never showed anything as 0% and mixed the
  train sessions in. Earlier reports (KIRTAN-GENERAL.md) leave never-shown clips out of the line number (their loss is
  in right-Shabad % and not-found). v1.1 does the same and prints the never-shown count: Fremont dev 64.0% (6 clips
  + 5 never shown), exactly the reported number.
* **Time to find** (v1.0 median 0 s): v1.0 timed from the truth window start, but L2 / paath / Aarti clips are cut from
  inside a performance (the 30 s before the window is the same Shabad), so the app was usually locked already. v1.1
  times those from t=0 (cold start) and keeps truth-start timing only where the Shabad really begins in the clip.
* **Switch time** is new (Shabad -> different Shabad inside a clip).
* **Ear checks** of aligned line starts are applied (sangat-score: rejected rows skipped; Renton truth: 48 of 51 rows
  confirmed, 3 unsure; the one rejected start is never scored). Renton is in the test split, so this shows only in
  reconciliation runs.
* **Excluded:** pt37, pt42, pt46 (their 30-60 s window is not Aarti; dataset truth to fix).
* **Headline:** per behaviour, no 50/50 mix in the headline; all-behaviours row is labelled "mixed; not a headline".

## Run it (one line)

```
cd ~/personal/sttm-replay/research/level2-dataset/tools
./gab run upstream                      # smoke tier: 10 clips, < 1 min the first time, seconds after
./gab run ~/personal/<worktree> --tier full
./gab compare upstream ~/personal/<worktree> [--tier full]   # before/after, PASS only if no guarded number is worse
./gab slowpc upstream ~/personal/<worktree>                   # simulated slow PC (timing only, never on the leaderboard)
./gab publish <run>/scorecard.json --name "<build name>" [--status candidate --note "from 2cb8b003"]   # one row on the Space
```
`<build>` is a worktree or a git rev of `~/personal/sttm-desktop` (`upstream` = khalis/experimental-release).
`--manifest hf` scores against the manifest + answer keys on Hugging Face instead of the local copy
`~/personal/vf-benchmark`. `--folders 2-bani-recited/japji` narrows it. Output: `results/gab/<time>-run/scorecard.{md,json}`.

Guardrails (`gab compare`): each behaviour, all clips and per mic path (mixer, room, 50/50).
Worse beyond a tiny tolerance on any of right %, sangat-sees-pangti %, seconds behind, wrong s/h, time to find,
not found, switch time, never switched = FAIL. Per-Bani rows, named sets and the mixed all-behaviours row are information only. The replay is deterministic, so
every change is a real change; the compare also lists the clips whose screen events differ.

Speed: the first run of a new build replays every clip from the cache (no speech model): measured 48 s for smoke and
14 min for full (11 h of audio, 4 workers, the Mac at load average ~30 from other runs). A committed build that was
replayed before is reused: smoke 1-3 s, full 9 s. Uncommitted edits are always replayed.

## The split rule

Every recording session is in train, dev or test, decided once and never moved (`hf-ingest.js` RULE: one Gurdwara's
recordings < 2 h apart are one session; Fremont kh01-kh06 sessions pinned to test; others by hash 60/20/20).
`gab` without `--split` uses every row that is not test. `--split test` is the only way to see test numbers: use it
once, at the end, on the build you would ship. Never tune on test.

## How data gets in

1. **Recordings from Jaspal** (Fremont, STTM Desktop on the sevadaar's laptop): `./gab ingest` pulls new
   `khalisfoundation/sttm_desktop_*` datasets, converts them, assigns session + split, rebuilds the manifest.
   `./gab ingest --push` also uploads the new clip folders to the dataset.
2. **Cache:** `./gab fill` checks every clip: missing locally -> pulled from the shared Azure bench-cache; missing
   there too -> recorded with the speech model (bench lock, nice 19) and pushed to Azure. `./gab fill --plan` lists
   only. `gab run` / `compare` also pull from Azure first and never run the model.
3. **Real usage (harvest):** `./gab harvest` reads the Voice-Follow sessions in Azure (read-only). The sevadaar's
   screen is a human label that may lag. Developer sessions (Arashdeep, Jashandeep, Gauravjeet, test Gurdwaras) and
   testers with no real name are skipped unless `--include-dev` / `--include-unidentified`; their audio is never
   downloaded unless `--audio`. From each outside session it cuts the stretches where the sevadaar's line stayed put
   and the app agreed or disagreed (Voice-Follow hidden), and every sevadaar override (Voice-Follow visible), and
   queues them as short clips with both lines. `./gab harvest --list` shows every session and whether it is outside.
4. **Ear checks:** `./gab review` opens the yes/no page (app / sevadaar / both / neither / instruments only / not
   sure) on the harvest queue, or on any queue folder (`--queue <dir>` with items.json + clips/).
5. **Into the benchmark:** a harvested clip enters only after an ear-check answer, or when the sevadaar overrode the
   app. `./gab harvest --promote` writes those as clip folders (benchmark layout) into a staging folder.

## Add a recording in 3 steps

1. Put a 16 kHz mono WAV in `~/personal/live-darbar-venues/clips/` and its answer key (the Shabad/Bani and, if you
   have them, line start times made by a person) in the truth sheet of its kind (Jaspal-style recordings: just let
   `./gab ingest` do steps 1-2).
2. `node vf-benchmark-build.js` (adds the manifest row and clip folder), then `./gab fill` (pull or record its cache).
3. `./gab run upstream --tier full` shows it in the scorecard; `node hf-ingest.js --push-benchmark` uploads it.

## What is still manual

* Harvested clips have no replay runner yet: promoted clips sit in staging until a `harvest` suite exists.
* No outside (non-developer) session exists in Azure yet; harvest was proven on the Renton / Newton developer
  sessions with `--include-dev --no-audio`.
* Mic path for Fremont (room mic) and a few YouTube sources is assumed; confirm and edit `gab-micpath.json`.
