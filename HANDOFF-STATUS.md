# HANDOFF-STATUS: Akhand Kirtan round 1 (cloud session, Oct 15 2026)

Work for `vf-akhand-kirtan-1`, off 9.0.3 (`3fafc0ba`). The cloud session can push only to its own branch, so
it is on the fork as **`claude/sweet-brahmagupta-x0uez6`**; rename or re-push it as `vf-akhand-kirtan-1` from the Mac
if you like. The local-scoring experiment is the same tree with one line changed (the checklist makes it).

**Decision needed from GAB, not from me:** nothing here is measured yet. The cloud session has no emission
cache, Hugging Face token or Azure SAS, so GAB cannot run here. Every change is a named constant (0 = off) in
`www/main/addons/voice-follow/components/VoiceFollow.jsx`, built so GAB can score each one on its own.

## What is on the branch (one commit per step)

| commit | what it does | aimed at | constant (0 = off) |
|---|---|---|---|
| `f3859279` `da64ce48` `488c3721` | V6 Shabad-level evidence (the `vf-fix1-v6` commits themselves; this branch starts from them) | idea 1: score V6 on Akhand | `SHEV_LOCK`, `SHEV_SWITCH` |
| `31ed091a` | **Solid-win guard:** a switch commits on the win count only when at least one win in the run was heard on a solid decode (>= 16 letters) | GAB-Hard kh17: 32 s false switch on 8-9 letter decodes, the one reason V6 failed Hard | `SWITCH_COMMIT_SOLID = 1` |
| `eea1d2f8` | **Probation after a first lock:** after a lock made while searching (not a switch, tap or Bani), until the locked Shabad is heard clearly once (a solid decode scoring >= 0.65 on it), for at most ~60 s, a rival Shabad switches in on 2 wins instead of 3 | idea 2: GAB-Akhand ytak_0typ, wrong lock at 9.7 s, right Shabad only at 95 s | `PROBATION_DECODES = 120`, `PROBATION_CONFIRM = 2` |
| `c6d36ded` | Lint only: V6 had 5 lint errors (would fail CI); no behaviour change | | |
| `8c7a6ca8` | **Local pangti scoring** (`engine/ctcLocal.js`): the search-phase acoustic check scores each candidate pangti where it is sung inside the 10 s window, instead of aligning the whole pangti from the window's first frame. **Off on this branch** | idea 4 | `AK_LOCAL_CTC = 0` (experiment: `= 2`) |

Idea 3 (careful first lock, 2+ distinct pangtis) is already what V6's search lock does (`ev.distinct >= 2`),
so it gets measured with V6. A stricter rule for the older single-phrase lock routes would slow main GAB's
find time; I did not add it blind.

## What was measured here (no GAB)

| check | 9.0.3 | this branch |
|---|---|---|
| Unit tests (`node --test www/main/addons/voice-follow/components/*.test.js`) | 35 / 35 | **52 / 52** (17 new: solid guard 4, probation 4, local scorer 9) |
| Policy KPIs (`switchPolicy.eval.js`) | all hold | all hold |
| ESLint, `app.js packaging www/main` | 124 problems | 124 problems (same; none in changed files) |
| Component tests (`test/voice-follow`, with the public BaniDB database) | 32 pass, 59 fail | identical (a Node 22 ESM loading issue in this container, not this change) |
| Local pangti scorer cost, 10 s window (Xeon 2.8 GHz) | whole-window score 1.7 ms / pangti | **0.18 ms / pangti** (9x cheaper) |

## GAB checklist for the Mac (exact commands)

Run from `research/level2-dataset/tools` in the GAB tools tree. Practice split only (train + dev); test split
once at the end.

