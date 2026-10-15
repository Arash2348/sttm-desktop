---
name: judge-on-heldout
description: "A version is only \"better\" if it holds on held-out data (locked test, Yuba unseen, Level 3) and on a busy-machine real-time run, not just the tuning clips"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-27T06:21:26.244Z
---

User (2026-09-27): overfitting is the thing to avoid; declaring something "better" must mean truly better.

**Why:** real-time Cycle 12 beat Cycle 8 strongly on the 97 tuning clips but only partly on the locked test + Yuba
(more found/right, but wrong stretches slightly longer) — tuning-set wins didn't fully transfer.

**How to apply:** every verdict table shows tuning, locked test, Yuba unseen (and Level 3 when run) as separate rows;
"better" requires no held-out set worse, plus the result holding on the busy-computer (half CPU) real-time run and a
harness-equivalence check. Never tune on held-out sets; say when a held-out difference is only 1–2 clips (noise).
Related: [[level3-policy]], [[results-as-tables]], [[priority-find-faster]].

Live-mode noise (measured 2026-09-30): same code reruns move Level 2 wrong by ~0.1-0.2 pt and the single hall clip
between 1.4 / 6.4 / 9.2 % wrong. Never judge on one live run: repeat the hall >= 5x and rerun the baseline alongside.
