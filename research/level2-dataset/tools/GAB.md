# GAB: Gurbani Autopilot Bench

GAB is one named, repeatable test for STTM Voice-Follow. It plays the same recordings to any version of the app and
says, in a few numbers, how well the app kept the right Gurbani on screen. It uses saved speech-model outputs (the
cache), so a check takes seconds to minutes instead of hours, and the same build always gets the same numbers.

Dataset: Hugging Face `khalisfoundation/GurbaniAutopilotBench` (private). Tools: `research/level2-dataset/tools/`
on branch `vf-cached-replay` (`gab.js`, `gab-score.js`, `gab-harvest.js`, `gab-review.js`, `gab-publish.js`).
Version: every scorecard says `GAB v1.0` and the manifest hash it used.

## The questions, in plain words

| question | what is measured |
|---|---|
| Is the right Shabad or Bani on screen? | % of the time it is being sung or read that some line of it is on screen |
| Does the sangat see the right line? | % of the time the line being sung is on screen, or the app is within 1 s of switching to it. The headline uses answer keys made by people only (the sevadaar's screen, ear checks); keys made by our own aligner are shown apart |
| How many seconds behind is it? | when a new line starts, seconds until it is on screen (typical = median, worst = p90) |
| How long is a wrong Shabad up? | seconds per hour that a line from a different Shabad or Bani is on screen |
| How fast does it find a new Shabad? | seconds from when a Shabad or Bani starts to when it is first on screen (median, p90, and how many were never found) |

Rows: the four content folders (`1-kirtan-shabad`, `2-bani-recited/<bani>`, `3-bani-sung-like-kirtan/<bani>`,
`4-akhand-paath`), each Bani under them, and all folders together. Each row is also split by microphone:
**mixer feed** (USB from the mixer, livestream) and **room mic** (a laptop or room microphone in the hall). Gurdwaras
are about half and half, so the headline averages the two 50/50. Studio recordings are shown but are not in the 50/50.
Which recording counts as which is in `gab-micpath.json` (edit it when a Gurdwara's setup is confirmed).
`4-akhand-paath` has no replay runner yet (the Sehaj clips have the order of Shabads but no times), so it reads "-".

## Run it (one line)

```
cd ~/personal/sttm-replay/research/level2-dataset/tools
./gab run upstream                      # smoke tier: 10 clips, < 1 min the first time, seconds after
./gab run ~/personal/<worktree> --tier full
./gab compare upstream ~/personal/<worktree> [--tier full]   # before/after, PASS only if no guarded number is worse
./gab slowpc upstream ~/personal/<worktree>                   # simulated slow PC (timing only, never on the leaderboard)
./gab publish <run>/scorecard.json --name "<build name>"      # one row on the dataset page's Leaderboard
```
`<build>` is a worktree or a git rev of `~/personal/sttm-desktop` (`upstream` = khalis/experimental-release).
`--manifest hf` scores against the manifest + answer keys on Hugging Face instead of the local copy
`~/personal/vf-benchmark`. `--folders 2-bani-recited/japji` narrows it. Output: `results/gab/<time>-run/scorecard.{md,json}`.

Guardrails (`gab compare`): all folders and each content folder, all clips and per mic path (mixer, room, 50/50).
Worse beyond a tiny tolerance on any of right %, right line % (human), seconds behind, wrong s/h, time to find,
not found = FAIL. Per-Bani rows and aligner-made answer keys are information only. The replay is deterministic, so
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
