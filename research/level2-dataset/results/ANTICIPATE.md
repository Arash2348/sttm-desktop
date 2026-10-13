# Paath follower anticipation (branch vf-paath-anticipate, base 7165bd24)

Goal: on Renton Rehras, correct line on screen >= 95% of VOICED time, premature flips <= 1%, no held-out set worse.

## Method
- Fast loop: `research/follower-bench/anticipate-bench.js <set> [base|cand]` = cached-window replay. Each 4 s window's
  transcript comes from `cache/*.hyps.json` (made earlier by precompute.js); the acoustic model is NOT loaded
  (CachedInfer returns the cached string; ~30 s for the whole 1716 s Rehras on one core). `base` = follower2.js at
  7165bd24 (copy), `cand` = this worktree with `OPTS` JSON.
- Rehras: the app's own 527 extra-long rows (dumped from the headless app) and app-id truth
  (`research/follower-bench/anticipate/`, copies of rt11_rehrasX.app.truth.json + line list); 0.25 s step;
  app move gate confidence >= 0.4. Only `confident` truth rows scored.
- Metrics: voiced = share of time inside [start_i, end_i) of confident lines the screen shows line i.
  exact / within1 = renton-score definition (pause after line i counts as line i, so a flip inside the pause
  LOWERS exact by construction; voiced is the target metric). Flips to i+1 while on i: PREMATURE (inside
  [start_i, end_i)), GOOD (inside the pause [end_i, start_i+1)), LAG (after start_i+1). premature% = of all
  next-line flips. aheadV = voiced time showing a later line. Lag per line (negative = shown in the pause).
- Truth caveat: `end` = last CTC token frame + 40 ms, so it is biased EARLY against the acoustic end;
  a "GOOD" flip within 0.2 s of end_i (goodNearEnd) may still be inside the final vowel.

## Log
Step 1. Harness check: base replay of 7165bd24 on Rehras gives exact 84.2 / within-1 95.9 = scorer3's 84.2 / 95.8 (same
replay, same definitions). OK.

Step 2. Base (7165bd24), Rehras, replay:
| variant | voiced | aheadV | exact | within1 | flips | premature | good | lag | prem % | lag med / p90 | back (followed/all) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| base 7165bd24 | 79.6 | 1.69 | 84.2 | 95.9 | 373 | 3 | 0 | 370 | 0.8 | 0.38 / 0.89 | 7/8 |

Pauses between consecutive confident lines (344 pairs): median 0.80 s; 43 < 0.2 s, 117 (34%) < 0.3 s, 162 < 0.5 s.

Step 3. Knob 1: anticipate once the line is heard to its last letter (antFrac 1) and the position stays there antDelay
more windows (no new letters = a pause). Rehras slice 300-420 s first (base voiced 89.3), then full Rehras:
| knob | slice voiced / prem | Rehras voiced | aheadV | exact | prem / flips | prem % | good | lag | lag med |
|---|---|---|---|---|---|---|---|---|---|
| antDelay 0 (= a4d15a8f rule) | 97.9 / 5 | 89.2 | 3.18 | 69.9 | 111/350 | 31.7 | 151 | 88 | -0.35 |
| antDelay 1 | 98.2 / 1 | 89.5 | 1.91 | 73.9 | 12/353 | 3.4 | 189 | 152 | -0.09 |
| antDelay 2 | 97.5 / 1 | 87.6 | 1.80 | 75.6 | 5/357 | 1.4 | 148 | 204 | 0.14 |
| antDelay 3 | - | 86.7 | 1.69 | 77.7 | 3/358 | 0.8 | 137 | 218 | 0.19 |
antDelay 0 = the rejected attempt: 111 of its flips land inside the line still voiced (median 0.08 s before end).

Step 4. Knob 2: antSlack (the last 1-2 letters, often dropped by recognition, may be missing; position must not move back):
| knob | Rehras voiced | prem % | lag med |
|---|---|---|---|
| delay 2, slack 1 | 89.4 | 2.5 (9) | -0.03 |
| delay 2, slack 2 | 90.6 | 5.4 (19) | -0.17 |
| delay 3, slack 2 | 88.6 | 2.2 (8) | 0.07 |

Step 5. Knob 3 (on delay 2 slack 1): antEnter (first letters of the next line after an at-end window flip at once):
voiced 89.8, prem 2.8%. antStall 3 / 2 (position still for 3 / 2 windows past 80% of the line): 90.1 / 3.4%, 89.7 / 4.0%.
Marginal.

