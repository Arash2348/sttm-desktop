---
name: gab
description: "GAB = Gurbani Autopilot Bench (user's name, Oct 14 2026): the one named, cached, fast benchmark + data flywheel (ingest Jaspal recordings, harvest Azure sessions where the sevadaar screen is the label, ear-check review queue); every change gets a GAB scorecard"
metadata:
  type: project
---

The user wants benchmarking named GAB, "Gurbani Autopilot Bench", that uses the cache so iteration
is fast, and a data flywheel: better data -> easier improvements. Built on vf-cached-replay tools:
`gab run | compare | slowpc | fill | ingest | publish | harvest`; one scorecard format (four
content folders x the plain questions, mic path split 50/50, "GAB v1.0" + manifest hash);
LEADERBOARD in the HF dataset README; harvest turns non-developer Azure sessions into review-queue
clips (sevadaar screen = lagging human label), served by the ear-check app.

**How to apply:** every Voice-Follow change reports a GAB scorecard (smoke while iterating, full
once, test split only at the end); new data always enters through gab ingest / harvest / ear
checks, never ad hoc. See [[behaviour-benchmark-dataset]], [[sangat-view-metric]],
[[human-labels-first]], [[developers-vs-sangat]], [[kirtan-general-goal]].

Dataset id: khalisfoundation/GurbaniAutopilotBench (renamed Oct 14 2026 from voice-follow-benchmark; old id redirects). Card title "GAB: Gurbani Autopilot Bench".

**Leaderboard (Oct 14 2026):** GAB v1.1, private STATIC HF Space khalisfoundation/GAB-leaderboard (Gradio/Docker Spaces need a paid org plan, so static like gurbani-asr-leaderboard); results JSON live inside the Space (no token/secret). Practice set = train+dev only; Renton clips are test split, so no Renton paath row (moving them is the user's call). Reviewer found: kirtan "switch" counted returns-after-parmaan as 0 s switches (being fixed); kirtan line-hold candidate 747cb093 worsens Aarti-50 wrong Shabad 42.7 -> 57 s/h, so it is NOT ready as is.

**Tiers (user decision, Oct 14 2026):** main GAB excludes Jaspal's Fremont recordings ("very very hard": resonant hall, laptop mic, little clean audio). They form a separate GAB-Hard set (`--set hard`), tracked on its own leaderboard view but NOT the priority. Main GAB is what we optimise and report first. Kirtan pangti metric also shows "same or neighbouring pangti" because ragis sing paired lines as one phrase.

**Model is fixed (user, Oct 14 2026):** Karanbir's model stays for a long time; almost all changes are to the harness around it (decision logic, following, switching). GAB must keep harness iterations fast (cache replay, minutes). Model swaps only when something strictly better is found; then one cache fill on GCP.

**Name (user, Oct 14 2026):** the system benchmarked is called **Gurbani Autopilot** (GA), versions "Gurbani Autopilot 9.0.3" etc. Not ਧਿਆਨ/Dhiaan (that name was tried and replaced the same day).

**Feature name (team decision via Gauravjeet, Oct 14 2026):** the user-facing feature name in the app is **Voice Autopilot** (not "Autopilot" + "Voice-Follow" mixed), including setting labels. Recording notice approved: one-time first-launch popup + a "Recording audio" label that opens the description on click (branch vf-recording-notice).

**GAB-Akhand Kirtan tier (user, Oct 14 2026):** kirtan with many singers (5-15), sangat singing along, many instruments, resonant: the hardest kirtan; we perform poorly and haven't tuned on it. Separate tier (`--set akhand`), seeded from the 32 Level 3 smagam sheet rows (AKJ Toronto 2022, Manchester 2024) + user-supplied YouTube links; improve it under the rule that main GAB must not get worse. The user will send links.
**GCP use (user, Oct 14 2026):** "you can also outsource work to GCP." Rule: GCP (x86) model output only for clips with NO Mac cache (whole new clips); incremental fills on Mac-recorded clips stay on the Mac, so a clip's windows never mix machines. Budget rules unchanged.

**Keep the leaderboard current (user, Oct 14 2026):** whenever a new version, idea/experiment, data tier (e.g. Akhand Kirtan) or metric (Lag, switches, pangti) lands, publish it to the GAB leaderboard (lean page) and the dataset card in the same step; don't leave results only in local scorecards.
