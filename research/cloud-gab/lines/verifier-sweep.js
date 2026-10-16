#!/usr/bin/env node
// verifier-sweep.js <vsweep.jsonl> — offline sweep of the Shabad verifier's settings on the app's OWN candidates.
// Input: one line per verifier check from a debug build that never locks (behaviour = verifier off) and logs every pool
// Shabad's fit: {clip, t (s of audio), sec, fits: [[shabadId, score, n, bestSearchRank], ...]}.
// For each pool size K (Shabads the search ranked < K) and lead threshold L, with C checks in a row required:
//   inPool = the sung Shabad is a candidate at all;  top = it fits best;  fire = lead >= L on C checks in a row
//   (same Shabad);  right/wrong = what such a lock would put on screen. Practice clips only (the debug run's set).
const fs = require('fs');
const path = require('path');
const BENCH = process.env.BENCH || '/home/user/gab/bench';
const L = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const truthOf = {};
const truthAt = (clip, t) => {
  const id = clip.split('_')[0];
  if (!truthOf[id]) {
    const dirs = ['1-kirtan-shabad', '5-akhand-kirtan'].map((d) => path.join(BENCH, d, id, 'shabads.csv')).filter(fs.existsSync);
    const [h, ...rows] = fs.readFileSync(dirs[0], 'utf8').trim().split('\n'); const k = h.split(',');
    truthOf[id] = rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [k[i], v])));
  }
  const r = truthOf[id].find((x) => t >= Number(x.start_s) && t < Number(x.end_s));
  return r ? new Set(String(r.shabadId).split('|').map(Number)) : null;
};
const out = [];
for (const K of [3, 6, 12, 25]) for (const C of [1, 2]) for (const LD of [0, 5, 10, 20, 30, 40]) {
  let n = 0, inPool = 0, top = 0, fire = 0, right = 0;
  const run = {};
  for (const x of L) {
    const tr = truthAt(x.clip, x.t); if (!tr) continue;
    const f = x.fits.filter((e) => e[3] < K).sort((a, b) => b[1] - a[1]);
    if (f.length < 2) continue;
    n++;
    if (f.some((e) => tr.has(e[0]))) inPool++;
    if (tr.has(f[0][0])) top++;
    const lead = f[0][1] - f[1][1];
    const key = x.clip;
    const r = run[key] || { id: null, k: 0 };
    if (lead >= LD) { r.k = r.id === f[0][0] ? r.k + 1 : 1; r.id = f[0][0]; } else { r.k = 0; r.id = null; }
    run[key] = r;
    if (r.k >= C) { fire++; if (tr.has(f[0][0])) right++; }
  }
  out.push({ K, C, LD, n, inPool: +(100 * inPool / n).toFixed(0), top: +(100 * top / n).toFixed(0), fire, right, wrong: fire - right });
}
console.log('K = search ranks pooled, C = checks in a row, LD = lead needed; % of checks while the app is still searching');
console.log('K  C  LD | checks inPool% top% | fires right wrong');
for (const o of out) console.log(`${String(o.K).padEnd(2)} ${o.C}  ${String(o.LD).padEnd(2)} | ${String(o.n).padEnd(6)} ${String(o.inPool).padEnd(7)} ${String(o.top).padEnd(4)} | ${String(o.fire).padEnd(5)} ${String(o.right).padEnd(5)} ${o.wrong}`);
