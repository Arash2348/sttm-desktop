---
name: work-in-background
description: NEVER launch the tester app (or any app) on the user's Mac unless they explicitly ask; builds and offline checks only, in the background
metadata:
  node_type: memory
  type: feedback
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-02T21:12:36.640Z
---

Do not launch the tester app (Voice-Sikhi-To-The-Max) or any other app on the user's Mac at all unless they explicitly ask for a run. Even a 'hidden' launch flashes a window and steals focus, and the user said twice (2026-10-02) to stop. Builds, lint, unit tests and S3/benchmark work are fine in the background; app-level end-to-end runs need an explicit OK first ("run the Mac test now").

**Why:** scripted end-to-end runs of the tester app (Voice-Sikhi-To-The-Max) kept popping the window up and once played kirtan aloud while the user was working; they asked (2026-10-02) to "keep working in the background" and to remember this preference.

**How to apply:**
- Only when the user explicitly asks for an app run: use the hidden launcher (`scratchpad/e2e/launch.js`) and kill leftover instances first; otherwise do not start the app at all.
- Feed test audio with the `VF_TEST_WAV` hook instead of playing it aloud.
- Long builds/tests go in background tasks with `nice -n 19`; report results when they finish.
- Related: [[mac-compute-limit]], [[end-with-action-items]].