Where the remaining voiced time goes (delay 2 slack 1 vs base, % of voiced time):
| | ok | behind 1 (line start) | behind 1 (later) | behind 2+ | ahead 1 | ahead 2+ | nothing shown |
|---|---|---|---|---|---|---|---|
| base | 79.2 | 15.1 | 0.5 | 1.6 | 0.8 | 0.9 | 2.05 |
| cand | 89.2 | 5.2 | 0.5 | 1.3 | 0.6 | 1.3 | 2.05 |
"Nothing shown" = 17.6-41.0 s, the replay's cold first lock (in the app the search opens the Bani); identical in all variants.
2+ = reader skips / header jumps (-46, -30, +130 lines), identical in base and cand: tracker, not anticipation.
So even a PERFECT anticipation on the 7165bd24 tracker would give ~94.2% voiced (96.2% after the first lock).
Remaining LAG flips by pause before the line: < 0.25 s: 82 flips, 22.6 s lost; 0.25-0.5 s: 52, 8.4 s; >= 0.5 s: 25, 18.9 s.

Step 6. Upper bound check: listening every 0.125 s (2x model cost) with the same rule: voiced 91-92%, premature 2.9-18%.
The listening step is not what blocks 95%.

Step 7. Decisive diagnostic (Rehras, tracker unchanged): first window whose position is at line i's last letter
(t_end_seen) vs truth. t_end_seen - end_i: q10/25/50/75/90 = -0.14 / -0.05 / +0.03 / +0.10 / +0.17 s
(slack 1 letter: -0.35 / -0.20 / -0.10 / -0.01 / +0.06). start_i+1 - t_end_seen: median 0.93 s, q25 0.25 s, q10 0.12 s.
=> "Heard to its last letter" happens AT the truth end (both are the same model's last-token spike), so it cannot
tell a held final vowel from a pause: flipping then is premature about half the time by the truth's own definition
(antDelay 0 above: 111 premature, median 0.08 s before end). A safe flip needs 0.5-0.75 s more evidence, which a
third of boundaries (pause < 0.3 s) do not have.

Step 8. Knob 4: audio pause (the follower already has the PCM; the replay now feeds the real clip audio,
PCM=1, still no model). antQuiet r: the last antQuietS (0.15 s) RMS < r x the window's 90th-percentile 20 ms RMS.
Quiet + at the line end flips at once; antQuietHops 2: quiet for 2 windows with the position past 80% of the line.
| knob (all antSlack 1) | Rehras voiced | aheadV | exact | prem / flips | prem % | good | lag | lag med / p90 |
|---|---|---|---|---|---|---|---|---|
| delay 3 | 87.7 | 1.73 | 76.1 | 4/356 | 1.1 | 151 | 201 | 0.15 / 0.57 |
| delay 3, quiet 0.2 | 88.2 | 1.82 | 74.2 | 4/353 | 1.1 | 159 | 190 | 0.12 / 0.55 |
| delay 3, quiet 0.3 | 88.4 | 1.93 | 73.9 | 9/353 | 2.5 | 159 | 185 | 0.09 / 0.54 |
| delay 3, quiet 0.2, quietHops 2 | 88.9 | 2.00 | 74.0 | 4/353 | 1.1 | 168 | 181 | 0.07 / 0.49 |
| delay 3, quiet 0.25, quietHops 2 | 89.0 | 2.10 | 73.9 | 8/353 | 2.3 | 167 | 178 | 0.04 |
| delay 2, quiet 0.2, quietHops 2 | 90.4 | 2.09 | 73.7 | 9/351 | 2.6 | 185 | 157 | -0.11 |
| delay 4, quiet 0.2, quietHops 2 | 88.6 | 1.98 | 74.4 | 3/353 | 0.8 | 165 | 185 | 0.09 |
Frontier: each +1 point of voiced costs ~+1 point of premature. Chosen for held-out: delay 4, slack 1, quiet 0.2,
quietHops 2 (the only setting with premature <= 1%).
Remaining loss (delay 3 quiet run): behind 1 at line start 5.6% (LAG flips: pause < 0.25 s 87 flips 27.6 s;
0.25-0.5 s 67 flips 17.9 s; >= 0.5 s 15 flips 7.9 s), cold first lock 2.05%, tracker 2+ lines off 2.6%, ahead 0.7%.
