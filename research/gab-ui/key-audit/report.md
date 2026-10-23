# GAB answer-key audit: do the keys match what is actually sung?

*2026-10-22. All 197 public recordings in the GAB viewer (Kirtan 108, Karanbir v1 4, Akhand Kirtan 24, Sung Bani 12, Paath 45, Sehaj / Akhand Paath 4; the 8 Karanbir cold-start crops are copies of his 4 recordings and are left out). 15.1 hours carry an answer key on the page.*

## Headline

**The answer keys are not wrong or shifted in any systematic way.** The speech model's own hearing, matched against all of Gurbani with no Voice Autopilot logic, agrees with the key on 171 of 197 recordings (87%). The other 26 have local problems that touch **about 12 minutes of 15.1 keyed hours (1.3%)**:

| What the hearing shows | Recordings | Keyed time affected |
|---|---|---|
| Key runs on 13-47 s after the kirtani has moved to the next Shabad (Shabad end too late) | 6 | 3 min |
| A parmaan or other Shabad sung for 16-30 s that the key does not mark | 3 | 2 min |
| Vaheguru simran inside a keyed Shabad | 6 | 4 min |
| Last 31-41 s of the key has no Gurbani at all (Ardas, talk, silence, music) | 5 | 3 min |
| Hearing too weak to confirm or contradict the key (hall audio, katha) | 6 | none shown wrong |
| Wrong Shabad for a long stretch (60 s or more) | **0** | 0 |
| Pangti keys shifted in time (where the page shows pangtis) | **0** | 0 |

**No timing offset.** Where the page shows pangti keys (Paath, Sung Bani, Sehaj Paath, Karanbir v1), the hearing lines up best with the keys at a shift of 0.0 s (Paath, Sung Bani), -0.5 s (Sehaj Paath) and -1.5 s (Karanbir v1, human keys with long pangti spans). Paath, Sung Bani and Sehaj Paath are within 2 s on every recording. There is no 30 s lead-in offset and no clip-start mix-up. The published timeline also matches the HF key files second by second on every pangti-keyed recording.

**So why does the page often look wrong while a recording plays?** Because **88% of the keyed time on the page (13.4 of 15.1 h: all 107 Kirtan Gurdwara Sahib broadcasts and 22 of 24 Akhand Kirtan recordings) has a Shabad-level key only.** For those the "sung" readout can only show the Shabad's first pangti. The kirtani is almost never singing that pangti: they sing the rahao, repeat pangtis, go back to the rahao, do Vaheguru simran and take short parmaans. The key is right about the Shabad but cannot say which pangti is being sung. That is the mismatch the owner sees, not wrong keys. The 1.3% of real problems above add to it, mostly at Shabad endings.

**One HF data issue:** `shabads.csv` for clip12 and clip17 on Hugging Face still covers the whole clip (1,140 s and 970 s). The listening corrections from clip-notes (`end_override_s`) are applied by the scorers and the viewer (291 s and 442 s) but were never written into the HF files. The hearing confirms the corrections. In clip17, "ਧੰਨੁ ਧੰਨੁ ਰਾਮਦਾਸ ਗੁਰੁ" starts at about 7:21, then a Vaar pauri ("ਸਭੁ ਕਿਛੁ ਤੇਰੈ ਵਸਿ ਤੇਰਾ ਘਰੁ ਭਲਾ") and a salok follow until the end. In clip12, Shabad 3535 ("ਜਿਸ ਦਾ ਕਰਤਾ ਮਿਤ੍ਰੁ ਸਭਿ ਕਾਜ ਸਵਾਰਿਆ") starts at about 12:25. Anyone who reads the HF files directly gets 528 s and 849 s of wrong key.

## How it was checked

