---
name: mvp-8-6-bani
description: "MVP 8.6 = Cycle 8 + only the same-Gurbani lock + Bani/paath work; its test sets, results and comparison rules"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-09-29T07:42:21.557Z
---

Branch `mvp-8.6-c8-bani` (worktree ~/personal/sttm-bani, HEAD fa250815 on 2026-09-29). User prefers Cycle 8 kirtan
behaviour over Cycle 12, so only Cycle 11's same-Gurbani lock was ported (needed for Rehras/Sohila/Aarti, whose shabads
exist in 2-3 identical copies). Adds: pane fix, one-line paath rule (Japji, Jaap, Savaiye, Chaupai, Anand, Aarti-only
lines), 3-line straight-reading rule (Rehras/Sohila/Japji/Aarti), all-length Bani hold, Jaap pooling,
BANI_CUR_SPAN=8 (fixes "stuck in the Bani"), copy-aware paath rules, no switching between copies.
Also: Rehras followed at the long length by default (restored after), only its opening 1661/1721 may open it by the reading rule; Mool Mantar home (cycle 12) shows shabad 1. Aarti = Bani 22 at the user's length (same as Sundar Gutka popular list and sikhitothemax.org), not extra-long.

Tests: research/level2-dataset/paath-tests.json (pt01-38, titles as truth; Aarti pt35-38 verified by user),
tools/paath-score.js (WARM=10), tools/exit-test.js + run-exit.sh (leave a Bani for kirtan vs shabad control).
L2 kirtan (EC2, --fast --trace-all, fa250815): 40/41 clips identical to the Cycle 8 control; only clip38 differs
(copy 2129 of truth 4997, same text) -> equal on every metric copy-aware. Paath right text: 100% Rehras/Sohila/
Anand/Chaupai/Savaiye, 98% Japji, ~93% Aarti (sung windows), 77% Jaap (speech model limit), 0% wrong. Compare only same-machine runs: flicker is 38 on
EC2 vs 25 on the Mac for the same Cycle 8 code.

Related: [[level3-policy]], [[data-priority]]
