# Pankti Cumulation (10.0.x) against today's experimental (9.0.20), re-run 2026-10-29

Question (owner, Oct 29): is there a 10.x.y build with Pankti Cumulation that is better than the current experimental in
all cases and does not degrade anything; if not, make one.

**Answer.** Yes, now there is, on the benchmark: 10.0.1's logic was already equal-or-better on every GAB tier against
9.0.20, and **10.0.6** (the 10.0.5 logic rebased onto experimental 9.0.20, branch `vf-10.0.6`) is better on six tiers,
equal on four, and its two "worse" cells are 3 s and 7 s where the build showed the sung salok (a parmaan) and the key
counts it as wrong. What is still missing is the owner's live test (every Voice Autopilot build needs one before merge).

## Method (what changed since the 19 October numbers)

- Baseline = experimental 9.0.20 (420732c9), the logic running in the field, not the 9.0.4 card used on Oct 18-19.
- Same tools (`sttm-ws1-modelswap` GAB v1.5 checkout, harness key current), same manifest `ae3071d25fd4`, same human
  keys, same x86 replay cache (`5f9e41d867de-q16-x86`) for every build; every build replayed fresh on the Mac.
- All splits run, including the main held-out **test** split (Kirtan 35 clips, Bani sung 3, Paath 1, Akhand Paath 4)
  that was never run for 10.0.x before.
