/* Build a MULTI-SHABAD switch stream from the labeled YouTube pull (Bhai Harjinder
 * Singh Ji — a DIFFERENT raagi/voice than the 86-min benchmark's cANTWzO5P4Y).
 * Takes the cleanly title-labeled clips, slices ~45s of the sung middle of each,
 * concatenates them back-to-back with a short gap, and writes a manifest in the
 * SAME format vf-kirtan-switch-eval.js consumes (WAV=/MANIFEST= overrides).
 *
 * Output: kirtan_pull_16k.wav + kirtan_pull_manifest.json
 *   node /Users/asingh02/aai/kirtan_bench/build_pull_stream.js
 */
const fs = require('fs');
const path = require('path');

const PULL = process.env.PULL_DIR || '/Users/asingh02/aai/kirtan_bench/pull';
const OUT_WAV = process.env.OUT_WAV || '/Users/asingh02/aai/kirtan_bench/kirtan_pull_16k.wav';
const OUT_MAN = process.env.OUT_MAN || '/Users/asingh02/aai/kirtan_bench/kirtan_pull_manifest.json';
const SR = 16000;
const SEG_S = parseFloat(process.env.SEG_S || '45');   // sung seconds taken per shabad
const FRAC = parseFloat(process.env.FRAC || '0.35');   // start slice at this fraction of the clip (skip intro)
const TITLE_MIN = parseFloat(process.env.TITLE_MIN || '75');

function readWavFloat32(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = Math.floor(sz / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + sz + (sz & 1);
  }
  throw new Error(`no data chunk in ${file}`);
}
function wavWrite(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { let s = Math.max(-1, Math.min(1, samples[i])); buf.writeInt16LE((s * 32767) | 0, 44 + i * 2); }
  fs.writeFileSync(file, buf);
}

const labels = JSON.parse(fs.readFileSync(path.join(PULL, 'labels.json')));
// clean, unique-shabad set
const seen = new Set();
const chosen = [];
for (const o of labels) {
  if (!o.sid || o.titleScore < TITLE_MIN || !o.nLines) continue;
  if (seen.has(o.sid)) continue;
  seen.add(o.sid);
  chosen.push(o);
}
console.log(`chosen ${chosen.length} unique-shabad clips (titleScore>=${TITLE_MIN})`);

const gap = new Float32Array(Math.floor(0.3 * SR));
const parts = [];
const segs = [];
const linesBySid = {};
let cum = 0;
for (const o of chosen) {
  let a = readWavFloat32(path.join(PULL, o.file));
  const startSamp0 = Math.floor(a.length * FRAC);
  let seg = a.slice(startSamp0, startSamp0 + SEG_S * SR);
  if (seg.length < SEG_S * SR * 0.6) seg = a.slice(0, SEG_S * SR); // fallback only if clip too short for requested SEG_S
  const start = cum / SR;
  parts.push(seg); cum += seg.length;
  segs.push({ shabadId: String(o.sid), start: +start.toFixed(3), end: +(cum / SR).toFixed(3), startSamp: Math.floor(start * SR), endSamp: cum, clipDur: +(seg.length / SR).toFixed(2) });
  parts.push(gap); cum += gap.length;
  linesBySid[String(o.sid)] = o.lines;
}
const total = new Float32Array(cum);
let off = 0;
for (const p of parts) { total.set(p, off); off += p.length; }
wavWrite(OUT_WAV, total);
fs.writeFileSync(OUT_MAN, JSON.stringify({ sr: SR, segments: segs, lines: linesBySid }));
const durs = segs.map((s) => s.clipDur).sort((a, b) => a - b);
console.log(`wrote ${OUT_WAV}  (${(total.length / SR / 60).toFixed(1)} min)`);
console.log(`segments: ${segs.length}  switches: ${segs.length - 1}  distinct shabads: ${Object.keys(linesBySid).length}`);
console.log(`seg dur: min ${durs[0]} median ${durs[durs.length >> 1]} max ${durs[durs.length - 1]}`);
