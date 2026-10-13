// Follower v2 (Bani / paath): tracks WHERE in the text the reciter is, not which whole
// line the last few seconds sound most like. Benchmark, truth and tuning:
// research/follower-bench (55 recitation clips of 7 Banis, line-level truth).
//
// The Bani is one stream of letters with line boundaries. Each window's transcript is
// aligned (local alignment, letter level) against that stream, and the place where the
// END of the transcript lands is the reciter's current position. So a new line shows as
// soon as its first syllables are heard, and a short line can't be swallowed by its
// neighbours in the window.
//
// Continuity: the search first looks just around the current position (a little back,
// several lines ahead), with the next stretch of text favoured; moving forward there
// needs no confirmation. A jump elsewhere must beat the local match clearly and hold
// for several windows. Same streaming contract as the v1 Follower: push(pcm) returns
// { verseIndex, verseId, lineIndex, wordIndex, confidence } or null.
const { resampleTo16k, SR } = require('./infer');
const { spoken } = require('./spoken');

// Tuned on research/follower-bench at a 0.125 s listening step; ships at 0.25 s, the same
// model cost as the line follower (a gurdwara PC that already decodes slower than real
// time cannot afford twice the passes). At 0.25 s: Renton Rehras median lag 0.39 s vs
// 0.29 s at 0.125 s, 55 recited clips within one line 97.4% vs 97.9%. Dwell counts are
// in windows; on a slower device windows are merged, so they simply cover more time.
const DEFAULTS = {
  windowS: 4.0,
  hopS: 0.25,
  minHyp: 4, // letters heard before anything is decided
  back: 4, // lines before the current one searched locally
  ahead: 6, // lines after the current one searched locally
  minScore: 0.35, // alignment score per heard letter (max 1) to trust a position
  enterLetters: 2, // letters of a new line that must be heard before showing it
  enterGain: 3, // ...and they must improve the match by this much (2 per matched letter)
  skipDwell: 1, // windows a move past the next line must persist
  skipGain: 6, // ...and how much better it must match than staying within the next line
  backDwell: 4, // windows a backward move (repeat) must persist
  backDwell1: 0, // ...a step back of exactly one line (0 = same as backDwell)
  jumpDwell: 4, // windows a far jump must persist
  jumpMargin: 0.15, // a far jump must beat the local match by this (per letter)
  jumpScore: 0.35, // ...and match at least this well
  lockDwell: 3, // windows the first position must persist
  lockScore: 0.6, // ...and how well it must match (a wrong first line is worse than a moment of nothing)
  // Next-line prior: within the local search, each line further than the next one
  // ahead (or any line behind) costs this much per heard letter, so of two equally
  // good matches the nearer one ahead wins.
  distCost: 0.03,
  tieSlack: 0.05, // matches this close (per heard letter) to the best count as equal
  // The whole-Bani search (for jumps) is the costly part on long Banis; while the local
  // match is good it runs only every globalEvery windows.
  globalEvery: 1,
  // Is it really THIS Bani? Positions are trusted only when this Bani matches what was
  // heard clearly better than other Gurbani does (opts.background: text of other
  // Banis). Common words make some stretch of any long Bani match any Gurbani a bit.
  lockMargin: 0.15, // locking on / jumping: this Bani vs other Gurbani, per heard letter
  moveMargin: 0, // moving to another line
  releaseHops: 40, // windows in a row where other Gurbani fits better: stop showing a line
  releaseMargin: 0.2, // ...by at least this much (per heard letter)
  // ...or simply nothing here matches what is heard for this many windows in a row
  // (someone reading a Bani that is not in the comparison set; talk; katha). 0 = off.
  noMatchHops: 24, // windows with words heard (3 s of speech at the 0.125 s step)
  // Catch-up: in paath the reader almost always just moves on. If the local match keeps
  // landing on a line further ahead (even without a clear gain over the next line), go
  // there after this many windows in a row (1 s at the 0.25 s step), so lag can never
  // compound. 0 = off.
  catchHops: 4,
  catchScore: 0.5, // ...each of those windows matching at least this well (per letter)
  // Anticipation (read paath only; see present()). 0 = off; off for the sung Banis below.
  // Times are seconds of audio, so a slow PC that merges windows waits as long as a fast one.
  anticipate: 1,
  antSlack: 1, // the line counts as heard to its end with all but this many last letters
  antDelayS: 1.0, // ...and the position must stay there this long (no new letters: a pause)
  antMono: 1, // ...without moving back meanwhile
  antQuiet: 0.2, // or sooner: the audio's last antQuietS is this much quieter than its speech
  antQuietS: 0.3,
  antQuietMinS: 0.5, // ...but not sooner than this after the end was heard
  antQuietRunS: 0.5, // or: quiet this long with the position past antStallFrac of the line
  antStallFrac: 0.8,
  antMinLetters: 10, // lines shorter than this (headers, 'Dohra') are not anticipated
  backFrac: 0.5, // shown ahead, but the position is back in the first half of the line...
  backS: 0.25, // ...for this long: the reader is repeating it, step back
  repeatLast: 1, // the last two lines of every read Bani are expected to be read twice
  repeatDwell: 1, // windows an expected repeat (BANI_REPEATS) needs to be followed back
  antOnward: 2, // shown ahead, but this many new letters of the line heard: still reading it, step back
};
// Sung Banis (kirtan-style, not read): Asa di Vaar (BaniDB Bani 90). Ragis repeat a pauri
// or a chhant stanza from its top (a jump 4-6 lines back, which the recited profile treats
// as a far jump needing a clear margin and a long dwell), dwell on a line, and sing the
// chhant refrain over and over. Measured on Khalsa School Newton (Oct 11, 2026) and a
// YouTube Asa di Vaar (research: scratchpad asa/sweep*.txt): the local window reaches back
// to the pauri's start, a move back of 2+ lines (a repeat) confirms in 2 windows while a
// one-line step back keeps the recited 4 (it is a flicker, not a repeat), the next-line prior is
// weaker, a 2-line skip needs less gain, and a pause (alaap, a held note) must last 12 s,
// not 6, before the line is let go. Recited Banis keep DEFAULTS untouched.
// Keyed by opts.baniId, so the engine and the headless bench build the same follower.
const SUNG_BANIS = {
  90: {
    back: 8,
    backDwell: 2,
    backDwell1: 4,
    distCost: 0.01,
    skipGain: 3,
    noMatchHops: 48,
    anticipate: 0,
  },
  // Aarti (sung): followed with the recited profile, but a sung line is held and repeated,
  // so its end says little about when the next one starts: no anticipation.
  22: { anticipate: 0 },
};
// Expected repeats in the usual reading of a paath: the reader finishes the first line of a
// pair and goes back to the second (a block read twice). There the next line is not shown
// ahead on the first reading, and the move back is followed as soon as it is heard. Lines are
// matched by text (any Bani, any length or id space). The last two lines of every read Bani
// are such a pair too (see the constructor).
const REPEATS = [
  // Rehras / Benti Chaupai: Jap tap sanjam, the closing pangtis read again
  ['ਸਰਣਿ ਪਰੇ ਕੀ ਰਾਖਹੁ ਸਰਮਾ', 'ਜਪੁ ਤਪੁ ਸੰਜਮੁ ਧਰਮੁ ਨ ਕਮਾਇਆ'],
  // the Dohra after Chaupai Sahib
  ['ਬਾਹਿ ਗਹੇ ਕੀ ਲਾਜ ਅਸਿ ਗੋਬਿੰਦ ਦਾਸ ਤੁਹਾਰ', 'ਸਗਲ ਦੁਆਰ ਕਉ ਛਾਡਿ ਕੈ ਗਹਯੋ ਤੁਹਾਰੋ ਦੁਆਰ'],
  // the end of Anand Sahib (pauri 40)
  ['ਬਿਨਵੰਤਿ ਨਾਨਕੁ ਗੁਰ ਚਰਣ ਲਾਗੇ ਵਾਜੇ ਅਨਹਦ ਤੂਰੇ', 'ਸੁਣਤੇ ਪੁਨੀਤ ਕਹਤੇ ਪਵਿਤੁ ਸਤਿਗੁਰੁ ਰਹਿਆ ਭਰਪੂਰੇ'],
  // the end of Rehras
  ['ਜਿਸੁ ਸਿਮਰਤ ਸੁਖੁ ਹੋਇ ਸਗਲੇ ਦੂਖ ਜਾਹਿ', 'ਤਿਸੁ ਸਾਹਿਬ ਕੀ ਟੇਕ ਨਾਨਕ ਮਨੈ ਮਾਹਿ'],
  // the end of Sohila (its list may continue past it)
  ['ਨਾਨਕ ਦਾਸੁ ਇਹੈ ਸੁਖੁ ਮਾਗੈ ਮੋ ਕਉ ਕਰਿ ਸੰਤਨ ਕੀ ਧੂਰੇ', 'ਅੰਤਰਜਾਮੀ ਪੁਰਖ ਬਿਧਾਤੇ ਸਰਧਾ ਮਨ ਕੀ ਪੂਰੇ'],
  // the end of Japji Sahib
  ['ਨਾਨਕ ਤੇ ਮੁਖ ਉਜਲੇ ਕੇਤੀ ਛੁਟੀ ਨਾਲਿ', 'ਜਿਨੀ ਨਾਮੁ ਧਿਆਇਆ ਗਏ ਮਸਕਤਿ ਘਾਲਿ'],
];

