# Paath follower: re-acquire after a reader skip (branch vf-paath-reacquire, base d15450f3)

Goal: cut the time the Voice-Follow paath follower takes to catch up after the reader skips rows or
jumps past a header inside a Bani. Target: crossing lag <= 0.6 s on every Renton Rehras skip, no new
wrong jumps, no held-out set worse. Sung Banis (Aarti 22, Asa di Vaar 90) byte-identical.

## Method
Cached-window replay (`research/follower-bench/anticipate-bench.js`, PCM=1, 0.25 s step, no model, no
lock), base = follower2.js at d15450f3. Scratch tools (`$S/reacq`): `skiplag.js` (per truth skip of >= 3
rows: first time the screen reaches the gap's far side and the first real line), `trace.js` (per window:
local match L, whole-Bani match G, other-Gurbani score bg, pending candidate), `splice-bench.js`
(spliced Renton audio = a reader of a shorter Rehras on the extra-long profile; see below).
Times are bench times (window end + 0.25 s, as the app shows them).

## What the traces showed (base)
The Renton reader reads the Taksal Rehras on the Buddha Dal (extra-long) profile: every skip is a block
only the extra-long list has (rows 167-203, 373-401, 414-433), preceded by a header row he says aloud
("ਦੋਹਰਾ", "ਪਾਤਿਸ਼ਾਹੀ ੧੦", "ਚੌਪਈ", a fateh).
- A header is short and recurs all over the Bani, so the LOCAL window (4 back / 6 ahead) always has a
  copy: the position moves to the local copy (373 instead of 402, 414 instead of 434) and the local
  match stays healthy. The far jump then has to beat that local match by jumpMargin and hold jumpDwell
  = 4 windows (1 s).
- At 1171 s: the new line's letters first appear at 1177.5 ("ਜਬਅਚਪਰਭ", 4 s window) and G first lands on
  row 403 at 1177.75 (score 0.36). The local match is already below minScore (0.24) yet the margin over
  it was still demanded, and the other-Gurbani margin (0.09 < 0.15) also failed that window; the
  candidate started at 1178.0 and the 4-window dwell showed 403 at 1178.75 (truth start 1176.4).
- At 1219 s: "ਦੋਹਰਾ ਰਾਮ" at 1222.75 gives G = 435 at 0.93 at once; the dwell alone cost 0.75 s.
- At 653 s: the reader went 166 -> fateh (212) -> Patshahi 10 (213) -> "ਚੌਪਈ" -> stanza 375 (row 204,
  9 rows BACK from 213) -> 211 -> 214. Base showed the local duplicates 167, 173, 174, 175 (same text as
  what he said) and reached 204 at 663.0; by app id it was 30 s off (173 shown while truth says 212).

## Rule (shipped defaults)
`reacquireDwell: 2, reacquireRows: 150` (0 = off for Banis 22 and 90). In decide(): `lost` = the local
match is below minScore, or the current line is a header row, or the local match ends in a header row
(header = fewer than antMinLetters = 10 spoken letters). While lost, a whole-Bani match within
reacquireRows rows of the current line (either direction) needs no margin over the local match and
confirms in reacquireDwell windows; it still needs jumpScore (0.35) and the lockMargin (0.15) over other
Gurbani. Everything else (far/backward jumps beyond 150 rows, sung Banis) unchanged.

## Variants tried
| variant | Rehras voiced | within-1 | prem | slowed voiced | Sohila voiced | rec55 voiced | note |
|---|---|---|---|---|---|---|---|
| base d15450f3 | 88.2 | 96.1 | 3 (0.8%) | 86.8 | 96.6 | 90.60 | |
| c1 forward only, dwell 2, no margin vs failed local | 88.4 | 96.2 | 3 | 87.0 | 96.8 | 90.63 | 653 s: never shows 204 (it is 9 rows back) |
| c2 = c1 + backward within 150 rows (FINAL) | 88.5 | 96.3 | 3 | 87.2 | 96.8 | 90.64 | 204 shown 662.5; backs followed 7/8 again |
| c3 = c2 + other-Gurbani margin 0.05 while lost | 88.4 | 96.3 | 3 | 87.2 | 97.0 | 90.66 | NEW wrong jump 1273.5 s (row 317, 133 rows back, 1.5 s) -> rejected |
jumpDwell 2 or 1 alone (other agent): +0.1 voiced only, since the margin against a failing local match
still blocked the first windows.

