// Replays a follower over cached streaming windows (precompute.js) and scores it
// against line truth (align.js). The follower gets every line of the Bani, as in the
// app's Sundar Gutka view, and sees exactly the windows it would see live (4 s, every
// 0.25 s); the model is replaced by the cached transcript of each window.
//
// Metrics (over the span the reciter is in the Bani):
//   accuracy   share of seconds the displayed line is the line being recited
//   within1s   the same, but during the first second of each line the previous line
//              still counts as right (a human sevadaar needs at least that long)
//   wrongShown share of seconds showing a line that is neither the current line nor
//              the one just finished (a real error, not lag)
//   lagMedian / lagP90  seconds from a line starting to it being displayed
//   missed     lines never displayed while they were being recited (+2 s)
//   firstLock  seconds from the first recited line to the first display
//   steady*    the same as within1s / wrongShown, leaving out the first STARTUP_S of
//              each clip (start-up is reported by firstLock instead)
//   verified   share of truth time that is independently confirmed: a truth segment
//              counts only if a streaming window around it heard that line's text
//              (match >= VERIFY_MIN). Unconfirmed time is left out of every metric.
const fs = require('fs');
const { partialRatio } = require('../../www/main/addons/voice-follow/engine/fuzz');
const { spoken } = require('./spoken');

const HOP = 0.25;
const VERIFY_MIN = 0.6;
const STARTUP_S = 5;
// Hand-checked ranges where the truth is not Bani or is wrong: not scored.
const OVERRIDES = JSON.parse(fs.readFileSync(`${__dirname}/truth-overrides.json`));
const squash = (x) => spoken(x).replace(/[\s।॥0-9੦-੯]/g, '');

// Truth segments confirmed by the windows that heard them, around their start.
function verify(truth, hyps, hop = HOP) {
  return truth.lines.map((s) => {
    const line = squash(s.text);
    let best = 0;
    // Near the start: a segment stretched over other speech must not pass because its
    // line is heard at the end.
    for (let t = s.start + 0.75; t <= Math.min(s.end, s.start + 4) + 1.0; t += hop) {
      const k = Math.round((t - 1) / hop);
      if (k < 0 || k >= hyps.length) continue;
      const h = squash(hyps[k]);
      if (h.length >= 3) best = Math.max(best, partialRatio(h, line) / 100);
    }
    return best >= VERIFY_MIN;
  });
}

class CachedInfer {
  constructor(hyps) { this.hyps = hyps; this.i = -1; }
  async emissions() { this.i += 1; return { data: new Float32Array(0), frames: 0, C: 257, i: this.i }; }
  greedy() { return []; }
  decode() { return this.hyps[this.i] || ''; }
}

const tokenize = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);

async function replay(clip, baniId, makeFollower) {
  // HOP env: replay the windows cached at that listening rate (precompute.js HOP=...).
  const tag = process.env.HOP && Number(process.env.HOP) !== 0.25 ? `.hop${Number(process.env.HOP)}` : '';
  const cache = JSON.parse(fs.readFileSync(`cache/${clip}${tag}.hyps.json`));
  const hop = cache.hop || HOP;
  const truth = JSON.parse(fs.readFileSync(`truth/${clip}.json`));
  const bani = JSON.parse(fs.readFileSync(`banis/${baniId}.json`));
  const verses = bani.verses.filter((v) => tokenize(v.unicode).length);
  const lines = verses.map((v) => ({ verseId: v.verseId, words: tokenize(v.unicode), text: v.unicode }));
  const infer = new CachedInfer(cache.hyps);
  const f = makeFollower(infer, lines, { baniId, hop });
  const chunk = new Float32Array(Math.round(16000 * hop));
  const shown = []; // [{t, verseId}]
  let cur = null;
  const pre = Math.round(1 / hop) - 1; // pushes that only fill the 1 s minimum
  const n = cache.hyps.length + pre;
  for (let k = 0; k < n; k++) {
    const t = (k + 1) * hop;
    const out = await f.push(chunk);
    const v = out ? (out.verseId === undefined ? null : out.verseId) : undefined;
    if (v !== undefined && v !== cur) {
      cur = v;
      shown.push({ t, verseId: v });
    }
  }
  // Truth confirmation always uses the standard 0.25 s windows, so rates compare fairly.
  const std = tag ? JSON.parse(fs.readFileSync(`cache/${clip}.hyps.json`)).hyps : cache.hyps;
  return score(truth, shown, verses, verify(truth, std), OVERRIDES[clip]);
}

