---
name: voice-follow-oracle-bakeoff
description: "Oracle within-shabad tracking bake-off — per-mode winners (Path=forced-align, Kirtan=CTC-posterior)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-09T22:47:49.415Z
---

Bake-off (2026-09-09) for [[voice-follow-project]] under the ORACLE reframe (shabad already
known; maximize within-shabad line tracking, distractor-FP gates dropped). Harness:
`voice-align-server/oracle_bench.py` (pluggable decoder; metrics: overall_acc, tracking_acc =
frames after first correct lock, switch_med lag, lock_med). Two acoustic backends wired
(karansea raw-audio ONNX, surinder features ONNX). Ran a verified 5-strategy Workflow.

KARANSEA baselines: kirtan 42.4 overall / 47.0 tracking; clean 88.6 / 85.2. Results (tracking):
- **align2** (global line-graph CTC FORCED ALIGNMENT, `strat_align2.py`): CLEAN **93.2** (offline)
  / 91.1 (causal) — beats baseline by ~+8. KIRTAN 34.3 — LOSES. Root-cause fix that made it work:
  the CTC **blank-sink** (every line's blank state emits identical lp[t,BLANK]; ~90% blank frames
  → path clings to a finished line's trailing blank for up to 30s). Cure = a small per-frame
  **stay_pen (~3.0)** on the self-loop to break the tie toward advancing. Frame-level alignment
  wins on spoken/clean, loses on sung.
- **post** (per-window CTC **POSTERIOR** line score via prefix-aware `ctc_score`, replacing
  greedy→fuzzy emission, fed to the same token-passing line Viterbi; `strat_post.py`): KIRTAN
  **49.6** track / 43.6 overall — BEST kirtan (+2.6). CLEAN regresses to 82.1/87.0. Best cfg
  win=12, norm_mode="band" band=1.1. Kirtan-only.
- **ens** (karansea+surinder confidence-weighted per-frame fusion, `strat_ens.py`): kirtan 47.4,
  clean 85.6 — tiny safe win both; lock faster. Only conf-weighted fusion helps (global blend dilutes).
- **look** (bounded lookahead+onset, `strat_look.py`): clean 87.8 (+2.6, sweeps clean), kirtan track 47.9.
- **dur** (duration/tempo monotonic prior, `strat_dur.py`): kirtan 48.0, clean 85.4 — small.

**Per-mode winners → product recommendation:**
- **Path Mode = align2 forced alignment** (85→93 clean; causal readout also clears bar). Big real win.
- **Kirtan Mode = post CTC-posterior** (47→49.6). Modest.
- **Strongest next step (not yet built):** a SEGMENTAL line-graph Viterbi whose emission is
  per-window `ctc_score` (fuses align2's graph + post's posterior emission) — avoids the frame-level
  blank ambiguity and could lift kirtan further. Then port winners from the offline harness into the
  STREAMING `karansea_engine.py` (the live server/desktop use that, not the bench decoders).

**Confirmed across ALL strategies:** kirtan **switch_med stays pinned at the ~8s cap** — the switch
lag is acoustic-floored, not a decoder lever (matches [[voice-follow-realkirtan-frontier]]). The
frontend predictive pre-highlight is the real leading-indicator lever. Kirtan accuracy still bounded
by the ~37-50% acoustic ceiling; a real break needs a kirtan-adapted acoustic model (see
[[voice-follow-kirtan-model-goal]]).