```sh
cd ~/personal/sttm-desktop && git fetch arash claude/sweet-brahmagupta-x0uez6
git branch vf-akhand-kirtan-1 arash/claude/sweet-brahmagupta-x0uez6
for c in 488c3721:ak-v6 31ed091a:ak-solid eea1d2f8:ak-probation vf-akhand-kirtan-1:ak-ctc; do
  git worktree add ~/personal/${c#*:} ${c%%:*} && ln -s ~/personal/sttm-desktop/node_modules ~/personal/${c#*:}/node_modules
done
# the experiment: local pangti scoring on (committed, so GAB's per-tree result cache sees a new tree)
cd ~/personal/ak-ctc && git switch -c vf-akhand-kirtan-1-ctc && sed -i '' 's/^const AK_LOCAL_CTC = 0;/const AK_LOCAL_CTC = 2;/' \
  www/main/addons/voice-follow/components/VoiceFollow.jsx && git commit -qam "Experiment: AK_LOCAL_CTC = 2" && cd -
cd <GAB tools>
# 1. V6 alone on Akhand (idea 1); main and Hard were already measured on vf-fix1-v6
./gab akhand compare upstream ~/personal/ak-v6 --tier full
# 2. each step against the one before it, all three tiers
for pair in "ak-v6 ak-solid" "ak-solid ak-probation" "ak-probation ak-ctc"; do
  set -- $pair
  ./gab compare      ~/personal/$1 ~/personal/$2 --tier full
  ./gab hard compare ~/personal/$1 ~/personal/$2 --tier full
  ./gab akhand compare ~/personal/$1 ~/personal/$2 --tier full
done
# 3. the best combination against 9.0.3 on all three tiers, then publish it to the leaderboard
```

Expect `ak-ctc` to report cache misses on the search-phase acoustic check only if its windows change; they
should not (it scores the same emissions differently), so it should replay from cache.

