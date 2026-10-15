---
name: akhand-paath-mode
description: "Akhand / Sehaj Paath = \"sequence mode\" built Oct 8 2026 on branch akhand-paath (worktree ~/personal/sttm-akhand); no button, auto-detected; proxy benchmark = Rehras/Sohila clips with Bani routes off"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-09T02:59:57.297Z
---

Prebhdev asked (Slack, Oct 8 2026) what Voice-Follow does during an Akhand Paath and suggested
"a dedicated Akhand Paath mode button that integrates with the Akhand Paath reader". The user
prefers NO separate button: it should tell by itself (and still integrate with STTM's reader).

**What exists (Oct 8 2026, branch `akhand-paath`, worktree `~/personal/sttm-akhand`, forked
from voice-follow-visible-experimental ede93c17; commit 1730ce97):**
- "Sequence mode" in VoiceFollow.jsx: when a plain SGGS Shabad is read straight through
  (`PAATH_SEQ_LINES` = 6 distinct lines in order, and the straight-through detector found no
  Bani to open), the follower profile becomes a window of the current + next `PAATH_SEQ_AHEAD`
  = 2 Shabads (consecutive ShabadIDs, same as STTM's own next-Shabad arrow). Crossing into the
  next Shabad opens it via `autopilotLock(..., {promote: true, window: true})` (session-log kind
  `paath_next`), then the window slides. STTM's **Akhand Paatt view** setting (`akhandpatt`)
  turns it on from the first lock. A line coming back (sung, not read) or a judge switch outside
  the window turns it off. The window's Shabads are vetoed from the switch judge
  (`curBaniShabadsRef`), same mechanism as Bani following.
- Benchmark: `research/level2-dataset/tools/paath-seq-bench.js` + `paath-seq-tests.json`
  (Rehras bn01/bn02 = Shabads 40-48, Sohila bn03/bn04 = 49-53, consecutive SGGS ids) run with
  `VF_EXP_NO_BANI=1` (driver also blanks `PAATH_READ_BANIS` and patches `= findBaniSequence(`);
  on shadow branches run `node -r ./tools/no-shadow-preload.js`. Metrics: in-sequence time,
  covered N/M, carry-overs, flips (no per-Shabad truth times, so in-sequence is lenient).
  Results (real time, Mac, commit 9aac160b): Sohila 5/5 covered on both readers, 100% in
  sequence; Rehras 6/9 (ids 40-45 carried; the later Rehras pieces are not consecutive ids).
  Stock component (fast mode) reaches the next Shabad too, but only via the judge, ~12 s later
  per Shabad and with searching gaps (Sohila 88.5% / 71%).
- Lessons: (1) the bench driver swallows handler errors (`chain.catch(() => {})`) and has no
  `process.env` in its vm: never use process.env inside the component for debugging; (2) a fix
  inside the next Shabad must NOT update the previous-line marker, or the next fix back in the
  current Shabad reads as "a line coming back" and turns sequence mode off (the cause of the
  v2-v4 stalls); (3) crossing needs 2 fixes over 1.5 s for the next id, 4 over 8 s for a skip.
- Real Sehaj Paath clips (user OK'd YouTube pulls, Oct 8 2026; `pull-clips.sh` + sehaj.list):
  sp01 FGWBnA3nIOI Ang 100-109, sp02 n-xzrmDTrqY Ang 103-110, sp03 06tOxT1xYu0 Ang 1000-1010,
  60-660 s each, truth = every Shabad on those Angs (`ang-shabads.js` query). Result: found in
  3-5 s, 99% in sequence, 0% wrong, 10-11 carry-overs each, every transition in strict order
  (results/paath-seq-sehaj). Rehras ps01's 6% "wrong" is the opening Slok 1721 (Dukh daroo)
  before the 30 s truth start, likely correct; ask the user to confirm by ear and add it.
- Known gaps: Shabads inside a Bani (e.g. Japji at Ang 1) still take the Bani route; Level 2
  regression not run (EC2 needs the user's OK); no panel indication of sequence mode yet; no
  hall-acoustic Akhand Paath clip yet (Penang live N9mR62wsPKI is a candidate, Ang unknown).

**Why:** Akhand Paath is continuous reading of the whole Guru Granth Sahib; the Shabad-switch
model is wrong for it, and a position that only moves forward through consecutive Shabads is
right. Detecting it from the reading itself avoids a mode button the sevadaar must remember.

**How to apply:** iterate on branch `akhand-paath`; keep the Level 2 benchmark unchanged
(sequence mode must not fire on kirtan: six ascending distinct lines, reset on any line
coming back). See [[tester-build-86c]], [[judge-on-heldout]], [[hf-dataset-compat]].
