// Shabad verifier (Akhand Kirtan): how well does a whole Shabad explain the last ~30 s of audio?
//
// The speech model is poor at picking one Shabad out of the whole Guru Granth Sahib from a few
// seconds, but good at confirming a given one: told the Shabad, it clearly hears most of its
// pangtis. So, while searching, the candidates the text search keeps proposing are each
// force-aligned over the last ~30 s (pangtis in order, repeats allowed, unsung audio as
// garbage), and the best fit wins when it leads clearly. Offline on GAB-Akhand (practice, 280
// windows of 30 s): the right Shabad fit best in 79% of windows against the app's own search
// candidates, and in half of the windows where 9.0.3 was still searching it led by > 40.
//
// No new model passes: the evidence is stitched from the recognizer's own 10 s decode windows
// (one every ~10 s of history), so the verifier costs only the alignment arithmetic.
// Port of research/follower-bench/align.js (score only, no backtracking).
const { spoken } = require('./spoken');

const BLANK = 256;
const GARBAGE = -1.2; // per frame of audio not in the text
const ENTER_MID = -8; // entering the text mid-pangti
const LEAVE_MID = -8; // leaving it mid-pangti
const SKIP_LINE = -10;
const SKIP_PER_TOKEN = -4;
const SKIP_FAR = -250;
const TOKEN_FLOOR = -6;
const BLANK_SCALE = 3;
const REPEAT = -15;
const REPEAT_SPAN = 10;

// Gurmukhi pangti -> the model's token ids (sp: the app's SentencePiece, as the acoustic check uses)
function pangtiTokens(sp, text) {
  const said = spoken(text)
    .replace(/[।॥|0-9੦-੯.,;:!?-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return said ? sp.encode(said).filter((id) => id !== 0) : [];
}

// emis: {data, frames, C}; lines: token-id arrays in Shabad order -> best total log-score
function shabadFit(emis, lines) {
  const { data: lp, frames: T, C } = emis;
  const ext = [];
  const lineOf = [];
  const kOf = [];
  const end = [];
  const skipCost = [];
  lines.forEach((y) => {
    if (!y.length) return;
    skipCost.push(SKIP_LINE + SKIP_PER_TOKEN * y.length);
    ext.push(BLANK);
    lineOf.push(skipCost.length - 1);
    kOf.push(0);
    y.forEach((id, j) => {
      ext.push(id, BLANK);
      lineOf.push(skipCost.length - 1, skipCost.length - 1);
      kOf.push(2 * j + 1, 2 * j + 2);
    });
    end.push(ext.length - 1);
  });
  const S = ext.length;
  const L = end.length;
  if (!S || T < 2) return -Infinity;
  const NEG = -1e30;
  let prev = new Float64Array(S);
  let cur = new Float64Array(S);
  const at = (t, s) => {
    const v = lp[t * C + ext[s]];
    if (ext[s] === BLANK) return v * BLANK_SCALE;
    return v > TOKEN_FLOOR ? v : TOKEN_FLOOR;
  };
  let pre = GARBAGE;
  let post = NEG;
  for (let s = 0; s < S; s++) prev[s] = (kOf[s] <= 1 ? 0 : ENTER_MID) + at(0, s);
  const exitScore = new Float64Array(L);
  const repScore = new Float64Array(L);
  for (let t = 1; t < T; t++) {
    for (let i = 0; i < L; i++) exitScore[i] = Math.max(prev[end[i] - 1], prev[end[i]]);
    for (let i = 0; i < L; i++) {
      let m = NEG;
      for (let j = i; j < Math.min(L, i + REPEAT_SPAN + 1); j++)
        if (exitScore[j] > m) m = exitScore[j];
      repScore[i] = m;
    }
    let bestOld = NEG;
    let bestFar = NEG;
    for (let s = 0; s < S; s++) {
      const k = kOf[s];
      const i = lineOf[s];
      let best = prev[s];
      if (k >= 1 && prev[s - 1] > best) best = prev[s - 1];
      if (k >= 3 && k % 2 === 1 && ext[s] !== ext[s - 2] && prev[s - 2] > best) best = prev[s - 2];
      if (k <= 1) {
        if (k === 0 && i >= 2) {
          bestOld = Math.max(bestOld, exitScore[i - 2]) + skipCost[i - 1];
          bestFar = Math.max(bestFar, exitScore[i - 2]);
        }
        if (i >= 1 && exitScore[i - 1] > best) best = exitScore[i - 1];
        if (bestOld > best) best = bestOld;
        if (bestFar + SKIP_FAR > best) best = bestFar + SKIP_FAR;
        if (repScore[i] + REPEAT > best) best = repScore[i] + REPEAT;
        if (pre > best) best = pre;
      } else if (pre + ENTER_MID > best) best = pre + ENTER_MID;
      cur[s] = best + at(t, s);
    }
    let pb = post;
    for (let s = 0; s < S; s++) {
      const isEnd = s === end[lineOf[s]] || s === end[lineOf[s]] - 1;
      const v = prev[s] + (isEnd ? 0 : LEAVE_MID);
      if (v > pb) pb = v;
    }
    post = pb + GARBAGE;
    pre += GARBAGE;
    [prev, cur] = [cur, prev];
  }
  let bv = post;
  for (let s = 0; s < S; s++) {
    const isEnd = s === end[lineOf[s]] || s === end[lineOf[s]] - 1;
    const v = prev[s] + (isEnd ? 0 : LEAVE_MID);
    if (v > bv) bv = v;
  }
  return bv;
}

// Recognizer pass history -> one emission matrix over the last `spanS` seconds, built from
// non-overlapping 10 s passes (newest first, each ending ~10 s before the previous one began).
// history: [{ end: samples pushed when the pass ran, len: window samples, emis }]
function stitch(history, { spanS = 30, sr = 16000, fps = 25 } = {}) {
  if (!history.length) return null;
  const picked = [];
  const used = new Set();
  const newest = history[history.length - 1].end;
  let edge = newest;
  // walk back: each step takes the pass whose end is nearest the start of the one after it. The
  // recognizer keeps at most one pass per second for older audio, so a gap or overlap of up to
  // 1.5 s is accepted (a second of doubled or missing frames barely moves a 30 s fit).
  const nearest = (at) => {
    let best = null;
    let bd = Infinity;
    history.forEach((h) => {
      const d = Math.abs(h.end - at);
      if (!used.has(h) && d <= 1.5 * sr && d < bd) {
        best = h;
        bd = d;
      }
    });
    return best;
  };
  while (picked.length < Math.ceil(spanS / 10) + 1) {
    const best = nearest(edge);
    if (!best) break;
    used.add(best);
    picked.unshift(best);
    edge = best.end - best.len;
    if ((newest - edge) / sr >= spanS) break;
  }
  if (!picked.length) return null;
  const { C } = picked[0].emis;
  const frames = picked.reduce((a, h) => a + h.emis.frames, 0);
  const data = new Float32Array(frames * C);
  let o = 0;
  picked.forEach((h) => {
    data.set(h.emis.data.subarray(0, h.emis.frames * C), o);
    o += h.emis.frames * C;
  });
  return { data, frames, C, seconds: frames / fps };
}

module.exports = { shabadFit, stitch, pangtiTokens, BLANK };
