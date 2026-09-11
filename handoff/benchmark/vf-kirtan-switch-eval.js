/* Headless eval for autopilot SHABAD SWITCHING on REAL kirtan.
 *
 * Unlike vf-switch-eval.js (which concatenates clean studio recordings), this
 * streams ONE continuous ~86-minute real kirtan performance (harmonium + tabla +
 * live voice) that already carries ground-truth shabad boundaries: 117 segments /
 * 116 real transitions across 90 distinct shabads. Built by kirtan_bench extraction
 * from models/eval-kirtan-canonical.
 *
 * It replicates the supervisor's acoustic switch logic verbatim and scores
 * initial-lock, switch recall, false switches, and switch latency against the REAL
 * boundaries. The detector scores against ALL 90 shabads' line sets (a realistic
 * distractor field, vs. the 3 in the studio harness).
 *
 * The follower is intentionally NOT run here: the switch decision reads only the
 * recognizer + maxLineScore (as in vf-switch-eval.js), so dropping the follower
 * ~halves inference and makes the 86-min run tractable.
 *
 * Run (node 18):
 *   NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules \
 *   MODEL=/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx \
 *   node vf-kirtan-switch-eval.js [--cap-min 10]
 */
const fs = require('fs');
const path = require('path');

const ENG = '/Users/asingh02/AAI/sttm-desktop/www/main/addons/voice-follow/engine';
const { Infer, norm } = require(path.join(ENG, 'infer'));
const { Recognizer } = require(path.join(ENG, 'recognizer'));
const { partialRatio } = require(path.join(ENG, 'fuzz'));

const BENCH = '/Users/asingh02/aai/kirtan_bench';
// Default = the full 86-min real-kirtan stream; override with WAV=/MANIFEST= for the
// 1-2-line rapid-switch stress dataset (kirtan_stress_*).
const WAV = process.env.WAV || path.join(BENCH, 'kirtan_full_16k.wav');
const MANIFEST = process.env.MANIFEST || path.join(BENCH, 'kirtan_manifest.json');
const MODEL = process.env.MODEL;
const SR = 16000;

// --- supervisor constants (mirror the SHIPPED VoiceFollow.jsx); env-overridable ---
const SEARCH_WIN = parseFloat(process.env.SEARCH_WIN || '10');
const FOLLOW_WIN = parseFloat(process.env.FOLLOW_WIN || '4');
const AP_REC_HOP_S = parseFloat(process.env.REC_HOP || '0.5');
const HYP_SLICE = parseInt(process.env.HYP || '35', 10);
const SWITCH_ACOUSTIC_MIN = parseFloat(process.env.SMIN || '0.65');
const SWITCH_ACOUSTIC_MARGIN = parseFloat(process.env.MARG || '0.15');
const SWITCH_CONFIRM = parseInt(process.env.CONF || '2', 10);
const CAND_MIN = parseFloat(process.env.CAND_MIN || '0'); // proxy for SWITCH_CAND_MIN_VOTES gate
const MIN_DWELL_S = parseFloat(process.env.DWELL || '0'); // block a new switch within N s of the last one (anti-flap)
const OPEN_LINES = parseInt(process.env.OPEN_LINES || '0', 10); // score candidate vs its first K lines only (0 = all)
// SWITCH_MODE=count (consecutive winning decodes) | cusum (score-weighted accumulator).
// cusum locks fast on a SUSTAINED strong switch (big margin) but decays on brief spikes,
// aiming for low latency on real switches AND low erroneous-jump rate — without count's
// blunt latency tax. Increment when winning = (contS-SMIN)+(margin-MARG); leak CUSUM_DECAY
// otherwise; commit at CUSUM_THRESH; reset on candidate-id change.
const SWITCH_MODE = process.env.SWITCH_MODE || 'count';
const CUSUM_THRESH = parseFloat(process.env.CTHRESH || '1.0');
const CUSUM_DECAY = parseFloat(process.env.CDECAY || '0.5');
// First-letter gate (proxy for the app's SWITCH_CAND_MIN_VOTES banidb vote gate):
// a candidate must share a first-letter run of >= FL_MIN with the heard audio to be
// eligible for the acoustic switch test. FL_GATE=1 turns it on.
const FL_GATE = parseInt(process.env.FL_GATE || '0', 10);
const FL_MIN = parseInt(process.env.FL_MIN || '4', 10);
const FL_WIN = parseInt(process.env.FL_WIN || '8', 10); // last N heard first-letters to match
// Two-signal (cross-modal) commit: when the first-letter proposer STRONGLY identifies the
// candidate (LCS of heard first-letters vs candidate opening >= FL_STRONG), LOWER the
// acoustic bar to SMIN_STRONG/MARG_STRONG. Mirrors VoiceFollow.jsx's fused/tiered gate:
// trust the shape-recognizer (votes) where the acoustic word-reader is weak on kirtan.
// FL_STRONG=0 disables (pure acoustic baseline behavior).
const FL_STRONG = parseInt(process.env.FL_STRONG || '0', 10);
const SMIN_STRONG = parseFloat(process.env.SMIN_STRONG || '0.50');
const MARG_STRONG = parseFloat(process.env.MARG_STRONG || '0.10');
// Scoring mode:
//   'line' = max partialRatio over individual lines (current app behavior) — a single
//            shared line scores 1.00 regardless of how much of the recent audio it
//            explains, which is the false-positive mechanism.
//   'cov'  = coverage: partialRatio of the WHOLE recent window against the shabad's
//            full concatenated text — the entire recent audio must be explained by a
//            contiguous stretch of that shabad. Kills single-line-overlap FPs.
const SCORE_MODE = process.env.SCORE_MODE || 'line';
const LOCK_MIN = parseFloat(process.env.LOCK_MIN || '0.6'); // initial-lock acoustic floor
const LOCK_STABLE = parseInt(process.env.LOCK_STABLE || '2', 10);
const SEARCH_OPTS = { inputSr: SR, hopS: AP_REC_HOP_S, windowS: SEARCH_WIN };
const FOLLOW_OPTS = { inputSr: SR, hopS: AP_REC_HOP_S, windowS: FOLLOW_WIN };

