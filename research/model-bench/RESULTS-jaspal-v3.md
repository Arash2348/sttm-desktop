# Jaspal sggs-asr-v3 vs Karanbir (and v0, v1, v2): hearing benchmark, 2026-10-30

Model: https://huggingface.co/jssaluja/sggs-asr-v3-onnx (revision 89bc09c6, int8 ONNX sha256 2dbc62f9…, audio-input graph,
blank 0, 1,000 classes; CC-BY-NC-4.0). Benchmark: `research/model-bench` (48 clips, human or broadcast-caption keys,
same 10 s / 4 s windows, same greedy decode and corpus search for every model). Karanbir = the model the app ships.

✅ clearly ahead of Karanbir · ➖ within noise · ⚠️ behind by under 10 points · ❌ behind by 10 or more (95% CI "clear").

## hit@5 % per behaviour, 10 s window (the app's search window)

v0, v1, v2 and the Karanbir column: x86 run of 2026-10-27 (`results.md`). v3: Mac M4 run of 2026-10-30 scored against
Karanbir on the same Mac (`results-mac-v3.md`; Karanbir's Mac numbers are within 0.6 points of its x86 numbers on
every row). x86 v3 (GCP n2-standard-32, 2026-10-30, `results-x86-v3-w10.md`) agrees with the Mac within 0.5 points on
every row: kirtan 69.7, GAB-Hard 9.7, Akhand Kirtan 29.3, paath hall 90.3, paath studio 81.5, sung Bani 62.4,
Akhand Paath (both sets) 98.5 vs Karanbir 93.6.

| Behaviour | Karanbir | Jaspal v0 | Jaspal v1 | Jaspal v2 | Jaspal v3 |
|---|---|---|---|---|---|
| Kirtan, mixer feed | 69.3 | 39.5 ❌ | 46.2 ❌ | 70.5 ➖ | 69.3 ➖ |
| Kirtan, hall laptop mic (GAB-Hard) | 20.0 | 0.1 ❌ | 1.5 ❌ | 9.7 ❌ | 9.5 ❌ |
| Akhand Kirtan | 40.2 | 4.5 ❌ | 10.7 ❌ | 27.7 ❌ | 29.8 ❌ |
| Paath, hall | 93.6 | 84.9 ⚠️ | 86.3 ⚠️ | 89.7 ⚠️ | 90.0 ⚠️ |
| Paath, studio | 86.5 | 41.5 ❌ | 56.0 ❌ | 79.5 ⚠️ | 81.7 ⚠️ |
| Bani sung as kirtan | 72.4 | 38.3 ❌ | 46.9 ❌ | 67.1 ⚠️ | 62.4 ❌ |
| Akhand Paath, natural speed | 97.5 | 97.6 ➖ | 99.0 ✅ | 98.9 ✅ | 98.8 ✅ |
| Akhand Paath, 1.35x (synthetic, 2 clips) | 85.7 | 74.1 ❌ | 84.8 ➖ | 92.7 ✅ | 97.4 ✅ |

## 4 s window (what the app leans on while following a line), Mac, same machine

x86 (`results-x86-v3.md`) agrees within 0.5 points: v3 27.6 / 1.9 / 10.9 / 79.6 / 32.9 / 37.3 vs Karanbir 32.4 / 4.2 / 14.7 /
79.4 / 41.3 / 45.8 on the six rows below in order; Akhand Paath (both sets) 93.1 vs 91.4.

| Behaviour | Karanbir | Jaspal v3 | Call |
|---|---|---|---|
| Kirtan, mixer feed | 32.7 | 27.6 | ⚠️ |
| Kirtan, hall laptop mic (GAB-Hard) | 4.5 | 1.9 | ➖ (CI touches 0) |
| Akhand Kirtan | 15.1 | 10.8 | ⚠️ |
| Paath, hall | 80.1 | 79.6 | ➖ |
| Paath, studio | 42.1 | 32.5 | ⚠️ |
| Bani sung as kirtan | 45.9 | 37.0 | ⚠️ |
| Akhand Paath, natural speed | 93.1 | 95.1 | ➖ |
| Akhand Paath, 1.35x | 89.9 | 89.8 | ➖ |

## Character error on whole pangtis (edge-tolerant CER %, lower is better), Mac

Only behaviours with human or caption pangti times. 1-2 clip rows are examples, not evidence.

| Behaviour | Clips | Karanbir | Jaspal v3 | Call |
|---|---|---|---|---|
| Kirtan, hall laptop mic (GAB-Hard) | 7 | 53.5 | 62.3 | ❌ worse (+8.9, clear) |
| Akhand Paath, natural speed | 4 | 14.3 | 9.1 | ✅ better (-5.2) |
| Paath, studio | 2 | 27.1 | 28.9 | ➖ |
| Bani sung as kirtan | 1 | 34.9 | 46.2 | ⚠️ (one clip) |
| Akhand Paath, 1.35x | 2 | 23.7 | 20.2 | ➖ |

## Speed and size (Mac M4, 14 cores, onnxruntime 1.29.0; median ms per window)

| | Karanbir | Jaspal v3 | Call |
|---|---|---|---|
| 10 s window, 4 threads | 116 | 87 | ✅ 25% faster |
| 10 s window, 2 threads (the app on < 8 cores) | 146 | 92 | ✅ 37% faster |
| 4 s window, 2 threads | 61 | 41 | ✅ |
| Model file | 184 MB | 155 MB | ✅ |
| Load time | 0.4 s | 1.4 s | ⚠️ |

## Reading

- v3 is v2 plus a little: level on clean mixer-feed kirtan, ahead on Akhand Paath (natural and fast), faster and
  smaller. It stays 10 points or more behind wherever the audio is hard: hall laptop mic, Akhand Kirtan, sung Bani,
  and it lost 5 points on sung Bani against v2.
- The gap is not uniform, so it is not the harness: a measurement bias would move every row. The hard rooms are
  where the training data does not reach. See the fairness notes in `MODEL-GUIDE.md`.
- Bar for shipping a model (MODEL-GUIDE section 5): no behaviour worse in GAB, then an owner live test. v3 does not
  reach the first step on hearing alone, so GAB steps 4-6 were not run for it.
- Jaspal's models keep improving on exactly what they are trained on. The lever is hall / laptop-mic kirtan and sung
  Bani audio in training (GAB train split, Shadower sessions on HF), not another export.