1. **Hearing, not app decisions.** I decoded the cached speech-model output (Karanbir's IndicConformer int8, the app's own model; x86 replay cache, the same windows the benchmark replays) for every recording. Cached windows were found by hashing the clip audio exactly as the replay does: 4 s windows tiled end to end, 96% of windows found overall. Greedy CTC gives a timed stream of what the model heard.
2. **Which Shabad it sounds like.** Every 10 s window, sliding 2 s at a time, is matched against all 142,576 pangtis in the STTM corpus. A character-trigram search over every Shabad finds candidates, then each candidate is scored by fuzzy partial matching of each 5 s half against the Shabad's text. Each window has a best Shabad overall, a best Shabad other than the key, and a score for the keyed Shabad. Copies of the same Gurbani score the same, so they are never flagged.
3. **Flags.**
   - **(a) Other Shabad:** for at least 20 s, 60% of windows hear the same other Shabad at least 10 points above the key (score at least 70). These are split into: next Shabad started before the key ended, parmaan length (under 60 s) and wrong Shabad (60 s or more).
   - **(b) Timing:** keyed pangtis are scored against the hearing at shifts from -30 to +30 s. A flag needs a peak at least 3 s from zero that gains at least 5 points, from 4 or more pangtis.
   - **(c) No Gurbani:** the first or last 30 s or more of a keyed Shabad has no Gurbani heard where the cache has audio. Vaheguru simran is flagged separately.
4. **Calibrated so it does not flag noise.** It gave no flags on the trusted sets: Karanbir's human-keyed v1 (0/4), Paath (0/45), Sung Bani (0/12) and Sehaj Paath (0/4). **It also catches real errors.** Giving each recording a deliberately wrong key (another recording's Shabad) was caught on 95/108 Kirtan (85/87 where the hearing backs the true key at least half the time), 14/24 Akhand Kirtan and 4/4 Karanbir v1. Akhand Kirtan hearing is weak, so a clean result there is weaker evidence.
5. **What the page shows.** Verdicts use the published timeline's keyed seconds, with listening corrections applied. A window counts as keyed only where the page shows a key.

Limits: window onsets are accurate to about 10 s, so end-late shifts under 20 s (rn51, rn66) are borderline. Katha is not detected directly. rn79 and rn13/rn16 sound like katha or "ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ" in places and are listed as weak evidence. Kirtan and Akhand Kirtan line keys in the HF files (two-model aligned, not shown on the page) also line up: median shift -0.5 s, 84% within 2 s. Seven of them peak 3-13 s off (clip14, clip39, rn02, rn19, l3clip03, l3clip15, l3clip29) and are recorded in audit.json under `hidden_line_key_timing`.

## The 10 worst (page-visible), with the exact pangti heard

Times are clip time. The link opens the YouTube video at that moment.

