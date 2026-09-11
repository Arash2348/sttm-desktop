---
name: voice-follow-midpangti-decision
description: Decision NOT to special-case mid-pangti starts in voice-follow (FP risk not worth it)
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-09T08:14:42.375Z
---

Mid-pangti start (reciter joins in the MIDDLE of a line, not at its beginning) is a
rare case for [[voice-follow-project]]. **Decision (2026-09-09): do NOT add a special
acquisition path for it** — the user explicitly does not want changes that raise false
positives, and mid-pangti is rare enough that it's not worth the trade.

**Why it already works well enough:** the clean 92.03% benchmark's cold-start variants
ARE mid-pangti joins (e.g. `zOtIpxMT9hU_cold66` joins at 193.3s, inside line 5 / 180.7–204.7s;
`cold33` joins at 96.7s inside line 2). They're already counted in the 92% — cold66 is the
worst case at 81.8%. Line match uses `partial_ratio` (substring-tolerant) and the word cursor
uses free-entry CTC alignment, so mid-line entry is supported by design.

**Why a live mid-pangti attempt feels broken:** acquisition latency, not inability. A short
mid-line fragment is ambiguous, so the FP guards (`init_confirm=4`, `margin_gate=0.10`) wait
until confident and often lock only when the NEXT full line arrives. Those guards ARE the FP
protection; loosening them is exactly what would let distractor audio false-lock.

**How to apply:** if asked to improve mid-pangti, first confirm it truly regresses the
benchmark; only pursue a change that shows ZERO false-positive delta. The one FP-safe lever
tried (prefix-aware acoustic confirm, `acoustic_gate=0.02`, history row `ship-prefix-honest`)
scored 87% — worse than 92% — so it's not a clear win. Prefer a late highlight over a wrong one.

**Separate known gotcha:** the honest real-kirtan set (`parquet_bench/gt/pq_*`, what `iterate.py`
GT_DIR points to now) scores only ~35% with the shipped config — it is much harder (starts
mid-shabad, jumps around) than the original 12-case captioning set (`.../live-gurbani-captioning-benchmark-v1-main/test/`) that produced 92.03%. Don't confuse the two datasets when reading numbers.
