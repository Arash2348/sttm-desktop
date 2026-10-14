## GAB v1.1 scorecard — eb789375d5ec

build `/Users/asingh02/personal/live-darbar-venues/cache/worktrees/eb789375d5ec` @ eb789375d5ec · manifest 0d7202f6daa8 (190 rows) · tier **full** · split **dev (train + dev rows; test held out)** · 2026-10-14 10:28

| behaviour | clips · audio | right Shabad/Bani on screen (human truth) | sangat sees the right pangti (truth basis; coverage) | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s | switch: found within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|
| **Kirtan of a Shabad** | 61 · 7.98 h | 81.4% | **47.7%** (human; 11 clips, +9 never shown) | 2.27 / 20.23 (136 pangtis, human) | 146.1 | 15.9 / 70.1 (n 61, 45 cold, 9 not found) | 1 within 10 s / 2 later / 2 never (n 5); p50 17.9 s over found; 3 stayed on main Shabad; parmaan shown 1 of 6 |
| **Bani recited (paath)** | 45 · 0.86 h | 95.7% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 5.1 / 19.5 (n 45, 45 cold, 1 not found) | - (no switch in these clips) |
| &nbsp;&nbsp;anand-40 | 4 · 0.08 h | 100% | - (no line truth) | - | 0 | 4.1 / 4.1 (n 4, 4 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;chaupai | 3 · 0.06 h | 100% | - (no line truth) | - | 0 | 5.1 / 5.1 (n 3, 3 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;jaap | 8 · 0.16 h | 81.2% | - (no line truth) | - | 0 | 5.6 / 45.1 (n 8, 8 cold, 1 not found) | - (no switch in these clips) |
| &nbsp;&nbsp;japji | 16 · 0.29 h | 97.2% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 7.2 / 19.5 (n 16, 16 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;rehras | 8 · 0.16 h | 100% | - (no line truth) | - | 0 | 4.6 / 7.7 (n 8, 8 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;saloks | no clips yet in this split |  |  |  |  |  |  |
| &nbsp;&nbsp;sohila | 3 · 0.06 h | 100% | - (no line truth) | - | 0 | 4.1 / 9.2 (n 3, 3 cold) | - (no switch in these clips) |
| &nbsp;&nbsp;tav-prasad-savaiye | 3 · 0.06 h | 100% | - (no line truth) | - | 0 | 5.1 / 5.6 (n 3, 3 cold) | - (no switch in these clips) |
| **Bani sung like kirtan** | 46 · 2.16 h | 85% | 93.5% (aligned (our own aligner, unaudited); 1 clips) (thin) | 0.56 / 1.3 (134 pangtis, aligned (our own aligner, unaudited)) | 38 | 8.2 / 58.9 (n 46, 46 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 48.7 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| &nbsp;&nbsp;aarti | 45 · 1.96 h | 83.5% | - (no line truth) | - | 42.7 | 8.2 / 58.9 (n 45, 45 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 48.7 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| &nbsp;&nbsp;asa-di-vaar | 1 · 0.2 h (thin) | 97.7% | 93.5% (aligned (our own aligner, unaudited); 1 clips) (thin) | 0.56 / 1.3 (134 pangtis, aligned (our own aligner, unaudited)) | 0 | 4.6 / 4.6 (n 1, 1 cold) (thin) | - (no switch in these clips) |
| &nbsp;&nbsp;rehras | no clips yet in this split |  |  |  |  |  |  |
| &nbsp;&nbsp;saloks | no clips yet in this split |  |  |  |  |  |  |
| **Akhand Paath (Ang after Ang)** | no runner yet: the Sehaj Paath clips have the Shabads of each Ang in order but no times, and GAB has no replay suite for them |  |  |  |  |  |  |

Named clip sets of earlier reports (so an old number can be checked on its own clips):

| set | clips · audio | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 / p90 | wrong s/h | find p50 / p90 s | switch: within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|
| Level-2 kirtan 41 (L2 sheet, human Shabad truth) | 41 · 5.19 h | 98.5% | 45.7% (aligned (our own aligner, unaudited); 1 clips) (thin) | 2.24 / 3.54 (8 pangtis, aligned (our own aligner, unaudited)) | 23.6 | 13.3 / 38.9 (n 41, 41 cold) | - (no switch in these clips) |
| Fremont kirtan, dev sessions (Jaspal, sevadaar screen = human line truth) | 11 · 1.31 h | 61.1% | **64%** (human; 6 clips, +5 never shown) | 2.13 / 23.07 (66 pangtis, human) | 246 | 14.9 / 51.7 (n 11, 5 not found) | 0 within 10 s / 0 later / 1 never (n 1); p50 - s over found; 1 stayed on main Shabad; parmaan shown 0 of 1 (thin) |
| Fremont kirtan, train sessions | 9 · 1.48 h | 46% | **36.5%** (human; 5 clips, +4 never shown) | 2.47 / 18.31 (70 pangtis, human) | 437.4 | 100.4 / 208.9 (n 9, 4 cold, 4 not found) | 1 within 10 s / 2 later / 1 never (n 4); p50 17.9 s over found; 2 stayed on main Shabad; parmaan shown 1 of 5 |
| Paath 60 (recited Nitnem cuts, human Bani truth 30-60 s of each) | 45 · 0.86 h | 95.7% | 70.9% (aligned (our own aligner, unaudited); 1 clips) (thin) | 0.44 / 1.66 (11 pangtis, aligned (our own aligner, unaudited)) | 0 | 5.1 / 19.5 (n 45, 45 cold, 1 not found) | - (no switch in these clips) |
| Aarti-50 (cold starts inside a sung Aarti, human piece truth) | 45 · 1.96 h | 83.5% | - (no line truth) | - | 42.7 | 8.2 / 58.9 (n 45, 45 cold, 3 not found) | 0 within 10 s / 9 later / 1 never (n 10); p50 48.7 s over found; 1 stayed on main Shabad; parmaan shown 2 of 2 |
| All behaviours together (mixed; not a headline) | 152 · 11 h | 82.7% | **47.7%** (human; 11 clips, +9 never shown) | 2.27 / 20.23 (136 pangtis, human) | 118.5 | 8.2 / 51.7 (n 152, 136 cold, 13 not found) | 1 within 10 s / 11 later / 3 never (n 15); p50 48.7 s over found; 4 stayed on main Shabad; parmaan shown 3 of 8 |

Mic path, second view (50/50 = mean of mixer feed and room mic):

| behaviour | mic path | clips | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 | wrong Shabad s/h | find p50 s |
|---|---|---|---|---|---|---|---|
| Kirtan of a Shabad | mixer-feed | 41 | 98.5% | 45.7% (aligned (our own aligner, unaudited), 1) | 2.24 | 23.6 | 13.3 |
| Kirtan of a Shabad | room-mic | 20 | 52.8% | 47.7% (human, 11) | 2.27 | 350.8 | 51.7 |
| Kirtan of a Shabad | **50/50** | | **75.65%** | **46.7%** | **2.25** | **187.2** | **32.5** |
| Bani recited (paath) | studio | 41 | 97.7% | 70.9% (aligned (our own aligner, unaudited), 1) | 0.44 | 0 | 5.1 |
| Bani recited (paath) | unknown | 4 | 75% | - | - | 0 | 3.1 |
| Bani sung like kirtan | mixer-feed | 39 | 82.9% | - | - | 44 | 9.2 |
| Bani sung like kirtan | studio | 7 | 98.2% | 93.5% (aligned (our own aligner, unaudited), 1) | 0.56 | 0 | 5.6 |

Mic path assumptions (gab-micpath.json): Aarti (verified bn07/bn08 video) [studio] = studio; Aarti Bhai Karaj Singh Hazoori Ragi [studio] = studio; Aarti Darbar Sahib (No Ads) [hall] = mixer-feed; Aarti Darbar Sahib Amritsar [hall] = mixer-feed; Gurdwara Sahib Fremont (Jaspal) [laptop-mic] = room-mic; Gurdwara Sahib Fremont [hall] = mixer-feed; Gurdwara Sahib Fremont, CA [hall] = mixer-feed; Gurdwara Sahib Renton [hall] = mixer-feed; Jaap Sahib live path, Bhai Manpreet Singh Kanpuri [hall] = unknown; Japji Bhai Gurbaj Singh [studio] = studio; Japji Bhai Manpreet Singh Kanpuri [studio] = studio; Japji Bhai Sahib Singh [studio] = studio; Japji Path Full (Fast) [studio] = studio; Nitnem playlist, Bhai Gurpreet Singh Shimla Wale [studio] = studio; Sachkhand Sri Harmandir Sahib, Amritsar (SGPC broadcast) [hall] = mixer-feed; YouTube Asa di Vaar [studio] = studio.

How to read: right Shabad/Bani % and wrong s/h rest on human answer keys for every clip. Sangat-sees-pangti % and seconds behind need line-level answer keys; their basis is printed (human = the sevadaar's screen or a person; aligned, ear-checked = made by our aligner and spot-checked by ear; aligned = made by our aligner only, not a headline). Find = first Shabad/Bani of a clip ("cold" = the app was started while it was being sung, timed from t=0); switch = a later, different Shabad/Bani, timed from its start, counted only when the screen showed something else when it began (a return to the main Shabad after a parmaan that the screen never left is "stayed on main Shabad", correct, not a switch); p50 is over found switches only, so read it with "never"; a parmaan is also counted as shown / not shown. (thin) = fewer than 3 clips or events behind the number.

Not run (10): no replay runner for this clip yet: aa21, aa22, kh16, kh23, sp01, sp02, sp03; excluded (the 30-60 s window is not Aarti (paath-tests not_bani); the dataset's bani:22 truth there is wrong): pt37, pt42, pt46.

Timing: total 8.1 s (replay 2.1 s, scoring 5.9 s), 0 clip runs, 152 reused; load average 12.8 12.9 14.0.
