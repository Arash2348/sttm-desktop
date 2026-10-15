---
name: cycle-numbering
description: "Each accepted Voice-Follow improvement bundle gets the next cycle number (10, 11, 12...) and a plain entry in CYCLES.md"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-26T08:52:26.067Z
---

User (2026-09-26, going to sleep): keep the AWS instance busy running trials of approaches likely to improve the metrics, keep iterating toward every goal, and name successive accepted iterations Cycle 10, Cycle 11, Cycle 12... so they can follow progress.

**Why:** they want to wake up to a clear, numbered progression rather than a pile of trial names.

**How to apply:** trial names (greet, h1s8...) are internal; when a bundle passes the keep rule (no metric worse on deciding sets, lockstep, vs the previous cycle), promote it to the next cycle number and write a CYCLES.md entry with a before/after goal table. Still no commits without explicit approval; work stays in the ~/personal/sttm-c10-dev worktree. Related: [[cycle10-scope]], [[mac-compute-limit]].
