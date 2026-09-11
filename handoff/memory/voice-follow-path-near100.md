---
name: voice-follow-path-near100
description: Path-mode near-100 investigation — errors are 100% fixable (not acoustic); align2 best streaming, seg raises offline ceiling
metadata:
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-09T23:46:46.808Z
---

Push to get **Path Mode** ("as close to 100 as possible") for [[voice-follow-project]],
after scoping kirtan out for now (kirtan is #1 use case but deferred — see
[[voice-follow-kirtan-model-goal]]). Work on the CLEAN recitation set (VF_GT_DIR=
.../live-gurbani-captioning-benchmark-v1-main/test, VF_AUDIO_DIR=.../benchmark/audio),
only ~12 segments / ~4 shabads — small, a couple hard recordings dominate.

**DECISIVE finding (`_decisive.py`): Path errors are 100% FIXABLE, 0% acoustic.**
On all 12 of align2's wrong ≥3s stretches, the windowed CTC *posterior* of the GT line
outranks the wrongly-picked line (e.g. GT −0.08 vs pred −0.31). The acoustic model KNOWS
the right line; align2's per-FRAME token emission mis-integrates it. So the ~93 ceiling is
NOT an acoustic wall — it's emission granularity.

**Root cause = "attractor line".** The most-repeated line (usually the rahao, e.g. line 3
in kchMJPK9Axs, line 6 in zOtIpxMT9hU) wins during acoustically weak stretches because its
common/short tokens coincidentally emit high per-frame. NOT fixed by rahao penalty, jump
penalty, or median smoothing (collar=1 already forgives blips; the counted errors are long
multi-second wrong stretches). Diagnosed via `_analyze_path.py` (85% interior, not boundary)
+ `_trace.py` (pred snaps to the attractor).

**Numbers (KARANSEA, clean; overall / tracking / switch / lock):**
- current shipping streaming engine (baseline_strategy): 88.6 / 85.2 / 5 / 2.65
- align2 OFFLINE (ceiling): 93.4 / 93.2 / 1 / 0.15
- align2 CAUSAL (streaming): 92.6 / 91.1 / **7** / 1.85  ← switch 7s is DP integration lag,
  NOT the readout (lag param has zero effect); frame-level forward DP is slow to flip lines.
- **seg** (`strat_seg.py`, NEW — segmental line Viterbi, emission = free-entry/exit
  `ctc_score` of each line over a trailing window): OFFLINE 88.9 / **95.7** / 2 / 0.85 (win=2.5)
  — best FOLLOWING, +2.5 track over align2. CAUSAL 88.1 / 90.4 / **2-3** / 3 (win=3) — best
  switch lag, but overall lower (slow lock/acquisition). Dual-window (short+long, max fuse)
  FAILED (79-83, short window injects FPs).

**Decision — Path streaming decoder = align2** (best overall 92.6/91.1, +4/+6 vs shipping,
locks fast). Its 7s switch lag is a **frontend problem**: mitigate with predictive
pre-highlight (per voice-align-server/CLAUDE.md: switch is the frontend's job), NOT by
trading 4 accuracy points for seg. **seg is the ceiling-raise research path** (proves 95.7
track reachable); a *smarter* align2+seg fusion (not naive max) is the next real lever.

**NEXT:** port align2 causal into streaming `karansea_engine.py` as the karansea/path
profile (currently runs the greedy→fuzzy line-graph decoder, NOT align2) so E2E reflects it;
then frontend predictive pre-highlight. Scratch scripts left in voice-align-server:
`_analyze_path.py _trace.py _decisive.py _sweep_rahao.py _sweep_smooth.py _align2_lag.py`
strat_seg.py. See [[voice-follow-oracle-bakeoff]] [[voice-follow-desktop-integration]].
