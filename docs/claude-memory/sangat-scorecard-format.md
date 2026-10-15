---
name: sangat-scorecard-format
description: "Agreed format for the sangat tester benchmark report (model vs person scorecard, ✅/⚠️/❌, rows and wording)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-02T01:28:09.146Z
---

Sangat tester benchmark (shadow build, research/shadow-aws/benchmark.py) reports a model-vs-person scorecard in this shape, agreed 2026-10-01:

| # | What we're checking | Model | Person | Target ("as good as a person") | Result |
1. Same line: when both are on the same shabad, is the model on the same line? (% of time; ↳ line changes caught within 5 s) — the HEADLINE
2. Speed: seconds behind the person to reach the next shabad (minus = model first): typical, worst, per-change list
3. Shabads in the recording, counting parmaans; ↳ found by the model (x of y, how many within 30 s)
4. Wrong shabads shown (false positives), incl. when nothing should be up: count and seconds, model AND person (person's from review rulings)

Result column: ✅ as good as a person / ⚠️ a bit worse / ❌ much worse.

**Why:** the user wants to read it and say plainly whether the model is ≥ a person. They found "accuracy %" and "right shabad on screen %" confusing or misleading (lingering on the old shabad after a change is a speed issue, not an error). Speed is wanted in seconds, not %. Percentages otherwise; higher is better except where labelled.

**How to apply:** use this layout whenever reporting sangat/shadow results. The tester is ground truth by default; only a person listening to the audio can overrule them (see [[verified-data-home]]). Never let model-derived audio evidence act as truth, only to pick clips for review. Related: [[vaheguru-slide-not-error]], [[end-with-action-items]].
