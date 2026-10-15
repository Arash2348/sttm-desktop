---
name: data-priority
description: Which data decides Voice-Follow benchmark results — Level 2 human-verified + hall test first; Shabad Gurbani studio playlist is only a supplement
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-26T03:33:54.764Z
---

User (2026-09-25, Cycle 10): the most important data is the Level 2 human-fully-verified main tab (172 rows) plus the
hall test tab (real prod mic). The "Shabad Gurbani" YouTube playlist (729 videos) is STUDIO recordings — use it only as a
supplement, never as a deciding set. Level 2 = live gurdwara audio, which is what the app faces.

**Why:** studio kirtan is clean and unlike live hall/livestream audio; optimizing for it can mislead.

**How to apply:** ship/keep decisions rest on Level 2 gold (dev for tuning, locked test for the final check) and the hall
test. Playlist results are reported as a secondary line (a large drop there is a warning to investigate, not a veto on
its own); in fine-tuning, playlist audio is down-weighted supplemental training data. Don't ask the user to ear-check
playlist clips. Related: [[level3-policy]], [[verified-data-home]], [[vaheguru-slide-not-error]]
