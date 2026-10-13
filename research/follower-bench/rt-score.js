// Scores real-time headless app runs (renton-bench.js / renton-stress.js output: {part, events})
// with the anticipation buckets of anticipate-bench.js (voiced %, premature / good / lag flips).
//   node rt-score.js <run.json> [...]
const fs = require('fs');
const { score } = require('./anticipate-bench');
const V = '/private/tmp/claude-501/-Users-asingh02-personal-sttm-desktop/7dc20a33-cab3-495f-b630-6acf57f0287c/scratchpad/vf-fix';
const A = `${__dirname}/anticipate`;
const BANI_OK = { rt11_rehras: 'bani:21', rt11_sohila: 'bani:23' };

function item(part) {
  if (part === 'rt11_rehras') {
    const all = JSON.parse(fs.readFileSync(`${A}/app-rehras21-extralong.lines.json`)).all;
    const truth = JSON.parse(fs.readFileSync(`${A}/rt11_rehrasX.app.truth.json`)).lines
      .filter((l) => l.appVerseId != null).map((l) => ({ id: l.appVerseId, start: l.start, end: l.end, ok: !!l.confident, conf: l.conf }));
    return { lines: all.map(([verseId]) => ({ verseId })), truth };
  }
  // Sohila: the line list by BaniDB index, app verse ids from the truth's own mapping.
  const T = JSON.parse(fs.readFileSync(`${V}/data/truth/${part}.truth.json`)).lines.filter((l) => l.appVerseId != null);
  const n = Math.max(...T.map((l) => l.lineIndex)) + 2;
  const lines = Array.from({ length: n }, (_, i) => ({ verseId: `x${i}` }));
  T.forEach((l) => { lines[l.lineIndex] = { verseId: l.appVerseId }; });
  return { lines, truth: T.map((l) => ({ id: l.appVerseId, start: l.start, end: l.end, ok: !!l.confident, conf: l.conf })) };
}

for (const f of process.argv.slice(2)) {
  const run = JSON.parse(fs.readFileSync(f));
  const it = item(run.part);
  if (run.dur) it.truth = it.truth.filter((l) => l.end <= run.dur - 2);
  const idx = new Map();
  it.lines.forEach((l, i) => { if (!idx.has(l.verseId)) idx.set(l.verseId, i); });
  const ev = run.events.filter((e) => ['shabad', 'seeking', 'verse'].includes(e.type)).sort((a, b) => a.t - b.t);
  const shown = [];
  let sid = null;
  let last = null;
  for (const e of ev) {
    if (e.type === 'shabad') sid = e.shabadId;
    let i = null;
    if (e.type === 'verse') i = idx.has(e.verseId) ? idx.get(e.verseId) : -1000;
    else if (e.type === 'shabad' && sid !== BANI_OK[run.part]) i = -2000; // another page
    else continue;
    if (i !== last) { shown.push({ t: e.t, i, id: e.type === "verse" ? e.verseId : null }); last = i; }
  }
  const r = score(it, shown);
  const out = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));
  console.log(f.split('/').slice(-2).join('/'), JSON.stringify(out));
}