**Keep rule (owner's):** a step is kept only if no guarded number is worse on main GAB and on GAB-Hard; on
GAB-Akhand it must move right Shabad %, wrong s/h or find time the right way. Stop after 2 rounds with no gain.

## What I expect, and what would change my mind

| step | expected on GAB-Akhand | risk to watch |
|---|---|---|
| V6 | more right Shabad (it helped Hard: 52.8 -> 58%) | main find time |
| Solid guard | GAB-Hard wrong s/h back to <= 9.0.3 (kh17) | slower real switches on main: switch "within 10 s" count |
| Probation | ytak_0typ right Shabad in ~10-20 s, not 95 s | a correct lock the model never hears clearly can be switched away from in its first minute: main wrong s/h |
| Local scoring | better first lock on many-voice audio | the 2-nat margin is a guess; tune `AK_LOCAL_CTC` (1-3) and the margin on train+dev only |

## GAB results, round 1 (cloud, Oct 15 2026; practice split = train + dev; replay from the shared cache)

**Baseline check:** 9.0.3 (3fafc0ba) on full GAB-Akhand reproduces the published v1.3 row exactly (78.2% right Shabad,
398.3 wrong s/h, find 5.8 / 38.1 s, 7 not found, switches 6 / 1 / 3). GAB-Hard: 52.8% right Shabad, 47.7% right pangti.

| step (vs the one before) | GAB-Hard (20 clips) | GAB-Akhand (23 clips) | main GAB | call |
|---|---|---|---|---|
| V6 (488c3721) vs 9.0.3 | FAIL: wrong Shabad 350.8 -> 358.9 s/h (33 better, right Shabad 52.8 -> 58%) | PASS: right Shabad 78.2 -> 78.8%, not found 7 -> 6 | running | promising, not keepable alone |
| solid-win guard (31ed091a) vs V6 | **FAIL**: right Shabad 58 -> 48.8%, wrong 358.9 -> 456.9 s/h, not found 7 -> 8 | INCOMPLETE (7 clips) | - | **dropped** |
| V6 + probation (`SWITCH_COMMIT_SOLID = 0`) vs V6 | **PASS, 17 better**: right Shabad 58 -> 58.4%, right pangti 48.8 -> 49.2%, fremont-train find p50 100.4 -> 89.1 s | INCOMPLETE (9 clips) | not run | **best so far** |
| V6 + local scoring (`AK_LOCAL_CTC = 2`) vs V6 | INCOMPLETE (10 clips) | INCOMPLETE | INCOMPLETE (53 clips, with the guard on) | cannot judge yet |
| all constants 0 vs V6 (check) | identical | identical | - | constant = 0 really removes a step |
| window alignment (122acabb) vs 9.0.3 | INCOMPLETE (11) | INCOMPLETE (22) | INCOMPLETE (186 of ~200) | needs a near-full re-record |

**INCOMPLETE = the change asks the speech model for windows the cache has never seen** (a lock or switch at a new moment).
Replay-only rule: not recorded here. Where each clip can be filled (a clip never mixes machines; Azure manifest platform):

| clips | cached on | fill where |
|---|---|---|
| Akhand L3 (32), Renton Finds rn (81), Yuba (17) | linux-x64 (GCP VM) | GCP VM, or this x86 cloud container (model int8 sha 5f9e41d867de downloads publicly from karansea/...shabad-preview) |
| L2 clip*, paath pt*, Aarti aa*/bn*, Hard kh*, nw*, rt*, ytap/ytas/sp | darwin-arm64 (Mac) | the Mac only |

**Mac fill for the two finalists** (variants are constants on `d71b304`, committed so GAB's per-tree cache sees them):
```sh
cd ~/personal/sttm-desktop && git fetch arash claude/sweet-brahmagupta-x0uez6
for v in "v6-prob:SWITCH_COMMIT_SOLID=0" "v6-prob-ctc:SWITCH_COMMIT_SOLID=0 AK_LOCAL_CTC=2"; do
  n=${v%%:*}; git worktree add --detach ~/personal/$n d71b304 && ln -s ~/personal/sttm-desktop/node_modules ~/personal/$n/node_modules
  for kv in ${v#*:}; do sed -i '' "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" ~/personal/$n/www/main/addons/voice-follow/components/VoiceFollow.jsx; done
  git -C ~/personal/$n -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: ${v#*:}" --date 2026-01-01T00:00:00Z
done
cd <GAB tools> && ./gab fill --root ~/personal/v6-prob && ./gab fill --root ~/personal/v6-prob-ctc   # records Mac clips only, pushes to Azure
```
App tree hashes (must match the cloud): v6-prob d04e5aee6242, v6-prob-ctc ab8536eeb6da.

**Cloud infrastructure (new):** `research/cloud-gab/` — `setup.sh` (one command: deps, GAB tools + cloud patch, BaniDB,
HF audio, Mac path layout), `run-job.sh` (one helper session = one build replayed on given tiers), `results-sync.js`
(replay results shared in Azure `bench-results/`, so a build replayed once is never replayed again in any session).
Measured: replay ~32x real time on 4 cores (Akhand 3 min, Hard 5 min, main ~30 min per build).

## Pangti-level answer keys for all of GAB (cloud, Oct 15 2026)

Every GAB clip with Shabad / Bani truth (307 clips, 31.3 h, all tiers and both splits) is force-aligned pangti by
pangti with TWO speech models (Karanbir int8 = the app's; Surinder pa-v3-kirtan fp32 with a NeMo mel front end;
same 256-token vocabulary), inside each truth row's window (`research/cloud-gab/lines/line-build.js`).

**Accuracy, measured on GAB-Hard's 29 human-keyed clips** (`line-eval.js`; human = sevadaar screen, lags 0-3 s):

| aligned start | starts | right pangti on the human screen | human start within 3 s |
|---|---|---|---|
| both models agree within 1 s + heard words match (check >= 0.5): **auto-accepted** | 273 | **97%** (n 162 on practice) | 45% (screen lag) |
| both agree, weak word match | 166 | ~65% | 30% |
| one model only | 371 | 41% | 13% |

| tier · folder | clips | pangti starts | auto-accepted | to review |
|---|---|---|---|---|
| main · kirtan | 144 | 5,496 | 3,064 | 2,578 |
| main · Bani recited | 47 | 1,047 | 944 | 151 |
| main · Bani sung | 55 | 2,120 | 1,239 | 939 |
| GAB-Akhand | 32 | 819 | 440 | 402 |
| GAB-Hard (already human; calibration only) | 29 | 810 | 273 | 0 |
| **total** | **307** | **10,292** | **5,960** | **4,070** |

Human-labels-first: every aligned key is `aligned-*` (secondary) until a person confirms it; the review queue holds
every not-auto-accepted start plus a 5% spot check of the accepted ones. Shared in Azure `gab-lines/` (keys,
alignments, review items; no audio, no model output).

**Review on the Mac:** `bash research/cloud-gab/lines/review-mac.sh` (pulls the queue, opens http://localhost:8772;
Pangti Start Check design; recordings with the fewest open pangtis first) and `review-mac.sh --push` after a session
(prints the human-confirmed count, shares the answers). `line-apply.js` writes the final keys (human-confirmed /
human-tapped). Not yet on Hugging Face: only human-checked keys go there.

**GCP VM:** the service-account key works (VM vf-record found STOPPED). VM jobs (`research/cloud-gab/vm/`) are written
but not run: the session's safety guard blocks sending the HF / Azure keys to the VM (metadata) or reading the VM's
own copies; needs the owner's explicit OK. The key was pasted in chat: rotate it.

## Shabad verifier, offline test on GAB-Akhand (practice, 23 recordings, 280 windows of 30 s; Oct 15 2026)

Idea: the model is poor at picking the Shabad out of the whole Guru Granth Sahib, but good at confirming a given one
(told the Shabad, it clearly hears ~64% of Akhand pangtis). So: align each search candidate over the last 30 s and
keep the best fit. `research/cloud-gab/lines/verifier-test.js` (Karanbir int8 output, follower-bench align.js).

| right Shabad vs ... | windows | scores best | by a clear lead (> 20) |
|---|---|---|---|
| 20 random Shabads | 280 | 90% | 75% |
| the wrong Shabads 9.0.3 showed | 162 | 87% | 70% |
| the app's own search candidates (up to 25 per window) | 278 | 79% | 64% |

The app's search proposes the right Shabad at least once in 89% of the windows (so the evidence is there to pick).
Against what 9.0.3 had on screen at the end of each window:

| 9.0.3 screen | windows | verifier says right Shabad with lead > 40 | verifier says a wrong one with lead > 40 |
|---|---|---|---|
| still searching (blank) | 36 | **18** | 2 |
| wrong Shabad | 28 | 2 (right at all: 9) | - |
| right Shabad | 216 | - | 4 (2%) |

Reading: the verifier's clear win is **finding faster while the app is still searching** (half of the searching
windows, 18 right vs 2 wrong); it rarely rescues a wrong lock and rarely contradicts a right one. Rough upper bound:
moving those 18 windows from blank to right ~ +6 points right Shabad on Akhand (78 -> ~84%). Next: build it in the app
behind a constant (verifier lock while searching, lead > 40), fed from the decode windows the app already runs (no new
model passes, so it replays from the cache except where it changes later windows), then score on all three tiers.

## Brief for the Mac session: fill the x86 Akhand / Renton windows on the GCP VM (paste into Claude on the Mac)

> The cloud session cannot send the HF / Azure keys to the VM (its safety mode), so this runs from the Mac, which
> already reaches the VM and holds the keys. Goal: record the missing model windows of three candidate builds on the
> x86-recorded clips (GAB-Akhand l3*, Renton Finds rn*) on vf-record itself (the machine that recorded them), push
> them to Azure bench-cache/, stop the VM. ~30-60 min, ~$1-2. Owner OK given Oct 15 2026; budget rules unchanged.
>
> 1. Start vf-record (us-east1-b, project vf-bench-sttm) with its usual 6 h self-stop; ssh in.
> 2. On the VM, as the user that holds ~/.vf-hf-token and ~/.vf-azure-sas:
>    ```sh
>    export HF_TOKEN=$(cat ~/.vf-hf-token) VF_AZURE_SAS=$(cat ~/.vf-azure-sas)
>    sudo -E bash -c 'mkdir -p /home/user && cd /home/user && rm -rf sttm-desktop &&
>      git clone -q --depth 200 -b claude/sweet-brahmagupta-x0uez6 https://github.com/Arash2348/sttm-desktop &&
>      cd sttm-desktop && bash research/cloud-gab/vm/vm-job.sh fill-x86 2>&1 | tee /tmp/fill-x86.log'
>    ```
>    (vm-job.sh runs setup.sh --model: node deps, GAB tools + cloud patch, BaniDB, HF audio, the int8 model with sha
>    check; builds v6-prob / v6-ctc / v6-prob-ctc as committed constants on d71b304; vf-check --fill on l3 + rfinds
>    (platform guard: only linux-x64 entries are recorded into); pushes the grown entries to Azure; pushes replays
>    to bench-results/.) It needs node 22 on PATH (vm-startup.sh shows how to install it into /opt/node).
> 3. Check the log ends with "fill-x86 done" and "pushed to Azure bench-cache", then STOP the VM.
> 4. Tell the cloud session; it scores GAB-Akhand for the three builds from the shared cache in seconds.

## Owner's standing instruction (Oct 16 2026)

"Don't ask me, just do things." Every session working on this: do not stop to ask the owner for OKs, choices or
confirmations; pick the sensible option, do it, and report what was done. Ask only when a step is impossible without
the owner (a key or account only they hold, or a platform safety check that needs their approval typed in that
session), and then give the exact one-line step. The hard rules above (keys, no deletes in Azure, no AWS, budget,
Gurbani wording) still hold.

## Owner's standing goals (Oct 16 2026)

1. **Key objective: GAB-Akhand Kirtan above 85% right Shabad, with main GAB and GAB-Hard no worse.** Iterate
   ruthlessly, fundamental method and design changes included (tracker: Key objectives).
2. **"Make the cache exhaustive in everything we do, so future changes score lightning fast."** Whenever the VM is
   up, use spare time to fill every window any candidate asks for, on every tier, and push it to Azure; prefer
   fixed-grid (window-align) recordings so new app changes replay from the cache instead of coming back INCOMPLETE.
   VM queue order (owner, Oct 16): the Shabad verifier builds and probation first, Akhand (l3) before Renton (rfinds,
   only for builds worth the main-tier check); then window alignment's one full GAB re-record on the VM (~2-3 h,
   ~$5; a second boot is fine under the $150 cap, 6 h self-stop per boot).

## Open questions for the owner

1. Add `HF_TOKEN` and `VF_AZURE_SAS` to this cloud environment's settings (environment menu in the session's
   title bar, then Edit), then start a new cloud session: a session only picks up variables added before it
   started. Then GAB can run in the cloud and this checklist runs there instead of on the Mac.
2. Fix 6: decided (Oct 16), see Backlog.

## Backlog (decided, not scheduled)

- **Fix 6: after a ceremony, hand off cleanly to what is sung next.** Owner's call: the app should follow the
  next Shabad well after a ceremony (Ardas, Hukamnama, Anand Sahib) rather than pause, but only if no other GAB
  metric gets worse (main, Fremont, Akhand: right Shabad, wrong-Shabad s/h, find time). Not built now: Akhand
  Kirtan comes first. Pick it up if the issue shows up again in a recording or a report; build it as a constant
  (on/off) and run the GAB checklist before keeping it.