// LEN_MIN (chars): length-aware containment penalty. A short line matched as a
// substring of a longer hyp (partialRatio is asymmetric — it rewards containment)
// is the dominant source of spurious ERRONEOUS switches (a 1-line shabad hits ~1.0
// on a fragment of unrelated audio). When LEN_MIN>0 each line's score is scaled by
// min(1, lineLen/LEN_MIN), so a short line needs a proportionally higher raw match
// to win. 0 = off (original behavior).
const LEN_MIN = parseFloat(process.env.LEN_MIN || '0');
function maxLineScore(hypNorm, linesNorm) {
  if (!hypNorm || !linesNorm || !linesNorm.length) return 0;
  let best = 0;
  for (const ln of linesNorm) {
    if (ln) {
      let s = partialRatio(hypNorm, ln) / 100;
      if (LEN_MIN > 0) s *= Math.min(1, ln.length / LEN_MIN);
      if (s > best) best = s;
    }
  }
  return best;
}

function readWavFloat32(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = Math.floor(sz / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + sz + (sz & 1);
  }
  throw new Error(`no data chunk in ${file}`);
}

async function main() {
  const args = process.argv.slice(2);
  const capIdx = args.indexOf('--cap-min');
  const capMin = capIdx >= 0 ? parseFloat(args[capIdx + 1]) : null;

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  // distinct shabads -> normalized line sets (the detector's scoreable field)
  const linesNormBySid = {};
  const openLinesBySid = {}; // candidate scored against its opening lines (a new shabad is entered at its start)
  const concatBySid = {}; // whole-shabad text for coverage scoring
  for (const [sid, lines] of Object.entries(manifest.lines)) {
    const ln = lines.map((l) => norm(l)).filter(Boolean);
    linesNormBySid[sid] = ln;
    openLinesBySid[sid] = OPEN_LINES > 0 ? ln.slice(0, OPEN_LINES) : ln;
    concatBySid[sid] = ln.join(' ');
  }
  const allSids = Object.keys(linesNormBySid);
  // Unified score: 'cov' explains the whole recent window; 'line' matches any one line.
  const scoreSid = (hypNorm, sid, opening) => {
    if (SCORE_MODE === 'cov') return partialRatio(hypNorm, concatBySid[sid]) / 100;
    return maxLineScore(hypNorm, opening ? openLinesBySid[sid] : linesNormBySid[sid]);
  };

  // First-letter gate — a HARNESS PROXY for the app's SWITCH_CAND_MIN_VOTES first-letter
  // vote gate (banidb first-letter search). A candidate is only allowed to be acoustically
  // tested if the heard first-letter run also matches its opening first-letters. Built from
  // the SAME normalized text on both sides, so it's self-consistent without banidb.
  // NOTE: norm() strips spaces, so first-letters MUST come from RAW (spaced) text on
  // both sides — recognizer rout.text and the raw manifest lines. (The old code built
  // these from the normalized text, yielding a single char, which silently disabled the
  // whole first-letter proxy.)
  const firstLetters = (s) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).join('');
  const flBySid = {};
  for (const sid of allSids) {
    const rawLines = manifest.lines[sid];
    const rawOpen = OPEN_LINES > 0 ? rawLines.slice(0, OPEN_LINES) : rawLines;
    flBySid[sid] = firstLetters(rawOpen.join(' '));
  }
  // longest common substring length between two strings (bounded, cheap)
  const lcs = (a, b) => {
    if (!a || !b) return 0;
    let best = 0;
    const dp = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      let prev = 0;
      for (let j = 1; j <= b.length; j++) {
        const t = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
        if (dp[j] > best) best = dp[j];
        prev = t;
      }
    }
    return best;
  };
  // eligible if the heard first-letters share a run of >= FL_MIN with the candidate's opening
  const flEligible = (rawHyp, sid) => {
    if (!FL_GATE) return true;
    const hfl = firstLetters(rawHyp).slice(-FL_WIN);
    return lcs(hfl, flBySid[sid]) >= FL_MIN;
  };

  let total = readWavFloat32(WAV);
  if (capMin) total = total.slice(0, Math.floor(capMin * 60 * SR));
  const durS = total.length / SR;

  // truth boundaries within the (possibly capped) window
  const truth = manifest.segments
    .filter((s) => s.start < durS)
    .map((s) => ({ id: s.shabadId, start: s.start, end: Math.min(s.end, durS) }));
  console.log(`kirtan stream: dur=${(durS / 60).toFixed(1)}min  shabads=${allSids.length}  segments=${truth.length}  boundaries=${truth.length - 1}`);

  const infer = await Infer.create(MODEL);
  let rec = new Recognizer(infer, SEARCH_OPTS);

  let phase = 'searching';
  let curId = null;
  let lockCand = null;
  let lockCount = 0;
  let switchCand = null; // { id, wins }
  let lastCommitT = -1e9; // time of the last switch commit (for MIN_DWELL_S anti-flap)
  const events = []; // { t, from, to, sCur, sCand }
  const contLog = []; // per following-hop { t, hfl } — feeds the lock-in (#3) meter

  const CHUNK = Math.floor(0.1 * SR);
  const t0 = Date.now();
  for (let p = 0; p < total.length; p += CHUNK) {
    const chunk = total.slice(p, p + CHUNK);
    const tNow = (p + chunk.length) / SR;
    const rout = await rec.push(chunk);
    if (rout && rout.text) {
      const hypNorm = norm(rout.text).slice(-HYP_SLICE);
      const rawHyp = rout.text; // spaced — used for first-letter (proposer) matching
      const scoreOf = (sid) => scoreSid(hypNorm, sid, false);
      if (phase === 'searching') {
        let bestId = null;
        let bestS = -1;
        for (const sid of allSids) {
          const s = scoreOf(sid);
          if (s > bestS) {
            bestS = s;
            bestId = sid;
          }
        }
        if (bestS >= LOCK_MIN) {
          if (bestId === lockCand) lockCount += 1;
          else {
            lockCand = bestId;
            lockCount = 1;
          }
          if (lockCount >= LOCK_STABLE) {
            curId = bestId;
            phase = 'following';
            events.push({ t: tNow, from: null, to: curId });
            lockCand = null;
            lockCount = 0;
            switchCand = null;
            lastCommitT = tNow;
            rec = new Recognizer(infer, FOLLOW_OPTS);
          }
        }
      } else {
        // Candidate scored against its OPENING lines (a new shabad is entered at
        // its start); current shabad scored across all its lines.
        let contId = null;
        let contS = -1;
        for (const sid of allSids) {
          if (sid === curId) continue; // eslint-disable-line no-continue
          if (!flEligible(rawHyp, sid)) continue; // first-letter proposer gate
          const s = scoreSid(hypNorm, sid, true);
          if (s > contS) {
            contS = s;
            contId = sid;
          }
        }
        if (contId === null) continue; // no first-letter-eligible candidate this hop
        const sCur = scoreOf(curId);
        const margin = contS - sCur;
        // Two-signal tier: a strong start-anchored first-letter match on the contender
        // relaxes the acoustic bar (shape-recognizer corroborates the weak word-reader).
        const hfl = firstLetters(rawHyp).slice(-FL_WIN);
        contLog.push({ t: tNow, hfl });
        const strong = FL_STRONG > 0 && lcs(hfl, flBySid[contId]) >= FL_STRONG;
        const smin = strong ? SMIN_STRONG : SWITCH_ACOUSTIC_MIN;
        const marg = strong ? MARG_STRONG : SWITCH_ACOUSTIC_MARGIN;
        const winning = contS >= CAND_MIN && contS >= smin && margin >= marg;
        if (!switchCand || switchCand.id !== contId) switchCand = { id: contId, wins: 0, acc: 0 };
        let commit;
        if (SWITCH_MODE === 'cusum') {
          // Score-weighted: strong sustained evidence crosses fast; brief spikes leak away.
          if (winning) {
            switchCand.acc += (contS - smin) + (margin - marg);
          } else {
            switchCand.acc = Math.max(0, switchCand.acc - CUSUM_DECAY);
          }
          commit = switchCand.acc >= CUSUM_THRESH;
        } else {
          switchCand.wins = winning ? switchCand.wins + 1 : Math.max(0, switchCand.wins - 1);
          commit = switchCand.wins >= SWITCH_CONFIRM;
        }
        // Anti-flap: don't commit another switch within MIN_DWELL_S of the last one.
        const dwellOk = tNow - lastCommitT >= MIN_DWELL_S;
        if (commit && dwellOk) {
          events.push({ t: tNow, from: curId, to: contId, sCur, sCand: contS });
          curId = contId;
          switchCand = null;
          lastCommitT = tNow;
          rec = new Recognizer(infer, FOLLOW_OPTS);
        }
      }
    }
    if (p % (CHUNK * 3000) === 0 && p > 0) {
      const pct = ((100 * p) / total.length).toFixed(0);
      process.stderr.write(`  ...${pct}% (${(tNow / 60).toFixed(1)}min audio, ${((Date.now() - t0) / 1000).toFixed(0)}s wall)\n`);
    }
  }

  // --- score ---
  // Real switch is any boundary where the shabad id changes vs. the previous segment.
  const realBoundaries = [];
  for (let i = 1; i < truth.length; i++) {
    if (truth[i].id !== truth[i - 1].id) realBoundaries.push(truth[i]);
  }
  const lock = events[0];
  const lockOk = lock && lock.to === truth[0].id;

  let recall = 0;
  const latencies = [];
  for (const b of realBoundaries) {
    const winStart = b.start;
    const winEnd = b.end + 1.0;
    const ev = events.find((e) => e.from && e.to === b.id && e.t >= winStart - 0.5 && e.t <= winEnd);
    if (ev) {
      recall += 1;
      latencies.push(ev.t - winStart);
    }
  }

  // --- LOCK-IN meter (#3 "does it lock on?"): among real switches the PROPOSER surfaced
  // (heard first-letters match the target's opening first-letters >= FL_MIN at some hop
  // in the segment), how many actually COMMITTED, and how long after they were first
  // found? never-locked = found-but-stuck = the user's "finds it, won't lock in".
  let lockProposed = 0;
  let lockCommitted = 0;
  const lockLat = [];
  for (const b of realBoundaries) {
    const winStart = b.start - 0.5;
    const winEnd = b.end + 1.0;
    const propHop = contLog.find(
      (h) => h.t >= winStart && h.t <= winEnd && lcs(h.hfl, flBySid[b.id]) >= FL_MIN,
    );
    if (!propHop) continue; // proposer never found it — a detection gap, not a lock-in failure
    lockProposed += 1;
    const ev = events.find((e) => e.from && e.to === b.id && e.t >= winStart && e.t <= winEnd);
    if (ev) {
      lockCommitted += 1;
      lockLat.push(Math.max(0, ev.t - propHop.t));
    }
  }
  const neverLocked = lockProposed - lockCommitted;

  const nowPlaying = (t) => {
    const s = truth.find((x) => t >= x.start && t <= x.end + 0.5);
    return s ? s.id : null;
  };
  const falseSwitches = events.filter((e) => e.from && e.to !== nowPlaying(e.t)).length;
  const nSwitchEvents = events.filter((e) => e.from).length;

  // --- PRIMARY UX METRIC: what fraction of playback time the projector shows the
  // right shabad. This is what the sangat actually experiences — a 1s flicker to a
  // wrong shabad and a 20s wrong display are NOT the same, and switch-count hides
  // that. Build the "believed" shabad timeline from commits and integrate against
  // truth. (Small step integration; exact enough at 0.1s resolution.)
  const believedAt = (t) => {
    let b = null;
    for (const e of events) {
      if (e.t <= t) b = e.to;
      else break;
    }
    return b; // null while still searching (before first lock)
  };
  // Which truth segment is playing at t, and the id of the segment right before it.
  const segAt = (t) => {
    for (let i = 0; i < truth.length; i++) {
      if (t >= truth[i].start && t <= truth[i].end + 0.5) return i;
    }
    return -1;
  };
  const STEP = 0.2;
  let tCorrect = 0;
  let tStale = 0; // showing the PREVIOUS shabad — a graceful late switch (tolerable)
  let tErr = 0; // showing some OTHER shabad — a jarring wrong jump (the thing to avoid)
  let tSearch = 0;
  for (let t = 0; t < durS; t += STEP) {
    const si = segAt(t);
    if (si < 0) continue; // inter-segment gap — ignore
    const curTruth = truth[si].id;
    const prevTruth = si > 0 ? truth[si - 1].id : null;
    const bel = believedAt(t);
    if (bel == null) tSearch += STEP;
    else if (bel === curTruth) tCorrect += STEP;
    else if (bel === prevTruth) tStale += STEP;
    else tErr += STEP;
  }
  const tTotal = tCorrect + tStale + tErr + tSearch || 1;

  console.log('\nfirst 25 switch events (t, from->to [cand vs cur, margin], * = false):');
  events
    .filter((e) => e.from)
    .slice(0, 25)
    .forEach((e) => {
      const bad = e.to !== nowPlaying(e.t) ? ' *' : '';
      console.log(
        `  ${e.t.toFixed(1)}s  ${e.from} -> ${e.to}   [cand ${e.sCand.toFixed(2)} vs cur ${e.sCur.toFixed(2)}, margin ${(e.sCand - e.sCur).toFixed(2)}]${bad}`,
      );
    });

  console.log('\n=== metrics (REAL kirtan) ===');
  console.log(
    `TIME ON CORRECT:  ${((100 * tCorrect) / tTotal).toFixed(1)}%  <- primary UX`,
  );
  console.log(
    `  stale (late):   ${((100 * tStale) / tTotal).toFixed(1)}%   (showing prev shabad — graceful, tolerable)`,
  );
  console.log(
    `  ERRONEOUS:      ${((100 * tErr) / tTotal).toFixed(1)}%   (jarring wrong jump — the thing to avoid)`,
  );
  console.log(
    `  searching:      ${((100 * tSearch) / tTotal).toFixed(1)}%`,
  );
  console.log(`initial lock:     ${lockOk ? 'OK' : 'WRONG/none'} (${lock ? lock.to : '-'} @ ${lock ? lock.t.toFixed(1) : '-'}s, truth ${truth[0].id})`);
  console.log(`real boundaries:  ${realBoundaries.length}`);
  console.log(`switch recall:    ${recall}/${realBoundaries.length}` + (realBoundaries.length ? ` (${Math.round((100 * recall) / realBoundaries.length)}%)` : ''));
  console.log(`switch events:    ${nSwitchEvents}  (false: ${falseSwitches})`);
  console.log(`LOCK-IN (#3):     ${lockCommitted}/${lockProposed}` + (lockProposed ? ` (${Math.round((100 * lockCommitted) / lockProposed)}%)` : '') + `  never-locked: ${neverLocked}  (found-but-stuck)`);
  if (lockLat.length) {
    const avg = lockLat.reduce((a, b) => a + b, 0) / lockLat.length;
    const med = lockLat.slice().sort((a, b) => a - b)[Math.floor(lockLat.length / 2)];
    console.log(`lock-in latency:  avg ${avg.toFixed(1)}s  median ${med.toFixed(1)}s  (found -> committed)`);
  }
  if (latencies.length) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const med = latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length / 2)];
    console.log(`switch latency:   avg ${avg.toFixed(1)}s  median ${med.toFixed(1)}s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
