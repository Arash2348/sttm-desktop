## GAB v1.2 scorecard — GAB-Hard (Fremont hall, laptop mic) — 265da34e14fb

build `/Users/asingh02/personal/live-darbar-venues/cache/worktrees/265da34e14fb` @ 265da34e14fb · manifest 2a6fc3ba5c16 (193 rows) · set **hard** · tier **full** · split **dev (train + dev rows; test held out)** · 2026-10-14 22:40

| behaviour | clips · audio | right Shabad/Bani on screen (human truth) | sangat sees the right pangti (truth basis; coverage) | same or neighbouring pangti | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s | switch: found within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| **Kirtan of a Shabad** | 14 · 1.91 h | 59.3% | **47%** (human; 9 clips, +5 never shown) | 65.9% | 2.05 / 20.23 (106 pangtis, human) | 383.8 | 16.9 / 125.5 (n 14, 2 cold, 5 not found) | 0 within 10 s / 1 later / 2 never (n 3); p50 518.1 s over found; 1 stayed on main Shabad; parmaan shown 0 of 1 |
| **Bani recited (paath)** | no GAB-Hard (Fremont hall, laptop mic) recording of this behaviour has a replay runner |  |  |  |  |  |  |  |
| **Bani sung like kirtan** | no GAB-Hard (Fremont hall, laptop mic) recording of this behaviour has a replay runner |  |  |  |  |  |  |  |
| **Akhand Paath (Ang after Ang)** | no GAB-Hard (Fremont hall, laptop mic) recording of this behaviour has a replay runner |  |  |  |  |  |  |  |

Named clip sets of earlier reports (so an old number can be checked on its own clips):

| set | clips · audio | right Shabad/Bani | sangat sees the right pangti | same or neighbouring | seconds behind p50 / p90 | wrong s/h | find p50 / p90 s | switch: within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| Fremont kirtan, dev sessions (Jaspal, sevadaar screen = human line truth) | 9 · 1.1 h | 70.8% | **64%** (human; 6 clips, +3 never shown) | 86.6% | 2.13 / 23.07 (66 pangtis, human) | 284.9 | 14.9 / 51.7 (n 9, 3 not found) | 0 within 10 s / 0 later / 1 never (n 1); p50 - s over found; 1 stayed on main Shabad; parmaan shown 0 of 1 (thin) |
| Fremont kirtan, train sessions | 5 · 0.82 h | 44.6% | **28.4%** (human; 3 clips, +2 never shown) | 43.2% | 1.3 / 17.9 (40 pangtis, human) | 511 | 100.4 / 125.5 (n 5, 2 cold, 2 not found) | 0 within 10 s / 1 later / 1 never (n 2); p50 518.1 s over found (thin) |
| All behaviours together (mixed; not a headline) | 14 · 1.91 h | 59.3% | **47%** (human; 9 clips, +5 never shown) | 65.9% | 2.05 / 20.23 (106 pangtis, human) | 383.8 | 16.9 / 125.5 (n 14, 2 cold, 5 not found) | 0 within 10 s / 1 later / 2 never (n 3); p50 518.1 s over found; 1 stayed on main Shabad; parmaan shown 0 of 1 |

Mic path, second view (50/50 = mean of mixer feed and room mic):

| behaviour | mic path | clips | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 | wrong Shabad s/h | find p50 s |
|---|---|---|---|---|---|---|---|
| Kirtan of a Shabad | room-mic | 14 | 59.3% | 47% (human, 9) | 2.05 | 383.8 | 16.9 |

Mic path assumptions (gab-micpath.json): Gurdwara Sahib Fremont (Jaspal) [laptop-mic] = room-mic.

How to read: right Shabad/Bani % and wrong s/h rest on human answer keys for every clip. Same or neighbouring pangti adds the time the screen is one pangti behind or ahead (in kirtan the ragi sings two pangtis as one phrase, and the answer key marks the partner as wrong); information only. Sangat-sees-pangti % and seconds behind need line-level answer keys; their basis is printed (human = the sevadaar's screen or a person; aligned, ear-checked = made by our aligner and spot-checked by ear; aligned = made by our aligner only, not a headline). Find = first Shabad/Bani of a clip ("cold" = the app was started while it was being sung, timed from t=0); switch = a later, different Shabad/Bani, timed from its start, counted only when the screen showed something else when it began (a return to the main Shabad after a parmaan that the screen never left is "stayed on main Shabad", correct, not a switch); p50 is over found switches only, so read it with "never"; a parmaan is also counted as shown / not shown. (thin) = fewer than 3 clips or events behind the number.

Not run (8): replay left the cache (this build asks the model for new windows: gab fill): kh13, kh17, kh18, kh20, kh22, kh25; no replay runner for this clip yet: kh16, kh23.

Timing: total 110.9 s (replay 110.6 s, scoring 0.3 s), 10 clip runs, 0 reused; load average 6.8 8.8 15.0.
