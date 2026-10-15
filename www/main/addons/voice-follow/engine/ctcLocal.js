// Local CTC pangti scoring (Akhand Kirtan round 1, idea 4).
//
// The search-phase acoustic check scores a candidate line with the follower's _ctcScore: the
// CTC forward log-likelihood of the WHOLE line, aligned from the first frame of the window. In
// kirtan the window rarely holds exactly one line from its start: it holds the end of one
// phrase, a repeat, the start of the next. A whole-window alignment then spends most of its
// score explaining frames that are not the line at all, and many-voice audio (Akhand Kirtan,
// GAB-Akhand) makes that worse.
//
// localCtcScore finds the best place in the window where a contiguous run of the line's tokens
// is sung, and scores only that stretch (keyword spotting, Viterbi):
//   * each frame's cost is its log-prob for the path's symbol MINUS the frame's best log-prob
//     (<= 0: a frame the model is sure of costs nothing when the path agrees with it);
//   * entering each new token earns `reward` nats;
//   * the path may start at any frame and any token, and end anywhere; frames outside it are
//     free (they belong to other audio).
// So the score is roughly reward x tokens heard, minus how much the audio disagrees with them.
// A line that is not being sung cannot extend its path without paying for it, and stays near 0.
// Cost: O(frames x (2 x tokens + 1)) per line, the same order as _ctcScore.
const BLANK = 256;
const NEG = -1e30;

// Per-frame best log-prob, computed once per window and shared by every line scored on it.
function frameMax(emis, t0 = 0, t1 = emis.frames) {
  const { data, C } = emis;
  const out = new Float64Array(Math.max(0, t1 - t0));
  for (let t = t0; t < t1; t += 1) {
    let m = -Infinity;
    const off = t * C;
    for (let c = 0; c < C; c += 1) if (data[off + c] > m) m = data[off + c];
    out[t - t0] = m;
  }
  return out;
}

// emis: { data, frames, C } (log-probs, blank = BLANK). tokens: SentencePiece ids of the line.
// opts: { t0, t1, reward, maxFrames (cap on frames in the matched stretch, 0 = none), fmax }.
// Returns { score, tokens: number of the line's tokens in the best stretch, from, to (token
// range [from, to)), start, end (frame range [start, end)) }; score 0 and tokens 0 when nothing
// in the window earns more than it costs.
function localCtcScore(emis, tokens, opts = {}) {
  const { data, C } = emis;
  const t0 = opts.t0 || 0;
  const t1 = opts.t1 == null ? emis.frames : opts.t1;
  const reward = opts.reward == null ? 2 : opts.reward;
  const U = tokens ? tokens.length : 0;
  const none = { score: 0, tokens: 0, from: 0, to: 0, start: t0, end: t0 };
  if (!U || t1 <= t0) return none;
  const fmax = opts.fmax || frameMax(emis, t0, t1);
  const S = 2 * U + 1;
  const ext = new Int32Array(S).fill(BLANK);
  for (let i = 0; i < U; i += 1) ext[2 * i + 1] = tokens[i];
  // A skip over a blank (s-2 -> s) is allowed between two DIFFERENT tokens only.
  const skip = new Uint8Array(S);
  for (let s = 2; s < S; s += 1) skip[s] = ext[s] !== BLANK && ext[s] !== ext[s - 2] ? 1 : 0;
  let v = new Float64Array(S).fill(NEG);
  let nv = new Float64Array(S);
  let st = new Int32Array(S); // token index the path started at
  let nst = new Int32Array(S);
  let sf = new Int32Array(S); // frame the path started at
  let nsf = new Int32Array(S);
  let best = 0;
  let bestS = -1;
  let bestStart = 0;
  let bestFrom = 0;
  let bestEnd = t0;
  for (let t = t0; t < t1; t += 1) {
    const base = t * C;
    const m = fmax[t - t0];
    for (let s = 0; s < S; s += 1) {
      const cost = data[base + ext[s]] - m;
      const tok = s % 2 === 1; // odd states are tokens
      // Start fresh here: at a token (earns its reward) or at the blank before it.
      let val = tok ? reward : 0;
      let from = Math.floor(s / 2);
      let start = t;
      if (v[s] > NEG && v[s] > val) {
        val = v[s]; // stay in the same state: no new token
        from = st[s];
        start = sf[s];
      }
      if (s >= 1 && v[s - 1] > NEG) {
        const c = v[s - 1] + (tok ? reward : 0);
        if (c > val) {
          val = c;
          from = st[s - 1];
          start = sf[s - 1];
        }
      }
      if (skip[s] && v[s - 2] > NEG) {
        const c = v[s - 2] + reward;
        if (c > val) {
          val = c;
          from = st[s - 2];
          start = sf[s - 2];
        }
      }
      val += cost;
      if (opts.maxFrames > 0 && t - start + 1 > opts.maxFrames) {
        // Too long a stretch for one sung pangti: restart here instead.
        val = (tok ? reward : 0) + cost;
        from = Math.floor(s / 2);
        start = t;
      }
      nv[s] = val;
      nst[s] = from;
      nsf[s] = start;
      if (val > best) {
        best = val;
        bestS = s;
        bestStart = start;
        bestFrom = from;
        bestEnd = t + 1;
      }
    }
    [v, nv] = [nv, v];
    [st, nst] = [nst, st];
    [sf, nsf] = [nsf, sf];
  }
  if (bestS < 0) return none;
  // The last token reached: a token state is that token; a blank after token k counts k.
  const to = bestS % 2 === 1 ? (bestS - 1) / 2 + 1 : bestS / 2;
  return {
    score: best,
    tokens: Math.max(0, to - bestFrom),
    from: bestFrom,
    to,
    start: bestStart,
    end: bestEnd,
  };
}

module.exports = { localCtcScore, frameMax, BLANK };