## Per-skip crossing lag, Renton Rehras (first real line shown minus its truth start; base -> final)
| skip (s) | rows | first real line | base | final | floor (first window with >= 4 letters of the line, bench time) | lag after that floor base -> final |
|---|---|---|---|---|---|---|
| 1171.2 | 372 -> 402 (header) -> 403 | 403 "ਜਬ ਆਇਸੁ ਪ੍ਰਭ ਕੋ" | 2.35 | 1.85 | 1177.5 (truth start 1176.4: lag 1.1 at best) | 1.25 -> 0.75 |
| 1219.8 | 413 -> 434 (header) -> 435 | 435 "ਰਾਮ ਕਥਾ ਜੁਗ ਜੁਗ" | 1.22 | 0.72 | 1222.75 (0.45 at best) | 0.75 -> 0.25 |
| 653.6 | 166 -> 212 fateh -> 213 -> 204 | 212 (by app id; base showed the duplicate 173) | 30.15 (dup) | 2.9 | - | - |
| 653.6 | ... -> 204 "ਪੁਨਿ ਰਾਛਸ" (9 rows back) | 204 | 663.0 | 662.5 | 661.75 ("ਪੁਨਰਸ"; its truth start 658.2 includes the spoken headers) | 1.25 -> 0.75 |
| 685.6 | 211 -> 214 | 214 | 1.15 | 1.15 | (3-row local skip, not a far jump) | |
The <= 0.6 s target from the truth start is not reachable at 1171 with this recognizer: the first
window that contains 4 letters of the new line ends 1.1 s after the truth start (a 4 s window, 0.25 s
step, CTC spike late), and one window is not evidence (at 1177.5 the whole-Bani best is row 386, wrong).
From the first usable window the remaining lag is 0.75 s (one more window to agree + the show step).

## Sets (base -> final)
| set | voiced % | strict exact | within-1 | premature | lag med / p90 | missed | backs followed |
|---|---|---|---|---|---|---|---|
| Rehras (tuning) | 88.2 -> 88.5 | 75.9 -> 76.1 | 96.1 -> 96.3 | 3/363 -> 3/363 (0.8%) | 0.15/0.54 -> 0.15/0.55 | 7 -> 6 | 7/8 -> 7/8 |
| slowed Rehras (0.5 s decodes) | 86.8 -> 87.2 | 76.3 -> 76.6 | 96.9 -> 97.3 | 3 -> 3 (0.8%) | 0.20/0.74 -> 0.20/0.74 | 7 -> 5 | 6/8 -> 7/8 |
| Sohila | 96.6 -> 96.8 | 91.9 -> 92.1 | 99.2 -> 99.4 | 1 -> 1 (1.8%) | -0.19/0.38 same | 0 | 1/1 |
| 55 recited clips | 90.60 -> 90.64 | 87.57 -> 87.60 | 97.51 -> 97.55 | 11/1136 -> 11/1136 (1.0%) | 0.15/0.65 same | 10 | 3/3 |
| sung: Renton Aarti, bn07, bn08, Newton asa1/asa2, YouTube Asa | shown sequences IDENTICAL 6/6 | | | | | | |
Every shown-list difference, all sets: Rehras 96.5/97 s (the reader's greeting "Vaheguru ji ka Khalsa";
both builds wrongly match the fateh row 173, final 1 s sooner, recovers 0.5 s sooner at 114.5), 656.5-662.5
(the 653 skip above), 1178.25, 1223.0; slowed Rehras the same events; Sohila 12.5 -> 12.0 s (first lock
after the Salok tail); 55 clips: bn01 four moves 0.5 s earlier, bn02 one. No new wrong line anywhere.

