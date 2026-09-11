---
name: voice-follow-north-star-kpis
description: "The 9 agreed KPIs for the voice-follow autopilot, in plain + technical terms, with current status"
metadata: 
  node_type: memory
  type: project
  originSessionId: 912be5a1-888f-4cb5-8069-6e0729b9a0c9
  modified: 2026-09-10T23:45:04.894Z
---

The autopilot = a friend flipping to the right shabad page while the user sings. Always carry these 9 KPIs; the user may add/edit/delete them. North star = the Big 3 (#1,#2,#3).

**Big 3 (headline — optimize these):**
1. **Right page** (accuracy / time-on-correct) — HIGH. Now ~65–70% on real kirtan. 🟡
2. **Wrong page** (erroneous rate — jarring wrong jump) — LOW. Now ~10–17%. 🔴 want <~5%.
3. **Does it lock on?** (lock-in success rate) — HIGH. **NOT MEASURED YET.** 🔴 User feels it fail live: "finds the shabad, won't lock in." Bottleneck = acoustic commit gate; proposer (first-letter) already finds it.

**Helpers:**
4. **A little behind** (stale rate — showing prev shabad, graceful) — small OK. Now ~18%. 🟢
5. **Catches the change** (switch recall) — HIGH. Now ~90%. 🟢
6. **How fast it flips** (switch latency) — LOW. Now ~8s median. 🟡
7. **Jump-in-the-middle** (mid-shabad join: start mid-shabad / mid→mid switch) — HIGH. **NOT MEASURED YET.** 🔴 User felt it hard.

**Safety rails (must never regress):**
8. **Word-by-word stays good** (within-shabad line/word follow) — old bake-off: Path 85→93, Kirtan 47→49.6; NOT wired into live autopilot harness. 🟢/gap.
9. **Don't break what worked** (path-mode no-regression vs `pre-autopilot` = 2f451be) — 🟢.

Core insight: detector (proposer) works; the acoustic judge is unreliable on kirtan (~37% ceiling) so it won't commit. Cheapest big unlock = trust detector more / judge less. Fundamental unlock = new/fine-tuned kirtan acoustic model. See [[voice-follow-kirtan-model-goal]], [[voice-follow-realkirtan-frontier]], [[voice-follow-oracle-bakeoff]], [[voice-follow-kirtan-switch-bench]].
