# Cloud GAB + Voice Autopilot tracker: how the whole setup works (Oct 17 2026)

Read this with `HANDOFF-2026-10-17.md` (state, decisions, next steps) and `HANDOFF-STATUS.md` (standing rules).
This file explains the machinery: the tracker, GAB, the caches, the VMs, the leaderboard, and the helper scripts.

## 1. The tracker ("Voice Autopilot Initiatives")

- Live page: https://claude.ai/artifact/3EKGyCFMorhNwL3DzHNPfa (owned by Arash; you can write to it from a session on his account).
- Page source: `research/cloud-gab/tracker/tracker.html` (identical to the live page). It only renders; all content lives in the
  page's database (capability `db`). You normally never republish the page: you change rows with the `ArtifactData` tool.
- Snapshot of every row as of Oct 17 01:00 UTC: `research/cloud-gab/tracker/db-snapshot/{objectives,initiatives,log}/*.json`.
- Republish only for a layout change: `Artifact` publish with `url` = the link above and `file_path` = tracker.html
  (read the live page first; keep `capabilities` unchanged).

### Collections and fields
**objectives** (the key objectives Arash checks; one doc each: p0-kirtan, p0-paath, p0-akhand-paath, p1-sung-bani, p1-akhand-kirtan, p2-fremont)
- `priority` "P0"/"P1"/"P2" (colours the card), `order` (1..6, Arash's priority order), `name`, `short`, `plain` (one line, plain words).
- `metrics`: list of bars `{label, current, start, target, from, to, unit, lower?, mode?}`. `from` = worst end of the scale, `to` = best
  end (for lower-is-better metrics like seconds behind, set `lower: true` and from > to). `mode: "hold"` = green bar + "keep >=".
- `checks`: `[{at: <UTC ISO>, what}]`. The page shows each as "⏰ <Pacific time> (in 2 h)" INSIDE the card and the next one as a pill
  next to the title. Arash wants a look-back time on every card, never a separate section. Store UTC; the page converts to PT.
- `eta` (text), `trend` (up / flat / down / hard / none), `trendNote`, `steps` `[{name, done?, now?}]`, `now`, `next`, `guard`, `updated`.

**initiatives** (one card per piece of work)
- `name` (prefix with the objective it serves, e.g. "P0 Kirtan: ..."), `state` (you / blocked / active / done / parked),
  `order` (sort inside a state; follow P0 then P1 then P2), `stage`, `result` (headline), `plain`, `why`, `now`, `next`, `eta`,
  `checkAt` (UTC ISO -> ⏰ pill), `trend`, `updated`.
- `todo` + `todoRank` + `todoTime`: any non-empty `todo` shows in the orange "Your turn" box for Arash, ranked by `todoRank`.
- Card `versions` = every version's numbers at a glance (keep it current when a version is scored).

**log**: `{at: <UTC ISO>, text}`, doc id like `l-20261017-0105`. Add one entry per meaningful change; never stamp future times.

### Rules for writing
- Pin every write with `if_version` (the version you last read). Use `batch` for several docs.
- Use real current time (`date -u`). Earlier ETAs were once stamped hours ahead; do not repeat that.
- Plain, short wording for Arash. Gurbani, pangti, Shabad, Bani, Ang (never "page"). Never "garbage".

### Other pages
- Smagam Listening Check: https://claude.ai/artifact/8atyGsZgwPTiUwu85Gjtr5. Source `research/cloud-gab/listen/index.html` +
  `spots.json`; the mp3 clips (~11 MB) are in the artifact's published files, not in git. Arash wants listening clips always
  embedded on a page like this (short clips, one question each, a Copy-my-notes button), never a localhost link.
- Pangti Spot Check: https://claude.ai/artifact/KcrZwV7uD1TTi1Tu2etHQt.
- Routine `trig_01NYuXFsJY2AXVsLT9ojmmaY` fires a tracker check-in every 2 h into the old "Real Gurbani Cloud" session: repoint it
  (`update_trigger` / recreate bound to your session) or disable it.

## 2. GAB (Gurbani Autopilot Bench) in the cloud

- Dataset: Hugging Face `khalisfoundation/GurbaniAutopilotBench` (v1.3). Leaderboard Space: `khalisfoundation/GAB-leaderboard`.
- Tiers: `main` (Kirtan, Paath, Sung Bani, Akhand Paath rows), `akhand` (Akhand Kirtan, folder 5-akhand-kirtan), `hard` (Fremont hall).
- Splits: practice = train + dev (tune here). `--split test` = held-back recordings: run before anything ships. Practice gains often do
  not hold (9.0.5 is the example), and Arash's rule is: generalise, never overfit.
- One-command setup in a fresh container: `bash research/cloud-gab/setup.sh` (`--test` adds held-back audio). Needs env HF_TOKEN and
  VF_AZURE_SAS (never print them). It installs deps, checks out the GAB tools (branch `gab-tools-handoff`) to
  `/home/user/gab-tools/research/level2-dataset/tools`, applies `gab-tools-cloud.patch`, gets the database and audio, and copies the
  fork's leaderboard page into `tools/gab-space/index.html`.
- Answer keys: pangti-level keys for all 269 recordings are merged in GAB, so every row scores right Shabad, right pangti, behind the singer
  and wrong-Shabad seconds per hour.

## 3. Caches (what is stored where)

| What | Where | Notes |
|---|---|---|
| Speech-model windows (emissions) | Azure `bench-cache/` (model sha 5f9e41d867de) | Recorded by the model. Keyed by audio. Never delete. Recordings first made on the Mac (darwin-arm64) can only be refilled on the Mac: never mix platforms. |
| Replays (screen events + scores per build) | Azure `bench-results/replays/` | Keyed by app tree hash. `node research/cloud-gab/results-sync.js pull|push|list`. Any build replayed once never needs replaying. |
| Scorecards | `/home/user/gab-tools/research/level2-dataset/results/gab/<date>-run/scorecard.json` | Per-clip `clips` array: compare recording by recording. |

- Re-score a build from replays in seconds (no model): worktree `/root/personal/vmscore`, check out the base commit, set constants with sed in
  `www/main/addons/voice-follow/components/VoiceFollow.jsx`, commit with
  `git -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: ..." --date 2026-01-01T00:00:00Z`
  (same parent + same edit + same author/date = same tree hash in every session and on the VM), then in the tools folder:
  `VF_MIN_FREE_GB=1 VF_NO_EMIS_PULL=1 ./gab run /root/personal/vmscore --set main --tier full --jobs 4 --manifest hf [--split test]`.
- A new build that changes what the model is asked (window length, alignment) needs new windows: that is a VM `--fill` job (or the Mac).
- Disk is a few GB: delete worktrees and caches you no longer need; everything big is in Azure.

## 3b. x86 is the reference (Oct 17)

Owner's decision (Oct 17 2026): x86 (linux-x64) is the reference platform for GAB, as it is for production (most PCs are
Intel/Windows). Every GAB recording, all tiers and both splits, has x86 speech-model output, so any build can be scored
in the cloud and no recording is Mac-only.

