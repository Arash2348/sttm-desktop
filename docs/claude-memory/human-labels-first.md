---
name: human-labels-first
description: "Benchmark headline numbers must come from human labels, not from answer keys our own pipeline generated (forced alignment); aligned truth is secondary and must be audited against a human sample"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-14T01:03:51.165Z
---

The user (Oct 13 2026), on learning that the Aarti / Rehras / Sohila / Sehaj line-level truth was
made by forced alignment with our own model: "we should benchmark not on things we make but human
labels usually."

**Why:** an answer key built with the same acoustic model the app uses is circular: it shares the
model's errors and flatters it; the user can't trust numbers built on it.

**How to apply:** headline results use human-labelled truth only (L2 Human-Fully Sheet, Aarti-50
piece labels, Fremont line timestamps from Jaspal, the sevadaar's real screen as a lagged human
reference). Aligned truth is labelled "aligned" everywhere, reported as secondary, and only kept
after a human audit of a random sample of line starts shows its error (state the error). New
line-level truth = human tapping (ear-check tool) or audit-then-trust. See
[[behaviour-benchmark-dataset]], [[verified-data-home]], [[always-baseline-numbers]].

**Ear checks are in the benchmark (Oct 13 2026):** HF khalisfoundation/GurbaniAutopilotBench
`human-verdicts/` = line-start-check (60, with snippets) + fremont-who-is-right (30, with
snippets) + README. Renton answer keys' lines.csv `source` now says aligned+human-confirmed (48)
/ aligned+human-unsure (3). Every future ear check must be uploaded there the same way (script:
scratchpad hfv/ear.py of session 7dc20a33). Scorers must skip rows marked REJECTED-by-human.

**Line-truth method agreed (Oct 14 2026):** slide OCR (human, 0-3 s late) + forced alignment of the KNOWN Shabad's pangtis with three different models (Karanbir, Surinder, Sukhpal; best formats) → auto-accept when >=2 signals agree within 1 s and one is the slide or two different models; disagreements + 5% audit sample go to a fast verifier page (pick a candidate mark or tap). Brief: research/level2-dataset/LINE-DATA-BRIEF.md; kit ~/personal/gab-linekit.tar.gz (for the user's 192-core machine). Phase 1 = GAB's own 232 YouTube-sourced clips (~23 h) without line truth.