function score(truth, shown, verses, ok, override) {
  const skip = override && Array.isArray(override[0]) ? override[0] : null;
  const idx = new Map(verses.map((v, i) => [v.verseId, i]));
  const L = truth.lines.map((l, k) => ({ ...l, ok: ok ? ok[k] : true })).filter((l) => idx.has(l.verseId));
  const t0 = L[0].start, t1 = L[L.length - 1].end;
  const step = 0.05;
  let total = 0, right = 0, wrong = 0, none = 0, tolerant = 0, all = 0;
  let sTotal = 0, sTol = 0, sWrong = 0;
  let segTotal = 0, segTol = 0, segWrong = 0; // inside segments only (pauses between lines excluded)
  let si = -1, li = 0;
  for (let t = t0; t < t1; t += step) {
    while (li + 1 < L.length && L[li + 1].start <= t) li++;
    while (si + 1 < shown.length && shown[si + 1].t <= t) si++;
    const disp = si >= 0 ? shown[si].verseId : null;
    all++;
    if (!L[li].ok) continue; // not independently confirmed: not scored
    if (skip && t >= skip[0] && t < skip[1]) continue; // hand-checked: not Bani / truth wrong
    total++;
    const steady = t - t0 >= STARTUP_S;
    if (steady) sTotal++;
    const inSeg = t < L[li].end;
    if (steady && inSeg) segTotal++;
    if (disp == null) { none++; continue; }
    let ok = false;
    if (disp === L[li].verseId) { right++; ok = true; } else if (li > 0 && disp === L[li - 1].verseId) {
      if (t - L[li].start < 1.0) ok = true;
    } else { wrong++; if (steady) sWrong++; if (steady && inSeg) segWrong++; }
    if (ok) { tolerant++; if (steady) sTol++; if (steady && inSeg) segTol++; }
  }
  // Per-line lag: first time the line is shown at or after its start (before the next+2 s).
  const lags = [];
  let missed = 0;
  L.forEach((l, i) => {
    if (!l.ok) return;
    const until = (L[i + 1] ? L[i + 1].start : l.end) + 2;
    const hit = shown.find((s) => s.verseId === l.verseId && s.t >= l.start - 1 && s.t <= until);
    if (hit) lags.push(Math.max(0, hit.t - l.start));
    else missed++;
  });
  lags.sort((a, b) => a - b);
  const q = (p) => (lags.length ? +lags[Math.min(lags.length - 1, Math.floor(p * lags.length))].toFixed(2) : null);
  const first = shown.find((s) => s.verseId != null && s.t >= t0);
  return {
    lines: L.filter((l) => l.ok).length,
    verified: +(total / Math.max(1, all)).toFixed(4),
    accuracy: +(right / total).toFixed(4),
    within1s: +(tolerant / total).toFixed(4),
    wrongShown: +(wrong / total).toFixed(4),
    steadyWithin1s: +(sTol / Math.max(1, sTotal)).toFixed(4),
    steadyWrong: +(sWrong / Math.max(1, sTotal)).toFixed(4),
    steadyLines: sTotal,
    segWithin1s: +(segTol / Math.max(1, segTotal)).toFixed(4),
    segWrong: +(segWrong / Math.max(1, segTotal)).toFixed(4),
    segTime: segTotal,
    lags,
    noneShown: +(none / total).toFixed(4),
    lagMedian: q(0.5), lagP90: q(0.9),
    missed,
    firstLock: first ? +(first.t - t0).toFixed(2) : null,
    moves: shown.length,
  };
}

module.exports = { replay, score, CachedInfer };
