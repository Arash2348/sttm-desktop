---
title: GAB Leaderboard
colorFrom: blue
colorTo: gray
sdk: static
app_file: index.html
pinned: false
short_description: Gurbani Autopilot Bench results per STTM Voice-Follow build
---

# GAB leaderboard

One row per STTM Desktop Voice-Follow build, scored by GAB (Gurbani Autopilot Bench) on the practice split
(train + dev recordings) of the private dataset `khalisfoundation/GurbaniAutopilotBench`.

Files: `index.html` (the page), `about.html` (how to read it), `reconcile.json` (earlier reported numbers checked
against GAB), `results/index.json` + `results/<build>.json` (one file per build, written by `gab publish`).
The page reads only these files; it needs no token or secret.