- **Where:** a separate cache namespace, codec `q16-x86` (same q16 encoding): Azure `bench-cache/5f9e41d867de/q16-x86/`,
  local `<cache>/5f9e41d867de-q16-x86/<clip>/`. It holds linux-x64 output only (entries without a stamp count as x86;
  any other platform is refused when recording into it). The old namespace `q16` (Mac entries + the first x86 entries)
  is kept as it was and never touched. Replays are keyed by codec too, so x86 and older replays never mix.
- **Default:** `gab` scores from `q16-x86` unless `VF_EMIS_CODEC` is set (the cloud patch sets it; the line
  "model output: x86 reference" in every run confirms it). `VF_EMIS_CODEC=q16` gives the older mixed Mac + x86 numbers.
  The older VM jobs (`fill-x86*`, `score*`, `test*`, `apaath*`) stay on `q16`, so a job started before Oct 17 behaves as it did.
- **All leaderboard numbers come from x86** from the Oct 17 re-score on (9.0.4, 9.0.6 candidate, 9.0.4 + Aarti 1,
  Bani end exit; every tier, practice + test). Compare a build only with x86 numbers.
- **Score build X on all tiers on the VM** (records any x86 output X needs, then scores main, akhand and hard, practice
  and test; scorecards go to Azure `bench-results/x86-cards/<build>/<tier>-<dev|test>.json`, replays to `bench-results/replays`):
  ```
  gcloud compute instances add-metadata vf-record --zone us-east1-b \
    --metadata '^;^cg-job=x86-X-1;cg-builds=X:<commit>:CONST=v,CONST2=v;cg-fill=X;cg-score=X;cg-branch=claude/sweet-brahmagupta-x0uez6' \
    --metadata-from-file startup-script=research/cloud-gab/vm/vm-startup.sh
  gcloud compute instances start vf-record --zone us-east1-b
  ```
  `cg-builds` is optional (or add `mk X <commit> CONST=v` to vm-job.sh); several builds: space-separated in cg-fill /
  cg-score. Job names must start with `x86`. Resumable: if the 6 h stop cuts it, start the VM again with the same metadata
  (finished builds are skipped; saved replays are reused). Pull scorecards with
  `node research/cloud-gab/results-sync.js pull --prefix bench-results/x86-cards --dir <dir>`.
- **Re-score from shared replays** anywhere (container or Mac with the cloud patch): `node research/cloud-gab/results-sync.js pull`,
  then `VF_NO_EMIS_PULL=1 ./gab run <build> --set main|akhand|hard --tier full --manifest hf [--split test]` (no model, seconds).
