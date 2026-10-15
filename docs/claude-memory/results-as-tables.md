---
name: results-as-tables
description: "User wants cycle/benchmark results shown as tables (one row per cycle, key metrics as columns)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-27T05:06:52.198Z
---

When reporting Voice-Follow cycle or benchmark results, always show a table: one row per cycle/version, columns for
the goal metrics (wrong %, right %, wrong hops/h, avg wrong stretch, longest, found ≤20 s, never found, English, hall).
Say which test method produced the numbers (real-time vs old lockstep/pause).

**Why:** the user asked (2026-09-27) "I like cycle results in tables" and wants them by default.

**How to apply:** every results update gets a table first, then short notes. Related: [[cycle-numbering]],
[[end-with-action-items]].
