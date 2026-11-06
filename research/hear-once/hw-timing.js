#!/usr/bin/env node
// hw-timing.js [out.json] — real model cost on THIS computer for today's windows and hear-once's,
// as CPU load per second of audio (1.0 = the computer is fully busy just keeping up).
// No audio needed (the model's cost does not depend on what it hears): seeded noise.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Infer } = require(path.resolve(__dirname, '../../www/main/addons/voice-follow/engine/infer'));
const MODEL = process.env.MODEL || path.join(os.homedir(), 'personal/vf-shared-models/model.int8.onnx');
const SR = 16000;
let seed = 7;
const noise = (s) => { const a = new Float32Array(Math.round(s * SR)); for (let i = 0; i < a.length; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; a[i] = (seed / 2147483648 - 0.5) * 0.1; } return a; };
async function msFor(infer, s, n = Number(process.env.N || 15)) {
  const buf = noise(s);
  for (let i = 0; i < 3; i++) await infer.run(buf);
  const ms = [];
  for (let i = 0; i < n; i++) { const t = performance.now(); await infer.run(buf); ms.push(performance.now() - t); }
  ms.sort((a, b) => a - b);
  return { median: +ms[n >> 1].toFixed(1), p90: +ms[Math.floor(n * 0.9)].toFixed(1) };
}
(async () => {
  const cpus = os.cpus();
  const rows = [];
  const threadsList = (process.env.THREADS || '1,2,4').split(',').map(Number);
  for (const th of threadsList) {
    process.env.VF_ORT_THREADS = String(th);
    const infer = await Infer.create(MODEL);
    const t4 = await msFor(infer, 4);
    const t10 = await msFor(infer, 10);
    const tChunk = await msFor(infer, 4.48); // hear-once piece: 2.56 s before + 1.28 + 0.64 after
    const tDraft = await msFor(infer, 1.6); // light draft: 0.64 s before + ~1 s newest
    const load = {
      // today, kirtan: follower 4 s every 0.25 s + recognizer every 0.5 s (4 s following, 10 s searching)
      todayFollowing: (4 * t4.median + 2 * t4.median) / 1000,
      todaySearching: (4 * t4.median + 2 * t10.median) / 1000,
      hearOnceNoDraft: (tChunk.median / 1.28) / 1000,
      hearOnceLightDraft: (tChunk.median / 1.28 + tDraft.median) / 1000,
    };
    Object.keys(load).forEach((k) => { load[k] = +load[k].toFixed(2); });
    rows.push({ threads: th, ms: { t4, t10, tChunk, tDraft }, load });
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  const out = { cpu: cpus[0].model, logical: cpus.length, mhz: cpus[0].speed, platform: `${os.platform()} ${os.arch()}`, ramGB: Math.round(os.totalmem() / 2 ** 30), rows };
  console.log(JSON.stringify({ cpu: out.cpu, logical: out.logical, platform: out.platform }));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
