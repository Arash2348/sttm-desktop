---
name: hearing-diagnostic
description: Oct 14 2026 hearing test — hard/Akhand audio misses are the speech model, not app logic; no candidate model clearly better
metadata:
  type: project
---
Result (Oct 14 2026, results/HEARING.md in sttm-replay/research/level2-dataset): on GAB-Hard every model form
(Karanbir int8/fp32, Surinder CTC/RNNT, Sukhpal CTC/RNNT) has the true Shabad in top-5 for only 4-7% of windows;
the app already shows the right Shabad MORE than the model evidence supports. Logic is not discarding evidence.
Karanbir int8 == fp32 (export costs nothing). Sukhpal best on Akhand hearing (16% vs 12% top-5) but votes wrong
more; Surinder best on Hard but votes wrong 24% vs 11%. RNNT worse than CTC on 4 s windows.
One logic loss: Akhand clip ytak_0typ wrong first lock, 59 s to switch.

**Why:** settles "model or logic?" for hard audio.
**How to apply:** don't tune logic to fix GAB-Hard; better hearing needs room-mic/hall training data or mic
placement. Rerun with `tools/hearing.sh <model>` when Jaspal's model arrives. See [[surinder-model-compare]], [[gab]].