// Letters only, with marks that recognition often drops or adds removed, so that
// spelling noise costs little.
const SIMPLE = /[\s।॥|0-9੦-੯.,;:!?\-ੰਂੱ਼੍]/g; // eslint-disable-line no-misleading-character-class
// NFD first: BaniDB writes ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼ as single characters, the model as letter + dot.
const simplify = (s) => (s || '').normalize('NFD').replace(SIMPLE, '');

const MATCH = 2;
const MISMATCH = -1;
const GAP = -1;

class FollowerV2 {
  constructor(infer, lines, opts = {}) {
    this.infer = infer;
    this.c = { ...DEFAULTS, ...(SUNG_BANIS[opts.baniId] || {}), ...opts };
    this.inputSr = opts.inputSr || 48000;
    this.verseIds = lines.map((l) => l.verseId);
    // Stream of letters; lineAt[k] = line of letter k; lineStart[i] = first letter.
    const text = [];
    const lineAt = [];
    const wordAt = [];
    const lineStart = [];
    const lineEnd = [];
    lines.forEach((l, i) => {
      lineStart.push(text.length);
      // The line as it is said aloud (ੴ, ਮਹਲਾ ੧ ...), letters only. Each written word is
      // expanded on its own, so wordAt maps every spoken letter to the word that says it
      // (a numeral after ਮਹਲਾ belongs to the ਮਹਲਾ word; verse numbers say nothing).
      let written = (l.text || (l.words || []).join(' ')).split(/[\s॥।]+/).filter(Boolean);
      // A row with no Gurmukhi letter at all (Asa di Vaar's 24 "❁" dividers) is never said:
      // as a one-letter line it was the "next line" after every pauri, so the screen left
      // the pauri's last line for the divider while that line was still being sung.
      if (!/[਀-੿]/.test(simplify(spoken(written.join(' '))))) written = [];
      const shown = (l.words && l.words.length ? l.words : written).map((x) => simplify(spoken(x)));
      let wi = 0;
      written.forEach((wd, k) => {
        const next = written[k + 1] || '';
        // ਮਹਲਾ/ਮਃ + numeral (or ਪਾਤਿਸ਼ਾਹੀ ੧੦) are said together: expand them as a pair.
        const pair = /^(ਮਹਲਾ|ਮਃ|ਪਾਤਿਸ਼?ਾਹੀ)$/.test(wd.normalize('NFC')) && /^[੦-੯]+/.test(next);
        let say = pair ? `${wd} ${next}` : wd;
        if (!pair && /^[੦-੯॥।]+$/.test(wd)) say = ''; // verse numbers say nothing
        const said = simplify(spoken(say));
        if (!said) return;
        // the written word this letter run belongs to, in l.words' numbering
        while (wi < shown.length - 1 && !shown[wi]) wi += 1;
        [...said].forEach((ch) => {
          text.push(ch);
          lineAt.push(i);
          wordAt.push(Math.min(wi, Math.max(0, shown.length - 1)));
        });
        wi += 1;
      });
      lineEnd.push(text.length - 1);
    });
    Object.assign(this, { text, lineAt, wordAt, lineStart, lineEnd });
    // Expected repeats (BANI_REPEATS): end line -> the line the reader goes back to.
    this.repeatTo = new Map();
    this.repeated = new Set();
    const pairs = this.c.repeats === undefined ? REPEATS : this.c.repeats;
    if (this.c.anticipate && pairs) {
      const said = lines.map((l) => simplify(spoken(l.text || (l.words || []).join(' '))));
      pairs.forEach(([endT, startT]) => {
        const e = simplify(spoken(endT));
        const st = simplify(spoken(startT));
        said.forEach((x, i) => {
          if (!x.startsWith(e)) return;
          for (let j = i - 1; j >= Math.max(0, i - 8); j -= 1) {
            if (said[j].startsWith(st)) {
              this.repeatTo.set(i, j);
              break;
            }
          }
        });
      });
      // the last two (spoken) lines of the Bani
      const real = said.map((x, i) => i).filter((i) => said[i].length >= this.c.antMinLetters);
      if (this.c.repeatLast && real.length >= 2) {
        this.repeatTo.set(real[real.length - 1], real[real.length - 2]);
      }
    }
    this.lastEnd = -1;
    // Other Gurbani (lines), minus any line this Bani also has: shared text (So Dar in
    // Japji and Rehras, Gagan mai thaal in Sohila and Aarti) is evidence for both.
    if (opts.background) {
      const own = new Set(lines.map((l) => simplify(spoken(l.text || (l.words || []).join(' ')))));
      const bg = []
        .concat(opts.background)
        .map((t) => simplify(spoken(t)))
        .filter((t) => t && !own.has(t));
      this.bg = [...bg.join('|')];
    } else this.bg = null;
    this.foreign = 0; // windows in a row that other Gurbani explains better
    this.noMatch = 0; // windows in a row where nothing near the current line matched
    this.win = Math.floor(this.c.windowS * SR);
    this.hop = Math.floor(this.c.hopS * SR);
    this.buf = new Float32Array(0);
    this.acc = 0;
    this.cur = null; // current line
    this.lastCur = null; // line before the last release: where a re-lock looks first
    this.cand = null; // pending move { line, n }
    this.ahead = 0; // windows in a row the local match landed past the next line
    // Where the app locked on (index into lines): a first match that is equally good in
    // several places (refrains) picks the one nearest this.
    if (Number.isInteger(opts.startLine) && opts.startLine >= 0) this.lastCur = opts.startLine;
    // A Bani opened from a line the app was already following (the two-shabads rule, the
    // reading rule) starts AT that line instead of re-locking from nothing: on poor audio
    // (Newton, a laptop mic in a hall) the fresh lock took tens of seconds, during which the
    // Bani pane sat on its first line.
    if (opts.startAt && Number.isInteger(opts.startLine) && opts.startLine >= 0) {
      this.cur = Math.min(opts.startLine, lines.length - 1);
    }
    this.tick = 0;
  }

