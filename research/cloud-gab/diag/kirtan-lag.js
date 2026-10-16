#!/usr/bin/env node
// kirtan-lag.js <replay dir (gab run --keep: .../replay/base)> <dataset dir> [--folder 1-kirtan-shabad]
// P0 Kirtan diagnosis: where the not-right pangti time comes from, pangti change by pangti change.
// For every truth pangti segment: lag = its start -> the first moment the screen is ON it; what the screen showed
// meanwhile (the previous pangti, an earlier one, a later one, another Shabad, blank). Seconds are weighted so the
// table adds up to the headline's missing %. Uses sangat-score's own per-moment trace (same rules as GAB).
const fs = require('fs');
const path = require('path');
const TOOLS = process.env.GAB_TOOLS || '/home/user/gab-tools/research/level2-dataset/tools';
const sv = require(path.join(TOOLS, 'sangat-score'));
const [runDir, dsDir] = process.argv.slice(2);
const folder = process.argv.includes('--folder') ? process.argv[process.argv.indexOf('--folder') + 1] : '1-kirtan-shabad';
const ds = sv.loadDataset(dsDir);
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.events.jsonl')) files.push(p); } })(runDir);
const lagBins = [[0, 1], [1, 2], [2, 3], [3, 5], [5, 10], [10, 1e9]];
const lagSec = lagBins.map(() => 0); const lagN = lagBins.map(() => 0);
const shown = { 'previous pangti': 0, 'two or more back': 0, 'later pangti': 0, 'other Shabad / wrong': 0, 'blank': 0, 'same Shabad, unknown pangti': 0 };
let voiced = 0, notRight = 0, segs = 0, never = 0, clips = 0;
const perClip = [];
for (const f of files) {
  const key = path.basename(f).replace(/\.events\.jsonl$/, '');
  const row = ds.find(key) || ds.find(key.split('_')[0]);
  if (!row || !String(row.content_folder).startsWith(folder)) continue;
  const trace = [];
  let r;
  try { r = sv.scoreClip(ds, row, f, { trace }); } catch (e) { continue; }
  if (!r.line || !r.line.acc || !trace.length) continue;
  clips++;
  // group the trace by truth segment (consecutive moments with the same truth text)
  const step = trace.length > 1 ? Math.max(0.01, trace[1].t - trace[0].t) : 1;
  let seg = null; const segList = [];
  for (const m of trace) {
    if (!seg || m.truth !== seg.truth) { seg = { truth: m.truth, t0: m.t, moments: [] }; segList.push(seg); }
    seg.moments.push(m);
  }
  let clipNot = 0;
  segList.forEach((s, i) => {
    segs++;
    const prev = segList[i - 1]; const next = segList[i + 1];
    const firstOn = s.moments.find((m) => m.b === 'on');
    const lag = firstOn ? firstOn.t - s.t0 : null;
    if (lag == null) never++;
    const bi = lag == null ? lagBins.length - 1 : lagBins.findIndex(([a, b]) => lag >= a && lag < b);
    lagN[bi]++;
    for (const m of s.moments) {
      voiced += step;
      if (m.b === 'on' || m.b === 'catching') continue;
      notRight += step; clipNot += step;
      if (!firstOn || m.t < firstOn.t) lagSec[bi] += step; // time lost before the pangti first appears
      const sc = m.screen || '';
      if (m.b === 'blank') shown.blank += step;
      else if (m.b === 'wrong') shown['other Shabad / wrong'] += step;
      else if (prev && sc === prev.truth) shown['previous pangti'] += step;
      else if (next && sc === next.truth) shown['later pangti'] += step;
      else if (m.b === 'behind' || m.b === 'lost') shown['two or more back'] += step;
      else if (m.b === 'ahead') shown['later pangti'] += step;
      else shown['same Shabad, unknown pangti'] += step;
    }
  });
  perClip.push({ id: row.id, lost: clipNot, voiced: r.line.acc.voiced || 0 });
}
sv.close();
const pct = (s) => `${(100 * s / voiced).toFixed(1)}%`;
console.log(`${clips} recordings, ${(voiced / 60).toFixed(1)} min voiced, not right ${pct(notRight)} (${segs} pangti changes, ${never} pangtis never shown)`);
console.log('\nTime lost before a pangti first appears, by how late it was (share of all voiced time; count of changes):');
lagBins.forEach(([a, b], i) => console.log(`  ${a}-${b === 1e9 ? '∞ / never' : b} s`.padEnd(16), pct(lagSec[i]).padStart(6), `  ${lagN[i]} changes`));
console.log(`  (lag part of all not-right time: ${pct(lagSec.reduce((x, y) => x + y, 0))})`);
console.log('\nWhat the screen showed during not-right time:');
for (const [k, v] of Object.entries(shown).sort((x, y) => y[1] - x[1])) console.log(`  ${k.padEnd(28)} ${pct(v)}`);
