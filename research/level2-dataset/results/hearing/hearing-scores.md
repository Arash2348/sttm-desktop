| tier | model | clips | windows | Shabad hit@1 % | hit@5 % | usable % | 30 s vote right % (wrong %) | pangti sim median, all windows (mean; n) | pangti sim median, usable windows (n) | same windows vs a wrong pangti (chance) |
|---|---|---|---|---|---|---|---|---|---|---|
| Main GAB (mixer feed, control) | karanbir-fp32 | 7 | 1820 | 19.2 | 32.8 | 57.6 | 59.3 (17.6) | 57.1 (53.8; 93) | 58.3 (90) | 32.7 |
| Main GAB (mixer feed, control) | karanbir-int8 | 7 | 1820 | 19.2 | 32.7 | 57.6 | 59.3 (17.7) | 58.8 (53.9; 93) | 59.4 (90) | 32.7 |
| Main GAB (mixer feed, control) | sukhpal-ctc | 7 | 1820 | 21.3 | 34.8 | 59 | 61.2 (18.1) | 55.6 (56.1; 93) | 55.9 (92) | 31 |
| Main GAB (mixer feed, control) | sukhpal-rnnt | 7 | 1820 | 21.8 | 34.8 | 54.7 | 63.9 (19.6) | 46.2 (49.1; 93) | 54.5 (81) | 30.8 |
| Main GAB (mixer feed, control) | surinder-ctc | 7 | 1820 | 16.9 | 27.9 | 54.7 | 56.1 (21.6) | 61.5 (58.8; 93) | 61.5 (91) | 33.3 |
| Main GAB (mixer feed, control) | surinder-rnnt | 7 | 1820 | 13.5 | 21.9 | 40.6 | 45.2 (28) | 54.5 (51.9; 93) | 70 (73) | 31.6 |
| GAB-Hard (Fremont hall, laptop mic) | karanbir-fp32 | 7 | 1958 | 2.5 | 4.4 | 38.7 | 6.6 (8.6) | 0 (21.3; 1958) | 53.8 (757) | 28.6 |
| GAB-Hard (Fremont hall, laptop mic) | karanbir-int8 | 7 | 1958 | 2.5 | 4.5 | 38 | 7.4 (11) | 0 (21; 1958) | 53.8 (745) | 28.6 |
| GAB-Hard (Fremont hall, laptop mic) | sukhpal-ctc | 7 | 1958 | 2.8 | 4.2 | 28.8 | 11.6 (0) | 0 (15.3; 1958) | 50 (564) | 28.6 |
| GAB-Hard (Fremont hall, laptop mic) | sukhpal-rnnt | 7 | 1958 | 2.3 | 4.2 | 20.7 | 8.6 (4.5) | 0 (11.4; 1958) | 50 (406) | 28.6 |
| GAB-Hard (Fremont hall, laptop mic) | surinder-ctc | 7 | 1958 | 3.9 | 6.6 | 41.5 | 11.8 (24.1) | 0 (22.7; 1958) | 54.5 (813) | 28.6 |
| GAB-Hard (Fremont hall, laptop mic) | surinder-rnnt | 7 | 1958 | 2.9 | 4.7 | 20.3 | 10.6 (21.7) | 0 (12.3; 1958) | 56.3 (397) | 26.1 |
| GAB-Akhand Kirtan | karanbir-fp32 | 7 | 1989 | 7.5 | 11.8 | 47.6 | 36.2 (18.8) | 0 (24.8; 1451) | 55.6 (640) | 25 |
| GAB-Akhand Kirtan | karanbir-int8 | 7 | 1989 | 7.9 | 12 | 47.3 | 33.7 (19.6) | 0 (24.8; 1451) | 55.6 (636) | 25 |
| GAB-Akhand Kirtan | sukhpal-ctc | 7 | 1989 | 9.9 | 16 | 58.6 | 35.1 (31.9) | 18.2 (27.5; 1451) | 50 (736) | 25 |
| GAB-Akhand Kirtan | sukhpal-rnnt | 7 | 1989 | 8.7 | 14 | 49.9 | 27 (37.9) | 0 (23.5; 1451) | 50 (615) | 25 |
| GAB-Akhand Kirtan | surinder-ctc | 7 | 1989 | 7.8 | 11.9 | 53.6 | 24.4 (36.3) | 0 (24.8; 1451) | 50 (655) | 25 |
| GAB-Akhand Kirtan | surinder-rnnt | 7 | 1989 | 6.4 | 9.3 | 37.5 | 17.3 (37.4) | 0 (16.7; 1451) | 41.7 (450) | 25 |

| tier | app showed the true Shabad % (Y) | 30 s vote right % (X, Karanbir int8) | X - Y | vote right but app NOT showing it % | app showing it without a right vote % | 4 s hit@5 % | app's own 10 s text hit@5 % | windows |
|---|---|---|---|---|---|---|---|---|
| Main GAB (mixer feed, control) | 94.5 | 59.3 | -35.2 | 0.8 | 36 | 32.7 | 32.3 | 1820 |
| GAB-Hard (Fremont hall, laptop mic) | 52.4 | 7.4 | -45.0 | 1.4 | 46.5 | 4.5 | 8.4 | 1958 |
| GAB-Akhand Kirtan | 74.6 | 33.7 | -40.9 | 3.1 | 44 | 12 | 13 | 1989 |

