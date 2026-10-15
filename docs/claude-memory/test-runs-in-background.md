---
name: test-runs-in-background
description: App test runs on the Mac must not pop a window in front of the user; launch in background and park the window off-screen
metadata:
  type: feedback
---

When a demo or end-to-end run launches the app on the Mac, it must not open in front of the user or steal focus (Oct 8 2026: "usually I'm working and it opens up and blocks what I'm working on").

**Why:** the user keeps working while runs happen; a window popping up interrupts them.

**How to apply:** launch with `open -g -a <App.app> --env VAR=... --args ...` (background, no activation), then park the window off-screen via CDP `Browser.setWindowBounds` (scratch `offscreen.js`); keep `--disable-backgrounding-occluded-windows` so the screencast keeps rendering. Never use plain `electron .` or the app binary directly for runs the user hasn't asked to watch. See [[work-in-background]].