  // Best end position in text[a..b] for an alignment that ends at the end of the heard
  // letters (the last 2 may be left out: a word cut off mid-way). Returns
  // { end, score } with score per heard letter in [0, 1].
  align(h, a, b, from = null, near = null) {
    const n = h.length;
    const m = b - a + 1;
    if (m <= 0 || n === 0) return null;
    let prev = new Float32Array(m + 1);
    let cur = new Float32Array(m + 1);
    const tail = []; // rows n-2..n
    for (let i = 1; i <= n; i++) {
      cur[0] = 0;
      const hc = h[i - 1];
      for (let j = 1; j <= m; j++) {
        const d = prev[j - 1] + (hc === this.text[a + j - 1] ? MATCH : MISMATCH);
        const u = prev[j] + GAP;
        const l = cur[j - 1] + GAP;
        let v = d > u ? d : u;
        if (l > v) v = l;
        cur[j] = v > 0 ? v : 0;
      }
      if (i >= n - 2) tail.push({ row: cur.slice(), drop: n - i });
      [prev, cur] = [cur, prev];
    }
    let best = { end: -1, raw: -1 };
    const prior = (k) => {
      if (from === null) return 0;
      const d = this.lineAt[k] - from;
      const steps = d >= 0 ? Math.max(0, d - 1) : -d; // current and next line free
      return this.c.distCost * MATCH * n * steps;
    };
    const ends = new Float32Array(m).fill(-1); // best score per end position
    tail.forEach(({ row, drop }) => {
      for (let j = 1; j <= m; j++) {
        const v = row[j] - drop * 1.0 - (row[j] > 0 ? prior(a + j - 1) : 0);
        if (v > ends[j - 1]) ends[j - 1] = v;
        if (v > best.raw) best = { end: a + j - 1, raw: v };
      }
    });
    // The same words can occur in several places (ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ, refrains): of the
    // places that match as well as the best, take the one nearest ahead of `near`.
    if (near !== null && best.end >= 0) {
      const tie = best.raw - this.c.tieSlack * MATCH * n;
      let pick = best.end;
      let pickD = Infinity;
      for (let j = 0; j < m; j++) {
        const d = this.lineAt[a + j] - near;
        const dist = d >= 0 ? d : 1000 - d; // ahead first, then behind
        if (ends[j] >= tie && (dist < pickD || (dist === pickD && ends[j] > ends[pick - a]))) {
          pickD = dist;
          pick = a + j;
        }
      }
      best = { end: pick, raw: ends[pick - a] };
    }
    return { end: best.end, score: best.raw / (MATCH * n), raw: best.raw, ends, a };
  }

