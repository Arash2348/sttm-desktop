// The real screen of the Newton session as a bench run (human.jsonl -> events), so nw-score.js scores what he saw.
const fs = require('fs');
const [src, out] = process.argv.slice(2);
const rows = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const events = []; let cur = null;
rows.forEach((r) => {
  const id = r.bani != null ? `bani:${r.bani}` : r.shabadId;
  if (id !== cur) { cur = id; events.push({ t: r.t, type: 'shabad', shabadId: id, verseId: r.verseId, override: !!r.override }); }
  events.push({ t: r.t, type: 'verse', verseId: r.verseId, override: !!r.override, slide: r.slide });
});
fs.writeFileSync(out, JSON.stringify({ name: 'nw11_human', mode: 'session', offset: 0, from: 0, dur: 2953, events }, null, 0));
console.log('events', events.length);
