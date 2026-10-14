# Kirtan line follower: hold the pangti (branch vf-kirtan-line-hold)

Base: upstream/experimental-release 2cb8b003. Only `www/main/addons/voice-follow/engine/follower.js`
(the kirtan line follower) is in scope; follower2 (paath), read-Bani paths and the search/lock/switch
judge are untouched.

Measured with the cached replay (`vf-check.js --suites fremont --no-lock`, ~30-50 s) and the honest
scorer (`sangat-score.js`, human Fremont line truth from khalis-tests.json). The 30 ear-checked moments
(linecheck-fremont/items.json + answers.json) are re-scored by replaying the build and asking what it
shows over [t0, t0+seconds]; a moment counts as fixed when the sevadaar's line is on screen >= 50% of it.

## Baseline (replay of 2cb8b003)

| measure | base |
|---|---|
| Fremont sangat sees right pangti (ON + catching up) | 59.3% |
| 25 sevadaar-right moments now right | 0/25 (4 of 415 s on the sevadaar line) |
| line exact / within 1 | 57.0% / 71.7% |

The replay reproduces the 30 moments exactly (same app line in every window).

### Why the app is off (follower decode trace, `VF_FTRACE=1`)

1. **Released and never re-locks (78% of the disagreement time).** After 14 frozen decodes (instruments,
   alaap, muddy audio) the follower releases (`cur = null`); the screen keeps the last line. To come back
   it needs 4 *consecutive* decodes with the same top line, and every frozen decode in between resets that
   count, so in muddy kirtan it almost never re-locks. In ~324 of the 415 disagreement seconds the
   follower was released. Examples: kh04 699-752 s (top = the right line over and over, never confirmed),
   kh01 261-300 s.
2. **Next-line moves on a scrap.** A move to the next line needs only one decode and no evidence test:
   kh04 687.4 s moved on the 4-letter fragment "ਤਸਿਆ" (partial match 0.75 vs 0.50), then the follower
   released and that early line stayed up for 100 s.

### Is it muddy audio / low recognizer confidence? (coordinator question)

Over the 119 screen line changes in the base Fremont replay (47 not confirmed by the sevadaar within
[-3, +8] s vs 72 confirmed): mean transcript confidence 0.897 vs 0.917 (no real separation); letters per
follower window 7.1 vs 8.5 (weak); how much better the new line matched than the current line 0.26 vs 0.47
(median 0.17 vs 0.44, strong). So the data does not support a confidence gate; it supports an
evidence-gap gate (a move needs the new line to match clearly better than the current one).

## Steps

(Resumed after the Mac disk filled up on Oct 13: the code diff was intact, the interrupted sweep was
rerun, and runs that failed with the model file missing during the cleanup were rerun.)

| step | change | Fremont sangat (ON + catching up) | 25 sevadaar-right moments right | note |
|---|---|---|---|---|
| 0 | base 2cb8b003 | 59.3% | 0/25 | |
| 1 | re-lock by votes: line top of 3 of the last 6 decodes; frozen decodes no longer reset it | 62.6% | 6/25 | |
| 2a | + next line needs >= 6 letters (`advMinHyp`) | 67.5% | 12/25 | lag p50 1.01 s |
| 2b | + next line must win 2 decodes (`dwellAdv` 2) | 70.3% | 14/25 | lag p50 1.17 s |
| - | `advEmisGap` 0.15-0.2 / `jumpEmisGap` 0.2 / `initWin` 5 or 8 / `dwellAdv` 3 | 69-70.6% | 13-14/25 | no gain; not used |

`dwellAdv` 2 slowed sung Aarti (Renton Aarti line exact 32.5 -> 30.8%, lag 2.4 -> 2.7 s), so it is
passed only for kirtan Shabads (`SHABAD_FOLLOWER_OPTS` in VoiceFollow.jsx); Aarti keeps 1.

## Final (head 8546d23c, cached replay, all clips replayed, no env overrides)

| set | metric | base | fix |
|---|---|---|---|
| Fremont (5, human line truth) | sangat sees right pangti | 59.3% | **70.3%** |
| | line exact / within 1 | 57.0 / 71.7% | 68.2 / 76.1% |
| | arbiter same/app-right | 59% | 72.3% |
| | catch-up lag p50 / p90 | 1.47 / 6.76 s | 1.17 / 7.27 s |
| | stuck > 3 s | 40 | 32 |
| | shabad right / wrong | 85.0 / 3.6% | same |
| 30 ear-checked moments | sevadaar-right now right (>= 50% of window) | 0/25 | **14/25** (240 of 415 s) |
| | "instruments only, keep the line" | 0/3 | 2/3 |
| L2-41 | right / wrong / found <= 10 s | 97.54 / 1.6% / 36 | same |
| Aarti-50 | right / wrong / heard line | 85.3 / 0.2 / 73.4% | 85.6 / 0.3 / 74.4% |
| | found / median find | 43 / 8 s | same |
| | wrong switches | 2 | **3** (one brief detour to 5478 in r1aarti@135) |
| Renton | Aarti line exact / lag p50 | 32.5% / 2.4 s | 32.0% / 2.5 s |
| | Rehras, Sohila, kirtan1, Fareed, Hukamnama | | same (Sohila line exact 84.1 -> 84.0) |

Per Fremont clip (sangat %): kh01 35.5 -> 51.6, kh02 81.6 -> 81.4, kh03 74.9 -> 78.1, kh04 54.5 -> 76.1,
kh05 47.3 -> 51.5.

## Resonance / group-singing check (user observation)

Over the 119 line changes in the base replay, transcript confidence on wrong moves is 0.897 vs 0.917 on
right ones: no usable separation. So the data does not support a confidence gate. What separates them
is how much better the new line matched (median gap 0.17 vs 0.44) and letters heard (7.1 vs 8.5). The
fix uses letters and persistence; an emission-gap gate gave no extra gain once those were in.

## What is left

* 3 of the 11 unfixed moments are another Shabad (parmaan, sevadaar verse 57964/57967/59185): a
  Shabad-switch matter, not the line follower.
* kh01 (Kabir Shabad, many shared words): the rahao (21768) and line 9-10 still trade places.
* The extra Aarti wrong switch (r1aarti@135, brief) is not explained yet; the switch judge is untouched,
  so follower state now differs at that moment.
* Tuned on Fremont, which is also the test; L2/Aarti/Renton held out. kh06 (Fremont, human truth, not
  in the suite or cache) would be the next held-out check.