  // How much better ending at `end` is than ending anywhere up to the end of line `upto`
  // (raw alignment score): real evidence of having moved on, not a stray matched mark.
  gainOver(r, upto) {
    const lim = Math.min(this.lineEnd[upto], r.a + r.ends.length - 1) - r.a;
    let prev = 0;
    for (let j = 0; j <= lim; j++) if (r.ends[j] > prev) prev = r.ends[j];
    return r.raw - prev;
  }

  // Best score of the heard letters (ending at their end) anywhere in other Gurbani.
  bgScore(h) {
    if (!this.bg) return 0;
    const n = h.length;
    const m = this.bg.length;
    let prev = new Float32Array(m + 1);
    let cur = new Float32Array(m + 1);
    let best = 0;
    for (let i = 1; i <= n; i++) {
      cur[0] = 0;
      const hc = h[i - 1];
      for (let j = 1; j <= m; j++) {
        const d = prev[j - 1] + (hc === this.bg[j - 1] ? MATCH : MISMATCH);
        const u = prev[j] + GAP;
        const l = cur[j - 1] + GAP;
        let v = d > u ? d : u;
        if (l > v) v = l;
        cur[j] = v > 0 ? v : 0;
        if (i >= n - 2) {
          const w = v - (n - i);
          if (w > best) best = w;
        }
      }
      [prev, cur] = [cur, prev];
    }
    return best / (MATCH * n);
  }

