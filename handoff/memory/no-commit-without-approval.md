---
name: no-commit-without-approval
description: "Standing rule: do NOT git commit unless the user explicitly says to"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 912be5a1-888f-4cb5-8069-6e0729b9a0c9
  modified: 2026-09-10T17:50:48.285Z
---

Do NOT create git commits unless the user explicitly tells me to (said 2026-09-10, mid voice-follow work).

**Why:** the user wants to control what enters history / when to snapshot, especially on the autopilot work where they revert to known-good points [[voice-follow-kirtan-switch-bench]].

**How to apply:** make and verify edits freely, but leave changes uncommitted and staged-at-most; ask/wait for explicit "commit" before running `git commit`. Still label autopilot work `[AUTOPILOT]` when a commit is eventually authorized.
