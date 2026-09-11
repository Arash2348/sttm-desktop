---
name: voice-follow-kirtan-model-goal
description: Active goal — break the Kirtan Mode acoustic ceiling via a new/fine-tuned local model; keep Path Mode advancing
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-09T20:54:00.859Z
---

Active work track (started 2026-09-09) for [[voice-follow-project]]. The user chose,
after I proved the ~37% real-kirtan ceiling is acoustic (see [[voice-follow-realkirtan-frontier]]):
**"ultracode and work on either getting a new local model or figure out best technique and
implementing for kirtan mode with /goal, while we at the same time keep working on path mode."**

So two parallel tracks:
- **Kirtan Mode (primary): break the acoustic ceiling.** Either (a) swap in a better local
  acoustic model for SUNG Gurmukhi (candidates to benchmark: MMS Punjabi, Whisper Punjabi,
  IndicWav2Vec / AI4Bharat, larger karansea variant), or (b) fine-tune/adapt the karansea CTC
  on the 39 labeled sung-kirtan recordings (GT line timings + shabad text already exist).
  Every candidate is judged on the SAME dual metric: real-kirtan accuracy AND distractor FP
  (iterate.py + fp_kirtan.py). No accuracy gain that raises FP counts.
- **Path Mode (keep advancing): forward Bani recitation, already 92% on the clean set.**

**2026-09-09 results — the "new local model" hypothesis came back ~NEUTRAL:**
- **`surinder-kirtan`** (`indicconformer-pa-v3-kirtan`, ~480h Gurbani incl ~300h kirtan) IS on
  disk at `/Users/asingh02/AAI/models/surinder-kirtan/onnx-pa-only/` (int8 + fp32 CTC ONNX).
  Same IndicConformer-PA base as karansea; **its 256-piece SP vocab is IDENTICAL to karansea's**
  (verified id→piece 0..255 match), blank=256. BUT its ONNX takes **80-dim log-mel FEATURES**
  (`audio_signal [B,80,T]`), not raw audio — reuse the shipped NeMo TorchScript preprocessor
  `/Users/asingh02/AAI/models/indic-conformer-600m/assets/preprocessor.ts` to extract features.
  Harness written: `voice-align-server/nemo_bench.py` (feature-in Conformer CTC → same decoder/metrics).
- **Real-kirtan bench, surinder vs karansea (37.33% @2.41%FP tight):** surinder tight 34.67% @2.13%FP;
  surinder LOOSE 39.33% @ **10%** FP lock 6.8s (vs karansea loose 42.83% @ **65%** FP!). So surinder
  discriminates target-vs-distractor MUCH better at loose gates (moves the FP frontier), but raw
  line-following accuracy is ~neutral. Greedy hyps are visibly cleaner on sung audio. `acoustic_gate`
  still over-freezes the target even on surinder (→0% FP but 22% acc / never locks) — drop it.
- **The paper (arXiv:2607.13457, Karanbir Singh — THIS system's own reference paper):** kirtan
  captioning = closed-vocab line-ID, not ASR. Dominant error = **shabad IDENTIFICATION / lock**,
  not tracking ("reasonably accurate once locked"). Reference system = 57.9% on the EASY 12-case
  set (our repo decoder already gets 92% there). Top FP-safe levers it recommends, NOT yet tried:
  (1) **calibrated lock confidence + margin-gated ∅ emission** (attacks the FP frontier directly);
  (2) warm-start/ensemble with surinder [4]; (3) **forced-alignment + rahao-aware Viterbi line graph**
  replacing hand-tuned hysteresis; also: multi-line agreement bonus, N-best matcher, phonetic/embedding
  retrieval for cold-start ID, tempo/rate normalization, predict-ahead shadow pointer (leading indicator).

**Bottom line so far:** neither swapping to surinder nor any decoder tuning delivers a big jump; the
~37% honest-set ceiling is an open ID/lock problem. Real ceiling-breakers = the paper's calibrated-
confidence + forced-alignment levers, and/or a GPU kirtan fine-tune. Pending user direction.

Environment facts: macOS, torch 2.14 CPU-only (no CUDA), venv `/Users/asingh02/AAI/voice-venv`.
Internet model download works (pip + HF hub, unauthenticated warning but functional). Demucs
source separation only bought ~+1.5% net — parked. Benchmark harnesses: `iterate.py` (acc),
`fp_kirtan.py` (FP), `sep_experiment.py` (A/B on separated audio). Shipping engine:
`karansea_engine.py`; live config in `server.py` KARANSEA_PROFILES (karansea=Path 4s,
kirtan=Kirtan 8s). Two-mode toggle shipped to fork Arash2348/sttm-web branch voice-follow.
