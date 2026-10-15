#!/usr/bin/env node
// bench-aligned.js — a local GAB dataset copy whose clips without human pangti truth use the two-model aligned keys
// (only the auto-accepted rows by default), so `gab run --manifest <out>` can report "sangat sees the right pangti"
// on every tier. The manifest's lines_source becomes "aligned" for those clips: GAB shows them as information,
// never as a headline (human-labels-first). Clips with human lines keep them.
//   node bench-aligned.js [--out /home/user/gab/bench-aligned] [--all-rows]
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const SRC = '/home/user/gab/bench', KEYS = '/home/user/gab/lines/keys', OUT = arg('out', '/home/user/gab/bench-aligned');
const split = (l) => { const v = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(cur); cur = ''; } else cur += ch; } v.push(cur); return v; };
const join = (v) => v.map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',');
const [head, ...rows] = fs.readFileSync(path.join(SRC, 'manifest.csv'), 'utf8').split('\n');
const k = split(head); const iId = k.indexOf('id'), iF = k.indexOf('content_folder'), iN = k.indexOf('lines_n'), iS = k.indexOf('lines_source');
let n = 0;
const out = [head];
for (const l of rows) {
  if (!l.trim()) { out.push(l); continue; }
  const v = split(l); const id = v[iId], folder = v[iF];
  const d = path.join(OUT, folder, id); fs.mkdirSync(d, { recursive: true });
  for (const f of ['shabads.csv', 'lines.csv']) { const s = path.join(SRC, folder, id, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(d, f)); }
  const key = path.join(KEYS, folder, id, 'lines.csv');
  if (fs.existsSync(key) && !/^human|^broadcast/.test(v[iS])) {
    const [h, ...ls] = fs.readFileSync(key, 'utf8').trim().split('\n');
    const keep = ls.filter((x) => argv.includes('--all-rows') || x.endsWith(',aligned-2model-sure'));
    fs.writeFileSync(path.join(d, 'lines.csv'), [h, ...keep].join('\n') + '\n');
    v[iN] = String(keep.length); v[iS] = 'aligned'; n++;
  }
  out.push(join(v));
}
fs.writeFileSync(path.join(OUT, 'manifest.csv'), out.join('\n'));
const hv = path.join(SRC, 'human-verdicts'); if (fs.existsSync(hv)) fs.cpSync(hv, path.join(OUT, 'human-verdicts'), { recursive: true });
console.log(`${OUT}: ${n} clips now carry aligned pangti keys`);
