---
name: voice-follow-realkirtan-frontier
description: Real-kirtan accuracy is FP-bound; win8 is the safe sweet spot; loosening gates = 84% FP
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-09T20:32:51.156Z
---

Measured accuracy/false-positive frontier on the real-kirtan benchmark (39 recordings,
`parquet_bench/gt/pq_*`) for [[voice-follow-project]]. FP = distractor false-move rate
(a shabad's lines vs every OTHER recording's audio; any lock = false). Harness:
`voice-align-server/fp_kirtan.py` (I wrote it; `trials.py` was stale — imported a `BENCH`
symbol `iterate.py` no longer exports). All measured 2026-09-09, model.int8.

| config | real-kirtan acc | lock med | FP mean | verdict |
|---|---|---|---|---|
| ship (win4, tight gates) | 34.7% | 20.8s | 3.2% | current |
| **win8, tight gates** | **37.3%** | 22.8s | **2.4%** | **safe win** (+acc, -FP) |
| win10 | 37.6% | 22.8s | 2.5% | plateau — window gains stop ~win8 |
| loose (win8, guard0.45 margin_gate0 init1) | 40.3% | 6.8s | **84.4%** | FP CATASTROPHE |
| win8 + VAD act_thresh0.15 | 25.5% | 30s | 1.0% | over-freezes target too |

**Key facts:**
- Real kirtan is ~40% forward / ~40% BACKWARD / ~20% same-line repeats (sthai/rahao +
  antra "chorus" structure). 35/39 recordings start mid-shabad. Sung lines are slow
  (median ~9s), so win4 never sees a full line — hence longer window helps.
- The 34.7% is a FLOOR set by FP safety, NOT a tuning miss. Every cheap accuracy gain
  (lower guard/margin_gate/init_confirm) explodes FP from 3% to 84%. The user's instinct
  was right: don't trade FP for accuracy. See [[voice-follow-midpangti-decision]].
- Transition/refrain retuning (symmetric costs, cheap backward, rahao/revisit bonuses)
  barely moved accuracy (`sym-win8` ≈ `win8`) because ACQUISITION (lock) is the bottleneck,
  not following. Refrain-awareness only pays off once lock is solved.

**Two-mode plan (user wants this):** Path Mode = current win4 tight config (linear Bani
recitation, 92% on clean set). Kirtan Mode = win8 tight (sung kirtan) — the safe win above.

**2026-09-09 exhaustive non-timing lever sweep (user pushed: "not only timing").** All on
win8-tight base (37.33% acc @ 2.41% FP mean). NOTHING broke the ceiling:
- `ac_blend=0.4` (fold CTC likelihood into line selection): 33.1% — HURTS (noisy model misleads).
- `dual_win=2.5` onset fast-switch: 37.33% — INERT (switches never fire inside window on kirtan).
- `init_confirm=2` (faster lock): 38.08% @ 3.50% FP — tiny acc gain, worse FP. Marginal.
- `acoustic_gate` (require fuzzy top1 == acoustic-best line): drives FP to **literally 0.00%**
  (huge headroom!) BUT over-freezes the target too (lock 30s, acc 22–33%). It's a near-perfect
  distractor filter, not an accuracy lever — the target's OWN acoustic score is too weak on
  noisy sung audio to pass. This is the tell that the wall is acoustic.
- **Source separation (Demucs htdemucs, vocals stem → recompute CTC, sep_experiment.py):**
  +4.7% on already-tractable recordings (MNB/HC7/GK0), 0 to −3.5% on hard ones (TSC/X5G/VWE/RVG
  never lock either way). ~+1.5% net. htdemucs runs ~4× realtime on CPU (16–32s for ~60s clip),
  so streaming-feasible, but not worth the CPU/latency/complexity for +1.5%. Cached separated
  wavs in `parquet_bench/audio_voc/`.

**FINAL verdict: the ~37% Kirtan ceiling is the acoustic model's inability to read SUNG,
ornamented, multi-raag Gurmukhi — NOT the decoder, gates, window, or instrument bleed.** The
one lever that would break it: FINE-TUNE the karansea CTC on sung kirtan (we HAVE 39 labeled
recordings w/ GT line timings + shabad text — enough for a supervised fine-tune / adaptation).
That's a training project, needs user buy-in. Everything short of new acoustic weights is done.

**To go substantially higher (60%+) needs real ML, each gated by the FP guardrail:**
singing-adapted acoustic model / source separation (Demucs) to de-noise harmonium+tabla
(root cause of noisy CTC hyps → slow lock), a learned line-bigram transition prior, a
properly-tuned garbage/VAD state, and possibly a beam/particle multi-hypothesis decoder
(Nakamura 2016 repeats/skips HMM) for non-monotonic recovery.
