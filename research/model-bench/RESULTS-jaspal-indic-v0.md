# Jaspal sggs-asr-indic-v0 vs Karanbir (and v3): hearing benchmark, 2026-11-01

Model: https://huggingface.co/jssaluja/sggs-asr-indic-v0-onnx (revision eaffa4d3, int8 ONNX sha256 a8653cec…, audio-input
graph, blank 512 = last id, 513 classes; CC-BY-NC-4.0, non-commercial only). AI4Bharat IndicConformer Punjabi encoder
fine-tuned CTC-only on SGGS paath + kirtan with a new 512-piece BPE. Benchmark: `research/model-bench` (47 clips, human or
broadcast-caption keys, same windows, greedy decode and corpus search for every model). Mac M4, all three models scored
on the same machine (`results-mac-indic-v0.md`, `results-wer-mac-indic-v0.md`). Karanbir = the model the app ships.

✅ clearly ahead of Karanbir · ➖ within noise · ⚠️ behind by under 10 points · ❌ behind by 10 or more (95% CI "clear").

## hit@5 % per behaviour (true Shabad among the top 5 search results from one window's text)

| Behaviour | Karanbir 10 s | v3 10 s | indic-v0 10 s | Karanbir 4 s | indic-v0 4 s |
|---|---|---|---|---|---|
| Kirtan, mixer feed | 69.2 | 69.3 ➖ | 77.0 ✅ | 32.7 | 35.9 ✅ |
| Kirtan, hall laptop mic (GAB-Hard) | 20.0 | 9.5 ❌ | 32.2 ✅ | 4.5 | 8.2 ✅ |
| Akhand Kirtan | 39.9 | 29.8 ❌ | 45.1 ➖ | 15.1 | 18.8 ✅ |
| Paath, hall | 93.9 | 90.0 ⚠️ | 94.1 ➖ | 80.1 | 85.8 ✅ |
| Paath, studio | 87.1 | 81.7 ⚠️ | 88.7 ➖ | 42.1 | 46.0 ✅ |
| Bani sung as kirtan | 72.6 | 62.4 ❌ | 80.0 ✅ | 45.9 | 54.6 ✅ |
| Akhand Paath, natural speed | 97.6 | 98.8 ✅ | 99.5 ✅ | 93.1 | 98.0 ✅ |
| Akhand Paath, 1.35x (synthetic, 2 clips) | 85.9 | 97.4 ✅ | 99.8 ✅ | 89.9 | 99.5 ✅ |

No row is behind Karanbir at either window. Three 10 s rows are ahead but not clearly (Akhand Kirtan +5.3, paath hall +0.2,
paath studio +1.6); every 4 s row is clearly ahead.

## Letter error on human / caption pangti times (edge-tolerant CER %, lower is better)

| Behaviour | Clips | Karanbir | v3 | indic-v0 |
|---|---|---|---|---|
| Kirtan, hall laptop mic (GAB-Hard) | 7 | 53.5 | 62.3 | 48.1 (−5.4, clear) |
| Paath, studio | 2 | 27.1 | 28.9 | 23.8 |
| Bani sung as kirtan | 1 | 34.9 | 46.2 | 28.2 |
| Akhand Paath, natural speed | 4 | 14.3 | 9.1 | 6.2 |
| Akhand Paath, 1.35x | 2 | 23.7 | 20.2 | 10.4 |

## Caveats

- **Training overlap unknown.** The card does not name its source collections. If any GAB clip (or the same diwan) was in
  its training set, its scores here are inflated. Ask the author to check against `gab-do-not-train.csv` before treating
  this as final, especially for the YouTube-sourced kirtan and paath clips.
- **Hearing only.** This scores one window's text through the app's search. It is not the app's following behaviour.
  The next test is a full GAB replay with the model loaded as a model pack (`VF_SPEECH_MODEL`, blank 512).
- **Licence.** CC BY-NC 4.0 (non-commercial). Shipping it in STTM needs the author's and Khalis Foundation's agreement.
- Speed: about 0.13 s per 10 s window on the Mac at nice 19, 4 threads (card: real-time factor 0.014 on 6 threads).
