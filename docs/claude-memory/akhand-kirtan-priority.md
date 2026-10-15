---
name: akhand-kirtan-priority
description: Oct 14 2026 — Akhand Kirtan improvement is a TOP priority; iterate the current system (logic + matching), no training, no metric worse
metadata:
  type: project
---
User (Oct 14 2026): "Focus on iterating current system on akhand kirtan without degrading metrics... one of my
top priority... be smart with your token limits".

**Why:** Akhand Kirtan shows right Shabad 75%; model hears true Shabad in top-5 only 12% (see [[hearing-diagnostic]]).
**How to apply:** iterate logic + matching (incl. direct CTC pangti scoring) on GAB-Akhand train/dev; every variant
must PASS main GAB and not worsen GAB-Hard; test split once at end. Training only as a later proposal. Run rounds on
the GCP farm, be token-efficient (scripts/summaries, few subagents). Branch vf-akhand-kirtan-1. See [[gab]].
