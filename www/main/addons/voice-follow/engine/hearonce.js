// Hear once: every second of audio goes through the model once, not ~20 times.
//
// Today each engine (Shabad recognizer, line follower) runs the model on its own trailing window
// (4-10 s, every 0.25-0.5 s), so each second of audio is encoded 16-24 times. A computer that
// cannot afford that (i5-class: ~300-500 ms per 4 s pass) falls behind. Here the audio is encoded
// in pieces of C seconds, each with L seconds before it and R seconds after it as context
// (research/hear-once/fidelity.js: L 2 / C 1 / R 0.5 hears as well as full windows, 0.651 vs
// 0.656, at 3.5 audio seconds encoded per second instead of ~24). The model outputs of the pieces
// are stitched into one timeline and every engine's window is served as a slice of it.
//
// The price is R: a piece is final only once R seconds after it have arrived. Without a draft the
// newest window an engine gets ends at the last final piece (up to C + R late). With drafts
// (VF_HO_DRAFT=1) the not-yet-final tail is filled by one short pass (Ld before it, no look-ahead)
// once per new audio end, and replaced when its piece becomes final.
//
// The engines need no change: they still call infer.emissions(theirWindow). A window is located in
// the shared audio history by its samples (every engine's window is a trailing slice of the same
// resampled stream); a window that is not part of the stream (the speed self-test, a one-off
// check) gets an ordinary model pass.

const SR = 16000;
const HOP = 640; // samples per model output frame (40 ms)

function framesFor(n) {
  // Model output frames for n samples (measured: ceil(n / 640) at 16 kHz, e.g. 4 s -> 100).
  return Math.ceil(n / HOP);
}

class HearOnce {
  constructor(infer, opts = {}) {
    this.infer = infer;
    const f = (s) => Math.max(1, Math.round((s * SR) / HOP));
    this.Lf = f(opts.L != null ? opts.L : 2.56);
    this.Cf = f(opts.C != null ? opts.C : 1.28);
    this.Rf = f(opts.R != null ? opts.R : 0.64);
    this.Ldf = f(opts.Ld != null ? opts.Ld : 1.28);
    this.draft = !!opts.draft;
    // A draft is reused until the audio has moved this far past it (engines asking every 0.25 s
    // share one draft per draftHop; the window then ends up to draftHop early).
    this.draftHop = Math.round((opts.draftHop != null ? opts.draftHop : 0.5) * SR);
    this.keepS = opts.keepS || 30;
    this.stats = { slices: 0, direct: 0, commits: 0, drafts: 0, encodedS: 0, resets: 0 };
    this.busy = null;
    this.gen = 0;
    this.reset();
  }

  reset() {
    this.hist = new Float32Array(0); // audio history
    this.abs0 = 0; // absolute sample index of hist[0] (a multiple of HOP)
    this.tl = new Map(); // absolute frame -> Float32Array(C) (final)
    this.C = 0;
    this.committedF = 0; // frames [.., committedF) are final
    this.draftF = null; // { endAbs, from, frames: Float32Array[] }
    this.alt = null; // an unmatched window: a new stream starting?
  }

  get histEnd() {
    return this.abs0 + this.hist.length;
  }

