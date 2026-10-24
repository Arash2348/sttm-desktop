# Voice Autopilot — minimum computer for the experimental build

**Rule:** a computer meets the minimum when **"Check this computer"** (Voice Autopilot panel, under the mic picker) says
**Great** or **Meets the minimum**. Anything below is not supported for experimental testing: issues from such a computer
may be the hardware, not Voice Autopilot.

## How the check decides

It times the real speech model on this computer (about 5–10 s the first time, ~1 s when the model is already loaded) for
the two jobs Voice Autopilot does every second:

| Job | Schedule | Share of each second the model needs |
|---|---|---|
| Finding the Shabad | one 10 s window every 0.5 s | time per 10 s window ÷ 500 ms |
| Following the pangti | 4 s windows: every 0.25 s + every 0.5 s | time per 4 s window ÷ 250 ms + ÷ 500 ms |

The worse of the two decides (kirtan always runs the full schedule):

| Result | Model busy | What it means |
|---|---|---|
| ✅ Great | ≤ 50% (2× faster than needed or more) | comfortable, room for other apps |
| ✅ Meets the minimum | 50–120% | keeps up; above 80% it is briefly behind now and then and catches up |
| ⚠️ Below the minimum | > 120%, or less than 7 GB memory | falls behind often; the screen lags the sangat |

