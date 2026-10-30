| Behaviour | Model | Clips | Pangtis | WER % | CER % | CER edge-tolerant % (per-clip avg) | edge-tolerant vs Karanbir (95% CI) |
|---|---|---|---|---|---|---|---|
| Kirtan, hall laptop mic (GAB-Hard) | karanbir | 7 | 81 | 169.3 | 118.5 | 53.5 (52.1) | baseline |
| Kirtan, hall laptop mic (GAB-Hard) | jaspal-v3 | 7 | 81 | 129.4 | 94.6 | 62.3 (59.4) | +8.9 [4.6, 11.6] clear |
| Paath (studio) | karanbir | 2 | 43 | 78.4 | 46.4 | 27.1 (26.9) | baseline |
| Paath (studio) | jaspal-v3 | 2 | 43 | 71.6 | 45.5 | 28.9 (28.8) | too few clips |
| Bani sung as kirtan | karanbir | 1 | 44 | 86.3 | 48.6 | 34.9 (34.9) | baseline |
| Bani sung as kirtan | jaspal-v3 | 1 | 44 | 85.6 | 56.6 | 46.2 (46.2) | too few clips |
| Akhand Paath (natural speed) | karanbir | 4 | 269 | 63.1 | 32.3 | 14.3 (14.2) | baseline |
| Akhand Paath (natural speed) | jaspal-v3 | 4 | 269 | 41.8 | 24.8 | 9.1 (9.0) | -5.2 [-6.2, -3.8] too few clips to call |
| Akhand Paath sped up 1.35x (synthetic; one clip repeats a natural-speed clip) | karanbir | 2 | 179 | 75.2 | 43.2 | 23.7 (24.0) | baseline |
| Akhand Paath sped up 1.35x (synthetic; one clip repeats a natural-speed clip) | jaspal-v3 | 2 | 179 | 61.9 | 36.6 | 20.2 (20.7) | too few clips |

Edge-tolerant CER is the headline; plain WER / CER on exact label times count repeated singing and late captions as errors. Only behaviours with human or broadcast-caption pangti times appear: kirtan (mixer feed), Akhand Kirtan and paath (hall) have only model-aligned times, so they are left out. Rows with 1-2 clips are examples, not evidence. Pangtis are scored inside the same [start, end] of each clip as hit@5, so the longer recordings contribute only that part. Pangtis over 20 s (39 of 81 on hall kirtan) are cut into equal parts for every model.