| clip | tier | windows | karanbir-fp32 hit@5 / vote / sim | karanbir-int8 hit@5 / vote / sim | sukhpal-ctc hit@5 / vote / sim | sukhpal-rnnt hit@5 / vote / sim | surinder-ctc hit@5 / vote / sim | surinder-rnnt hit@5 / vote / sim | app shown % | app 10 s heard hit@5 % |
|---|---|---|---|---|---|---|---|---|---|---|
| clip01 | main | 241 | 47.3 / 64.3 / - | 46.5 / 63.9 / - | 53.1 / 56 / - | 51.5 / 51.5 / - | 39.8 / 55.6 / - | 29.5 / 50.2 / - | 97.5 | 47.7 |
| clip03 | main | 297 | 19.5 / 22.6 / - | 19.2 / 21.9 / - | 18.2 / 22.9 / - | 16.8 / 25.3 / - | 14.5 / 24.9 / - | 8.1 / 0 / - | 99 | 19.2 |
| clip05 | main | 94 | 33 / 75.5 / 57.1 | 31.9 / 73.4 / 58.8 | 43.6 / 79.8 / 55.6 | 42.6 / 80.9 / 46.2 | 38.3 / 74.5 / 61.5 | 33 / 80.9 / 54.5 | 69.1 | 28.7 |
| clip06 | main | 297 | 49.2 / 83.8 / - | 49.2 / 83.8 / - | 50.8 / 86.2 / - | 52.2 / 87.9 / - | 47.8 / 84.2 / - | 42.1 / 81.5 / - | 88.2 | 47.5 |
| clip12 | main | 297 | 23.6 / 49.8 / - | 23.9 / 49.8 / - | 24.9 / 56.2 / - | 24.2 / 65 / - | 18.2 / 46.1 / - | 15.8 / 42.4 / - | 98 | 23.6 |
| clip17 | main | 297 | 32 / 69 / - | 32.3 / 71 / - | 31 / 60.3 / - | 30.3 / 69 / - | 26.6 / 59.6 / - | 20.2 / 47.8 / - | 98.7 | 32 |
| clip33 | main | 297 | 27.9 / 62 / - | 27.9 / 61.6 / - | 31.3 / 78.5 / - | 34.3 / 77.1 / - | 19.5 / 60.3 / - | 13.5 / 39.1 / - | 94.3 | 27.6 |
| kh11_sttm_desktop_2026_1 | hard | 267 | 1.9 / 0 / 0 | 1.9 / 0 / 0 | 1.5 / 0 / 0 | 3.4 / 0 / 0 | 3 / 0 / 0 | 3.7 / 0 / 0 | 0 | 6 |
| kh12_sttm_desktop_2026_1 | hard | 255 | 3.5 / 3.5 / 0 | 3.1 / 8.6 / 0 | 1.2 / 11 / 0 | 1.2 / 0 / 0 | 3.9 / 7.5 / 0 | 2.4 / 0 / 0 | 100 | 2.7 |
| kh13_sttm_desktop_2026_1 | hard | 295 | 1.4 / 0 / 0 | 1.4 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 1.7 / 0 / 0 | 1 / 0 / 0 | 0 | 10.2 |
| kh15_sttm_desktop_2026_1 | hard | 272 | 4 / 0 / 0 | 5.1 / 1.1 / 0 | 6.3 / 12.5 / 0 | 7 / 23.5 / 0 | 8.1 / 18.8 / 0 | 4 / 17.3 / 0 | 96.3 | 4.8 |
| kh19_sttm_desktop_2026_1 | hard | 297 | 11.8 / 21.2 / 42.9 | 11.1 / 20.5 / 42.9 | 11.4 / 23.9 / 30 | 10.8 / 33 / 0 | 19.2 / 34.7 / 50 | 16.2 / 42.1 / 0 | 71 | 15.8 |
| kh20_sttm_desktop_2026_1 | hard | 296 | 3.7 / 9.5 / 0 | 3.7 / 9.5 / 0 | 1 / 0 / 0 | 1 / 0 / 0 | 3.4 / 16.6 / 0 | 0.7 / 0 / 0 | 24 | 9.8 |
| kh27_sttm_desktop_2026_1 | hard | 276 | 4.3 / 10.9 / 0 | 5.1 / 10.9 / 0 | 8 / 34.1 / 0 | 5.8 / 2.5 / 0 | 6.2 / 3.3 / 18.2 | 4.3 / 12.7 / 0 | 82.2 | 8 |
| ytak_tD1clsfI2oA_full | akhand | 297 | 4.7 / 10.1 / 0 | 4.4 / 10.1 / 0 | 7.4 / 12.1 / 0 | 7.4 / 11.1 / 0 | 4.7 / 9.8 / 0 | 2.4 / 9.8 / 0 | 9.8 | 6.7 |
| ytak_zi5pmQuTN5Q_full | akhand | 297 | 14.8 / 40.4 / 20 | 14.5 / 40.4 / 0 | 15.5 / 39.4 / 33.3 | 13.5 / 41.4 / 33.3 | 9.4 / 25.9 / 33.3 | 9.4 / 21.5 / 27.3 | 76.1 | 14.8 |
| ytak_kB3vqpPMiGQ_0-2873 | akhand | 263 | 6.8 / 31.9 / 0 | 8 / 26.2 / 0 | 9.5 / 32.3 / 0 | 6.8 / 22.8 / 0 | 6.1 / 19.8 / 0 | 2.7 / 0 / 0 | 100 | 9.1 |
| ytak_0typLHmkekM_0-2271 | akhand | 297 | 13.5 / 56.2 / 0 | 12.8 / 53.9 / 0 | 14.8 / 49.2 / 0 | 12.5 / 14.5 / 0 | 10.8 / 23.9 / 0 | 5.4 / 4.7 / 0 | 69 | 11.8 |
| ytak_Q5QFYd6sL_w_1867-25 | akhand | 297 | 18.2 / 58.2 / 26.3 | 17.5 / 47.1 / 26.7 | 21.2 / 47.1 / 35 | 20.2 / 43.4 / 33.3 | 19.2 / 41.1 / 36.8 | 18.2 / 44.8 / 0 | 91.2 | 18.5 |
| l3clip01 | akhand | 269 | 5.9 / 3.3 / - | 6.3 / 3.3 / - | 18.6 / 17.8 / - | 13.8 / 13.4 / - | 12.6 / 10 / - | 8.6 / 4.8 / - | 83.6 | 9.3 |
| l3clip26 | akhand | 269 | 18.2 / 50.9 / - | 20.1 / 53.2 / - | 25.7 / 46.8 / - | 24.2 / 42.4 / - | 20.4 / 40.1 / - | 18.2 / 33.8 / - | 98.5 | 20.8 |