| # | Recording | What the hearing shows | Heard pangti (best match in Gurbani) | Key on the page says |
|---|---|---|---|---|
| 1 | rn55 (Kirtan), [1:49](https://youtu.be/iattXPs7Chg?t=7049) | key runs 47 s past the Shabad's end: from 1:49 the hearing is another Shabad until the key ends at 2:36 | ਅੰਮ੍ਰਿਤ ਬਾਣੀ ਹਰਿ ਹਰਿ ਤੇਰੀ ॥ | ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ |
| 2 | clip21 (Kirtan), [4:49](https://youtu.be/eYgMiglXTpk?t=542) | other Shabad heard 4:49-5:15 (26 s, parmaan length), not keyed | ਕਿਤੈ ਪ੍ਰਕਾਰਿ ਨ ਤੂਟਉ ਪ੍ਰੀਤਿ ॥ ਦਾਸ ਤੇਰੇ ਕੀ ਨਿਰਮਲ ਰੀਤਿ ॥੧॥ ਰਹਾਉ ॥ | ਪ੍ਰਭ ਮਿਲਬੇ ਕਉ ਪ੍ਰੀਤਿ ਮਨਿ ਲਾਗੀ ॥ / ਮੂ ਲਾਲਨ ਸਿਉ ਪ੍ਰੀਤਿ ਬਨੀ ॥ ਰਹਾਉ ॥ |
| 3 | l3clip16 (Akhand Kirtan), [2:05](https://youtu.be/V9r_8qByAXs?t=305) | other Shabad heard 2:05-2:35 (30 s, parmaan length), not keyed | ਜੋ ਸਿਰੁ ਸਾਈ ਨਾ ਨਿਵੈ ਸੋ ਸਿਰੁ ਕੀਜੈ ਕਾਂਇ ॥ | ਉਠੁ ਫਰੀਦਾ ਉਜੂ ਸਾਜਿ ਸੁਬਹ ਨਿਵਾਜ ਗੁਜਾਰਿ ॥ |
| 4 | rn69 (Kirtan), [1:55](https://youtu.be/l0EIMAuC0_U?t=1015) | key runs 40 s past the Shabad's end: from 1:55 the hearing is another Shabad until the key ends at 2:35 | ਗੁਰ ਪੂਰੇ ਕੀ ਸਰਣੀ ਉਬਰੇ ਕਾਰਜ ਸਗਲ ਸਵਾਰੇ ॥੧॥ | ਚੱਤ੍ਰ ਚੱਕ੍ਰ ਵਰਤੀ ਚੱਤ੍ਰ ਚੱਕ੍ਰ ਭੁਗਤੇ ॥ |
| 5 | clip04 (Kirtan), [1:10](https://youtu.be/IT9dBWP9hiw?t=4218) | Vaheguru simran 1:10-1:36 inside the keyed Shabad (+2 more like it) | ਵਾਹਿਗੁਰੂ (simran) | (the keyed Shabad) |
| 6 | l3clip02 (Akhand Kirtan), [5:05](https://youtu.be/WuciQokua6w?t=880) | key runs 35 s past the Shabad's end: from 5:05 the hearing is another Shabad until the key ends at 5:40 | ਗਾਈਐ ਰਾਤਿ ਦਿਨੰਤੁ ਗਾਵਣ ਜੋਗਿਆ ॥ | ਹਉ ਅਨਦਿਨੁ ਹਰਿ ਨਾਮੁ ਕੀਰਤਨੁ ਕਰਉ ॥ |
| 7 | rn18 (Kirtan), [4:15](https://youtu.be/EyKDbSzESi0?t=9650) | other Shabad heard 4:15-4:31 (16 s, parmaan length), not keyed | ਮੈ ਆਪਣਾ ਗੁਰੁ ਪੂਛਿ ਦੇਖਿਆ ਅਵਰੁ ਨਾਹੀ ਥਾਉ ॥੧॥ ਰਹਾਉ ॥ | ਸਾਚੀ ਲਿਵੈ ਬਿਨੁ ਦੇਹ ਨਿਮਾਣੀ ॥ |
| 8 | clip17 (Kirtan), [7:21](https://youtu.be/eYgMiglXTpk?t=6079) | key runs 31 s past the Shabad's end: from 7:21 the hearing is another Shabad until the key ends at 7:52 | ਧੰਨੁ ਧੰਨੁ ਰਾਮਦਾਸ ਗੁਰੁ ਜਿਨਿ ਸਿਰਿਆ ਤਿਨੈ ਸਵਾਰਿਆ ॥ | ਤਾਤੀ ਵਾਉ ਨ ਲਗਈ ਪਾਰਬ੍ਰਹਮ ਸਰਣਾਈ ॥ |
| 9 | rn72 (Kirtan), [16:39](https://youtu.be/l0EIMAuC0_U?t=3354) | Vaheguru simran 16:32-17:16 inside the keyed Shabad | ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ ਵਾਹਿ ਜੀਉ ॥ | ਜੋ ਦੀਸੈ ਗੁਰਸਿਖੜਾ ਤਿਸੁ ਨਿਵਿ ਨਿਵਿ ਲਾਗਉ ਪਾਇ ਜੀਉ ॥ / ਫੂਟੋ ਆਂਡਾ ਭਰਮ ਕਾ ਮਨਹਿ ਭਇਓ ਪਰਗਾਸੁ ॥ |
| 10 | clip23 (Kirtan), [6:52](https://youtu.be/eYgMiglXTpk?t=4626) | last 41 s of the key (6:52-7:33): no Gurbani heard (Ardas, talk, silence or music) | (no Gurbani heard) | ਵਾਹੁ ਵਾਹੁ ਬਾਣੀ ਨਿਰੰਕਾਰ ਹੈ ਤਿਸੁ ਜੇਵਡੁ ਅਵਰੁ ਨ ਕੋਇ ॥ |


Note on clip21: the clip-notes say the kirtani quoted "ਮੋਹਿ ਲਾਲਨ ਸਿਉ ਪ੍ਰੀਤਿ" (3120) at about 7:59 and that this was deliberately scored as a detour. The hearing places a different parmaan, the rahao of Shabad 2613, at 4:49-5:15.

## Every recording that is not "ok"

| Recording | Category | Verdict | Finding(s), clip time | Hearing backs key |
|---|---|---|---|---|
| clip04 | Kirtan | key covers simran | Vaheguru simran 1:10-1:36 inside the keyed Shabad; Vaheguru simran 4:04-4:24 inside the keyed Shabad; Vaheguru simran 5:46-6:10 inside the keyed Shabad | 77% |
| clip17 | Kirtan | Shabad start/end off (other Shabad heard) | key runs 31 s past the Shabad's end: from 7:21 the hearing is another Shabad until the key ends at 7:52 | 70% |
| clip21 | Kirtan | unkeyed parmaan (20-60 s) | other Shabad heard 4:49-5:15 (26 s, parmaan length), not keyed | 69% |
| clip22 | Kirtan | key covers lead-in / tail with no Gurbani | last 33 s of the key (5:12-5:45): no Gurbani heard (Ardas, talk, silence or music) | 85% |
| clip23 | Kirtan | key covers lead-in / tail with no Gurbani | last 41 s of the key (6:52-7:33): no Gurbani heard (Ardas, talk, silence or music) | 87% |
| l3clip02 | Akhand Kirtan | Shabad start/end off (other Shabad heard) | key runs 35 s past the Shabad's end: from 5:05 the hearing is another Shabad until the key ends at 5:40 | 53% |
| l3clip16 | Akhand Kirtan | unkeyed parmaan (20-60 s) | other Shabad heard 2:05-2:35 (30 s, parmaan length), not keyed | 28% |
| l3clip38 | Akhand Kirtan | weak evidence | no other Shabad heard, but the hearing is too weak to confirm the key | 20% |
| l3clip39 | Akhand Kirtan | weak evidence | no other Shabad heard, but the hearing is too weak to confirm the key | 9% |
| rn09 | Kirtan | weak evidence | no other Shabad heard, but the hearing is too weak to confirm the key | 9% |
| rn12 | Kirtan | key covers simran | Vaheguru simran 6:36-6:56 inside the keyed Shabad | 73% |
| rn13 | Kirtan | weak evidence | no other Shabad heard, but the hearing is too weak to confirm the key | 22% |
| rn16 | Kirtan | weak evidence | no other Shabad heard, but the hearing is too weak to confirm the key | 9% |
| rn18 | Kirtan | unkeyed parmaan (20-60 s) | other Shabad heard 4:15-4:31 (16 s, parmaan length), not keyed | 53% |
| rn32 | Kirtan | key covers simran | Vaheguru simran 2:04-2:38 inside the keyed Shabad | 28% |
| rn33 | Kirtan | key covers simran | Vaheguru simran 12:52-13:16 inside the keyed Shabad | 37% |
| rn51 | Kirtan | Shabad start/end off (other Shabad heard) | key runs 15 s past the Shabad's end: from 2:35 the hearing is another Shabad until the key ends at 2:50 | 42% |
| rn52 | Kirtan | key covers lead-in / tail with no Gurbani | last 36 s of the key (8:44-9:20): no Gurbani heard (Ardas, talk, silence or music) | 97% |
| rn55 | Kirtan | Shabad start/end off (other Shabad heard) | key runs 47 s past the Shabad's end: from 1:49 the hearing is another Shabad until the key ends at 2:36 | 35% |
| rn61 | Kirtan | key covers lead-in / tail with no Gurbani | last 31 s of the key (4:44-5:15): no Gurbani heard (Ardas, talk, silence or music) | 76% |
| rn66 | Kirtan | Shabad start/end off (other Shabad heard) | key runs 13 s past the Shabad's end: from 9:47 the hearing is another Shabad until the key ends at 10:00 | 74% |
| rn69 | Kirtan | Shabad start/end off (other Shabad heard) | key runs 40 s past the Shabad's end: from 1:55 the hearing is another Shabad until the key ends at 2:35 | 33% |
| rn72 | Kirtan | key covers simran | Vaheguru simran 16:32-17:16 inside the keyed Shabad | 63% |
| rn75 | Kirtan | key covers simran | Vaheguru simran 0:52-1:28 inside the keyed Shabad | 22% |
| rn78 | Kirtan | key covers lead-in / tail with no Gurbani | last 32 s of the key (10:28-11:00): no Gurbani heard (Ardas, talk, silence or music) | 38% |
| rn79 | Kirtan | weak evidence | no other Shabad heard, but the hearing is too weak to confirm the key | 6% |


## Next steps (ranked)

1. **Listen to the 10 recordings above** (about 10 minutes using the links). Confirm or reject each one: end too late, unkeyed parmaan, simran, or no Gurbani at the tail.
2. **Write the clip12 and clip17 end corrections into HF `shabads.csv`** (and its `lines.csv`), so the files match what the scorers and viewer already use.
3. **For confirmed items, trim the Shabad ends** (rn55, rn69, l3clip02, clip17, plus tails clip22, clip23, rn52, rn61, rn78). Decide one rule for simran and unkeyed parmaans: key them, or mark them as "either counts".
4. **To fix what the owner sees,** the viewer needs pangti keys for Kirtan, not better Shabad keys. Either show "Shabad: ..." without suggesting a pangti, or add pangti keys. The audited two-model line keys already exist in HF for most Kirtan clips, and this audit found them on time (median -0.5 s), apart from the 7 recordings listed above.

**TLDR:** The keys are sound. There is no timing offset, no wrong Shabad over a long stretch, and only 1.3% of keyed time has a local problem, mostly Shabad endings 13-47 s late. The mismatch the owner sees comes from 88% of the page using Shabad-level keys, whose "sung" text is always the first pangti.

## Files

- `audit.json`: summary, calibration, sensitivity, and per recording the verdict, findings (times, heard Shabad and pangti, heard text, scores) and timing scan.
- `tools/`: `make_clips.py` (inputs), `extract.py` (decode cached model output), `audit.py` (per-window corpus match and timing scan), `verdict.py` (flags), `sens.py` (wrong-key injection), `tlcheck.py` (timeline vs HF keys), `build_out.py` / `keydisp.py` (outputs). Run them from a scratch folder holding `hfkeys/` and `clips.json`. Intermediate files are not kept.

<details><summary>All 197 recordings</summary>

| Recording | Category | Verdict | Hearing backs key | Keyed on page (s) |
|---|---|---|---|---|
| l3clip01 | Akhand Kirtan | ok | 37% | 515 |
| l3clip02 | Akhand Kirtan | Shabad start/end off (other Shabad heard) | 53% | 340 |
| l3clip03 | Akhand Kirtan | ok | 37% | 375 |
| l3clip04 | Akhand Kirtan | ok | 45% | 220 |
| l3clip15 | Akhand Kirtan | ok | 71% | 195 |
| l3clip16 | Akhand Kirtan | unkeyed parmaan (20-60 s) | 28% | 175 |
| l3clip18 | Akhand Kirtan | ok | 88% | 95 |
| l3clip19 | Akhand Kirtan | ok | 73% | 355 |
| l3clip21 | Akhand Kirtan | ok | 56% | 100 |
| l3clip22 | Akhand Kirtan | ok | 56% | 80 |
| l3clip23 | Akhand Kirtan | ok | 48% | 65 |
| l3clip24 | Akhand Kirtan | ok | 67% | 25 |
| l3clip26 | Akhand Kirtan | ok | 44% | 360 |
| l3clip27 | Akhand Kirtan | ok | 28% | 285 |
| l3clip29 | Akhand Kirtan | ok | 66% | 142 |
| l3clip31 | Akhand Kirtan | ok | 38% | 195 |
| l3clip32 | Akhand Kirtan | ok | 39% | 495 |
| l3clip34 | Akhand Kirtan | ok | 35% | 300 |
| l3clip35 | Akhand Kirtan | ok | 45% | 70 |
| l3clip36 | Akhand Kirtan | ok | 38% | 60 |
| l3clip37 | Akhand Kirtan | ok | 25% | 130 |
| l3clip38 | Akhand Kirtan | weak evidence | 20% | 75 |
| l3clip39 | Akhand Kirtan | weak evidence | 9% | 160 |
| ytasa1_4IXk2t_Irqo_900-1620 | Akhand Kirtan | ok | 96% | 720 |
| clip01 | Kirtan | ok | 81% | 212 |
| clip02 | Kirtan | ok | 75% | 23 |
| clip03 | Kirtan | ok | 73% | 410 |
| clip04 | Kirtan | key covers simran | 77% | 375 |
| clip06 | Kirtan | ok | 86% | 296 |
| clip07 | Kirtan | ok | 83% | 387 |
| clip08 | Kirtan | ok | 76% | 268 |
| clip09 | Kirtan | ok | 71% | 506 |
| clip10 | Kirtan | ok | 80% | 490 |
| clip11 | Kirtan | ok | 57% | 236 |
| clip12 | Kirtan | ok | 79% | 291 |
| clip13 | Kirtan | ok | 95% | 182 |
| clip14 | Kirtan | ok | 76% | 320 |
| clip15 | Kirtan | ok | 84% | 411 |
| clip16 | Kirtan | ok | 85% | 500 |
| clip17 | Kirtan | Shabad start/end off (other Shabad heard) | 70% | 442 |
| clip18 | Kirtan | ok | 88% | 274 |
| clip19 | Kirtan | ok | 81% | 323 |
| clip20 | Kirtan | ok | 82% | 575 |
| clip21 | Kirtan | unkeyed parmaan (20-60 s) | 69% | 370 |
| clip22 | Kirtan | key covers lead-in / tail with no Gurbani | 85% | 315 |
| clip23 | Kirtan | key covers lead-in / tail with no Gurbani | 87% | 423 |
| clip24 | Kirtan | ok | 94% | 418 |
| clip25 | Kirtan | ok | 86% | 273 |
| clip26 | Kirtan | ok | 92% | 182 |
| clip27 | Kirtan | ok | 89% | 485 |
| clip28 | Kirtan | ok | 82% | 279 |
| clip29 | Kirtan | ok | 80% | 728 |
| clip30 | Kirtan | ok | 80% | 406 |
| clip31 | Kirtan | ok | 69% | 479 |
| clip32 | Kirtan | ok | 87% | 640 |
| clip33 | Kirtan | ok | 74% | 1050 |
| clip34 | Kirtan | ok | 87% | 110 |
| clip35 | Kirtan | ok | 83% | 1155 |
| clip36 | Kirtan | ok | 78% | 630 |
| clip37 | Kirtan | ok | 83% | 95 |
| clip38 | Kirtan | ok | 59% | 120 |
| clip39 | Kirtan | ok | 71% | 275 |
| clip40 | Kirtan | ok | 80% | 265 |
| clip41 | Kirtan | ok | 79% | 385 |
| rn01 | Kirtan | ok | 84% | 100 |
| rn02 | Kirtan | ok | 88% | 400 |
| rn03 | Kirtan | ok | 52% | 279 |
| rn04 | Kirtan | ok | 67% | 294 |
| rn05 | Kirtan | ok | 33% | 114 |
| rn06 | Kirtan | ok | 81% | 291 |
| rn07 | Kirtan | ok | 43% | 245 |
| rn08 | Kirtan | ok | 66% | 740 |
| rn09 | Kirtan | weak evidence | 9% | 282 |
| rn10 | Kirtan | ok | 95% | 329 |
| rn11 | Kirtan | ok | 85% | 360 |
| rn12 | Kirtan | key covers simran | 73% | 445 |
| rn13 | Kirtan | weak evidence | 22% | 250 |
| rn14 | Kirtan | ok | 63% | 742 |
| rn15 | Kirtan | ok | 72% | 305 |
| rn16 | Kirtan | weak evidence | 9% | 166 |
| rn17 | Kirtan | ok | 61% | 661 |
| rn18 | Kirtan | unkeyed parmaan (20-60 s) | 53% | 305 |
| rn19 | Kirtan | ok | 31% | 375 |
| rn20 | Kirtan | ok | 69% | 360 |
| rn21 | Kirtan | ok | 85% | 401 |
| rn22 | Kirtan | ok | 75% | 351 |
| rn23 | Kirtan | ok | 92% | 200 |
| rn24 | Kirtan | ok | 97% | 120 |
| rn25 | Kirtan | ok | 96% | 95 |
| rn26 | Kirtan | ok | 45% | 760 |
| rn27 | Kirtan | ok | 82% | 987 |
| rn28 | Kirtan | ok | 80% | 190 |
| rn29 | Kirtan | ok | 83% | 535 |
| rn30 | Kirtan | ok | 92% | 250 |
| rn31 | Kirtan | ok | 71% | 960 |
| rn32 | Kirtan | key covers simran | 28% | 215 |
| rn33 | Kirtan | key covers simran | 37% | 875 |
| rn34 | Kirtan | ok | 67% | 185 |
| rn35 | Kirtan | ok | 80% | 300 |
| rn36 | Kirtan | ok | 97% | 140 |
| rn50 | Kirtan | ok | 86% | 575 |
| rn51 | Kirtan | Shabad start/end off (other Shabad heard) | 42% | 140 |
| rn52 | Kirtan | key covers lead-in / tail with no Gurbani | 97% | 540 |
| rn53 | Kirtan | ok | 84% | 505 |
| rn54 | Kirtan | ok | 77% | 560 |
| rn55 | Kirtan | Shabad start/end off (other Shabad heard) | 35% | 126 |
| rn56 | Kirtan | ok | 33% | 185 |
| rn57 | Kirtan | ok | 46% | 158 |
| rn58 | Kirtan | ok | 33% | 178 |
| rn59 | Kirtan | ok | 54% | 390 |
| rn60 | Kirtan | ok | 89% | 205 |
| rn61 | Kirtan | key covers lead-in / tail with no Gurbani | 76% | 285 |
| rn62 | Kirtan | ok | 65% | 580 |
| rn63 | Kirtan | ok | 81% | 1565 |
| rn64 | Kirtan | ok | 89% | 380 |
| rn65 | Kirtan | ok | 95% | 555 |
| rn66 | Kirtan | Shabad start/end off (other Shabad heard) | 74% | 590 |
| rn67 | Kirtan | ok | 68% | 495 |
| rn68 | Kirtan | ok | 96% | 90 |
| rn69 | Kirtan | Shabad start/end off (other Shabad heard) | 33% | 125 |
| rn70 | Kirtan | ok | 86% | 620 |
| rn71 | Kirtan | ok | 81% | 705 |
| rn72 | Kirtan | key covers simran | 63% | 1120 |
| rn73 | Kirtan | ok | 77% | 100 |
| rn74 | Kirtan | ok | 49% | 170 |
| rn75 | Kirtan | key covers simran | 22% | 261 |
| rn76 | Kirtan | ok | 39% | 523 |
| rn77 | Kirtan | ok | 69% | 938 |
| rn78 | Kirtan | key covers lead-in / tail with no Gurbani | 38% | 630 |
| rn79 | Kirtan | weak evidence | 6% | 315 |
| rn80 | Kirtan | ok | 77% | 570 |
| rn81 | Kirtan | ok | 36% | 28 |
| kbv1_IZOsmkdmmcg | Kirtan (Karanbir v1, human keys) | ok | 77% | 457 |
| kbv1_kZhIA8P6xWI | Kirtan (Karanbir v1, human keys) | ok | 79% | 289 |
| kbv1_kchMJPK9Axs | Kirtan (Karanbir v1, human keys) | ok | 84% | 647 |
| kbv1_zOtIpxMT9hU | Kirtan (Karanbir v1, human keys) | ok | 33% | 289 |
| pt01 | Paath | ok | 100% | 30 |
| pt02 | Paath | ok | 100% | 30 |
| pt03 | Paath | ok | 100% | 30 |
| pt04 | Paath | ok | 100% | 30 |
| pt05 | Paath | ok | 100% | 30 |
| pt06 | Paath | ok | 87% | 30 |
| pt07 | Paath | ok | 100% | 30 |
| pt08 | Paath | ok | 86% | 30 |
| pt09 | Paath | ok | 100% | 30 |
| pt10 | Paath | ok | 100% | 30 |
| pt11 | Paath | ok | 100% | 30 |
| pt12 | Paath | ok | 100% | 30 |
| pt13 | Paath | ok | 100% | 30 |
| pt14 | Paath | ok | 100% | 30 |
| pt15 | Paath | ok | 100% | 30 |
| pt16 | Paath | ok | 100% | 30 |
| pt17 | Paath | ok | 100% | 30 |
| pt18 | Paath | ok | 100% | 30 |
| pt19 | Paath | ok | 67% | 30 |
| pt20 | Paath | ok | 73% | 30 |
| pt21 | Paath | ok | 93% | 30 |
| pt22 | Paath | ok | 100% | 30 |
| pt23 | Paath | ok | 93% | 30 |
| pt24 | Paath | ok | 100% | 30 |
| pt26 | Paath | ok | 100% | 30 |
| pt27 | Paath | ok | 100% | 30 |
| pt28 | Paath | ok | 87% | 30 |
| pt29 | Paath | ok | 100% | 30 |
| pt30 | Paath | ok | 100% | 30 |
| pt31 | Paath | ok | 100% | 30 |
| pt32 | Paath | ok | 100% | 30 |
| pt33 | Paath | ok | 100% | 30 |
| pt34 | Paath | ok | 87% | 30 |
| pt54 | Paath | ok | 100% | 30 |
| pt55 | Paath | ok | 87% | 30 |
| pt56 | Paath | ok | 100% | 30 |
| pt57 | Paath | ok | 100% | 30 |
| pt58 | Paath | ok | 100% | 30 |
| pt59 | Paath | ok | 93% | 30 |
| pt60 | Paath | ok | 100% | 30 |
| pt61 | Paath | ok | 100% | 30 |
| pt62 | Paath | ok | 100% | 30 |
| pt63 | Paath | ok | 100% | 30 |
| pt64 | Paath | ok | 100% | 30 |
| pt65 | Paath | ok | 100% | 30 |
| ytap_5N6Cgw8WAaY_1200-1800 | Sehaj / Akhand Paath | ok | 97% | 525 |
| ytap_67Z-uUuScfs_300-900 | Sehaj / Akhand Paath | ok | 99% | 550 |
| ytap_PB6nfe3QKn4_900-1500 | Sehaj / Akhand Paath | ok | 99% | 553 |
| ytap_q_dwf8YWdXY_300-900 | Sehaj / Akhand Paath | ok | 99% | 532 |
| pt35 | Sung Bani | ok | 100% | 30 |
| pt36 | Sung Bani | ok | 100% | 30 |
| pt38 | Sung Bani | ok | 67% | 30 |
| pt39 | Sung Bani | ok | 100% | 30 |
| pt40 | Sung Bani | ok | 87% | 30 |
| pt41 | Sung Bani | ok | 100% | 30 |
| pt43 | Sung Bani | ok | 100% | 30 |
| pt44 | Sung Bani | ok | 100% | 30 |
| pt45 | Sung Bani | ok | 93% | 30 |
| pt51 | Sung Bani | ok | 100% | 30 |
| pt52 | Sung Bani | ok | 100% | 30 |
| pt53 | Sung Bani | ok | 80% | 30 |

</details>