  out(line, score, end = -1) {
    if (end >= 0 && this.lineAt[end] === line) this.lastEnd = end;
    else if (this.lastEnd < 0 || this.lineAt[this.lastEnd] !== line) this.lastEnd = -1;
    const wordIndex = this.lastEnd >= 0 ? this.wordAt[this.lastEnd] : -1;
    this.lastScore = score;
    return {
      verseIndex: line,
      verseId: this.verseIds[line],
      lineIndex: line,
      wordIndex,
      confidence: +Math.max(0, Math.min(1, score)).toFixed(3),
    };
  }

  // A pending move must be proposed `need` windows in a row to happen. A forward move
  // also counts as confirmed by steady forward progress (each window at or past the
  // last proposal): in fast recitation the position moves on every window.
  confirm(line, need, forward = false) {
    if (
      this.cand &&
      (this.cand.line === line || (forward && line >= this.cand.line && this.cand.forward))
    ) {
      this.cand.n += 1;
      this.cand.line = line;
    } else this.cand = { line, n: 1, forward };
    return this.cand.n >= need;
  }

  decide(h) {
    const { c } = this;
    const last = this.text.length - 1;
    this.tick += 1;
    const aheadRun = this.ahead; // catch-up run so far; any other outcome ends it
    this.ahead = 0;
    let B = null; // other-Gurbani score, computed only when about to change something
    const bg = () => {
      if (B === null) B = this.bgScore(h);
      return B;
    };
    this.pos = -1;
    if (this.cur === null) {
      const G = this.align(h, 0, last, null, this.lastCur);
      if (!G || G.score < c.lockScore || G.score - bg() < c.lockMargin) {
        this.cand = null;
        return null;
      }
      const line = this.lineAt[G.end];
      if (G.end - this.lineStart[line] + 1 < c.enterLetters && line > 0) return null;
      if (!this.confirm(line, c.lockDwell)) return null;
      this.cur = line;
      this.noMatch = 0;
      this.cand = null;
      return this.out(line, G.score, G.end);
    }
    const a = this.lineStart[Math.max(0, this.cur - c.back)];
    const b = this.lineEnd[Math.min(this.lineEnd.length - 1, this.cur + c.ahead)];
    const Lc = this.align(h, a, b, this.cur);
    this.pos = Lc && Lc.score >= c.minScore ? Lc.end : -1;
    if (this.peakLine !== this.cur) {
      this.peakLine = this.cur;
      this.peak = -1;
    }
    if (this.pos >= 0 && this.lineAt[this.pos] === this.cur && this.pos > this.peak)
      this.peak = this.pos;
    const needGlobal =
      !Lc || Lc.score < c.minScore + c.jumpMargin || this.tick % c.globalEvery === 0 || this.cand;
    const G = needGlobal ? this.align(h, 0, last, null, this.cur) : null;
    // Far jump: the whole-Bani match is elsewhere and clearly better.
    if (
      G &&
      G.score >= Math.max(c.minScore, c.jumpScore) &&
      (G.end < a || G.end > b) &&
      (!Lc || G.score >= Lc.score + c.jumpMargin) &&
      G.score - bg() >= c.lockMargin
    ) {
      const line = this.lineAt[G.end];
      if (this.confirm(line, c.jumpDwell)) {
        this.cur = line;
        this.noMatch = 0;
        this.cand = null;
        return this.out(line, G.score, G.end);
      }
      return null;
    }
    if (!Lc || Lc.score < c.minScore) {
      this.cand = null;
      return this.release(h, Lc, bg);
    }
    this.noMatch = 0; // something here matched
    let line = this.lineAt[Lc.end];
    // Only the first letters of the next line heard: not enough yet.
    if (
      line > this.cur &&
      (Lc.end - this.lineStart[line] + 1 < c.enterLetters ||
        this.gainOver(Lc, line - 1) < c.enterGain)
    ) {
      line -= 1;
      while (line > this.cur && this.lineEnd[line] < this.lineStart[line]) line -= 1;
    }
    if (line === this.cur) {
      this.cand = null;
      this.foreign = 0;
      return this.out(line, Lc.score, Lc.end);
    }
    if (Lc.score - bg() < c.moveMargin) {
      this.cand = null;
      return this.release(h, Lc, bg);
    }
    this.foreign = 0;
    const skipOk = line > this.cur + 1 && this.gainOver(Lc, this.cur + 1) >= c.skipGain;
    if (line === this.cur + 1 || (skipOk && this.confirm(line, c.skipDwell, true))) {
      this.cur = line;
      this.noMatch = 0;
      this.cand = null;
      return this.out(line, Lc.score, Lc.end);
    }
    if (line > this.cur) {
      // Catch-up: steadily matching further ahead -> move there.
      this.ahead = Lc.score >= c.catchScore ? aheadRun + 1 : 0;
      if (c.catchHops && this.ahead >= c.catchHops) {
        this.cur = line;
        this.noMatch = 0;
        this.cand = null;
        this.ahead = 0;
        return this.out(line, Lc.score, Lc.end);
      }
      return null;
    }
    // A one-line step back (a flicker between neighbours) may need longer than a real repeat.
    // the expected repeat of a block read twice: follow it at once
    // (only once the line was read to near its end: earlier, a step back is a flicker)
    const expected =
      this.repeatTo.has(this.cur) &&
      line >= this.repeatTo.get(this.cur) &&
      line < this.cur &&
      this.peak >= this.lineEnd[this.cur] - 3;
    let need = line === this.cur - 1 && c.backDwell1 ? c.backDwell1 : c.backDwell;
    if (expected) need = c.repeatDwell;
    if (this.confirm(line, need)) {
      if (expected) this.repeated.add(this.cur);
      this.cur = line;
      this.noMatch = 0;
      this.cand = null;
      return this.out(line, Lc.score, Lc.end);
    }
    return null;
  }

