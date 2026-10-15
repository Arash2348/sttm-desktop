---
name: follower2-bani
description: follower2 = position follower for Banis (branch follower-v2 on MVP 8.6); line-level benchmark in research/follower-bench; numbers
metadata:
  node_type: memory
  type: project
  originSessionId: 6bc95961-62cf-46e4-a2ad-4811f0f06ded
  modified: 2026-10-01T09:18:18.038Z
---

2026-10-01: built follower2 (engine/follower2.js), a position tracker for Bani/paath following: aligns each
window's transcript to the Bani as one letter stream; end of match = current position. Branch `follower-v2`
(worktree ~/personal/sttm-follower2, base mvp-8.6-c8-bani, commits up to cfdc69df (reviewed twice by subagents), local only). Used for Banis only;
Shabads/kirtan keep the Cycle 8 follower (follower2 is 5.6% wrong on sung Aarti vs 1.8%).

Benchmark: research/follower-bench (README) — 55 recitation clips, 7 Banis, line truth by offline forced
alignment + window verification + hand-checked overrides. HONEST (time-weighted, both at 0.25 s): steady within-1s
Cycle 8 68.6% -> follower2 98.6%; steady wrong 4.3% -> 0.48%; lag 1.88 -> 0.35 s; strict wrong-Bani shown
13.4% -> 4.4%. (Old 55.8%/98.5% figures were line-weighted — don't quote them.) Shipped step 0.125 s re-check pending.

**Why:** user/brother want a Sundar Gutka follower with low latency, next-line prior, short lines caught,
~99% accuracy. Website (sttm-web branch follow-along, c2266db) uses follower2 on /sundar-gutka/ pages, but
browser WASM inference is ~0.8 s per window (vs 46 ms native), so web lag is ~1.6-2.5 s.

**How to apply:** compare any follower change on this bench (bench.js + foreign.js) before shipping;
truth bugs were the main early trap (check errors.js/timeline.js before trusting a "follower error").
Related: [[mvp-8-6-bani]], [[mac-compute-limit]], [[aws-stop-when-done]], [[judge-on-heldout]].