- **First run (Oct 17, job x86-ref-2, ~3 h VM):** 327 GAB recordings (34.7 h) all on x86; 183 recorded new (Mac-only
  before), 138 copied inside Azure from the earlier x86 entries. Scored: r904 (9.0.4), cand906b (9.0.6 candidate),
  aarti906 (9.0.4 + AARTI_FOLLOW=1), lev1 (BANI_END_EXIT=1). x86 vs the old mixed numbers for 9.0.4, same recordings:
  within about 1 point on every track; Bani sung wrong-Bani time 55 -> 23 s/h (practice), GAB-Hard practice pangti 47.7 -> 42.5.
  Akhand Paath practice now has 11 recordings (sp01-03 added) and Akhand Kirtan test 12 (nw11_session), so those rows
  differ from older numbers by their clip set too.
- **Recording speed on the VM:** `VF_RECORD_JOBS` (default 10 there) recordings side by side, 3 model threads each;
  `VF_REPLAY_MAX` widens replays past 4 workers. Both default to the old behaviour (1 and 4) on the Mac.

## 4. The two VMs (Google Cloud, us-east1-b)

- `vf-record` and `vf-record-2`, 32 cores each (CPU quota 64; GPU quota 0). Each boot stops itself after 6 h. Budget $300 cap, $150 kill-switch.
- Keys come from Secret Manager on the VM; nothing secret is in metadata.
- A job = metadata + start. Always re-send the startup script:
  ```
  gcloud compute instances add-metadata vf-record-2 --zone us-east1-b \
    --metadata '^;^cg-job=fill-x86-v20;cg-fill=kf8;cg-suites=apaath;cg-score=kf8;cg-test=kf8;cg-branch=claude/sweet-brahmagupta-x0uez6' \
    --metadata-from-file startup-script=research/cloud-gab/vm/vm-startup.sh
  gcloud compute instances start vf-record-2 --zone us-east1-b
  ```
- Job names: `fill-x86*` = record windows + score + test; `score*`; `test*`; `apaath-test*` (held-back Akhand Paath).
- Builds are defined in `research/cloud-gab/vm/vm-job.sh` as `mk <name> <commit> CONST=v ...` (add yours there and push first).
- Progress: serial console lines prefixed `CGJOB` (`gcloud compute instances get-serial-port-output <vm> --zone us-east1-b | grep CGJOB`).
  Results land in Azure; pull with results-sync. A watcher over serial output is cut at 2 h: poll every few minutes instead.
- The gcloud login in the old session expired on Oct 17; make sure yours works before collecting the 8 PM PT results.

## 5. Builds and branches

- App fork branches: `vf-9.0.4` (9.0.4 in the app; 9.0.5 merged on it as 1271040), `exp-on-904` (experiments behind constants, all 0 = off:
  KIRTAN_FOLLOW profiles 1-8, NEAR_TWIN, SIMRAN_HOLD, AARTI_FOLLOW), `ak-stack2` (Akhand Kirtan verifier stack).
- 9.0.6 candidate = exp-on-904 747b9b7 + NEAR_TWIN=0.03 + AARTI_FOLLOW=1 (build `cand906b`, app tree d1d7b9676dc8).
- Tests: `npx jest www/main/addons/voice-follow` (83 pass). VoiceFollow.jsx has 5 prettier-only lint errors from the experiment blocks.

## 6. Leaderboard publish

- `cd <tools>; VF_HF_CREATE_PR=1 [VF_PARTIAL=1] ./gab publish --batch <batch.json>` opens PRs on the Space and dataset.
- Batch example: `research/cloud-gab/leaderboard/publish-batch-905-906.json` (9.0.5 + 9.0.6 rows, `allowIncomplete`).
- `VF_PARTIAL=1` publishes rows with a few missing recordings as numbers with `*` (patch in gab-tools-cloud.patch).
- The page must be the fork's `research/cloud-gab/leaderboard/index.html` (setup.sh copies it). A publish once shipped the tool's old page
  and wiped the layout; check the page after every publish. Version names: `tools/gab-space/gab-names.json`.
- Mac fill: `research/cloud-gab/mac-fill.sh` on Arash's Mac completes the 9.0.5/9.0.6 rows; after "Mac fill done", re-run the batch without
  `allowIncomplete` and without VF_PARTIAL.

## 7. Helper scripts (`research/cloud-gab/`)

- `lines/`: pangti alignment and keys (`line-build.js`, `line-eval.js`, `apaath-keys.js`), verifier tools (`verifier-sweep.js`,
  `verifier-floor-sweep.js`, `verifier-test.js`), review app (`review-server.js`, `review.html`).
- `iso/` (scratch tools from the Akhand Kirtan diagnosis; paths are hard-coded to this container layout):
  `diag.py` (what audio conditions make the model hear a pangti badly), `ap-align.js` / `iso-eval*.js` (voice isolation and 1.3x speed
  tests), `sep.py` (htdemucs separation), `confirm-compare.js` (Surinder's model vs the app's model as Shabad confirmer),
  `vmscore.sh`, `vm1score.sh`, `vm2b.sh`, `cand.sh`, `twintest.sh` (re-score recipes from shared replays).
- `run-job.sh`: one helper session's replay job. `fetch-audio.js`, `results-sync.js`, `setup.sh`, `mac-fill.sh`.