  // Where buf ends in the history (absolute sample), appending its new audio; null if buf is
  // not a trailing slice of the stream.
  locate(buf) {
    const H = this.hist;
    const n = buf.length;
    if (!H.length) return null;
    const probe = Math.min(64, n);
    const lo = Math.max(0, H.length - n);
    // Scan from the newest start (most windows end at or just past the history's end).
    for (let p = H.length - 1; p >= lo; p -= 1) {
      if (H[p] !== buf[0]) continue;
      const over = Math.min(n, H.length - p);
      let ok = true;
      for (let i = 0; i < Math.min(probe, over); i += 1) {
        if (H[p + i] !== buf[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // full overlap check (cheap: exits on the first mismatch)
      for (let i = probe; i < over; i += 1) {
        if (H[p + i] !== buf[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (over < n) this.append(buf.subarray(over));
      return this.abs0 + p + n;
    }
    return null;
  }

  append(pcm) {
    const merged = new Float32Array(this.hist.length + pcm.length);
    merged.set(this.hist, 0);
    merged.set(pcm, this.hist.length);
    this.hist = merged;
    // keep the last keepS seconds (whole frames, so abs0 stays frame-aligned)
    const extra = this.hist.length - this.keepS * SR;
    if (extra > HOP * 64) {
      const cut = Math.floor(extra / HOP) * HOP;
      this.hist = this.hist.slice(cut);
      this.abs0 += cut;
      const minF = this.abs0 / HOP;
      for (const k of this.tl.keys()) if (k < minF - 8) this.tl.delete(k);
    }
  }

  audio(a, b) {
    return this.hist.subarray(a - this.abs0, b - this.abs0);
  }

  async pass(a, b) {
    const t0 = Date.now();
    const out = await this.infer.run(this.audio(a, b));
    const ms = Date.now() - t0;
    this.infer.notePassExternal(ms, b - a);
    this.stats.encodedS += (b - a) / SR;
    if (!this.C) this.C = out.C;
    return out;
  }

  // Make every piece whose look-ahead has arrived final.
  async commit() {
    const endF = Math.floor(this.histEnd / HOP);
    while (this.committedF + this.Cf + this.Rf <= endF) {
      const c0 = this.committedF;
      const c1 = c0 + this.Cf;
      const a0 = Math.max(this.abs0 / HOP, c0 - this.Lf);
      const a1 = c1 + this.Rf;
      // eslint-disable-next-line no-await-in-loop
      const e = await this.pass(a0 * HOP, a1 * HOP);
      for (let f = c0; f < c1; f += 1) {
        const src = f - a0;
        if (src >= 0 && src < e.frames) this.tl.set(f, e.data.slice(src * e.C, (src + 1) * e.C));
      }
      this.committedF = c1;
      this.stats.commits += 1;
    }
  }

  // Draft frames for [committedF, endAbs): one pass, no look-ahead, once per audio end.
  async draftTo(endAbs) {
    if (this.draftF && this.draftF.endAbs === endAbs && this.draftF.from === this.committedF) return;
    const from = this.committedF;
    const a0 = Math.max(this.abs0 / HOP, from - this.Ldf);
    const endF = Math.floor(endAbs / HOP);
    if (endF <= from) {
      this.draftF = { endAbs, from, frames: [] };
      return;
    }
    const e = await this.pass(a0 * HOP, endAbs);
    const frames = [];
    for (let f = from; f < endF; f += 1) {
      const src = f - a0;
      if (src >= 0 && src < e.frames) frames.push(e.data.slice(src * e.C, (src + 1) * e.C));
    }
    this.draftF = { endAbs, from, frames };
    this.stats.drafts += 1;
  }

  frameAt(f) {
    if (f < this.committedF) return this.tl.get(f) || null;
    const d = this.draftF;
    if (d && d.from === this.committedF) return d.frames[f - d.from] || null;
    return null;
  }

  // Locate buf in the stream (restarting the stream when buf starts a new one). Returns its end
  // (absolute sample) or null when buf is not part of the stream.
  place(buf) {
    let end = this.locate(buf);
    if (end != null) return end;
    // Not part of the stream. A window that extends the last unmatched one means a new stream
    // (a new session, or audio the app dropped): restart the history from it. A stream starts
    // only when a second window extends the first: the self-test's noise windows never do.
    const alt = this.alt;
    this.alt = buf.slice(0);
    if (!alt) return null;
    // Keep the whole state: a window that only looks new (a one-off check, the self-test) must
    // not cost the timeline built so far.
    const saved = {
      hist: this.hist, abs0: this.abs0, tl: this.tl, C: this.C, committedF: this.committedF, draftF: this.draftF,
    };
    const gen = this.gen;
    this.reset();
    this.hist = alt;
    end = this.locate(buf);
    if (end == null || end <= alt.length) {
      Object.assign(this, saved);
      this.alt = buf.slice(0);
      return null;
    }
    this.gen = gen + 1; // background work for the old stream is void
    this.stats.resets += 1;
    return end;
  }

  // Background worker: final pieces first, then a draft of the newest audio. Engines never wait
  // for it (except at a stream's start); they read whatever is ready.
  kick() {
    if (this.busy) return this.busy;
    const gen = this.gen;
    this.busy = (async () => {
      for (;;) {
        const endF = Math.floor(this.histEnd / HOP);
        if (this.committedF + this.Cf + this.Rf <= endF) {
          // eslint-disable-next-line no-await-in-loop
          await this.commitOne(gen);
          if (gen !== this.gen) return;
          continue;
        }
        const end = this.histEnd;
        const d = this.draftF;
        const stale = !d || d.from !== this.committedF || end - d.endAbs >= this.draftHop;
        if (this.draft && end > this.committedF * HOP && stale) {
          // eslint-disable-next-line no-await-in-loop
          await this.draftTo(end);
          if (gen !== this.gen) return;
          continue;
        }
        return;
      }
    })()
      .catch((e) => {
        // surfaced by the next serve() (an engine call), never an unhandled rejection
        this.err = e;
      })
      .finally(() => {
        this.busy = null;
      });
    return this.busy;
  }

  async commitOne(gen) {
    const c0 = this.committedF;
    const c1 = c0 + this.Cf;
    const a0 = Math.max(this.abs0 / HOP, c0 - this.Lf);
    const a1 = c1 + this.Rf;
    const e = await this.pass(a0 * HOP, a1 * HOP);
    if (gen !== this.gen) return;
    for (let f = c0; f < c1; f += 1) {
      const src = f - a0;
      if (src >= 0 && src < e.frames) this.tl.set(f, e.data.slice(src * e.C, (src + 1) * e.C));
    }
    this.committedF = c1;
    this.stats.commits += 1;
  }

  slice(buf, end) {
    let lastF = this.committedF;
    const d = this.draftF;
    if (this.draft && d && d.from === this.committedF && d.endAbs <= end) lastF = Math.max(lastF, Math.floor(d.endAbs / HOP));
    const want = framesFor(buf.length);
    const stopF = Math.min(lastF, Math.ceil(end / HOP));
    const startF = Math.max(this.abs0 / HOP, stopF - want);
    const n = stopF - startF;
    if (n < Math.min(want, 25) || !this.C) return null;
    const C = this.C;
    const data = new Float32Array(n * C);
    for (let i = 0; i < n; i += 1) {
      const fr = this.frameAt(startF + i);
      if (!fr) return null;
      data.set(fr, i * C);
    }
    this.stats.slices += 1;
    return { data, frames: n, C, hearOnce: { lagS: (end - stopF * HOP) / SR } };
  }

  // The window's model output: { data, frames, C } as Infer.run returns, or null (do a pass).
  async serve(buf) {
    if (this.err) {
      const e = this.err;
      this.err = null;
      throw e;
    }
    const end = this.place(buf);
    if (end == null) return null;
    const work = this.kick();
    let out = this.slice(buf, end);
    if (!out && work) {
      // the stream's first seconds: wait for the first pieces once
      await work;
      if (this.err) {
        const e = this.err;
        this.err = null;
        throw e;
      }
      out = this.slice(buf, end);
    }
    return out;
  }
}

module.exports = { HearOnce, framesFor, HOP };
