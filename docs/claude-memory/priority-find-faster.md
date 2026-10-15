---
name: priority-find-faster
description: Top priority is finding more shabads and finding them faster without degrading other metrics; English guard is low priority
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-27T05:21:59.596Z
---

User (2026-09-27): "my main thing is improving those metrics we set out to improve; if we can find more shabad and find
them faster without degrading metrics that's a huge win." Don't spend cycles on the spoken-English test (eng06).

Golden goal added 2026-09-27: AVERAGE time to first find ≈ 15 s (Cycle 12 real-time: 25.2 s avg, 11.1 s median),
without degrading any other metric. Show it as a column in every results table.

**Why:** found-within-20 s and never-found are the furthest from goal; English 9/10 is acceptable.

**How to apply:** pick cycle targets by found<=20 s / never / time-to-first-right first, then wrong-stretch length;
keep English only as a guard (must not get worse), don't tune for it. Related: [[results-as-tables]], [[cycle-numbering]].
