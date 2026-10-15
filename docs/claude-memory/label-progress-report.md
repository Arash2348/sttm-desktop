---
name: label-progress-report
description: After every line-labelling session, report how many pangti starts are fully human-confirmed (yes or tapped start), separate from auto/unconfirmed
metadata:
  type: feedback
---

The user (Oct 14 2026): after each labelling session, say how many pangti-level lines are now fully correct.

**Why:** they want to see the human-verified line data grow and know their effort counts.

**How to apply:** read the answers from the labelling page (artifact https://claude.ai/artifact/Xc4t9FWi2S8CuRYg8DAsmK, ArtifactData list "answers"); count "fully correct" = answer yes, or a tapped start (tap present). Don't count later/earlier without a tap, wrong, unsure, or auto-accepted lines (report those separately). Give a running total, per clip, and how many clips have enough (all their lines) to be scored. See [[gab]], [[human-labels-first]].
