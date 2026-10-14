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

One row per version of Gurbani Autopilot (STTM Desktop Voice-Follow), scored by GAB (Gurbani Autopilot Bench) on the practice split
(train + dev recordings) of the private dataset `khalisfoundation/GurbaniAutopilotBench`. Two tiers, never mixed:
main GAB (the priority) and GAB-Hard (the Fremont hall laptop-mic recordings), each ranked best first, with its own
"What changed between versions".

Files: `index.html` (the page), `about.html` (how to read it), `gab-names.json` (the system's name and each version's
display name, by commit), `reconcile.json` (earlier reported numbers checked
against GAB), `results/index.json` + `results/<build>.json` (one file per build, written by `gab publish`; `rows` = main GAB,
`hard.rows` = GAB-Hard). URL options: `?set=hard`, `?tab=board|changes|banis|sets|about`, `?beh=1-kirtan-shabad`.
The page reads only these files; it needs no token or secret.
