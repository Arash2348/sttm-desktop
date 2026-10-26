// Hardware check: the speech-music classifier (engine/speech-music.js) loads and runs here, and
// gives the same scores as the reference machine on fixed synthetic signals.
const path = require('path');
const sm = require(path.resolve('www/main/addons/voice-follow/engine/speech-music.js'));
const SR = 16000;
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const sig = {
  silence: () => new Float32Array(2 * SR),
  noise: () => Float32Array.from({ length: 2 * SR }, () => 0.1 * rnd()),
  // a harmonium-like chord (several harmonics, steady)
  chord: () => Float32Array.from({ length: 2 * SR }, (_, i) => [220, 277, 330, 440, 554].reduce((a, f, k) => a + Math.sin(2 * Math.PI * f * i / SR) * 0.08 / (k + 1), 0)),
  // a voice-like buzz with syllable-rate amplitude modulation
  voicelike: () => Float32Array.from({ length: 2 * SR }, (_, i) => { const env = Math.max(0, Math.sin(2 * Math.PI * 4 * i / SR)); let v = 0; for (let h = 1; h < 15; h += 1) v += Math.sin(2 * Math.PI * 140 * h * i / SR) / h; return 0.15 * env * v; }),
};
(async () => {
  const s = await sm.ensure();
  if (!s) { console.log('LOAD FAILED'); process.exit(1); }
  const out = {};
  for (const [k, f] of Object.entries(sig)) {
    seed = 7;
    const r = await sm.classify(f(), SR);
    out[k] = r && { speech: +r.speech.toFixed(4), music: +r.music.toFixed(4), singing: +r.singing.toFixed(4) };
  }
  // and the app's own path: 48 kHz input resampled inside classify
  const r48 = await sm.classify(Float32Array.from({ length: 6 * 16000 }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 440 * i / 48000)), 48000);
  out.resample48k = r48 && { music: +r48.music.toFixed(4) };
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version, ort: require('onnxruntime-node/package.json').version, out }));
  const ref = process.env.REF ? JSON.parse(process.env.REF) : null;
  if (ref) {
    let worst = 0;
    for (const k of Object.keys(ref)) for (const c of Object.keys(ref[k])) worst = Math.max(worst, Math.abs(ref[k][c] - out[k][c]));
    console.log('max difference from the reference machine:', worst.toFixed(5));
    if (worst > 0.02) { console.log('MISMATCH'); process.exit(1); }
  }
  console.log('OK');
})().catch((e) => { console.log('ERROR', e && e.message); process.exit(1); });
