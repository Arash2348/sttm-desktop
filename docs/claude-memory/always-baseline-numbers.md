---
name: always-baseline-numbers
description: Every progress update must show a before/after table with real numbers: what users actually experienced (baseline), where we are now, and the target
metadata:
  type: feedback
---

User (Oct 12 2026): "always give me evals and numbers. it's hard for me to understand if I don't have baseline of what was experienced, and now where we are at since I'm trying to advise you."

**Why:** the user advises on direction and can only judge progress against a concrete baseline (what the sangat/sevadaar actually saw) next to the current measured number.

**How to apply:** in every status update or result, include a table with columns: metric | what was experienced (real screen / tonight's build) | now (current build, measured) | target or pass bar. Name the test set and say when a number is a proxy (headless, slowed CPU, follower-only). No qualitative-only updates. Related: [[results-as-tables]], [[sangat-scorecard-format]].
