// Line-level truth for a recited Bani: offline CTC forced alignment of the WHOLE clip
// against the Bani text, in order. Unlike the streaming follower it sees all the audio
// at once and must explain it with the lines in sequence, which is what makes it a
// reliable reference for paath (recitation goes line by line).
//
// Allowed: start anywhere (a clip cut mid-Bani), audio before/after that is not in the
// text (intro, Ardas, applause), and skipping whole lines (Sundar Gutka length
// variants, or a line the reciter omits), and going back up to REPEAT_SPAN lines to
// repeat (sung paath, corrections), each with a penalty. Output per line: start/end seconds and a confidence (mean token log-prob
// over its frames); low-confidence lines are flagged for a listen.
//
//   node align.js <clip> <baniId>    -> truth/<clip>.json
const fs = require('fs');
const { SP } = require('../../www/main/addons/voice-follow/engine/sentencepiece');
const { partialRatio } = require('../../www/main/addons/voice-follow/engine/fuzz');
const VOCAB = require('../../www/main/addons/voice-follow/engine/assets/vocab');
const { spoken } = require('./spoken');

const BLANK = 256;
const C = 257;
const FPS = 25;
const GARBAGE = -1.2; // per-frame score of audio not in the text (closing Salok, Ardas, intros)
const ENTER_MID = -8; // entering the text mid-line (clip starts mid-line)
const LEAVE_MID = -8; // leaving the text mid-line (clip ends mid-line)
// Skipping a line costs in proportion to its length (a spoken line must not be
// skipped just because a few words were misheard); BaniDB header lines (titles,
// "ਸਲੋਕੁ ਮਃ ੧") are often not recited, so they are cheap to skip.
const SKIP_HEADER = -3, SKIP_LINE = -10, SKIP_PER_TOKEN = -4;
// ...but a long jump forward has a fixed cost, so the known skips are possible (the
// 6-pauri Anand Sahib jumping to its last pauri; shorter Sundar Gutka versions).
const SKIP_FAR = -250;
// A misheard syllable costs at most this (robust alignment): accents and mishearings
// must not make skipping a spoken line look cheaper than aligning it.
const TOKEN_FLOOR = -6;
// Blank frames are scaled up: the model calls most frames blank even mid-speech, so an
// unscaled blank lets whole spoken lines be "absorbed" for the small cost of the few
// frames where a syllable spikes. Scaling makes ignoring a confident syllable costly
// while true silence (blank log-prob ~0) stays almost free.
const BLANK_SCALE = 3; // skipping one or more whole lines
const REPEAT = -15; // going back to repeat a line (sung paath, a reciter correcting)
const REPEAT_SPAN = 10; // ...up to this many lines back

// Text as said aloud (spoken.js).
const tokenize = (u) => spoken(u).replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean).join(' ');