**Main GAB (mixer feed, control): clip05 at 38-42 s.** True pangti: ਦੁਸਟ ਦੂਤ ਪਰਮੇਸਰਿ ਮਾਰੇ ॥

- karanbir-fp32 (sim 86, true Shabad rank 1): ਦੁਸਟ ਦੂਤਿ ਪਰਵੇਸਰ
- karanbir-int8 (sim 86, true Shabad rank 1): ਦੁਸਟ ਦੂਤਿ ਪਰਵੇਸਰ
- sukhpal-ctc (sim 100, true Shabad rank 1): ਦੁਸਟ ਦੂਤ ਪਰਮੇਸਰ
- sukhpal-rnnt (sim 100, true Shabad rank 1): ਦੁਸਟ ਦੂਤ ਪਰਮੇਸਰ
- surinder-ctc (sim 78, true Shabad rank 1): ਦੁਸਟਿ ਦੂਤਿ
- surinder-rnnt (sim 0, true Shabad not in top 5): ਦੁਸਟ ਦੂਤ

**GAB-Hard (Fremont hall, laptop mic): kh11_sttm_desktop_2026_10_11 at 73-77 s.** True pangti: ਐਸੀ ਪ੍ਰੀਤਿ ਕਰਹੁ ਮਨ ਮੇਰੇ ॥

- karanbir-fp32 (sim 0, true Shabad not in top 5): ਐਸੀ ਨ ਮਨ
- karanbir-int8 (sim 0, true Shabad not in top 5): ਐਸੀ ਮਨ
- sukhpal-ctc (sim 25, true Shabad not in top 5): ਸਛ ਤੇ ਦਪ ਮਹ
- sukhpal-rnnt (sim 0, true Shabad not in top 5): ਅਛੂ
- surinder-ctc (sim 90, true Shabad rank 1): ਐਸੀ ਪ੍ਰੀਤ ਕਰ
- surinder-rnnt (sim 100, true Shabad rank 3): ਐਸੀ ਪ੍ਰੀਤ

**GAB-Akhand Kirtan: ytak_tD1clsfI2oA_full at 38-42 s.** True pangti: ਗੁਰਮਤਿ ਮਨੂਆ ਅਸਥਿਰੁ ਰਾਖਹੁ ਇਨ ਬਿਧਿ ਅੰਮ੍ਰਿਤੁ ਪੀਓਈਐ ॥੧॥ ਰਹਾਉ ॥

- karanbir-fp32 (sim 100, true Shabad rank 1): ਥਿਰੁ ਰਾਖਹੁ
- karanbir-int8 (sim 100, true Shabad rank 1): ਥਿਰੁ ਰਾਖਹੁ
- sukhpal-ctc (sim 88, true Shabad rank 1): ਥਿਰ ਰਾਖਹੁ
- sukhpal-rnnt (sim 88, true Shabad rank 1): ਥਿਰ ਰਾਖਹੁ
- surinder-ctc (sim 89, true Shabad rank 1): ਥਿਰਿ ਰਾਖਹੁ
- surinder-rnnt (sim 0, true Shabad not in top 5): ਥਿਰੁ ਰਾਖ
