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
| ✅ Meets the minimum | 50–80% | keeps up with the singing |
| ⚠️ Below the minimum | > 80%, or less than 4 GB memory | will fall behind; the screen lags the sangat |

The 80% line is the same one the app already uses to pick its performance tier. The Renton Gurdwara Sahib PC that fell
behind on Oct 11 ran the model at about 0.85–0.9× real time, which this check reports as below the minimum.

## Validated on real computers (Oct 23 2026)

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

Re-run: `python3 research/hwcheck/fleet_validate.py` (writes fleet-validate.json). Add tester "Copy details" lines as they come.

## Where the result goes

- Shown in the panel and kept per computer (the last result stays until "Check again").
- Written to the Voice Autopilot diagnostics log (`hw check: …`) and, in shadow builds, as a `hw_check` event in the
  session, so a problem session can be matched to its computer's result.

Code: `www/main/addons/voice-follow/engine/hwcheck.js` (+ `hwcheck.test.js`), `components/HwCheck.jsx`.
Idea from Karanbir Singh's kirtan-captioning hardware setup screen; no adaptive cadence, only the minimum bar.
