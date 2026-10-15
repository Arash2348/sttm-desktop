---
name: verified-data-home
description: Where human-verified Voice-Follow data lives — the main tab of the Level 2 Google Sheet, append-only; Auto tabs hold proposals
metadata:
  type: feedback
---

Every human-verified row goes into the FIRST tab, "Human-Fully Sheet (100% Human Verified) - Level 2", of the Google Sheet
"Level 2 Kirtan Live Darbar Dataset Real" (id 1FzvYu-U6c9Xl0cdJz32qD742BkTMHU2luX08O9Rl0DA). It already holds Level 2,
Level 3 smagam (AKJ Toronto, Manchester) and Yuba City rows. Columns: Gurdwara, Type, Cut time, End Time, Shabad, Link,
Human, Shabad BaniDB ID, Notes.

**Why:** the user (2026-09-25) wants one place to see everything verified, with visibility, not a database they can't see.
This supersedes the older "never edit the Human-Fully Sheet tab" rule — the tab is now APPEND-ONLY: add rows the user has
confirmed, never change or delete existing rows.

**How to apply:** proposals go to "(Auto)" tabs (one writer per tab: Claude rewrites Auto tabs, the user answers in
review columns); only after the user confirms does a row get appended to the main tab. Line-level labels can't fit the
main tab (one row per shabad), so they live in a linked line tab (pattern: existing "Line-Level (Auto) — CORRECTED") keyed
to the main-tab row. Writing needs the Google Sheets connector; Drive alone can only read/export. Related: [[no-model-labels]]

Exception (2026-09-25): the live hall recording (~/Desktop/SikhiToTheMax.mp4) has its own verified tab, "Hall Test Example
100% Human-Verified (Sep 25)" — the user renamed and fully annotated it; it grades each stretch the app showed (Correct /
Wrong shabad + correct shabad in words). Local copy: research/level2-dataset/hall-test-sep25.json. The user prefers this
"grade what the app showed" format over writing a separate sung timeline; ±1–2 s timing doesn't matter to them.

Boundary tolerance (2026-09-25): verified rows' start/end are approximate — the user often marks "Yes, times adjusted"
without typing new times, meaning a few seconds off. Scoring against these rows must use a few-seconds tolerance at
shabad boundaries; never treat boundary seconds as exact. Renton Finds answers are also saved locally in
research/level2-dataset/renton-finds-verified-sep25.json (+ review/renton-answers.json).

Derived tabs (2026-09-26, user asked for one combined view): "Benchmark Dataset (Sep 26)" (sheetId 260926001) = one row per
benchmark clip across every set (split, use, scored window, every correction + ear-check note) and "Ear-Check Answers
(Sep 26)" (sheetId 260926002) = one row per Wrong Switch Check answer. They are VIEWS rebuilt from the dataset truth files +
clip-notes.json + review/wrong-check-answers.json; refresh them when corrections change. The main tab stays the home of
verified rows. Ear-check answers fold into scoring via tools/sync-wc-answers.py (App right -> also_correct; Kirtan ended /
Ardas -> label end; No kirtan -> excluded stretch; Paused for talk / App wrong -> stays wrong).