  // Nothing here fits: if other Gurbani keeps fitting better, stop showing a line.
  release(h, Lc, bg) {
    if (this.c.noMatchHops && (!Lc || Lc.score < this.c.minScore)) {
      this.noMatch += 1;
      if (this.noMatch >= this.c.noMatchHops) {
        this.lastCur = this.cur;
        this.cur = null;
        this.cand = null;
        this.foreign = 0;
        this.noMatch = 0;
        return { verseIndex: -1, verseId: null, lineIndex: null, wordIndex: -1, confidence: 0 };
      }
    }
    if (!this.bg || (Lc && bg() - Lc.score <= this.c.releaseMargin)) {
      this.foreign = 0;
      return null;
    }
    this.foreign += 1;
    if (this.foreign < this.c.releaseHops) return null;
    this.lastCur = this.cur;
    this.cur = null;
    this.cand = null;
    this.foreign = 0;
    this.noMatch = 0;
    return { verseIndex: -1, verseId: null, lineIndex: null, wordIndex: -1, confidence: 0 };
  }

  async push(pcm) {
    const res = resampleTo16k(pcm, this.inputSr);
    if (res.length) {
      let merged = new Float32Array(this.buf.length + res.length);
      merged.set(this.buf, 0);
      merged.set(res, this.buf.length);
      if (merged.length > this.win) merged = merged.slice(merged.length - this.win);
      this.buf = merged;
      this.acc += res.length;
      this.clock = (this.clock || 0) + res.length / SR;
    }
    if (this.acc < this.hop || this.buf.length < SR) return null;
    this.acc = 0;
    const emis = await this.infer.emissions(this.buf);
    const h = [...simplify(this.infer.decode(this.infer.greedy(emis)))];
    if (h.length < this.c.minHyp) {
      this.pos = -1;
      return this.c.anticipate ? this.present(null) : null;
    }
    const out = this.decide(h);
    if (!this.c.anticipate) return out;
    this.quiet = this.c.antQuiet ? this.tailQuiet() : false;
    return this.present(out);
  }

