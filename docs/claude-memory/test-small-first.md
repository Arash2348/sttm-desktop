---
name: test-small-first
description: "Test smart: prove a change on a fast small set first, then extend incrementally; full suites only on final candidates; never burn time/usage on big runs of unproven ideas"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T03:20:29.717Z
---

The user (Oct 12 2026): "always prefer testing small making sure things work, and incrementally
becoming better and better. use your time extremely wisely. instead of full benchmark, run a fast
small one, prove the concept, then extend incrementally."

**Why:** full suites run at real time under one machine lock (hours); today's agents reran full
suites on intermediate commits and wasted most of a day of compute and usage.

**How to apply:** every change goes smoke set (seconds/minutes, cached replay if possible) ->
one held-out set -> full tier only on the final candidate. Tell every sub-agent this explicitly
in its brief. Related: [[mac-compute-limit]], [[judge-on-heldout]], [[always-baseline-numbers]].
