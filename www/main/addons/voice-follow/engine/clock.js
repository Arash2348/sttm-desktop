// Window alignment: one session clock for the following engines.
//
// Before: each engine counted its own hop from the moment it was created, with an EMPTY
// buffer. After a lock or switch the new follower and recognizer warmed up for ~4 s on short
// windows (1.0-3.9 s) that started at the lock, so (1) the first follower decode came >= 1 s
// after the lock, (2) every window of that warm-up depended on the exact lock moment, and
// (3) a different lock moment asked the speech model for windows no other run had seen.
//
// With the clock (WINDOW_ALIGN on), while following:
//   * the component advances the clock once per audio chunk, BEFORE the engines see it, and
//     the clock keeps the last RING_S seconds of session audio (16 kHz, as the engines hear it);
//   * an engine created at a lock or switch is seeded with that audio (seed()), so its first
//     window is already a full window and its first decode is the next grid point;
//   * engines decode only when the session's sample count crosses a multiple of their step
//     (due()). The steps are whole numbers of the 0.25 s base step, and the base step is a
//     whole number of audio chunks (the cadence the engines already had: every 2 chunks of
//     2048 samples at 16 kHz, every 6 of the microphone's 683), so the recognizer's grid
//     (0.5 s) lies on the follower's (0.25 s) and their windows are byte-identical there.
// A window is then a function of the session time only: whoever asks for it, whenever the
// lock happened, it is the same audio (one model pass via Infer's memo; one cache entry).
// The searching recognizer (10 s window) keeps its own hop exactly as before.
const { resampleTo16k, SR } = require('./infer');

// Default ON in this build; VF_WINDOW_ALIGN=0 turns it off (exactly the build without it).
const env = typeof process !== 'undefined' && process.env ? process.env.VF_WINDOW_ALIGN : '';
const WINDOW_ALIGN = env !== '0';

const BASE_STEP_S = 0.25; // the follower's step; every other step is a whole number of these
const RING_S = 10; // seed source: enough for any engine window (10 s searching, 4 s following)

class SessionClock {
  constructor({ inputSr = 48000, ringS = RING_S } = {}) {
    this.inputSr = inputSr;
    this.samples = 0; // 16 kHz samples of session audio so far
    this.before = 0; // ...before the last chunk
    this.last = null; // the last chunk (the pcm object the engines are pushed next)
    this.chunk = 0; // 16 kHz length of a normal chunk (the first one seen)
    this.ring = new Float32Array(Math.floor(ringS * SR));
    this.filled = 0;
  }

  // One audio chunk, exactly as the engines are pushed it (same object, same input rate).
  advance(pcm) {
    const res = resampleTo16k(pcm, this.inputSr);
    if (!this.chunk && res.length) this.chunk = res.length;
    this.before = this.samples;
    this.samples += res.length;
    this.last = pcm;
    const R = this.ring.length;
    if (res.length >= R) {
      this.ring.set(res.subarray(res.length - R));
      this.filled = R;
    } else {
      const keep = Math.min(this.filled, R - res.length);
      this.ring.copyWithin(0, this.filled - keep, this.filled);
      this.ring.set(res, keep);
      this.filled = keep + res.length;
    }
  }

  // The grid step (16 kHz samples) for an engine step in seconds: the base step rounded up
  // to whole chunks, times the whole number of base steps the engine's step needs.
  step(stepS) {
    const unitRaw = Math.floor(BASE_STEP_S * SR);
    const c = this.chunk || unitRaw;
    const unit = Math.ceil(unitRaw / c) * c;
    return Math.max(1, Math.ceil(Math.floor(stepS * SR) / unit)) * unit;
  }

  // Does this chunk (pcm) end on a grid point of an engine with this step?
  due(pcm, stepS) {
    if (pcm !== this.last) return false;
    const q = this.step(stepS);
    return Math.floor(this.samples / q) > Math.floor(this.before / q);
  }

  // The last `seconds` of session audio (a copy), ending with the last chunk.
  tail(seconds = RING_S) {
    const n = Math.min(this.filled, Math.floor(seconds * SR));
    return this.ring.slice(this.filled - n, this.filled);
  }
}

// An engine joining the session: its buffer becomes the session's recent audio (trimmed to
// the engine's window at its next push), and the chunk that audio ends with is not appended
// a second time when it is pushed next. seed = false: the engine starts empty, on the grid.
function seedEngine(engine, clock, { seed = true } = {}) {
  if (!engine || !clock) return;
  Object.assign(engine, { clock, acc: 0 });
  if (seed) Object.assign(engine, { buf: clock.tail(), seenLast: clock.last });
}

// Append a pushed chunk to an engine's buffer (clock mode); the chunk its seed already ended
// with is skipped.
function appendTo(engine, pcm, res, win) {
  let { buf } = engine;
  if (engine.seenLast !== pcm) {
    const merged = new Float32Array(buf.length + res.length);
    merged.set(buf, 0);
    merged.set(res, buf.length);
    buf = merged;
  }
  if (buf.length > win) buf = buf.slice(buf.length - win);
  Object.assign(engine, { buf, seenLast: null });
}

module.exports = { WINDOW_ALIGN, BASE_STEP_S, SessionClock, seedEngine, appendTo };