  // What the screen shows, given the tracker (anticipation). Once the current line has been
  // heard to its end (all but antSlack letters) and the position then stays there for
  // antDelayS (no new letters: the reader has paused), or the audio itself has gone quiet,
  // show the next line, so it is there as the reader starts it. "Heard to its last letter"
  // alone comes at the same moment as the last syllable's own spike, so it cannot tell a
  // held final vowel from a pause. One anticipation per reading of a line; if the position
  // falls back into the first part of the line instead (a repeat), the screen steps back.
  present(res) {
    const { c } = this;
    const line = this.cur;
    const now = this.clock || 0;
    if (line === null || (res && (res.lineIndex == null || res.verseIndex === -1))) {
      this.ant = null;
      this.endT = null;
      this.quietT = null;
      return res;
    }
    const p = this.pos;
    const inLine = p >= 0 && this.lineAt[p] === line;
    const len = this.lineEnd[line] - this.lineStart[line] + 1;
    const frac = inLine ? (p - this.lineStart[line] + 1) / len : null;
    if (frac !== null && frac < c.backFrac && this.antSpent === line && this.ant == null) {
      this.antSpent = -1; // a new reading of this line
    }
    if (line !== this.runLine) {
      // a new current line: end / quiet runs start over
      this.runLine = line;
      this.endT = null;
      this.quietT = null;
    }
    if (this.ant != null) {
      if (line !== this.ant) {
        this.ant = null; // the tracker caught up (or moved elsewhere)
        return res;
      }
      // the reader is back near the start of this line, or in an earlier one (a repeat)
      const back = (frac !== null && frac < c.backFrac) || (p >= 0 && this.lineAt[p] < line);
      if (back) {
        if (this.lowT == null) this.lowT = now;
      } else this.lowT = null;
      const earlier = p >= 0 && this.lineAt[p] < line;
      // still reading this line: new letters of it heard since the screen moved ahead
      const onward = c.antOnward && inLine && p >= this.antAtP + c.antOnward;
      if (onward) {
        this.ant = null;
        this.lowT = null;
        this.antSpent = -1;
        this.endT = null;
        this.quietT = null;
        return res || this.out(line, this.lastScore || c.minScore, p);
      }
      if (this.lowT != null && (earlier || now - this.lowT >= c.backS - 1e-6)) {
        this.ant = null;
        this.lowT = null;
        this.antSpent = -1;
        return res || this.out(line, this.lastScore || c.minScore, p);
      }
      return this.ahead1(res, line);
    }
    // At the end: the position on the line's last letters (or just into the next line,
    // not yet entered by the tracker, once the end was seen).
    const atEnd =
      (inLine &&
        this.lineEnd[line] - p <= c.antSlack &&
        (!c.antMono || this.endT == null || p >= this.antP)) ||
      (p >= 0 && this.lineAt[p] === line + 1 && this.endT != null);
    if (!atEnd) this.endT = null;
    else if (this.endT == null) this.endT = now;
    const late = inLine && frac >= c.antStallFrac && this.quiet;
    if (!late) this.quietT = null;
    else if (this.quietT == null) this.quietT = now;
    this.antP = p;
    const ready =
      (this.endT != null && now - this.endT >= c.antDelayS - 1e-6) ||
      (c.antQuiet &&
        this.quiet &&
        inLine &&
        this.endT != null &&
        now - this.endT >= c.antQuietMinS - 1e-6) ||
      (c.antQuiet && this.quietT != null && now - this.quietT >= c.antQuietRunS - 1e-6);
    if (
      ready &&
      len >= c.antMinLetters &&
      this.antSpent !== line &&
      !(this.repeatTo.has(line) && !this.repeated.has(line)) &&
      line + 1 < this.verseIds.length &&
      this.lineEnd[line + 1] >= this.lineStart[line + 1]
    ) {
      this.ant = line;
      this.antSpent = line;
      this.antAtP = inLine ? p : this.lineEnd[line];
      this.lowT = null;
      return this.ahead1(res, line);
    }
    return res;
  }

