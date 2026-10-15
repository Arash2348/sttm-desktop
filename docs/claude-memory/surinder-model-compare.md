---
name: surinder-model-compare
description: 2026-10-11 fair bench — Surinder Singh's kirtan model (fp32) ~ties Karanbir's; hears better, finds a bit slower; int8 of his is broken
metadata:
  type: project
---
Fair comparison (12 Level 2 clips, real time, Mac nice 19, worktree scratchpad/modelcmp/wt, NeMo-mel adapter verified to 0.0007 vs Karanbir's in-graph mel):
- Surinder int8 (onnx-pa-only/int8) is much worse and slower — never use it. His fp32 (460 MB) is the real model.
- Transcript match on 10 held-out clips: Surinder fp32 66.7 vs Karanbir 61.7 (fp32 and int8 same). Speed 154 vs 104 ms per 10 s.
- Shabad finding: Karanbir fp32/int8 found<=10s 9/12, median 0 s, flips 4; Surinder fp32 7/12, median 9.6 s, flips 8, right 95.3 vs 95.5%, wrong 1.1 vs 1.2%. Surinder much better on Renton clip34 (12.7 s vs 37.6 s), worse on clip02/05/11.
- Front-end variants (pre-emphasis, padding) change his score by <0.5.
**Why:** user asked for a fair side-by-side, not a switch.
**How to apply:** not strictly better; keep Karanbir ([[model-provenance]]). Remaining unfairness: engine thresholds tuned on Karanbir. Revisit when Surinder's training finishes (phase 2 target) or with a tuning run on EC2 (ask first, [[aws-stop-when-done]]).

Update 2026-10-11 (fair replay, both fp32, same default settings): a 10-setting threshold sweep on 15 held-out clips changed
neither model beyond noise, so tuning bias is not real. Replay harness (worktree only): sweep-runner.js + bench-driver
VF_EMCACHE/VF_VCLOCK/VF_CONST; matches real time exactly for Karanbir, differs for Surinder (timing-sensitive in real time).
27 clips minus 2 duplicate-label clips (25): found<=10s 20 vs 20, never 0 vs 0, right 97.0 vs 94.6, wrong 1.2 vs 1.5,
flips 6 vs 7, mean first find 5.1 vs 6.0 s (Karanbir vs Surinder). Verdict: Karanbir slightly better + faster + smaller.
