// JS port of karansea_recognize.py KaranseaRecognizer.
const { resampleTo16k, norm, SR } = require('./infer');
const pace = require('./pace');

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
    this.keepHistory = false;
    this.history = [];
    this.pushed = 0;
  }

  async push(pcm) {
    const res = resampleTo16k(pcm, this.inputSr);
    this.win = Math.floor(pace.windowS('recognizer', this.windowS) * SR);
    if (res.length) {
      let merged = new Float32Array(this.buf.length + res.length);
      merged.set(this.buf, 0);
      merged.set(res, this.buf.length);
      if (merged.length > this.win) merged = merged.slice(merged.length - this.win);
      this.buf = merged;
      this.acc += res.length;
      this.pushed += res.length;
    }
    this.hop = Math.floor(pace.hopS('recognizer', this.hopS) * SR); // performance tier
    if (this.acc < this.hop || this.buf.length < SR) return null;
    this.acc = 0;
    pace.markBeat(pcm);

    const emis = await this.infer.emissions(this.buf);
    if (this.keepHistory) {
      this.history.push({ end: this.pushed, len: this.buf.length, emis });
      // keep ~35 s, and at most one pass per second (stitching needs one every ~10 s)
      this.history = this.history.filter(
        (h, k, all) =>
          this.pushed - h.end <= 35 * SR &&
          (k === all.length - 1 || all[k + 1].end - h.end >= SR || this.pushed - h.end <= 12 * SR),
      );
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
