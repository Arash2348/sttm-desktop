#!/usr/bin/env node
// line-apply.js — review answers -> answer keys, and the progress count the owner asked for after every labelling
// session ("fully human-confirmed pangtis": answered yes, or a tapped start).
//
//   node line-apply.js [--lines /home/user/gab/lines] [--out <dir>]     (default out: <lines>/final)
//
// Per clip, from keys/<folder>/<id>/lines.csv + answers.jsonl, writes final/<folder>/<id>/lines.csv where source is:
//   human-confirmed   the reviewer said yes to the aligned start
//   human-tapped      the reviewer tapped the real start (start_s = the tap)
//   aligned-2model-sure, aligned-2model, aligned-1model   not reviewed (secondary; never a headline number)
// Starts answered "wrong pangti", or earlier/later without a tap, are left out; "not sure" keeps the aligned row.
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LINES = arg('lines', process.env.LINES || '/home/user/gab/lines');
const OUT = arg('out', path.join(LINES, 'final'));
const read = (f) => { const [h, ...r] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return r.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };

const answers = {};
const af = path.join(LINES, 'answers.jsonl');
if (fs.existsSync(af)) for (const l of fs.readFileSync(af, 'utf8').split('\n')) { if (!l) continue; try { const a = JSON.parse(l); answers[a.itemId] = a; } catch (_) { /* torn */ } }

const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name === 'lines.csv') out.push(p); } return out; };
const tot = { starts: 0, confirmed: 0, tapped: 0, dropped: 0, unsure: 0, sure: 0, open: 0 };
const per = [];
for (const f of walk(path.join(LINES, 'keys'))) {
  const rel = path.relative(path.join(LINES, 'keys'), path.dirname(f));
  const id = path.basename(rel);
  const rows = read(f);
  const out = [];
  const c = { id, starts: rows.length, confirmed: 0, tapped: 0, dropped: 0, open: 0 };
  rows.forEach((r, i) => {
    const a = answers[`${id}#${i}`];
    if (!a) { if (r.source === 'aligned-2model-sure') tot.sure++; else c.open++; out.push(r); return; }
    if (a.answer === 'yes' || (a.answer === 'tap' && a.direction === 'yes')) { c.confirmed++; out.push({ ...r, source: 'human-confirmed', confidence: 1 }); return; }
    if (a.tap != null) { c.tapped++; out.push({ ...r, start_s: a.tap, source: 'human-tapped', confidence: 1 }); return; }
    if (a.answer === 'unsure') { tot.unsure++; out.push(r); return; }
    c.dropped++;
  });
  out.sort((x, y) => Number(x.start_s) - Number(y.start_s));
  // an end is the next start (pangtis follow each other), capped at the aligned end
  const dir = path.join(OUT, rel); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lines.csv'), ['verseId,start_s,end_s,confidence,source', ...out.map((r) => `${r.verseId},${r.start_s},${r.end_s},${r.confidence},${r.source}`)].join('\n') + '\n');
  for (const k of ['starts', 'confirmed', 'tapped', 'dropped', 'open']) tot[k] += c[k];
  if (c.confirmed + c.tapped) per.push(c);
}
const human = tot.confirmed + tot.tapped;
console.log(`Fully human-confirmed pangti starts: ${human} (yes ${tot.confirmed}, tapped ${tot.tapped}) of ${tot.starts} aligned starts`);
console.log(`Auto-accepted (both models agree, words match; 97% right on GAB-Hard): ${tot.sure} · still open in the queue: ${tot.open} · removed (wrong pangti / no time): ${tot.dropped} · not sure: ${tot.unsure}`);
if (per.length) {
  console.log('\n| recording | human-confirmed | of starts | still open |\n|---|---|---|---|');
  for (const c of per.sort((a, b) => (b.confirmed + b.tapped) - (a.confirmed + a.tapped)).slice(0, 25)) console.log(`| ${c.id} | ${c.confirmed + c.tapped} | ${c.starts} | ${c.open} |`);
}
console.log(`\nanswer keys: ${OUT}`);
