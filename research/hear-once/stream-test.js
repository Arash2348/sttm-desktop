#!/usr/bin/env node
// stream-test.js <wav> [seconds] — the real HearOnce on a stream, as the app's engines call it:
// recognizer 10 s / 0.5 s and follower 4 s / 0.25 s windows of one 2048-sample chunked stream.
// Checks frame counts, text vs a direct pass, encoded audio seconds per audio second.
const fs = require('fs');
const path = require('path');
const ENGINE = path.resolve(__dirname, '../../www/main/addons/voice-follow/engine');
const { Infer } = require(path.join(ENGINE, 'infer'));
const { HearOnce, framesFor } = require(path.join(ENGINE, 'hearonce'));
const MODEL = process.env.MODEL || path.join(process.env.HOME, 'personal/vf-shared-models/model.int8.onnx');
const SR = 16000;
function readWav(f) { const b = fs.readFileSync(f); let o = 12; while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'data') { const n = sz >> 1, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = b.readInt16LE(o + 8 + 2 * i) / 32768; return a; } o += 8 + sz + (sz & 1); } }
function lev(a, b) { let p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; }
const sim = (a, b) => (a.length || b.length ? 1 - lev(a, b) / Math.max(a.length, b.length) : 1);
(async () => {
  const pcm = readWav(process.argv[2]).subarray(0, Number(process.argv[3] || 60) * SR);
  const infer = await Infer.create(MODEL);
  // frame-count formula check
  for (const n of [16000, 40000, 64000, 64000 + 777, 160000]) { const e = await infer.run(pcm.subarray(0, n)); if (e.frames !== framesFor(n)) console.log('FRAMES MISMATCH', n, e.frames, framesFor(n)); }
  const num=(k)=>process.env[k]?Number(process.env[k]):undefined; const ho = new HearOnce(infer, { draft: process.env.VF_HO_DRAFT === '1', draftHop: num('VF_HO_DRAFT_HOP'), C: num('VF_HO_C'), R: num('VF_HO_R'), L: num('VF_HO_L'), Ld: num('VF_HO_LD') });
  infer.notePassExternal = () => {};
  const bufs = { rec: new Float32Array(0), fol: new Float32Array(0) };
  const acc = { rec: 0, fol: 0 };
  const W = { rec: 10, fol: 4 }, HOPS = { rec: 0.5, fol: 0.25 };
  const res = { rec: [], fol: [] };
  let direct = 0;
  for (let p = 0; p < pcm.length; p += 2048) {
    const ch = pcm.subarray(p, Math.min(p + 2048, pcm.length));
    for (const k of ['rec', 'fol']) {
      const m = new Float32Array(bufs[k].length + ch.length); m.set(bufs[k]); m.set(ch, bufs[k].length);
      bufs[k] = m.length > W[k] * SR ? m.slice(m.length - W[k] * SR) : m;
      acc[k] += ch.length;
      if (acc[k] < HOPS[k] * SR || bufs[k].length < SR) continue;
      acc[k] = 0;
      const ref = await infer.run(bufs[k]);
      direct += bufs[k].length / SR;
      const got = await ho.serve(bufs[k]);
      if (!got) { res[k].push({ t: (p + ch.length) / SR, served: false }); continue; }
      const a = infer.decode(infer.greedy(ref)).replace(/\s+/g, ''), b = infer.decode(infer.greedy(got)).replace(/\s+/g, '');
      res[k].push({ t: (p + ch.length) / SR, served: true, sim: sim(a, b), lag: got.hearOnce.lagS, framesOk: got.frames === ref.frames });
    }
  }
  const dur = pcm.length / SR;
  for (const k of ['rec', 'fol']) {
    const s = res[k].filter((r) => r.served);
    const mean = (xs) => xs.reduce((x, y) => x + y, 0) / (xs.length || 1);
    console.log(k, { windows: res[k].length, served: s.length, textSimVsDirect: +mean(s.map((r) => r.sim)).toFixed(3), lagS: +mean(s.map((r) => r.lag)).toFixed(2), framesEqual: s.filter((r) => r.framesOk).length });
  }
  console.log({ stats: ho.stats, hearOnceEncodePerAudioS: +(ho.stats.encodedS / dur).toFixed(2), todayEncodePerAudioS: +(direct / dur).toFixed(2) });
})().catch((e) => { console.error(e); process.exit(1); });
