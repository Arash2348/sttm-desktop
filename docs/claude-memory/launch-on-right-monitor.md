---
name: launch-on-right-monitor
description: "When launching STTM visibly for the user to test, always put its window on the right monitor (the Dell at x>=1920), never the main centre one"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-10T03:33:44.961Z
---

The user tests the dev app on the right-hand monitor (DELL UP3017, 2560x1600, display bounds x >= 1920). The main centre display (LF32TU87, 1920x1080 UI) must stay free.

**Why:** the user asked on 2026-10-09 ("from now on please always launch STTM on the right monitor not my main center one").

**How to apply:** every dev launch (visible AND hidden test instances) gets `NODE_OPTIONS="--require <scratchpad>/demo/visible/right-display.js"`, a test-only main-process hook that moves each new window to the right display before it shows AND, for the first 30 s, keeps the app from taking focus (show -> showInactive, focus/app.focus/dock.show absorbed; the user asked 2026-10-10 not to have focus forced) (the app itself always opens on the primary display). Use `<scratchpad>/demo/visible/launch-user.sh` for the user's visible app (FRESH=1 for a new profile). Belt and braces: after launching the visible dev app (port 9333), run `node <scratchpad>/demo/visible/place-right.js 9333`: it uses `@electron/remote` (screen.getAllDisplays + getCurrentWindow().setBounds) through the debug port, so it needs no Accessibility permission. osascript window moves fail (osascript lacks assistive access). Hidden test instances (port 9334, launch-direct2.sh) stay hidden as before. See [[test-runs-in-background]].
