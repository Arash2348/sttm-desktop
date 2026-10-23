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

## Reference numbers

| Computer | 10 s window | 4 s window | Verdict |
|---|---|---|---|
| Apple M4 Pro, 14 cores, 48 GB (dev Mac) | 109–111 ms | 46–49 ms | Great, 3.4–3.6× faster than needed |

Add rows as testers send their "Copy details" line (one line, pasteable into Slack).

## Where the result goes

- Shown in the panel and kept per computer (the last result stays until "Check again").
- Written to the Voice Autopilot diagnostics log (`hw check: …`) and, in shadow builds, as a `hw_check` event in the
  session, so a problem session can be matched to its computer's result.

Code: `www/main/addons/voice-follow/engine/hwcheck.js` (+ `hwcheck.test.js`), `components/HwCheck.jsx`.
Idea from Karanbir Singh's kirtan-captioning hardware setup screen; no adaptive cadence, only the minimum bar.
