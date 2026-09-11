---
name: voice-follow-native-port
description: "Porting the Python voice-follow sidecar into sttm-desktop as native onnxruntime-node, to ship upstream"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-10T07:55:05.416Z
---

GOAL (user, 2026-09-09): voice-follow must become a real shippable feature INSIDE
`sttm-desktop` that all SikhiToTheMax users get on app update with ZERO setup — no
separate Python server, no manual steps. End state = merged upstream into
`KhalisFoundation/sttm-desktop` (PR + maintainer review + release). A standalone
server repo was rejected as the goal (dev-only, not usable by end users). This
supersedes the sidecar architecture in [[voice-follow-desktop-integration]].

DECISIONS: (1) run the ONNX model natively via **onnxruntime-node** in the Electron
renderer (this app already runs native modules there, e.g. realm) — no Python, one
process. (2) **Download the 184 MB int8 model on first run** from Hugging Face
(`karansea/indicconformer-stt-pa-ctc-shabad-preview`, MIT) and cache in userData;
keeps the installer lean = more upstream-merge-friendly. Bundle the tiny tokenizer/
vocab (241 KB) in-repo.

DE-RISK SPIKE DONE + VERIFIED (sandbox `/Users/asingh02/aai/ort-spike`, node v18 +
`onnxruntime-node@1.18.0` installed clean from npm registry — no github egress
issue). All primitives ported to JS and checked against the Python reference:
- ONNX inference: greedy ids + decoded text IDENTICAL to Python; log_probs differ
  only ~0.05 (int8 kernel variance, no argmax changes). Model IO: input `audio`
  [batch,samples] f32 + `audio_len` [batch] i64; output `log_probs` [b,frames,257]
  + `out_len`; BLANK=256; 256-piece vocab.
- Recognizer (auto-detect) streaming port `recognizer.js`: 8/8 emissions match,
  conf within ~0.01, text identical or within 1-2 boundary chars.
- Tokenizer is **BPE** (NOT unigram — max-sum Viterbi gave wrong splits; greedy
  merge-highest-score matches). `sentencepiece.js` encode: 55/55 Gurbani words
  incl. conjuncts (ਕ੍ਰਿਪਾ/ਸ੍ਰਿਸਟਿ/ਬ੍ਰਹਮ). Decode = id->piece vocab + ▁→space.
- Exported helper JSON in `/Users/asingh02/aai/`: `karansea_vocab.json` (id->piece),
  `karansea_pieces.json` ([{p,s}] for BPE encode). Sandbox files: infer.js,
  recognizer.js, sentencepiece.js + harnesses.

FOLLOWER PORT DONE + VERIFIED (2026-09-09): `follower.js` ports full KaranseaEngine
(_viterbi line token-passing, _build_word_align/_word_index_ctc CTC Viterbi word
align, _ctc_score CTC forward, push control logic w/ init_confirm/dwell/freeze/
monotone cursor). `fuzz.js` = JS partial_ratio (LCS/Indel, fixed-window; 6/9 exact
vs rapidfuzz, rest within ~5pts — exact parity not worth it, Viterbi margins absorb
it). E2E test vs Python on full16k.f32 + 5-line set (permissive params to force
locks): 141/143 steps match on (lineIndex,wordIndex); line tracking IDENTICAL; the
2 diffs are borderline frames JS froze (int8 hyp variance) — no tracking impact,
self-heal via monotone cursor. ALL inference now native-Node-equivalent to Python.

INTEGRATION DONE (2026-09-09): engine lives at
`www/main/addons/voice-follow/engine/` — infer.js, recognizer.js, sentencepiece.js
(SP.load()), fuzz.js, follower.js, model-manager.js, index.js + assets/vocab.js &
assets/pieces.js (JSON→.js so Babel bundles them; Babel only processes .js).
`index.js` exposes ready(onProgress)/isReady()/createRecognizer(opts)/
createFollower(lines,opts) with a shared warm Infer session + shared SP. model-
manager downloads model.int8.onnx (184,311,219 B) from HF to
userData/voice-follow/ with redirect + .part + size verify. VoiceFollow.jsx FULLY
rewired off the websocket: new startAudio(onChunk) mic helper (worklet → Float32
chunks pushed serially via a promise chain so no overlapping ONNX runs); start()
builds a Follower, startDetect() a Recognizer; first-run download shows % in detail
+ a .vf-dl progress bar (SCSS added). `onnxruntime-node@^1.18.0` added to
sttm-desktop package.json deps (electron-builder smartUnpack auto-unpacks the .node
like realm). VERIFIED: `npx babel` compiles all 11 files; node-sass builds; engine
smoke-tested end-to-end from inside the repo via NODE_PATH→sandbox ort + the local
model symlinked to model-manager's tmpdir path (follower tracked lines, verse/word
output correct; encode [63,180,...] matches BPE ref).

