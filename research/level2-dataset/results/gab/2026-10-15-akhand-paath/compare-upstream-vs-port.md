## GAB v1.3 compare (main) — A: 3fafc0baf8a7 vs B: 79584f7c4adb

A `/Users/asingh02/personal/live-darbar-venues/cache/worktrees/3fafc0baf8a7` @ 3fafc0baf8a7 · B `/Users/asingh02/personal/sttm-akhand-2` @ 79584f7c4adb · manifest 87155c50d6ce · tier full · split dev (train + dev rows; test held out)

| row | scope | metric | A | B | verdict |
|---|---|---|---|---|---|
| Akhand Paath (Ang after Ang) | all clips | right Shabad/Bani % | 97.8 | 98.4 | **better** |
| Akhand Paath (Ang after Ang) | all clips | sangat sees the right pangti % | 90.7 | 96.7 | **better** |
| Akhand Paath (Ang after Ang) | all clips | seconds behind p50 | 0.66 | 0.3 | **better** |
| Akhand Paath (Ang after Ang) | all clips | seconds behind p90 | 2.04 | 1.2 | **better** |
| Akhand Paath (Ang after Ang) | all clips | wrong Shabad s/h | 34 | 18.1 | **better** |
| Akhand Paath (Ang after Ang) | all clips | same or neighbouring pangti % (info) | 97.6 | 98.5 | **better** |
| Akhand Paath (Ang after Ang) | all clips | Akhand Paath crossing delay p50 s (info) | 0.4 | 0.3 | within tolerance |
| Akhand Paath (Ang after Ang) | all clips | Akhand Paath crossing delay p90 s (info) | 2.6 | 1.3 | **better** |
| Akhand Paath (Ang after Ang) | all clips | switch time p90 s (info) | 0.7 | 0 | **better** |
| All behaviours | all clips | right Shabad/Bani % | 95.2 | 95.3 | within tolerance |
| All behaviours | all clips | sangat sees the right pangti % | 90.7 | 96.7 | **better** |
| All behaviours | all clips | seconds behind p50 | 0.66 | 0.3 | **better** |
| All behaviours | all clips | seconds behind p90 | 2.04 | 1.2 | **better** |
| All behaviours | all clips | wrong Shabad s/h | 31.1 | 27.2 | **better** |
| All behaviours | all clips | same or neighbouring pangti % (info) | 97.6 | 98.5 | **better** |
| All behaviours | all clips | Akhand Paath crossing delay p50 s (info) | 0.4 | 0.3 | within tolerance |
| All behaviours | all clips | Akhand Paath crossing delay p90 s (info) | 2.6 | 1.3 | **better** |
| All behaviours | all clips | switch time p90 s (info) | 2.3 | 0.1 | **better** |
| (211 more metric cells unchanged) | | | | | |

GUARDRAILS: PASS (no guarded metric worse) · 15 better
Guarded = each behaviour, all clips and per mic path (mixer feed, room mic, 50/50); per-Bani rows, named sets and the mixed all-behaviours row are information only, and so are pangti % and seconds behind when they rest on aligner-only line answers or fewer than 3 clips. Tolerances: right % 0.1 pt, seconds behind 0.05 s (p50) / 0.1 s (p90), wrong s/h 1, find / switch time 0.2 s, not found / switches never found 0.

Screen events differ on 7 of 148 clips: ytap_-1yA1ufOku0_2000-2600_x1.35, ytap_DDHRQqbEnyo_1200-1800, ytap_DDHRQqbEnyo_1200-1800_x1.35, ytap_cKpg64jaTAo_1200-1800, ytap_cKpg64jaTAo_1200-1800_x1.35, ytap_q_dwf8YWdXY_300-900, ytap_q_dwf8YWdXY_300-900_x1.35.
Timing: total 14.7 s (replay 1.8 s, 0 clip runs, 296 reused), load 9.7 8.2 7.5.

## GAB v1.3 scorecard — GAB — 3fafc0baf8a7

build `/Users/asingh02/personal/live-darbar-venues/cache/worktrees/3fafc0baf8a7` @ 3fafc0baf8a7 · Voice-Follow 9.0.3 · manifest 87155c50d6ce (345 rows) · set **main** · tier **full** · split **dev (train + dev rows; test held out)** · 2026-10-15 06:15