function align(clip, baniId) {
  const buf = fs.readFileSync(`cache/${clip}.emis.f32`);
  const lp = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const T = lp.length / C;
  const bani = JSON.parse(fs.readFileSync(`banis/${baniId}.json`));
  const sp = SP.load();
  const lines = bani.verses.map((v) => ({ ...v, text: tokenize(v.unicode) })).filter((v) => v.text);
  // States: per line a CTC block [blank, y1, blank, y2, ..., yU, blank].
  const ext = [], lineOf = [], kOf = [], start = [], end = [], skipCost = [];
  lines.forEach((l, i) => {
    const y = sp.encode(l.text).filter((id) => id !== 0);
    skipCost.push(l.header ? SKIP_HEADER : SKIP_LINE + SKIP_PER_TOKEN * y.length);
    start.push(ext.length);
    ext.push(BLANK); lineOf.push(i); kOf.push(0);
    y.forEach((id, j) => {
      ext.push(id); lineOf.push(i); kOf.push(2 * j + 1);
      ext.push(BLANK); lineOf.push(i); kOf.push(2 * j + 2);
    });
    end.push(ext.length - 1);
  });
  const S = ext.length, L = lines.length;
  const NEG = -1e30;
  let prev = new Float32Array(S).fill(NEG);
  let cur = new Float32Array(S);
  const bp = new Uint8Array(T * S); // 0 stay, 1 s-1, 2 s-2, 3 prev line last token, 4 prev line last blank, 5 skip/repeat (src in skipSrc), 6 enter
  const skipSrc = new Int32Array(T * L).fill(-1); // state jumped from, for code 5
  const pre = new Float32Array(T), post = new Float32Array(T);
  const postFrom = new Int32Array(T).fill(-1); // -1: post stayed; else state left from
  const at = (t, s) => {
    const v = lp[t * C + ext[s]];
    if (ext[s] === BLANK) return v * BLANK_SCALE;
    return v > TOKEN_FLOOR ? v : TOKEN_FLOOR;
  };
  // t = 0
  pre[0] = GARBAGE;
  for (let s = 0; s < S; s++) {
    const entry = kOf[s] <= 1 ? 0 : ENTER_MID;
    prev[s] = entry + at(0, s);
    bp[s] = 6;
  }
  post[0] = NEG;
  for (let t = 1; t < T; t++) {
    // Exit score of each line at t-1, and the best exit among lines < i-1 (for skips).
    const exitScore = new Float32Array(L), exitCode = new Uint8Array(L), exitState = new Int32Array(L);
    for (let i = 0; i < L; i++) {
      const a = prev[end[i] - 1], b = prev[end[i]];
      if (a >= b) { exitScore[i] = a; exitCode[i] = 3; exitState[i] = end[i] - 1; } else { exitScore[i] = b; exitCode[i] = 4; exitState[i] = end[i]; }
    }
    let bestOld = NEG, bestOldState = -1, bestFar = NEG, bestFarState = -1;
    // Best exit among lines i..i+REPEAT_SPAN (repeat: go back to the start of line i).
    const repScore = new Float32Array(L).fill(NEG), repState = new Int32Array(L).fill(-1);
    for (let i = 0; i < L; i++) {
      for (let j = i; j < Math.min(L, i + REPEAT_SPAN + 1); j++) {
        if (exitScore[j] > repScore[i]) { repScore[i] = exitScore[j]; repState[i] = exitState[j]; }
      }
    }
    for (let s = 0; s < S; s++) {
      const k = kOf[s], i = lineOf[s];
      let best = prev[s], code = 0;
      if (k >= 1 && prev[s - 1] > best) { best = prev[s - 1]; code = 1; }
      if (k >= 3 && k % 2 === 1 && ext[s] !== ext[s - 2] && prev[s - 2] > best) { best = prev[s - 2]; code = 2; }
      if (k <= 1) {
        if (k === 0 && i >= 2) {
          // best exit among lines <= i-2, minus the cost of every line skipped in between
          if (exitScore[i - 2] > bestOld) { bestOld = exitScore[i - 2]; bestOldState = exitState[i - 2]; }
          bestOld += skipCost[i - 1];
          if (exitScore[i - 2] > bestFar) { bestFar = exitScore[i - 2]; bestFarState = exitState[i - 2]; }
        }
        if (i >= 1 && exitScore[i - 1] > best) { best = exitScore[i - 1]; code = exitCode[i - 1]; }
        if (bestOldState >= 0 && bestOld > best) { best = bestOld; code = 5; skipSrc[t * L + i] = bestOldState; }
        if (bestFarState >= 0 && bestFar + SKIP_FAR > best) { best = bestFar + SKIP_FAR; code = 5; skipSrc[t * L + i] = bestFarState; }
        if (repState[i] >= 0 && repScore[i] + REPEAT > best) { best = repScore[i] + REPEAT; code = 5; skipSrc[t * L + i] = repState[i]; }
        if (pre[t - 1] > best) { best = pre[t - 1]; code = 6; }
      } else if (pre[t - 1] + ENTER_MID > best) { best = pre[t - 1] + ENTER_MID; code = 6; }
      cur[s] = best + at(t, s);
      bp[t * S + s] = code;
    }
    pre[t] = pre[t - 1] + GARBAGE;
    // post: stay, or leave the text (cleanly from a line end, or mid-line with a penalty)
    let pb = post[t - 1], pf = -1;
    for (let s = 0; s < S; s++) {
      const v = prev[s] + (s === end[lineOf[s]] || s === end[lineOf[s]] - 1 ? 0 : LEAVE_MID);
      if (v > pb) { pb = v; pf = s; }
    }
    post[t] = pb + GARBAGE;
    postFrom[t] = pf;
    [prev, cur] = [cur, prev];
  }
  // Best final state: inside the text (any state) or post.
  let bs = -1, bv = post[T - 1];
  for (let s = 0; s < S; s++) {
    const v = prev[s] + (s === end[lineOf[s]] || s === end[lineOf[s]] - 1 ? 0 : LEAVE_MID);
    if (v > bv) { bv = v; bs = s; }
  }
  // Backtrack: state per frame (-1 = garbage).
  const path = new Int32Array(T).fill(-1);
  let s = bs, inPost = bs < 0;
  for (let t = T - 1; t >= 0; t--) {
    if (inPost) {
      if (postFrom[t] >= 0) { s = postFrom[t]; inPost = false; }
      continue; // frame t is garbage (post)
    }
    path[t] = s;
    if (t === 0) break;
    const code = bp[t * S + s], i = lineOf[s];
    if (code === 0) continue;
    if (code === 1) s -= 1;
    else if (code === 2) s -= 2;
    else if (code === 3) s = end[i - 1] - 1;
    else if (code === 4) s = end[i - 1];
    else if (code === 5) s = skipSrc[t * L + i];
    else if (code === 6) { // came from pre: everything before is garbage
      break;
    }
  }
  if (process.env.DEBUG_PATH) {
    const [d0, d1] = process.env.DEBUG_PATH.split(',').map(Number);
    for (let t = Math.round(d0 * FPS); t < Math.round(d1 * FPS); t += 5) {
      const st = path[t];
      console.log((t / FPS).toFixed(2), st < 0 ? 'garbage' : `line ${lineOf[st]} k ${kOf[st]} tok ${ext[st] === BLANK ? '-' : VOCAB[ext[st]]} lp ${lp[t * C + ext[st]].toFixed(2)} blank ${lp[t * C + BLANK].toFixed(2)}`);
    }
  }
  // Occurrences: each contiguous run of one line's states, timed by its token frames.
  const occ = [];
  let run = null;
  for (let t = 0; t < T; t++) {
    const st = path[t];
    const i = st < 0 ? -1 : lineOf[st];
    // A new run starts when the line changes, or the same line restarts from its top.
    const restart = run && i === run.i && st >= 0 && kOf[st] <= 1 && run.lastK > 1;
    if (!run || i !== run.i || restart) {
      if (run && run.n) occ.push(run);
      run = i < 0 ? null : { i, first: -1, last: -1, sum: 0, n: 0, lastK: 0 };
    }
    if (!run) continue;
    run.lastK = kOf[st];
    if (kOf[st] % 2 === 1) {
      if (run.first < 0) run.first = t;
      run.last = t; run.sum += lp[t * C + ext[st]]; run.n += 1;
    }
  }
  if (run && run.n) occ.push(run);
  // Independent check: what the model plainly heard over the segment vs the line's text.
  const heard = (f0, f1) => {
    let s2 = '', p = -1;
    for (let t = f0; t <= f1; t++) {
      let bi = 0, bv = -1e9;
      for (let c = 0; c < C; c++) { const v = lp[t * C + c]; if (v > bv) { bv = v; bi = c; } }
      if (bi !== p && bi !== BLANK) s2 += VOCAB[bi];
      p = bi;
    }
    return s2.replace(/▁/g, '');
  };
  const squash = (x) => x.replace(/[\s।॥0-9੦-੯]/g, '');
  const segs = occ.map((o) => ({
    i: o.i, verseId: lines[o.i].verseId, text: lines[o.i].unicode,
    start: +(o.first / FPS).toFixed(2), end: +((o.last + 1) / FPS).toFixed(2), conf: +(o.sum / o.n).toFixed(3),
    check: (() => {
      const hd = squash(heard(o.first, o.last)), tx = squash(lines[o.i].text);
      // Match quality, scaled down when far more (or less) was heard than the line has.
      const lenRatio = Math.min(hd.length, tx.length) / Math.max(1, hd.length, tx.length);
      return +((partialRatio(hd, tx) / 100) * Math.min(1, lenRatio / 0.6)).toFixed(2);
    })(),
  }));
  const said = new Set(segs.map((x) => x.i));
  const lo = Math.min(...said), hi = Math.max(...said);
  const skippedInside = [];
  for (let i = lo; i <= hi; i++) if (!said.has(i)) skippedInside.push(i);
  const repeats = segs.filter((x, k) => k > 0 && x.i <= segs[k - 1].i).length;
  return { clip, baniId, frames: T, score: bv, lines: segs, skippedInside, repeats };
}

module.exports = { align };

if (require.main === module) {
  const [clip, bani] = process.argv.slice(2);
  const r = align(clip, Number(bani));
  fs.writeFileSync(`truth/${clip}.json`, JSON.stringify(r, null, 1));
  const low = r.lines.filter((l) => l.check < 0.6).length;
  console.log(clip, 'bani', bani, 'segments', r.lines.length, 'repeats', r.repeats, `(#${r.lines[0]?.i}-#${r.lines[r.lines.length - 1]?.i})`, 'skipped inside', r.skippedInside.length, 'check<0.6', low);
}