AUTOPILOT DONE (2026-09-09, commit 49c657f pushed to fork): hands-free one-press
mode — user requirement is ZERO human at the computer, NO auto-switch confirm,
button pressed once. Supervisor in VoiceFollow.jsx over ONE continuous mic
session: phaseRef 'searching'|'following'. SEARCHING = recognizer→handleTranscript
detect; on confident+stable lock → autopilotLock() builds follower + projects +
→FOLLOWING. FOLLOWING = follower.push only (detection OFF, so no mid-shabad false
switch). Auto-switch = TWO independent signals: (1) follower RELEASE sentinel
{verseIndex:-1,lineIndex:null} (built-in ~release=14 hysteresis, verified: locks
then releases on silence) → enterSearching() which spins a FRESH recognizer (so
prior shabad's audio tail can't bias) → (2) same detect gates must re-fire before
next shabad projects. Last shabad stays on screen until new one found. Autopilot
default ON (state `autopilot`); re-attach effect guarded by autopilotRef so it
never tears down the session. Manual follow / one-shot detect kept as fallbacks.
Deliberately chose two-signal gating over always-on blind detect for accuracy
(real-kirtan is FP-bound, see [[voice-follow-realkirtan-frontier]]).

AUTOPILOT V3 — ACOUSTIC SWITCH (2026-09-09, commit 092103e pushed to fork):
user said V2 got WORSE (switched too little; jumped to a similar-worded line
WITHIN the old shabad; no UI cue when searching). Root insight: first-letters are
a noisy PROPOSER, not a precise judge — tightening vote gates was the wrong lever.
NEW DESIGN = separate recall from precision. (1) First-letter detector stays a
fast proposer (high recall): names the best DIFFERENT candidate shabad seen (votes
>= SWITCH_CAND_MIN_VOTES=6). (2) Switch judged ACOUSTICALLY (high precision): each
recognizer decode, score recent decoded audio (vfNorm(text).slice(-80)) vs current
shabad's line-norms AND vs candidate's line-norms via engine partialRatio
(maxLineScore); commit switch only when sCand>=SWITCH_ACOUSTIC_MIN=0.6 AND
sCand>=sCur+SWITCH_ACOUSTIC_MARGIN=0.08 for SWITCH_CONFIRM=3 consecutive decodes.
Headless check: singing shabad B scores 0.94 vs B / 0.31 vs A → huge margin, safe.
Self-corrects a wrong initial lock, so first lock is permissive again
(AP_LOCK_MIN_LETTERS=5, AP_LOCK_STABLE=2). Highlight anti-chase: freeze projected
line while a switch is being evaluated (switchCand.wins>=1) and on low-conf frames
(out.confidence < UI_MOVE_CONF=0.6) — holds instead of jumping to similar old
lines. UI: "new shabad? confirming N/3" + candidate shown while evaluating.
engine/index.js now exports norm + partialRatio. New refs: curLinesNormRef,
switchCandRef; helper loadShabadProfile(shabadId)->{verses,linesNorm}. Removed the
AP_SWITCH_* vote gates + VOTE_CAP-based switch. NEXT: build an OFFLINE eval harness
(concatenate known shabad audio, assert switch recall/precision/latency) — user
goal is "metrics + get it to a good point"; agent can't run mic/GUI so needs this.

AUTOPILOT V4 — TUNED + MEASURED (2026-09-09, commit 5f01009 pushed to fork;
labeled `[AUTOPILOT]`): built an OFFLINE eval harness `/Users/asingh02/AAI/
vf-switch-eval.js` (OUTSIDE repo) — concatenates known benchmark shabads (real
16k WAV + line GT from `/Users/asingh02/aai/voice-align-server/parquet_bench/`),
streams 100ms chunks through the SAME engine (recognizer+follower), replicates
the supervisor acoustic-switch logic, scores initial-lock / switch recall / false
switches / latency. Run: `NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules
MODEL=/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx node
vf-switch-eval.js pq_A pq_B pq_C [--secs N]` (node18). NOTE zsh does NOT word-split
unquoted vars — pass ids as explicit args, not `$VAR`. DIAGNOSIS: V3's switch was
~15s slow because REC window was 10s (stayed full of the PREVIOUS shabad's audio;
new shabad only won after window refilled). FIX = shorten the window (dominant
latency lever): AP_REC_WIN_S=4 (new const, passed to all 3 autopilot
createRecognizer calls), AP_REC_HOP_S 0.9->0.5, SWITCH_HYP_SLICE=35 (new const,
was slice(-80)), SWITCH_CONFIRM 3->2. MEASURED across 4 shabad triples incl.
aggressive --secs 12: switch recall 100%, false switches 0, latency avg 2.9-7.1s
(was ~15s). ~3-7s is the PHYSICAL floor (must hear ~1 line of new shabad).
Harness defaults now mirror shipped constants. Also tagged `pre-autopilot` at
2f451be (last build WITHOUT autopilot) + pushed, per user ask to be able to
revert to the good non-autopilot version. package-lock (onnxruntime-node 1.29.0)
committed separately as chore 13a84fc. CAVEAT (unmeasured headless): the short
window also feeds the FIRST autopilot lock; first-letter votes accumulate across
decodes so recall should hold, but wants a live-mic check. UI "new shabad?
confirming N/2" cue (from V3) satisfies the "obvious when searching" ask.