| behaviour | clips · audio | right Shabad/Bani on screen (human truth) | sangat sees the right pangti (truth basis; coverage) | same or neighbouring pangti | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s | switch: found within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| **Kirtan of a Shabad** | 41 · 5.19 h | 98.4% | 45.7% (aligned (our own aligner, unaudited); 1 clips) (thin) | 60.3% | 2.24 / 3.54 (8 pangtis, aligned (our own aligner, unaudited)) | 24.6 | 13.3 / 38.9 (n 41, 41 cold) | - (no switch in these clips) |
| **Bani recited (paath)** | 45 · 0.86 h | 95.7% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 72.2% | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 5.1 / 19.5 (n 45, 45 cold, 1 not found) | - (no switch in these clips) |
| &nbsp;&nbsp;anand-40 | 4 · 0.08 h | 100% | - (no line truth) | - | - | 0 | 4.1 / 4.1 (n 4, 4 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;chaupai | 3 · 0.06 h | 100% | - (no line truth) | - | - | 0 | 5.1 / 5.1 (n 3, 3 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;jaap | 8 · 0.16 h | 81.2% | - (no line truth) | - | - | 0 | 5.6 / 45.1 (n 8, 8 cold, 1 not found) | - (no switch in these clips) |
| &nbsp;&nbsp;japji | 16 · 0.29 h | 97.2% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 72.2% | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 7.2 / 19.5 (n 16, 16 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;rehras | 8 · 0.16 h | 100% | - (no line truth) | - | - | 0 | 4.6 / 7.7 (n 8, 8 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;saloks | no clips yet in this split |  |  |  |  |  |  |  |
| &nbsp;&nbsp;sohila | 3 · 0.06 h | 100% | - (no line truth) | - | - | 0 | 4.1 / 9.2 (n 3, 3 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;tav-prasad-savaiye | 3 · 0.06 h | 100% | - (no line truth) | - | - | 0 | 5.1 / 5.6 (n 3, 3 cold) | - (no switch in these clips) |
| **Bani sung like kirtan** | 46 · 2.16 h | 84.2% | 93.5% (aligned (our own aligner, unaudited); 1 clips) (thin) | 95.2% | 0.56 / 1.3 (134 pangtis, aligned (our own aligner, unaudited)) | 49.5 | 8.2 / 58.9 (n 46, 46 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 47 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| &nbsp;&nbsp;aarti | 45 · 1.96 h | 82.5% | - (no line truth) | - | - | 55.6 | 8.2 / 58.9 (n 45, 45 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 47 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| &nbsp;&nbsp;asa-di-vaar | 1 · 0.2 h (thin) | 97.7% | 93.5% (aligned (our own aligner, unaudited); 1 clips) (thin) | 95.2% | 0.56 / 1.3 (134 pangtis, aligned (our own aligner, unaudited)) | 0 | 4.6 / 4.6 (n 1, 1 cold) (thin) | - (no switch in these clips) |
| &nbsp;&nbsp;rehras | no clips yet in this split |  |  |  |  |  |  |  |
| &nbsp;&nbsp;saloks | no clips yet in this split |  |  |  |  |  |  |  |
| **Akhand Paath (Ang after Ang)** | 16 · 2.32 h | 97.8% | **90.7%** (publisher slides, frame-checked; 16 clips) | 97.6% | 0.66 / 2.04 (1846 pangtis, publisher slides, frame-checked) | 34 | 3.6 / 9.2 (n 16, 15 cold) | 254 within 10 s / 0 later / 0 never (n 254); p50 0 s over found |

Akhand Paath (Ang after Ang): in sequence (right Shabad up) 97.8% · wrong 0.9% (34 s/h) · searching/blank 1.2% · behind the reader p50 / p90 0.66 / 2.04 s · pangtis reached 1846 of 1910 · Shabad crossings 258 (0 not shown), new Shabad up p50 / p90 0.4 / 2.6 s after its first pangti begins (negative = during its header)

Named clip sets of earlier reports (so an old number can be checked on its own clips):

| set | clips · audio | right Shabad/Bani | sangat sees the right pangti | same or neighbouring | seconds behind p50 / p90 | wrong s/h | find p50 / p90 s | switch: within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| Level-2 kirtan 41 (L2 sheet, human Shabad truth) | 41 · 5.19 h | 98.4% | 45.7% (aligned (our own aligner, unaudited); 1 clips) (thin) | 60.3% | 2.24 / 3.54 (8 pangtis, aligned (our own aligner, unaudited)) | 24.6 | 13.3 / 38.9 (n 41, 41 cold) | - (no switch in these clips) |
| Paath 60 (recited Nitnem cuts, human Bani truth 30-60 s of each) | 45 · 0.86 h | 95.7% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 72.2% | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 5.1 / 19.5 (n 45, 45 cold, 1 not found) | - (no switch in these clips) |
| Aarti-50 (cold starts inside a sung Aarti, human piece truth) | 45 · 1.96 h | 82.5% | - (no line truth) | - | - | 55.6 | 8.2 / 58.9 (n 45, 45 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 47 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| All behaviours together (mixed; not a headline) | 148 · 10.53 h | 95.2% | **90.7%** (publisher slides, frame-checked; 16 clips) | 97.6% | 0.66 / 2.04 (1846 pangtis, publisher slides, frame-checked) | 31.1 | 7.2 / 37.9 (n 148, 147 cold, 4 not found) | 254 within 10 s / 9 later / 1 never (n 264); p50 0 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |

Mic path, second view (50/50 = mean of mixer feed and room mic):

| behaviour | mic path | clips | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 | wrong Shabad s/h | find p50 s |
|---|---|---|---|---|---|---|---|
| Kirtan of a Shabad | mixer-feed | 41 | 98.4% | 45.7% (aligned (our own aligner, unaudited), 1) | 2.24 | 24.6 | 13.3 |
| Bani recited (paath) | studio | 41 | 97.7% | 70.9% (aligned (our own aligner, unaudited), 1) | 0.44 | 0 | 5.1 |
| Bani recited (paath) | unknown | 4 | 75% | - | - | 0 | 3.1 |
| Bani sung like kirtan | mixer-feed | 39 | 82% | - | - | 57.4 | 9.2 |
| Bani sung like kirtan | studio | 7 | 98.2% | 93.5% (aligned (our own aligner, unaudited), 1) | 0.56 | 0 | 5.6 |
| Akhand Paath (Ang after Ang) | studio | 16 | 97.8% | 90.7% (publisher slides, frame-checked, 16) | 0.66 | 34 | 3.6 |

Mic path assumptions (gab-micpath.json): Aarti (verified bn07/bn08 video) [studio] = studio; Aarti Bhai Karaj Singh Hazoori Ragi [studio] = studio; Aarti Darbar Sahib (No Ads) [hall] = mixer-feed; Aarti Darbar Sahib Amritsar [hall] = mixer-feed; Gurdwara Sahib Fremont [hall] = mixer-feed; Gurdwara Sahib Fremont, CA [hall] = mixer-feed; Gurdwara Sahib Renton [hall] = mixer-feed; Jaap Sahib live path, Bhai Manpreet Singh Kanpuri [hall] = unknown; Japji Bhai Gurbaj Singh [studio] = studio; Japji Bhai Manpreet Singh Kanpuri [studio] = studio; Japji Bhai Sahib Singh [studio] = studio; Japji Path Full (Fast) [studio] = studio; Nitnem playlist, Bhai Gurpreet Singh Shimla Wale [studio] = studio; Sachkhand Sri Harmandir Sahib, Amritsar (SGPC broadcast) [hall] = mixer-feed; YouTube Asa di Vaar [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '21th Part Ang 296 Pankti 10 to Ang 311 Pankti 02 Guru Granth Sahib Ji English & Hindi Translation' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '2nd Part Ang 0016 Pankti 05 to Ang 0029 Pankti 10 Sri Guru Granth Sahib Ji Path Audio with Subtitles' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '33th Part Ang 485 Pankti 01 to Ang 496 Pankti 03 Path Sri Guru Granth Sahib Ji Video & Audio' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '45th Part Ang 645 Pankti 12 to Ang 661 Pankti 02 Sahaj Path Sri Guru Granth Sahib Ji Full' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '54th Part Ang 779 Pankti 09 to Ang 794 Pankti 19 Guru Granth Sahib Ji in Punjabi, Hindi & English' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '64th Part Ang 938 Pankti 05 to Ang 953 Pankti 18 Path Sri Guru Granth Sahib Ji Audio & Video' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '72th Part Ang 1066 Pankti 01 to Ang 1083 Pankti 13 Guru Granth Sahib Ji in Punjabi, Hindi & English' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '91th Part Ang 1353 Pankti 04 to Ang 1363 Pankti 07 Audio Path Guru Granth Sahib With Hindi Meaning' [studio] = studio.

How to read: right Shabad/Bani % and wrong s/h rest on human answer keys for every clip. Same or neighbouring pangti adds the time the screen is one pangti behind or ahead (in kirtan the ragi sings two pangtis as one phrase, and the answer key marks the partner as wrong); information only. Sangat-sees-pangti % and seconds behind need line-level answer keys; their basis is printed (human = the sevadaar's screen or a person; aligned, ear-checked = made by our aligner and spot-checked by ear; aligned = made by our aligner only, not a headline). Find = first Shabad/Bani of a clip ("cold" = the app was started while it was being sung, timed from t=0); switch = a later, different Shabad/Bani, timed from its start, counted only when the screen showed something else when it began (a return to the main Shabad after a parmaan that the screen never left is "stayed on main Shabad", correct, not a switch); p50 is over found switches only, so read it with "never"; a parmaan is also counted as shown / not shown. (thin) = fewer than 3 clips or events behind the number.

Not run (76): no replay runner for this clip yet: aa21, aa22, sp01, sp02, sp03; excluded (the 30-60 s window is not Aarti (paath-tests not_bani); the dataset's bani:22 truth there is wrong): pt37, pt42, pt46; not in the local or Azure cache (gab fill): rn01, rn02, rn03, rn04, rn05, rn06, rn07, rn08 +60.

Timing: total 14.7 s (replay 1.8 s, scoring 5.2 s), 0 clip runs, 296 reused; load average 9.7 8.2 7.5.

## GAB v1.3 scorecard — GAB — 79584f7c4adb

build `/Users/asingh02/personal/sttm-akhand-2` @ 79584f7c4adb · Voice-Follow 9.0.3 · manifest 87155c50d6ce (345 rows) · set **main** · tier **full** · split **dev (train + dev rows; test held out)** · 2026-10-15 06:15

| behaviour | clips · audio | right Shabad/Bani on screen (human truth) | sangat sees the right pangti (truth basis; coverage) | same or neighbouring pangti | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s | switch: found within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| **Kirtan of a Shabad** | 41 · 5.19 h | 98.4% | 45.7% (aligned (our own aligner, unaudited); 1 clips) (thin) | 60.3% | 2.24 / 3.54 (8 pangtis, aligned (our own aligner, unaudited)) | 24.6 | 13.3 / 38.9 (n 41, 41 cold) | - (no switch in these clips) |
| **Bani recited (paath)** | 45 · 0.86 h | 95.7% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 72.2% | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 5.1 / 19.5 (n 45, 45 cold, 1 not found) | - (no switch in these clips) |
| &nbsp;&nbsp;anand-40 | 4 · 0.08 h | 100% | - (no line truth) | - | - | 0 | 4.1 / 4.1 (n 4, 4 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;chaupai | 3 · 0.06 h | 100% | - (no line truth) | - | - | 0 | 5.1 / 5.1 (n 3, 3 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;jaap | 8 · 0.16 h | 81.2% | - (no line truth) | - | - | 0 | 5.6 / 45.1 (n 8, 8 cold, 1 not found) | - (no switch in these clips) |
| &nbsp;&nbsp;japji | 16 · 0.29 h | 97.2% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 72.2% | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 7.2 / 19.5 (n 16, 16 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;rehras | 8 · 0.16 h | 100% | - (no line truth) | - | - | 0 | 4.6 / 7.7 (n 8, 8 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;saloks | no clips yet in this split |  |  |  |  |  |  |  |
| &nbsp;&nbsp;sohila | 3 · 0.06 h | 100% | - (no line truth) | - | - | 0 | 4.1 / 9.2 (n 3, 3 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;tav-prasad-savaiye | 3 · 0.06 h | 100% | - (no line truth) | - | - | 0 | 5.1 / 5.6 (n 3, 3 cold) | - (no switch in these clips) |
| **Bani sung like kirtan** | 46 · 2.16 h | 84.2% | 93.5% (aligned (our own aligner, unaudited); 1 clips) (thin) | 95.2% | 0.56 / 1.3 (134 pangtis, aligned (our own aligner, unaudited)) | 49.5 | 8.2 / 58.9 (n 46, 46 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 47 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| &nbsp;&nbsp;aarti | 45 · 1.96 h | 82.5% | - (no line truth) | - | - | 55.6 | 8.2 / 58.9 (n 45, 45 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 47 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| &nbsp;&nbsp;asa-di-vaar | 1 · 0.2 h (thin) | 97.7% | 93.5% (aligned (our own aligner, unaudited); 1 clips) (thin) | 95.2% | 0.56 / 1.3 (134 pangtis, aligned (our own aligner, unaudited)) | 0 | 4.6 / 4.6 (n 1, 1 cold) (thin) | - (no switch in these clips) |
| &nbsp;&nbsp;rehras | no clips yet in this split |  |  |  |  |  |  |  |
| &nbsp;&nbsp;saloks | no clips yet in this split |  |  |  |  |  |  |  |
| **Akhand Paath (Ang after Ang)** | 16 · 2.32 h | 98.4% | **96.7%** (publisher slides, frame-checked; 16 clips) | 98.5% | 0.3 / 1.2 (1890 pangtis, publisher slides, frame-checked) | 18.1 | 3.6 / 9.2 (n 16, 15 cold) | 254 within 10 s / 0 later / 0 never (n 254); p50 0 s over found |

Akhand Paath (Ang after Ang): in sequence (right Shabad up) 98.4% · wrong 0.5% (18.1 s/h) · searching/blank 1.1% · behind the reader p50 / p90 0.3 / 1.2 s · pangtis reached 1890 of 1910 · Shabad crossings 258 (0 not shown), new Shabad up p50 / p90 0.3 / 1.3 s after its first pangti begins (negative = during its header)

Named clip sets of earlier reports (so an old number can be checked on its own clips):

| set | clips · audio | right Shabad/Bani | sangat sees the right pangti | same or neighbouring | seconds behind p50 / p90 | wrong s/h | find p50 / p90 s | switch: within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| Level-2 kirtan 41 (L2 sheet, human Shabad truth) | 41 · 5.19 h | 98.4% | 45.7% (aligned (our own aligner, unaudited); 1 clips) (thin) | 60.3% | 2.24 / 3.54 (8 pangtis, aligned (our own aligner, unaudited)) | 24.6 | 13.3 / 38.9 (n 41, 41 cold) | - (no switch in these clips) |
| Paath 60 (recited Nitnem cuts, human Bani truth 30-60 s of each) | 45 · 0.86 h | 95.7% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 72.2% | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 5.1 / 19.5 (n 45, 45 cold, 1 not found) | - (no switch in these clips) |
| Aarti-50 (cold starts inside a sung Aarti, human piece truth) | 45 · 1.96 h | 82.5% | - (no line truth) | - | - | 55.6 | 8.2 / 58.9 (n 45, 45 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 47 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| All behaviours together (mixed; not a headline) | 148 · 10.53 h | 95.3% | **96.7%** (publisher slides, frame-checked; 16 clips) | 98.5% | 0.3 / 1.2 (1890 pangtis, publisher slides, frame-checked) | 27.2 | 7.2 / 37.9 (n 148, 147 cold, 4 not found) | 254 within 10 s / 9 later / 1 never (n 264); p50 0 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |

Mic path, second view (50/50 = mean of mixer feed and room mic):

| behaviour | mic path | clips | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 | wrong Shabad s/h | find p50 s |
|---|---|---|---|---|---|---|---|
| Kirtan of a Shabad | mixer-feed | 41 | 98.4% | 45.7% (aligned (our own aligner, unaudited), 1) | 2.24 | 24.6 | 13.3 |
| Bani recited (paath) | studio | 41 | 97.7% | 70.9% (aligned (our own aligner, unaudited), 1) | 0.44 | 0 | 5.1 |
| Bani recited (paath) | unknown | 4 | 75% | - | - | 0 | 3.1 |
| Bani sung like kirtan | mixer-feed | 39 | 82% | - | - | 57.4 | 9.2 |
| Bani sung like kirtan | studio | 7 | 98.2% | 93.5% (aligned (our own aligner, unaudited), 1) | 0.56 | 0 | 5.6 |
| Akhand Paath (Ang after Ang) | studio | 16 | 98.4% | 96.7% (publisher slides, frame-checked, 16) | 0.3 | 18.1 | 3.6 |

Mic path assumptions (gab-micpath.json): Aarti (verified bn07/bn08 video) [studio] = studio; Aarti Bhai Karaj Singh Hazoori Ragi [studio] = studio; Aarti Darbar Sahib (No Ads) [hall] = mixer-feed; Aarti Darbar Sahib Amritsar [hall] = mixer-feed; Gurdwara Sahib Fremont [hall] = mixer-feed; Gurdwara Sahib Fremont, CA [hall] = mixer-feed; Gurdwara Sahib Renton [hall] = mixer-feed; Jaap Sahib live path, Bhai Manpreet Singh Kanpuri [hall] = unknown; Japji Bhai Gurbaj Singh [studio] = studio; Japji Bhai Manpreet Singh Kanpuri [studio] = studio; Japji Bhai Sahib Singh [studio] = studio; Japji Path Full (Fast) [studio] = studio; Nitnem playlist, Bhai Gurpreet Singh Shimla Wale [studio] = studio; Sachkhand Sri Harmandir Sahib, Amritsar (SGPC broadcast) [hall] = mixer-feed; YouTube Asa di Vaar [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '21th Part Ang 296 Pankti 10 to Ang 311 Pankti 02 Guru Granth Sahib Ji English & Hindi Translation' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '2nd Part Ang 0016 Pankti 05 to Ang 0029 Pankti 10 Sri Guru Granth Sahib Ji Path Audio with Subtitles' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '33th Part Ang 485 Pankti 01 to Ang 496 Pankti 03 Path Sri Guru Granth Sahib Ji Video & Audio' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '45th Part Ang 645 Pankti 12 to Ang 661 Pankti 02 Sahaj Path Sri Guru Granth Sahib Ji Full' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '54th Part Ang 779 Pankti 09 to Ang 794 Pankti 19 Guru Granth Sahib Ji in Punjabi, Hindi & English' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '64th Part Ang 938 Pankti 05 to Ang 953 Pankti 18 Path Sri Guru Granth Sahib Ji Audio & Video' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '72th Part Ang 1066 Pankti 01 to Ang 1083 Pankti 13 Guru Granth Sahib Ji in Punjabi, Hindi & English' [studio] = studio; YouTube playlist 'Sri Guru Granth Sahib Ji' Ang after Ang (PLZYyMXQ_ASWT31CR_szaYgaTdFiH_e4T2): '91th Part Ang 1353 Pankti 04 to Ang 1363 Pankti 07 Audio Path Guru Granth Sahib With Hindi Meaning' [studio] = studio.

How to read: right Shabad/Bani % and wrong s/h rest on human answer keys for every clip. Same or neighbouring pangti adds the time the screen is one pangti behind or ahead (in kirtan the ragi sings two pangtis as one phrase, and the answer key marks the partner as wrong); information only. Sangat-sees-pangti % and seconds behind need line-level answer keys; their basis is printed (human = the sevadaar's screen or a person; aligned, ear-checked = made by our aligner and spot-checked by ear; aligned = made by our aligner only, not a headline). Find = first Shabad/Bani of a clip ("cold" = the app was started while it was being sung, timed from t=0); switch = a later, different Shabad/Bani, timed from its start, counted only when the screen showed something else when it began (a return to the main Shabad after a parmaan that the screen never left is "stayed on main Shabad", correct, not a switch); p50 is over found switches only, so read it with "never"; a parmaan is also counted as shown / not shown. (thin) = fewer than 3 clips or events behind the number.

Not run (76): no replay runner for this clip yet: aa21, aa22, sp01, sp02, sp03; excluded (the 30-60 s window is not Aarti (paath-tests not_bani); the dataset's bani:22 truth there is wrong): pt37, pt42, pt46; not in the local or Azure cache (gab fill): rn01, rn02, rn03, rn04, rn05, rn06, rn07, rn08 +60.

Timing: total 14.7 s (replay 1.8 s, scoring 5.6 s), 0 clip runs, 296 reused; load average 9.7 8.2 7.5.