  // Is the end of the audio a pause? RMS of the last antQuietS against the loud speech
  // in the window (90th percentile of 20 ms frames).
  tailQuiet() {
    const b = this.buf;
    const F = Math.floor(0.02 * SR);
    const n = Math.floor(b.length / F);
    if (n < 10) return false;
    const rms = new Float32Array(n);
    for (let f = 0; f < n; f++) {
      let e = 0;
      for (let k = f * F; k < (f + 1) * F; k++) e += b[k] * b[k];
      rms[f] = Math.sqrt(e / F);
    }
    const tailN = Math.max(1, Math.round(this.c.antQuietS / 0.02));
    let tail = 0;
    for (let f = n - tailN; f < n; f++) tail += rms[f];
    tail /= tailN;
    const sorted = Array.from(rms).sort((x, y) => x - y);
    const loud = sorted[Math.floor(0.9 * (n - 1))];
    return loud > 0 && tail < this.c.antQuiet * loud;
  }

  ahead1(res, line) {
    return {
      verseIndex: line + 1,
      verseId: this.verseIds[line + 1],
      lineIndex: line + 1,
      wordIndex: 0,
      confidence: res ? res.confidence : Math.max(this.lastScore || 0, this.c.minScore),
    };
  }
}

module.exports = { FollowerV2, DEFAULTS, simplify };
