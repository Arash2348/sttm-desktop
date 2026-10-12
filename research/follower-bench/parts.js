// Scores followers on real service parts (cached windows replay), each at the step it
// ships with, with the app's confidence gate. Also used for the 55-clip set.
//   cd <workdir with cache/ truth/ banis/>; node parts.js part:baniId [...]   env VARIANTS=c8,paath
const fs = require('fs');
const B = __dirname;
process.chdir(process.env.WORK || process.cwd());
const { CachedInfer } = require(B + '/replay');
const VARIANTS = require(B + '/variants');
const STEP = 0.05, GATE = process.env.GATE === undefined ? 0.4 : Number(process.env.GATE), MINCHK = Number(process.env.MINCHK || 0.6);
const tokenize = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);

// Each follower at the step it ships with: c8 every 0.25 s, paath every 0.125 s. A 0.125 s
// cache holds the 0.25 s grid in its even windows (window k ends at 1 + k*0.125 s).
function windows(part, hop) {
  const f125 = `cache/${part}.hop0.125.hyps.json`;
  if (fs.existsSync(f125)) {
    const h = JSON.parse(fs.readFileSync(f125)).hyps;
    return hop === 0.125 ? h : h.filter((_, k) => k % 2 === 0);
  }
  if (hop !== 0.25) return null;
  return JSON.parse(fs.readFileSync(`cache/${part}.hyps.json`)).hyps;
}
async function run(part, baniId, vname) {
  let HOP = vname === 'c8' || vname.endsWith('25') ? 0.25 : 0.125;
  let hyps = windows(part, HOP);
  if (!hyps) { HOP = 0.25; hyps = windows(part, HOP); }
  const cache = { hyps };
  const truth = JSON.parse(fs.readFileSync(`truth/${part}.json`));
  const bani = JSON.parse(fs.readFileSync(`banis/${baniId}.json`));
  const verses = bani.verses.filter((v) => tokenize(v.unicode).length);
  const lines = verses.map((v) => ({ verseId: v.verseId, words: tokenize(v.unicode), text: v.unicode }));
  const idx = new Map(verses.map((v, i) => [v.verseId, i]));
  const extra = vname !== 'c8' && HOP === 0.25 ? { catchHops: vname === 'paathNoCatch' ? 0 : 4 } : undefined;
  const f = VARIANTS[vname.replace(/25$/, '')](new CachedInfer(cache.hyps), lines, { baniId: Number(baniId) >= 2100 ? 21 : Number(baniId), hop: HOP, extra });
  const chunk = new Float32Array(Math.round(16000 * HOP));
  const shown = [];
  let cur;
  const n = cache.hyps.length + Math.round(1 / HOP) - 1;
  const cpu0 = process.cpuUsage();
  for (let k = 0; k < n; k++) {
    const out = await f.push(chunk);
    // As the app shows it: a release holds the line; a move needs confidence >= GATE.
    if (!out || out.verseId == null || out.lineIndex == null || out.confidence < GATE) continue;
    if (out.verseId !== cur) { cur = out.verseId; shown.push({ t: (k + 1) * HOP, verseId: cur }); }
  }
  const cpu = process.cpuUsage(cpu0);
  const logicMsPerS = +((cpu.user + cpu.system) / 1000 / (cache.hyps.length * HOP)).toFixed(2);
  const L = truth.lines.filter((l) => idx.has(l.verseId));
  const t0 = L[0].start, t1 = L[L.length - 1].end;
  let total = 0, within1 = 0, wrong = 0, none = 0, si = -1, li = 0;
  const behind = []; // [t, linesBehind]
  for (let t = t0; t < t1; t += STEP) {
    while (li + 1 < L.length && L[li + 1].start <= t) li++;
    while (si + 1 < shown.length && shown[si + 1].t <= t) si++;
    if ((L[li].check ?? 1) < MINCHK) continue;
    total++;
    const d = si >= 0 && shown[si].verseId != null ? idx.get(shown[si].verseId) : null;
    if (d == null) { none++; continue; }
    const ti = idx.get(L[li].verseId);
    if (Math.abs(ti - d) <= 1) within1++;
    const prev = li > 0 ? idx.get(L[li - 1].verseId) : -99;
    if (d !== ti && d !== prev) wrong++;
    behind.push([t, ti - d]);
  }
  // Worst lines behind, held for >= 2 s (min over a 2 s window, max over time).
  let maxBehind = 0;
  const W = Math.round(2 / STEP);
  for (let i = 0; i + W <= behind.length; i++) {
    if (behind[i + W - 1][0] - behind[i][0] > 2.2) continue;
    let m = Infinity;
    for (let j = i; j < i + W; j++) m = Math.min(m, behind[j][1]);
    if (m > maxBehind) maxBehind = m;
  }
  const lags = [];
  let missed = 0;
  L.forEach((l, i) => {
    if ((l.check ?? 1) < MINCHK) return;
    const until = (L[i + 1] ? L[i + 1].start : l.end) + 2;
    const hit = shown.find((s) => s.verseId === l.verseId && s.t >= l.start - 1 && s.t <= until);
    if (hit) lags.push(Math.max(0, hit.t - l.start)); else missed++;
  });
  lags.sort((a, b) => a - b);
  const q = (p) => (lags.length ? +lags[Math.min(lags.length - 1, Math.floor(p * lags.length))].toFixed(2) : null);
  return { part, variant: vname, hop: HOP, logicMsPerS, moves: shown.length, scoredS: Math.round(total * STEP), lagMed: q(0.5), lagP90: q(0.9),
    within1: +(100 * within1 / total).toFixed(1), wrong: +(100 * wrong / total).toFixed(1),
    none: +(100 * none / total).toFixed(1), maxBehind2s: maxBehind, missed, lines: lags.length + missed };
}
(async () => {
  const vs = (process.env.VARIANTS || 'c8,paath').split(',');
  const rows = [];
  for (const a of process.argv.slice(2)) {
    const [part, bani] = a.split(':');
    for (const v of vs) rows.push(await run(part, bani, v));
  }
  console.table(rows);
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
})();