## Short-reader regression check (user ask)
The Renton reading itself is a Taksal reader on the extra-long profile (three crossings above). paath-60
has no other Rehras reader with a crossing inside a clip (Shimla Wale pt19-27 reads the full list, 70 s
clips; bn01/bn02 stop at 520 s), so two short readers were made by splicing the Renton audio
(`$S/reacq/splice`, transcripts precomputed with the real model under the lock):
- sp1 SGPC/medium reader: row 315 (end of Chaupai 401) straight to the Savaiya 451/452 (137 rows skipped).
- sp2 Taksal reader without the stanza-375 insert: fateh + Patshahi 10 (212-213) straight to "ਕਬਿਯੋ ਬਾਚ ਬੇਨਤੀ" (214).
Replay (`splice-bench.js`, base -> final):
| clip | crossing | first real line shown after its truth start | screen past the gap (after the cut) | voiced % | within-1 | wrong lines |
|---|---|---|---|---|---|---|
| sp1 SGPC/medium: 315 -> 451/452 -> 453 (138 rows) | header "ਸ੍ਵੈਯਾ" then "ਪਾਇ ਗਹੇ ਜਬ ਤੇ" | 453: 0.39 -> 0.39 s (452 shown 73.75 -> 72.25, 1.5 s sooner) | 6.15 -> 4.65 s | 83.7 -> 83.7 | 97.3 -> 97.3 | none -> none |
| sp2 Taksal, no stanza insert: 213 -> 214 (40 rows past the local duplicates) | "ਕਬਿਯੋ ਬਾਚ ਬੇਨਤੀ" | 214: NEVER (base lands on 216 at +3.15 s) -> 0.40 s | 3.45 -> -0.55 s | 79.4 -> 83.1 | 89.9 -> 93.9 | base 216/217/218 while 214-215 read -> none |
Both shorter readers are followed through the omitted sections, with no wrong line; sp2 is the case the
rule was made for (a header stretch the local window also contains).

## Ideas 1 and 2 from the brief (not implemented, and why)
- Idea 1 (section-start candidate set with a lower letter requirement): the traces show the whole-Bani
  match already lands on the right row at the first window that holds 4 letters of the new line (1177.75,
  1222.75, 662.25); the binding constraints were the margin demanded against a local match that had
  already failed, the 4-window dwell, and the other-Gurbani margin. A smaller candidate set changes none
  of these, and the one window before that (1177.5) pointed at a wrong row even with 10 letters heard.
- Idea 2 (shorter alignment window while lost): at those windows the 4 s window already held only the
  new line's letters (the reader's pause before the new section had cleared it); nothing to shorten.
- Idea 3 (headers read or skipped): covered by `lost` including "position on a header row" and by the
  header's local duplicate being harmless (same text on screen) until the real line decides.

## Notes / follow-ups
- Rehras aheadV 1.47 -> 1.81 is the 653 s duplicate (screen on 213 "Patshahi 10" while the truth files
  the spoken headers under row 204's start), not a new ahead case.
- `lost` also fires on "current line is a header" when the local match is healthy on a real line (the
  reader just continuing past a Dohra); no harm seen (the nearest-ahead tie-break keeps duplicate
  pangtis such as 389-390 / 406-407 local). A tighter form would keep dwell 2 whenever lost but drop the
  local margin only when the local match fails or ends in a header.
- Resume command for the splice check: `cd $S/reacq && node splice-bench.js sp1_sgpc_315to452 base cand`
  (caches in `$S/reacq/splice/cache`, made with precompute.js under the lock, BENCH_THREADS=3).
