// JS port of karansea_recognize.py KaranseaRecognizer.
const { resampleTo16k, norm, SR } = require('./infer');
const pace = require('./pace');
const { appendTo } = require('./clock');

class Recognizer {
  constructor(infer, { inputSr = 48000, windowS = 10.0, hopS = 0.6, minHyp = 2 } = {}) {
    this.infer = infer;
    this.inputSr = inputSr;
    this.win = Math.floor(windowS * SR);
    this.windowS = windowS;
    this.hopS = hopS;
    this.hop = Math.floor(hopS * SR);
    this.minHyp = minHyp;
    this.buf = new Float32Array(0);
    this.acc = 0;
    // Shabad verifier (shabadVerify.js): when set, each pass's emissions are kept for ~35 s so a
    // long window can be stitched from passes already run (no extra model passes)
    // one shared object changed in place, so it works through wrappers (Object.create(rec) in the bench driver)
    this.passHistory = { on: false, list: [] };
    this.pushed = 0;
  }

  async push(pcm) {
    const res = resampleTo16k(pcm, this.inputSr);
    this.win = Math.floor(pace.windowS('recognizer', this.windowS) * SR);
    this.pushed += res.length; // audio seen so far (the verifier's pass slices are placed by it)
    if (this.clock) {
      // Window alignment (engine/clock): seeded at the lock, decodes on the session grid.
      appendTo(this, pcm, res, this.win);
      if (!this.clock.due(pcm, pace.hopS('recognizer', this.hopS)) || this.buf.length < SR) {
        return null;
      }
      pace.markBeat(pcm);
    } else {
      if (res.length) {
        let merged = new Float32Array(this.buf.length + res.length);
        merged.set(this.buf, 0);
        merged.set(res, this.buf.length);
        if (merged.length > this.win) merged = merged.slice(merged.length - this.win);
        this.buf = merged;
        this.acc += res.length;
      }
      this.hop = Math.floor(pace.hopS('recognizer', this.hopS) * SR); // performance tier
      if (this.acc < this.hop || this.buf.length < SR) return null;
      this.acc = 0;
      pace.markBeat(pcm);
    }

    const emis = await this.infer.emissions(this.buf);
    const ph = this.passHistory;
    if (ph.on) {
      // keep only the MIDDLE of each pass (the frames between the previous pass's centre and this
      // one's), where the model hears best; consecutive slices tile the audio with no seams
      const len = this.buf.length;
      const start = this.pushed - len;
      const centre = this.pushed - len / 2;
      const from = ph.lastCentre == null ? start : Math.max(start, ph.lastCentre);
      const perSample = emis.frames / len;
      const a = Math.round((from - start) * perSample);
      const b = Math.round((centre - start) * perSample);
      if (b > a) {
        ph.list.push({
          t0: from,
          t1: centre,
          frames: b - a,
          C: emis.C,
          data: emis.data.slice(a * emis.C, b * emis.C),
        });
        ph.lastCentre = centre;
      }
      const cut = this.pushed - 40 * SR;
      while (ph.list.length && ph.list[0].t1 < cut) ph.list.shift();
    }
    const hyp = this.infer.decode(this.infer.greedy(emis));
    if (norm(hyp).length < this.minHyp) return null;
    return {
      text: hyp,
      confidence: Number(this.infer.confidence(emis).toFixed(3)),
      audioSec: Number((this.buf.length / SR).toFixed(1)),
    };
  }
}

module.exports = { Recognizer };
