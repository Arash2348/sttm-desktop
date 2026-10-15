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

## Open questions for the owner

1. Add `HF_TOKEN` and `VF_AZURE_SAS` to this cloud environment's settings (environment menu in the session's
   title bar, then Edit), then start a new cloud session: a session only picks up variables added before it
   started. Then GAB can run in the cloud and this checklist runs there instead of on the Mac.
2. Fix 6 (after a ceremony: follow what is sung, or pause?) is still your call.
