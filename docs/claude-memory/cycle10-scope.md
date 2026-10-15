---
name: cycle10-scope
description: Cycle 10 is code-only — improve Voice-Follow's decision code on all data; do NOT fine-tune the speech model unless evidence shows it is the blocker
metadata:
  type: feedback
---

User (2026-09-25): the goal of Cycle 10 is to update our CODE (judge/follower/lock logic) to be smarter across all the
data, not to train the model. The karansea CTC model came from Hugging Face and is generally good. Fine-tuning is only on
the table if the benchmark proves the recogniser itself is why we can't do well — the user hasn't seen that.

**Why:** code changes are cheap, reversible and measurable with the existing benchmark; training adds GPUs, cost and risk
without evidence it is needed.

**How to apply:** use the CPU benchmark machine for replay runs only; no GPU requests or training plans. If a failure
analysis points at recogniser output (e.g. garbled transcripts no logic can fix), report that as evidence and ask before
proposing any training. Related: [[model-provenance]], [[data-priority]]