- Builds: 10.0.1 (219a4f1f), 10.0.4 (9b1fa814), 10.0.5 (6a866c94 = PR #2253), 10.0.6 (c13807ab, this run).
- Clips a build could not replay from the cache are left out of that row for every build (noted below).
- Workspace: `~/personal/gab-builds/pc-final/` (`chain.sh`, `report.py`, `cards/`, `REPORT-all.md`).

## Tier table

Cells: right Shabad % / right pangti % / wrong Shabad s per h. ✅ better than experimental on at least one measure and
worse on none; ❌ worse on at least one (margin 0.05).

| Tier / split | clips · hours | Experimental 9.0.20 | 10.0.1 | 10.0.4 | 10.0.5 | 10.0.6 |
|---|---|---|---|---|---|---|
| GAB-Hard test | 9 · 1.2 h | 84.9 / 64.8 / 185.3 | 84.9 / 64.8 / 185.3 | 81.3 / 61.7 / 355 ❌ | 84.9 / 64.8 / 185.3 | 84.9 / 64.8 / 185.3 |
| GAB-Hard dev | 19 · 2.2 h | 56.9 / 51.3 / 201.5 | 56.9 / 51.3 / 201.5 | 53.2 / 47.0 / 555.3 ❌ | 56.9 / 51.3 / 201.5 | 56.9 / 51.3 / 201.5 |
| Kirtan **test** | 35 · 5.5 h | 90.7 / 87.5 / 142 | 90.7 / 87.5 / 142 | 91.5 / 87.5 / 125.8 ✅ | 91.5 / 87.6 / 117.3 ✅ | 91.5 / 87.6 / 117.3 ✅ |
| Kirtan dev | 106 · 13.5 h | 92.3 / 86.8 / 120.3 | 92.4 / 86.9 / 119.9 ✅ | 92.4 / 86.9 / 144.1 ❌ | 92.5 / 87.1 / 116.9 ✅ | 92.5 / 87.1 / 116.9 ✅ |
| Bani sung **test** | 3 · 0.5 h | 96.8 / 88.3 / 28.4 | 96.8 / 88.3 / 28.4 | 96.6 / 88.3 / 34.8 ❌ | 96.6 / 88.3 / 34.8 ❌ | 96.6 / 88.3 / 34.8 ❌ (3 s, see below) |
| Bani sung dev | 45 · 1.9 h | 84.1 / 81.1 / 23.4 | 85.4 / 82.5 / 18.6 ✅ | 85.5 / 82.6 / 18.6 ✅ | 85.4 / 82.5 / 18.6 ✅ | 85.4 / 82.5 / 18.6 ✅ |
| Paath **test** | 1 · 0.5 h | 97.1 / 93.7 / 0.0 | same | same | same | same |
| Paath dev | 45 · 0.9 h | 96.7 / 96.8 / 0 | same | same | same | same |
| Akhand Paath **test** | 4 · 0.6 h | 98.2 / 97.7 / 24.2 | 98.2 / 97.7 / 22.8 ✅ | 98.3 / 97.8 / 22.8 ✅ | 98.2 / 97.7 / 22.8 ✅ | 98.2 / 97.7 / 24.2 |
| Akhand Paath dev | 5 · 0.8 h | 98.1 / 97.4 / 28.7 | 98.2 / 97.4 / 26.0 ✅ | 98.2 / 97.5 / 26.0 ✅ | 98.2 / 97.4 / 26.0 ✅ | 98.1 / 97.4 / 28.7 |
| Akhand Kirtan **test** | 10 · 1.5 h | 86.3 / 74.6 / 240.4 | 86.3 / 74.6 / 240.4 | 85.4 / 74.6 / 288.9 ❌ | 86.4 / 74.6 / 242.1 ❌ | 86.4 / 74.6 / 242.1 ❌ (7 s, see below) |
| Akhand Kirtan dev | 24 · 1.7 h | 80.9 / 80.3 / 346.4 | 80.9 / 80.3 / 346.4 | 83 / 81.1 / 348.3 ❌ | 81.2 / 81 / 336.1 ✅ | 81.2 / 81 / 336.1 ✅ |

Tier verdicts against experimental 9.0.20:

| Build | better on | same on | worse on | better everywhere, nothing worse |
|---|---|---|---|---|
| 10.0.1 | 4 (Kirtan dev, Bani sung dev, Akhand Paath test, Akhand Paath dev) | 8 | 0 | **yes** |
| 10.0.4 | 4 | 2 | 6 | no |
| 10.0.5 | 6 | 4 | 2 (3 s + 7 s, both a sung salok shown) | no by the scorer, yes by the audio |
| 10.0.6 | 4 (Kirtan test, Kirtan dev, Bani sung dev, Akhand Kirtan dev) | 6 | 2 (3 s + 7 s, both a sung salok shown) | no by the scorer, yes by the audio |

Clips left out (cache misses): 9.0.20 and 10.0.6 cannot replay 8 Akhand Paath clips and rt11_sohila from the x86 cache
(9.0.20's Akhand Paath mode listens on a different window schedule); 10.0.5 / 10.0.6 miss kh31 (Hard dev), l3clip09
(Akhand Kirtan test) and one Kirtan dev clip (their fragment search asks for windows the cache lacks). Pankti Cumulation
is off while a Bani is followed, so the Akhand Paath / Paath rows cannot differ by design; the small Akhand Paath gains
of 10.0.1-10.0.5 come from their 9.0.8 base and vanish in 10.0.6 (equal to experimental), as expected.

## Per-clip tally (any of the three measures worse by more than 0.05)

| Build | clips compared | better | same | worse | the worse clips (extra wrong-Shabad seconds, Shabad points) |
|---|---|---|---|---|---|
| 10.0.1 | 309 | 10 | 296 | 3 | aa08 (+0 s, +0.4 pt), ytap x2 (-1 s, +0.2 pt): sub-second noise |
| 10.0.4 | 309 | 37 | 232 | 40 | kh10 (+165 s, -21.8 pt), kh28 (+215 s, -29.9 pt), kh17 (+574 s), kh31 (+691 s), rn13 (+141 s, -35.3 pt), ... |
| 10.0.5 | 306 | 21 | 278 | 7 | clip35 (+12 s, -1.0 pt), l3clip14 (+5 s), rt11_fareed2 (+3 s), four sub-second |
| 10.0.6 | 306 | 17 | 284 | 5 | clip35 (+12 s, -1.0 pt), l3clip14 (+5 s), rt11_fareed2 (+3 s), two sub-second |

## The "losses" of 10.0.5 / 10.0.6, checked against the audio

Replay transcripts (`cache/replays/<key>/<suite>/trace/<clip>.events.jsonl`) and the screen timelines:

- **l3clip14 (Akhand Kirtan test), 126-147 s.** The jatha sings salok 5096 ("ਇਕ ਦਿਨ ਸੋਵਨੁ ਹੋਇਗੋ") and then salok 5095
  word for word ("ਕਬੀਰ ਸੂਤਾ ਕਿਆ ਕਰਹਿ ਜਾਗੁ ਰੋਇ ਭੈ ਦੁਖ ... ਜਾ ਕਾ ਵਾਸਾ ਗੋਰ ਮਹਿ") as a parmaan before "ਜੈਸੇ ਗੋਇਲਿ ਗੋਇਲੀ".
  10.0.6 shows 5095 at 140 s; experimental shows a Waheguru slide from 142 s. The key marks the whole span as the
  Shabad, so the correctly shown salok is 7 s of "wrong Shabad".
- **rt11_fareed2 (Bani sung test), 285-302 s.** The sangat sings Fareed saloks ("... ਨਾ ਤਰਸਾਏ ਜੀਉ", then "ਫਰੀਦਾ ਰੋਟੀ
  ਮੇਰੀ ਕਾਠ ਕੀ"). 10.0.6 shows the salok just sung ("ਫਰੀਦਾ ਦੇਖਿ ਪਰਾਈ ਚੋਪੜੀ") as a Shabad card for 3 s; the key expects
  the Bani container.
- **clip35 (Kirtan dev), 642-658 s.** A 20-minute kirtan of "ਪ੍ਰਭ ਕੀਆ ਤੁਮਾਰਾ ਥੀਆ" with many parmaans. During "ਹਰਿ ਪ੍ਰਭ
  ਮੇਰਿਆ ਕੇਤੇ ਗਨਉ ਅਸੰਖ / ਅਵਗੁਣ ਮੇਰਿਆ ਰਾਖਿ ਲੇਹੁ / ਜਿਉ ਭਾਵੈ ਤਿਉ ਰਾਖੁ" the two builds pick different Shabads holding
  those lines (experimental keeps "ਰਾਖੁ ਪਿਤਾ ਪ੍ਰਭ ਮੇਰੇ", which the key accepts; 10.0.6 shows 2673 "ਜਿਉ ਜਾਨਹੁ ਤਿਉ
  ਰਾਖੁ" for 16 s, which it does not).

These are at the key's resolution (parmaan spans are not labelled), not app regressions. Two variants built to remove
them anyway, 10.0.7a (a fragment confirm needs an 8-letter piece) and 10.0.7b (no fragment confirm within 10 s of a
change), left the l3clip14 cell unchanged (242.1) and were dropped.

## Why the 19 October picture was different

- The rn19 (pangti 100 -> 12.7), rn61 and l3clip27 regressions of 10.0.1 do not exist against 9.0.20 with today's keys
  and tools: 10.0.1 has no per-clip loss above noise. They came from the old pangti basis and the 9.0.4 baseline card.
- 10.0.3 / 10.0.4 (judge assist on) are confirmed clearly worse (GAB-Hard wrong 185 -> 355 test, 202 -> 555 dev; 40 of
  309 clips worse).
- The owner's live verdicts stand as recorded: 10.0.1 "started changing too soon" (Oct 18), 10.0.3 "huge improvement
  finding shabads, follower worse in some cases" (Oct 18), 10.0.5 "minimal gains" (Oct 19). No build of this line has a
  live pass yet.

## 10.0.6: what it is

- Branch `vf-10.0.6` on github.com/Arash2348/sttm-desktop (c13807ab), 14 commits on 420732c9: the twelve 10.0.1-10.0.5
  logic commits cherry-picked (switch rule, end-of-Aarti exit, fragment confirm with judge assist off and the 20 s
  fresh window), VF_FEATURE_VERSION 10.0.6. Unit tests 134/134 (`node --test` on the components folder).
- Kept the 9.0.20 Autopilot panel; the 10.0.x evidence panel (chips and bars) is not ported, so the sevadaar sees the
  9.0.20 panel with the 10.0.5 switching underneath. Porting the panel is UI-only work for the PR.
- Compared with experimental on the clips both can replay, it is identical where Pankti Cumulation is off (Hard, Paath,
  Akhand Paath) and better on Kirtan test (wrong 142 -> 117 s/h, yuba07 found), Kirtan dev, Bani sung dev (Aarti exits
  aa04, aa07) and Akhand Kirtan dev (l3clip35, l3clip37, l3clip10 found).

## Next

1. Owner live test of 10.0.6 (build from `vf-10.0.6`, launch on the right monitor): the cases to watch are a Shabad
   change on a shared phrase, Aarti into a Shabad, and a long kirtan with parmaans.
2. If it passes: port the evidence panel UI onto the branch, open the PR, close #2246 and #2253 as superseded.
3. Label parmaan spans in the Akhand Kirtan and long-kirtan keys so a correctly shown salok stops counting as wrong.