AUTOPILOT V5 — PHASE-SPLIT + PRECISION GATE (2026-09-10, commit b215f1a pushed):
user north-star = autopilot should equal ALL dedicated features at once (within-
shabad==manual follow, detection==standalone auto-detect, switching great; will
eventually be the ONLY mode, others removed). Two fixes: (1) PHASE-SPLIT recognizer
window — searching uses AP_SEARCH_WIN_S=10 (SAME as standalone startDetect, so
initial detection is provably un-regressed) and following uses AP_FOLLOW_WIN_S=4
(fast switch). Proven byte-identical following via all-4s vs 10/4 harness compare
(searching window only affects the initial lock). startDetect (one-shot manual) &
start (manual follow) UNTOUCHED — different code paths, no changed consts. (2)
PRECISION GATE (kept CONF=2 for speed, did NOT go to CONF=3 which pushed latency to
~10s): SWITCH_ACOUSTIC_MIN 0.60->0.65, SWITCH_ACOUSTIC_MARGIN 0.08->0.15. Root
cause of a rare false switch = two shabads sharing a CLOSING phrase (old shabad
tail matched other shabad: cand 0.60/margin 0.20); real switches score cand>=0.67/
margin>=0.33 so thresholds sit cleanly between. MEASURED 4 scenarios (incl.
aggressive --secs 12): initial lock correct ~2.5-3s, switch recall 100%, false
switches 0 (was 1), latency avg 2.9-6.5s. Harness now models the phase split
(SEARCH_WIN/FOLLOW_WIN env) + prints per-switch cand/cur/margin. SHIPPED autopilot
consts: AP_SEARCH_WIN_S=10, AP_FOLLOW_WIN_S=4, AP_REC_HOP_S=0.5, SWITCH_HYP_SLICE=35,
SWITCH_ACOUSTIC_MIN=0.65, SWITCH_ACOUSTIC_MARGIN=0.15, SWITCH_CONFIRM=2. STILL
unmeasured headless: live-mic first-letter initial-detection recall (should match
standalone now). NOTE: eval runs ~60-120s each (184MB model load + 150s audio) so
they auto-background; run SEQUENTIALLY (parallel = CPU stall); zsh needs explicit
args not $VAR (no word-split); grep is aliased to ugrep (mangles `->`, use full
stdout). Commits labeled `[AUTOPILOT]` (5f01009, b215f1a); revert point tag
`pre-autopilot`@2f451be. See [[voice-follow-native-port]] V4 below for prior step.

AUTOPILOT V2 — BUG FIXES (2026-09-09): user reported v1 was "60% there": (1)
"stops working / does nothing" even when singing other shabads; (2) rarer, "finds
the wrong shabad because it selects really quick". ROOT CAUSE of (1): detection was
OFF during FOLLOWING and the follower's release counter resets on ANY partial match
(Gurbani lines share words) so it never released → stuck forever on old shabad.
FIX (VoiceFollow.jsx): detection now runs CONTINUOUSLY in BOTH phases — onChunk
always pushes to the recognizer + handleTranscript, and additionally pushes to the
follower only while following (for the line/word cursor). Switch decision is made
by the DETECTOR identifying a different dominant shabad, NOT by follower release
(release path now just holds the current shabad on screen). New AP gates: initial
lock needs AP_LOCK_MIN_LETTERS=6 + AP_LOCK_STABLE=3 (fixes bug 2); a switch needs
leaderId!=current, AP_SWITCH_CONF=0.7, AP_SWITCH_EVIDENCE=10, AP_SWITCH_STABLE=4,
AND best>=curVotes*AP_SWITCH_MARGIN=1.2 (must clearly dominate the shabad we're on).
VOTE_CAP=60 clamps tallies so a long shabad can't become unswitchable; votes decay
0.8/decode still applies. autopilotLock is now re-entrancy-guarded (lockingRef) and
switch-aware (transient load failure on a switch keeps the working follower instead
of dropping to searching); on commit it resets votes AND recreates the recognizer
(AP_REC_HOP_S=0.9) so the previous shabad's ≤10s audio tail can't vote us straight
back. Detect shortlist/status suppressed while following. Compiles (babel+sass).
NOT yet committed/pushed at time of writing; NOT live-tested (needs user mic).

REMAINING WORK: user must `npm install` in sttm-desktop in THEIR terminal (agent
egress blocked for electron/realm CDN) to pull onnxruntime-node + rebuild, then
`npm start` to test live mic. Then (d) package + docs + upstream PR to
KhalisFoundation/sttm-desktop. See [[voice-follow-desktop-integration]].
