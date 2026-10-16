# GAB leaderboard page fixes (khalisfoundation/GAB-leaderboard)

`index.html` = the Space's page (main @ Oct 15 2026) with the layout fix in `layout-fix.diff`: the version column gets
`min-width: 200px` and the timeline column keeps `36px`, so names no longer wrap one word per line and the timeline
line and dots no longer run over them; the table scrolls sideways inside its box instead of squeezing; page width 1140px.
Published together with the GAB v1.3 results (main, Hard, Akhand Kirtan) by the publish session.

Pangti level (Oct 16 2026): every accuracy cell shows the right Shabad % with the right pangti % in small type under it,
and a version's expanded tree has a "Right pangti" column. `≈` marks pangti numbers resting on two-model aligned keys
(spot-checked by a person, 20 of 20); numbers without it rest on keys made by a person. Pangti numbers never replace the
Shabad headline. Fields read: `pangti_pct`, `pangti_basis` of each scorecard row (already in gab-score output).

Big picture (Oct 16 2026, owner's ask): a table above the leaderboard shows one version across every situation (Kirtan,
Paath, Aarti and sung Bani, Akhand Paath, Kirtan on a laptop mic = GAB-Hard, Akhand Kirtan; Akhand Paath reads
"not scored yet" until its recordings are in the practice set and have a runner), six numbers each: hours and recordings,
right Shabad %, right pangti %, behind the singer p50 / p90, wrong Shabad seconds per hour, time to find p50 / p90 (with
"n of m starts missed" = recordings whose first Shabad never reached the screen). A select picks the version (default:
in the app now); ▲▼ are vs the version before. The leaderboard below it is unchanged. Fields read: hours, clips,
behind_p50_s, behind_p90_s, wrong_s_per_h, find_p50_s, find_p90_s, find_n, not_found (already in the published results).
