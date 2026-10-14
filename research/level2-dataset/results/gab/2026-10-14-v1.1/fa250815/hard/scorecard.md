## GAB v1.2 scorecard — GAB-Hard (Fremont hall, laptop mic) — fa250815bc98

build `/Users/asingh02/personal/live-darbar-venues/cache/worktrees/fa250815bc98` @ fa250815bc98 · manifest 51120e2f5e8f (195 rows) · set **hard** · tier **full** · split **dev (train + dev rows; test held out)** · 2026-10-14 22:56

| behaviour | clips · audio | right Shabad/Bani on screen (human truth) | sangat sees the right pangti (truth basis; coverage) | same or neighbouring pangti | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s | switch: found within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| **Kirtan of a Shabad** | 18 · 2.46 h | 52.6% | **45.7%** (human; 10 clips, +8 never shown) | 65.2% | 2.22 / 17.9 (129 pangtis, human) | 329.9 | 51.7 / 208.9 (n 18, 4 cold, 8 not found) | 0 within 10 s / 2 later / 2 never (n 4); p50 518.1 s over found; 3 stayed on main Shabad; parmaan shown 1 of 4 |
| **Bani recited (paath)** | no GAB-Hard (Fremont hall, laptop mic) recording of this behaviour has a replay runner |  |  |  |  |  |  |  |
| **Bani sung like kirtan** | no GAB-Hard (Fremont hall, laptop mic) recording of this behaviour has a replay runner |  |  |  |  |  |  |  |
| **Akhand Paath (Ang after Ang)** | no GAB-Hard (Fremont hall, laptop mic) recording of this behaviour has a replay runner |  |  |  |  |  |  |  |

Named clip sets of earlier reports (so an old number can be checked on its own clips):

| set | clips · audio | right Shabad/Bani | sangat sees the right pangti | same or neighbouring | seconds behind p50 / p90 | wrong s/h | find p50 / p90 s | switch: within 10 s / later / never; p50 |
|---|---|---|---|---|---|---|---|---|
| Fremont kirtan, dev sessions (Jaspal, sevadaar screen = human line truth) | 11 · 1.31 h | 61.1% | **64%** (human; 6 clips, +5 never shown) | 86.6% | 2.13 / 23.07 (66 pangtis, human) | 246 | 14.9 / 51.7 (n 11, 5 not found) | 0 within 10 s / 0 later / 1 never (n 1); p50 - s over found; 1 stayed on main Shabad; parmaan shown 0 of 1 (thin) |
| Fremont kirtan, train sessions | 7 · 1.14 h | 43.6% | **30%** (human; 4 clips, +3 never shown) | 46.7% | 2.27 / 15.82 (63 pangtis, human) | 418.5 | 125.5 / 208.9 (n 7, 4 cold, 3 not found) | 0 within 10 s / 2 later / 1 never (n 3); p50 518.1 s over found; 2 stayed on main Shabad; parmaan shown 1 of 3 |
| All behaviours together (mixed; not a headline) | 18 · 2.46 h | 52.6% | **45.7%** (human; 10 clips, +8 never shown) | 65.2% | 2.22 / 17.9 (129 pangtis, human) | 329.9 | 51.7 / 208.9 (n 18, 4 cold, 8 not found) | 0 within 10 s / 2 later / 2 never (n 4); p50 518.1 s over found; 3 stayed on main Shabad; parmaan shown 1 of 4 |

Mic path, second view (50/50 = mean of mixer feed and room mic):

| behaviour | mic path | clips | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 | wrong Shabad s/h | find p50 s |
|---|---|---|---|---|---|---|---|
| Kirtan of a Shabad | room-mic | 18 | 52.6% | 45.7% (human, 10) | 2.22 | 329.9 | 51.7 |

Mic path assumptions (gab-micpath.json): Gurdwara Sahib Fremont (Jaspal) [laptop-mic] = room-mic.

How to read: right Shabad/Bani % and wrong s/h rest on human answer keys for every clip. Same or neighbouring pangti adds the time the screen is one pangti behind or ahead (in kirtan the ragi sings two pangtis as one phrase, and the answer key marks the partner as wrong); information only. Sangat-sees-pangti % and seconds behind need line-level answer keys; their basis is printed (human = the sevadaar's screen or a person; aligned, ear-checked = made by our aligner and spot-checked by ear; aligned = made by our aligner only, not a headline). Find = first Shabad/Bani of a clip ("cold" = the app was started while it was being sung, timed from t=0); switch = a later, different Shabad/Bani, timed from its start, counted only when the screen showed something else when it began (a return to the main Shabad after a parmaan that the screen never left is "stayed on main Shabad", correct, not a switch); p50 is over found switches only, so read it with "never"; a parmaan is also counted as shown / not shown. (thin) = fewer than 3 clips or events behind the number.

Not run (4): no replay runner for this clip yet: kh16, kh23; replay left the cache (this build asks the model for new windows: gab fill): kh17, kh22.

Timing: total 108.8 s (replay 108.4 s, scoring 0.4 s), 10 clip runs, 0 reused; load average 8.4 7.6 9.8.
