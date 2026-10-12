// Side by side for a time range: truth segments, what a variant shows, what was heard.
//   node timeline.js <variant> <clip> <from_s> <to_s>
const fs = require('fs');
const VARIANTS = require('./variants');
const { CachedInfer } = require('./replay');
const [name, clip, a, b] = process.argv.slice(2);
const bani = JSON.parse(fs.readFileSync('clips.json'))[clip];
const tokenize = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);
(async () => {
  const cache = JSON.parse(fs.readFileSync(`cache/${clip}.hyps.json`));
  const truth = JSON.parse(fs.readFileSync(`truth/${clip}.json`)).lines;
  const verses = JSON.parse(fs.readFileSync(`banis/${bani}.json`)).verses.filter((v) => tokenize(v.unicode).length);
  const idx = new Map(verses.map((v, i) => [v.verseId, i]));
  const f = VARIANTS[name](new CachedInfer(cache.hyps), verses.map((v) => ({ verseId: v.verseId, words: tokenize(v.unicode), text: v.unicode })), { baniId: bani });
  const ev = [];
  let cur;
  for (let k = 0; k < cache.hyps.length + 3; k++) {
    const t = (k + 1) * 0.25, out = await f.push(new Float32Array(4000));
    if (out && out.verseId !== cur) { cur = out.verseId; if (t >= a && t <= b) ev.push([t, `SHOW #${idx.get(cur)}`]); }
    if (t >= a && t <= b && k >= 3 && (k - 3) % 4 === 0) ev.push([t, `   heard: ${cache.hyps[k - 3]}`]);
  }
  truth.filter((s) => s.end >= a && s.start <= b).forEach((s) => ev.push([s.start, `TRUTH #${idx.get(s.verseId)} (${s.start}-${s.end}, check ${s.check}) ${s.text}`]));
  ev.sort((x, y) => x[0] - y[0]).forEach(([t, s]) => console.log(t.toFixed(2).padStart(7), s));
})();