**Why 120%, not 80% (Oct 23 2026, with session A's per-tester review):** when the computer is slightly too slow the
app merges the waiting audio instead of building a backlog, so it is briefly behind and catches up. Maskeen Singh's
ThinkPad E14 (Ryzen 7 250, ~161 ms per 4 s window, ~110% busy) "fell behind" ~42 times an hour yet made 381 of 385 screen
changes in a whole diwan with 100% right Shabad and pangti. Real trouble starts around 350 ms per window (~2× too slow):
the i7-1255U, i7-7500U and Ryzen 5 7520U (6 GB) laptops. 7 GB, not 8, because 8 GB PCs report about 7.3–8 GB.

## How it went on real computers (session data + per-tester review)

| Who | Computer | ms per 4 s window | Check says | Fell behind / h | How it actually went |
|---|---|---|---|---|---|
| Maskeen Singh, UK | ThinkPad E14, Ryzen 7 250, 15 GB | ~161 | ✅ Meets (brief catch-ups) | 42 | ✅ excellent: 381/385 screen changes, 100% right |
| Renton Gurdwara Sahib | Ryzen 9 3900XT desktop, 17 GB | ~135–150 | ✅ Meets (brief catch-ups) | 114 | runs all day; earlier paath lag was the processing queue, CPU ~25% busy |
| Waheguru Samagams | i7-1270P, 34 GB | ~122 | ✅ Meets | 9 | ✅ kept up |
| Dyal Singh; Tarneit; San Antonio; IGSK | Apple M1 / M1 Pro; i9-13900H | 74–88 | ✅ Great | 0–5 | ✅ kept up |
| Harpreet Singh Wahan, NY (2nd laptop) | i7-1255U, 17 GB | ~381 | ⚠️ Below (~2.3× too slow) | 192 | dropped to slowest mode (5 min of data) |
| Preet | i7-7500U HP, 13 GB | ~356 | ⚠️ Below (~2.1× too slow) | 254 | (20 min of data) |
| Uttam | Ryzen 5 7520U, 6 GB | ~443 | ⚠️ Below (too slow + memory) | 161 | ❌ worst real machine |

Not judged: base Apple M2 Baltimore (1 min, first launch while the Gurbani database was downloading) and Khalsa Gurmat
Academy Toronto (Gurbani database never downloaded on the school network, so Autopilot never really ran).

## Raw log-based grading (first pass, with the earlier 80% line)

Every computer that uploaded a Voice Autopilot session (Azure, read-only), graded with the same rule from its own
measured model time, against what actually happened ("fell behind" = the app's audio queue went past its bound):

| Computer | OS | Hours of sessions | ms per 4 s window | Check verdict | Times fell behind per hour |
|---|---|---|---|---|---|
| Apple M2, 8 cores | macOS | 0.0 | 342 | ⚠️ Below the minimum | 146.1 |
| 12th Gen Intel(R) Core(TM) i7-1255U, 12 cores | Windows | 0.1 | 305 | ⚠️ Below the minimum | 191.7 |
| Intel(R) Core(TM) i7-7500U CPU @ 2.70GHz, 4 cores | Windows | 0.3 | 285 | ⚠️ Below the minimum | 253.6 |
| AMD Ryzen 5 7520U with Radeon Graphics, 8 cores | Windows | 3.7 | 274 | ⚠️ Below the minimum | 161.0 |
| AMD Ryzen 7 250 w/ Radeon 780M Graphics, 16 cores | Windows | 1.4 | 183 | ⚠️ Below the minimum | 41.5 |
| AMD Ryzen 9 3900XT 12-Core Processor, 24 cores | Windows | 59.8 | 135 | ⚠️ Below the minimum | 110.6 |
| 12th Gen Intel(R) Core(TM) i7-1270P, 16 cores | Windows | 12.3 | 122 | ✅ Meets the minimum | 8.6 |
| Apple M1, 8 cores | macOS | 0.0 | 88 | ✅ Meets the minimum | 0.0 |
| Apple M1 Pro, 10 cores | macOS | 0.6 | 85 | ✅ Meets the minimum | 5.0 |
| Apple M1 Pro, 10 cores | macOS | 0.3 | 81 | ✅ Great | 0.0 |
| Apple M2 Pro, 12 cores | macOS | 4.6 | 77 | ✅ Great | 38.2 |
| 13th Gen Intel(R) Core(TM) i9-13900H, 20 cores | Windows | 0.0 | 67 | ✅ Great | 0.0 |

- Every computer the check calls **Below the minimum** really fell behind: **41–254 times an hour**.
- **Meets / Great** computers mostly ran clean (0–9 an hour). The one exception, an Apple M2 Pro at 38 an hour with a
  294 s worst case, is a developer laptop whose sessions include sleep/lid-close gaps, not a speed problem.
- **The Renton Gurdwara Sahib PC (Ryzen 9 3900XT, 24 cores)** sits just over the line (load 0.81) and fell behind
  110 times an hour over 60 hours: a strong desktop is not automatically enough on Windows, which is why the check
  measures instead of reading the CPU name.
- Dev Mac (Apple M4 Pro): 46–49 ms per 4 s window, Great (3.4–3.6× faster than needed).

**The check measures what sessions log.** Same process on the dev Mac: the app's own speed self-test (logged as
`selfTestMs` by every session above) vs the check — normal cores 49 ms vs 67 ms per 4 s window (Great); forced onto the
slow efficiency cores (`taskpolicy -b`) 595 ms vs 569 ms (check: Below the minimum, about 3.4× too slow; the app itself
dropped to its slowest tier). So the table above is what the check would report on those computers.

**The check itself on real x86 machines** (GitHub's cloud Windows and Linux machines, 3 runs each, Oct 23 2026):

| Machine | Check verdict | ms per 4 s / 10 s window | App's own self-test, same run |
|---|---|---|---|
| Windows 11, AMD EPYC 7763, 4 cores, 16 GB | ⚠️ Below the minimum, about 1.15–1.26× too slow | 192–209 / 502–591 | 199–239 ms |
| Linux, AMD EPYC 9V74, 4 cores, 15.6 GB | ✅ Meets the minimum, 1.3–1.4× faster than needed | 123–126 / 305 | 122–125 ms |

A 4-core x86 PC is around the line, and Windows runs the same model noticeably slower than Linux on similar hardware —
consistent with the Windows laptops in the session data. (Intel Mac and older Windows images were not available.)

Re-run: `python3 research/hwcheck/fleet_validate.py` (writes fleet-validate.json). Add tester "Copy details" lines as they come.

## Where the result goes

- Shown in the panel and kept per computer (the last result stays until "Check again").
- Written to the Voice Autopilot diagnostics log (`hw check: …`) and, in shadow builds, as a `hw_check` event in the
  session, so a problem session can be matched to its computer's result.

Code: `www/main/addons/voice-follow/engine/hwcheck.js` (+ `hwcheck.test.js`), `components/HwCheck.jsx`.
Idea from Karanbir Singh's kirtan-captioning hardware setup screen; no adaptive cadence, only the minimum bar.
