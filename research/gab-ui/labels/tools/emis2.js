#!/usr/bin/env node
// emis2.js — full-clip CTC log-probs (25 fps x 257: 256 tokens + blank) from one of two speech models, for line
// alignment (research/follower-bench/align.js reads cache/<clip>.emis.f32 in exactly this layout).
//
//   node emis2.js karanbir <wav> <out.f32>   # the app's model (raw-audio ONNX, the app's own Infer)
//   node emis2.js surinder <wav> <out.f32>   # surindersinghssj/indicconformer-pa-v3-kirtan, onnx-pa-only fp32
//                                            # (80-mel NeMo front end below; same 256-token vocabulary)
// Like follower-bench/emis.js: 10 s chunks, each keeps only its middle 6 s (models lose words on long inputs).
// env: MODEL_KARANBIR, MODEL_SURINDER, THREADS (default 3), APP_ROOT (an sttm-desktop checkout with node_modules)
const fs = require('fs');
const path = require('path');

const APP = process.env.APP_ROOT || '/home/user/sttm-desktop';
const ort = require(path.join(APP, 'node_modules/onnxruntime-node'));
const SR = 16000, FPS = 25, C = 257, KEEP = 6, PAD = 2;

function readWav(f) {
  const b = fs.readFileSync(f);
  // find the "data" chunk (most of our wavs have a 44-byte header, but not all)
  let o = 12;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4);
    if (id === 'data') return Float32Array.from(new Int16Array(b.buffer.slice(b.byteOffset + o + 8, b.byteOffset + o + 8 + (Math.min(n, b.length - o - 8) & ~1))), (x) => x / 32768);
    o += 8 + n + (n & 1);
  }
  throw new Error(`no data chunk in ${f}`);
}

// ---- NeMo AudioToMelSpectrogramPreprocessor (indicconformer defaults): preemph 0.97, n_fft 512, win 400 hann
// (symmetric), hop 160, power spectrum, 80 slaney mels 0-8000 Hz, log(x + 2^-24), per-feature normalisation.
const NFFT = 512, WIN = 400, HOP = 160, NMEL = 80;
const hann = Float64Array.from({ length: WIN }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (WIN - 1)));
const winPad = new Float64Array(NFFT); winPad.set(hann, (NFFT - WIN) >> 1);
const hz2mel = (f) => (f < 1000 ? f / (200 / 3) : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27));
const mel2hz = (m) => (m < 15 ? m * (200 / 3) : 1000 * Math.exp((m - 15) * (Math.log(6.4) / 27)));
const MELFB = (() => {
  const nb = NFFT / 2 + 1, fft = Float64Array.from({ length: nb }, (_, k) => (k * SR) / NFFT);
  const mpts = Array.from({ length: NMEL + 2 }, (_, i) => mel2hz(hz2mel(0) + ((hz2mel(SR / 2) - hz2mel(0)) * i) / (NMEL + 1)));
  return Array.from({ length: NMEL }, (_, m) => {
    const lo = mpts[m], c = mpts[m + 1], hi = mpts[m + 2], enorm = 2 / (hi - lo), w = new Float64Array(nb);
    for (let k = 0; k < nb; k++) w[k] = Math.max(0, Math.min((fft[k] - lo) / (c - lo), (hi - fft[k]) / (hi - c))) * enorm;
    return w;
  });
})();
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function mel(pcm) {
  const x = new Float64Array(pcm.length);
  x[0] = pcm[0]; for (let i = 1; i < pcm.length; i++) x[i] = pcm[i] - 0.97 * pcm[i - 1];
  const T = Math.floor(x.length / HOP) + 1, out = new Float32Array(NMEL * T), half = NFFT / 2;
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT), pw = new Float64Array(half + 1);
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < NFFT; k++) { const s = t * HOP - half + k; re[k] = (s >= 0 && s < x.length ? x[s] : 0) * winPad[k]; im[k] = 0; }
    fft(re, im);
    for (let k = 0; k <= half; k++) pw[k] = re[k] * re[k] + im[k] * im[k];
    for (let m = 0; m < NMEL; m++) { let s = 0; const w = MELFB[m]; for (let k = 0; k <= half; k++) s += w[k] * pw[k]; out[m * T + t] = Math.log(s + 2 ** -24); }
  }
  for (let m = 0; m < NMEL; m++) {
    let mu = 0; for (let t = 0; t < T; t++) mu += out[m * T + t]; mu /= T;
    let v = 0; for (let t = 0; t < T; t++) v += (out[m * T + t] - mu) ** 2; const sd = Math.sqrt(v / Math.max(1, T - 1)) + 1e-5;
    for (let t = 0; t < T; t++) out[m * T + t] = (out[m * T + t] - mu) / sd;
  }
  return { data: out, T };
}

async function engine(name) {
  const n = parseInt(process.env.THREADS || '3', 10);
  if (name === 'karanbir') {
    const { Infer } = require(path.join(APP, 'www/main/addons/voice-follow/engine/infer'));
    const VOCAB = require(path.join(APP, 'www/main/addons/voice-follow/engine/assets/vocab'));
    const sess = await ort.InferenceSession.create(process.env.MODEL_KARANBIR || '/home/user/gab/model/model.int8.onnx', { intraOpNumThreads: n, interOpNumThreads: 1 });
    const inf = new Infer(sess, VOCAB);
    return (pcm) => inf.emissions(pcm);
  }
  if (name === 'surinder') {
    const sess = await ort.InferenceSession.create(process.env.MODEL_SURINDER || '/home/user/gab/model/surinder/indicconformer-pa-ctc.onnx', { intraOpNumThreads: n, interOpNumThreads: 1 });
    return async (pcm) => {
      const f = mel(pcm);
      const r = await sess.run({ audio_signal: new ort.Tensor('float32', f.data, [1, NMEL, f.T]), length: new ort.Tensor('int64', BigInt64Array.from([BigInt(f.T)]), [1]) });
      const o = r.logprobs; const frames = o.dims[1], cc = o.dims[2];
      if (cc !== C) throw new Error(`surinder: ${cc} classes, expected ${C}`);
      return { data: o.data, frames };
    };
  }
  throw new Error(`model ${name}: karanbir | surinder`);
}

async function main() {
  const [name, wav, out] = process.argv.slice(2);
  const run = await engine(name);
  const pcm = readWav(wav);
  const dur = pcm.length / SR, total = Math.floor(dur * FPS), buf = new Float32Array(total * C);
  // frames no chunk covers stay "blank certain" (log-prob 0 on blank, -inf-ish elsewhere)
  for (let g = 0; g < total; g++) { buf.fill(-30, g * C, (g + 1) * C); buf[g * C + 256] = 0; }
  for (let s = 0; s < dur; s += KEEP) {
    const a = Math.max(0, s - PAD), b = Math.min(dur, s + KEEP + PAD);
    const e = await run(pcm.subarray(Math.floor(a * SR), Math.floor(b * SR)));
    const f0 = Math.round((s - a) * FPS), f1 = Math.min(e.frames, f0 + KEEP * FPS);
    for (let f = f0; f < f1; f++) { const g = Math.round(a * FPS) + f; if (g < total) buf.set(e.data.subarray(f * C, (f + 1) * C), g * C); }
  }
  fs.writeFileSync(out, Buffer.from(buf.buffer));
  console.log(`${path.basename(wav)} ${name} ${total} frames (${dur.toFixed(1)} s)`);
}
if (require.main === module) main().catch((e) => { console.error(e.stack); process.exit(1); });
module.exports = { mel, readWav };
