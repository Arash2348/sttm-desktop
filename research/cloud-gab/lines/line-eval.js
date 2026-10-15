#!/usr/bin/env node
// line-eval.js — how close are the aligned pangti starts to human pangti starts? (GAB-Hard has human line truth:
// the sevadaar's screen, which lags the singing by 0-3 s.) For each aligned start (by source), find the human start
// of the same verseId nearest in time; report |difference| buckets and the signed median (negative = aligned earlier).
//   node line-eval.js [--keys /home/user/gab/lines/keys] [--truth <gab-hf dir>]
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const KEYS = arg('keys', '/home/user/gab/lines/keys');
const TRUTH = arg('truth', '/home/user/gab/bench');
const read = (f) => { const [h, ...r] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return r.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };
const by = {};
let clips = 0;
for (const folder of fs.readdirSync(KEYS)) {
  for (const id of fs.readdirSync(path.join(KEYS, folder))) {
    const t = path.join(TRUTH, folder, id, 'lines.csv');
    if (!fs.existsSync(t)) continue;
    const human = read(t).filter((r) => r.source === 'human');
    if (!human.length) continue;
    clips++;
    for (const a of read(path.join(KEYS, folder, id, 'lines.csv'))) {
      const same = human.filter((h) => h.verseId === a.verseId);
      const d = same.length ? same.map((h) => Number(h.start_s) - Number(a.start_s)).sort((x, y) => Math.abs(x) - Math.abs(y))[0] : null;
      (by[a.source] = by[a.source] || []).push(d);
    }
  }
}
const pct = (n, d) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;
console.log(`clips with human line truth: ${clips}`);
console.log('| aligned source | starts | same pangti in human key | human within 1 s | within 3 s | within 5 s | median human - aligned (s) |');
console.log('|---|---|---|---|---|---|---|');
for (const [src, ds] of Object.entries(by)) {
  const f = ds.filter((x) => x != null);
  const med = f.length ? [...f].sort((a, b) => a - b)[Math.floor(f.length / 2)] : null;
  console.log(`| ${src} | ${ds.length} | ${pct(f.length, ds.length)} | ${pct(f.filter((x) => Math.abs(x) <= 1).length, ds.length)} | ${pct(f.filter((x) => Math.abs(x) <= 3).length, ds.length)} | ${pct(f.filter((x) => Math.abs(x) <= 5).length, ds.length)} | ${med == null ? '-' : med.toFixed(2)} |`);
}
