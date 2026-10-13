#!/usr/bin/env node
/* ut13-bench.js — replay the Oct 13 user-test sessions (ut13_s90 / ut13_s91, see ../ut13-truth.json)
 * through the real VoiceFollow component headless, fresh Start at clip t=0, and score every truth
 * segment: seconds from the segment start until an expected id is on screen, and any other Shabad
 * shown inside the segment (a wrong switch). The driver is the cached-replay harness in
 * ~/personal/sttm-replay (VF_TOOLS overrides); the app under test is VF_DRIVER_ROOT.
 * Usage: node -r <tools>/no-shadow-preload.js ut13-bench.js --out <dir> [--only ut13_s90] [--fast] [--to 700]
 */
const fs = require('fs');
const path = require('path');
const TOOLS = process.env.VF_TOOLS || '/Users/asingh02/personal/sttm-replay/research/level2-dataset/tools';
const { createDriver } = require(path.join(TOOLS, 'bench-driver'));
const CLIPS = '/Users/asingh02/personal/live-darbar-venues/clips';
const MODEL = process.env.MODEL || '/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx';
const USERDATA = process.env.VF_BANIDB_USER_DATA || path.join(process.env.HOME, 'Library/Application Support/SikhiToTheMax');
const SR = 16000, CHUNK = 2048;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const TRUTH = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ut13-truth.json')));
const PARTS = Object.keys(TRUTH).filter((k) => !k.startsWith('_'));
const ONLY = arg('only', '') ? new Set(arg('only', '').split(',')) : null;
const FAST = process.argv.includes('--fast');
const TO = Number(arg('to', 0)) || 0;
const OUT = arg('out'); fs.mkdirSync(OUT, { recursive: true });
function readWav(file) {
  const b = fs.readFileSync(file); let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), sz = b.readUInt32LE(off + 4);
    if (id === 'data') { const n = Math.floor(sz / 2), out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2) / 32768; return out; }
    off += 8 + sz + (sz & 1);
  }
  throw new Error('no data chunk');
}
const KEEP = new Set(['shabad', 'seeking', 'verse', 'length', 'pane', 'component-error', 'transcript', 'switch-comparison', 'paath-follower']);
function score(part, events) {
  const shown = events.filter((e) => e.type === 'shabad').sort((a, b) => a.t - b.t);
  const seeking = events.filter((e) => e.type === 'seeking').sort((a, b) => a.t - b.t);
  const at = (t) => { let s = null; for (const e of shown) { if (e.t <= t) s = e.shabadId; else break; } let k = false; for (const e of seeking) { if (e.t <= t) k = e.visible; else break; } return k ? null : s; };
  const rows = [];
  for (const seg of TRUTH[part].segments) {
    if (seg.skip) continue;
    const ok = new Set(seg.expect);
    let found = null; const wrong = new Map();
    for (let t = seg.start; t <= seg.end + 20; t += 0.1) {
      const s = at(t);
      if (found == null && ok.has(s)) found = +(t - seg.start).toFixed(1);
      if (t <= seg.end && s != null && !ok.has(s)) wrong.set(s, (wrong.get(s) || 0) + 0.1);
    }
    // switches INTO a wrong shabad during the segment (a wrong page carried in from before is not a new wrong switch)
    const wrongSwitches = shown.filter((e) => e.t >= seg.start && e.t <= seg.end && !ok.has(e.shabadId)).map((e) => `${e.shabadId}@${e.t.toFixed(1)}`);
    rows.push({ name: seg.name, start: seg.start, end: seg.end, cold: !!seg.cold, informational: !!seg.informational, found_s: found, wrongSwitches, wrong_s: [...wrong].map(([k, v]) => `${k}:${v.toFixed(1)}`) });
  }
  return rows;
}
(async () => {
  for (const part of PARTS) {
    if (ONLY && !ONLY.has(part)) continue;
    let pcm = readWav(path.join(CLIPS, TRUTH[part].wav));
    if (TO) pcm = pcm.subarray(0, TO * SR);
    const events = []; const t0 = Date.now();
    const driver = await createDriver({ model: MODEL, userData: USERDATA, cacheId: part, onEvent: (ev) => {
      if (!KEEP.has(ev.type)) return;
      const { inferenceMs, stack, ...keep } = ev; events.push(keep);
    } });
    await driver.start();
    const wall0 = Date.now();
    for (let p = 0; p < pcm.length; p += CHUNK) {
      const chunk = pcm.subarray(p, Math.min(p + CHUNK, pcm.length));
      const audioT = (p + chunk.length) / SR;
      await driver.push(chunk, audioT);
      if (!FAST) { const ahead = audioT * 1000 - (Date.now() - wall0); if (ahead > 2) await new Promise((r) => setTimeout(r, ahead)); }
    }
    await driver.stop();
    const rows = score(part, events);
    fs.writeFileSync(path.join(OUT, `${part}.json`), JSON.stringify({ part, dur: pcm.length / SR, wall_s: (Date.now() - t0) / 1000, score: rows, events }, null, 0));
    const sh = events.filter((e) => e.type === 'shabad').map((e) => `${e.shabadId}@${e.t.toFixed(1)}`);
    console.log(`${part} | ${((Date.now() - t0) / 1000).toFixed(0)} s wall | errors ${events.filter((e) => e.type === 'component-error').length} | shown ${sh.join(' ')}`);
    for (const r of rows) console.log(`  ${r.cold ? 'COLD ' : ''}${r.name.padEnd(62)} ${String(r.start).padStart(4)}-${String(r.end).padEnd(4)} found ${r.found_s == null ? 'NEVER' : `+${r.found_s} s`} | wrong switches ${r.wrongSwitches.join(' ') || '-'} | wrong page s ${r.wrong_s.join(' ') || '-'}`);
  }
})().catch((e) => { console.error(e.stack); process.exit(1); });
