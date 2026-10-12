// Every stretch (>= MIN_S) where a variant shows something other than the line being
// recited (or the one just finished), with what the window heard at that moment.
//   node errors.js <variant> <clip>
const fs = require('fs');
const VARIANTS = require('./variants');
const { CachedInfer } = require('./replay');
const MIN_S = 0.5;
const [name, clip] = process.argv.slice(2);
const bani = JSON.parse(fs.readFileSync('clips.json'))[clip];
const tokenize = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);
(async () => {
  const cache = JSON.parse(fs.readFileSync(`cache/${clip}.hyps.json`));
  const truth = JSON.parse(fs.readFileSync(`truth/${clip}.json`)).lines;
  const verses = JSON.parse(fs.readFileSync(`banis/${bani}.json`)).verses.filter((v) => tokenize(v.unicode).length);
  const idx = new Map(verses.map((v, i) => [v.verseId, i]));
  const f = VARIANTS[name](new CachedInfer(cache.hyps), verses.map((v) => ({ verseId: v.verseId, words: tokenize(v.unicode), text: v.unicode })), { baniId: bani });
  const shown = [];
  let cur = null;
  for (let k = 0; k < cache.hyps.length + 3; k++) {
    const out = await f.push(new Float32Array(4000));
    if (out && out.verseId !== undefined && out.verseId !== cur) { cur = out.verseId; shown.push({ t: (k + 1) * 0.25, v: cur }); }
  }
  const at = (arr, t, key) => { let r = null; for (const x of arr) { if (x[key] <= t) r = x; else break; } return r; };
  let bad = null;
  const report = (b, t) => {
    if (t - b.t < MIN_S) return;
    const k = Math.round((b.t - 1) / 0.25);
    console.log(`${b.t.toFixed(2)}-${t.toFixed(2)}  truth #${b.truth}  shown #${b.shown}  heard: ${cache.hyps[k] || ''}`);
  };
  for (let t = truth[0].start; t < truth[truth.length - 1].end; t += 0.05) {
    const tr = at(truth, t, 'start'), sh = at(shown, t, 't');
    const ti = tr ? idx.get(tr.verseId) : null, si = sh && sh.v != null ? idx.get(sh.v) : null;
    const prevOk = (() => { const j = truth.indexOf(tr); return j > 0 && idx.get(truth[j - 1].verseId) === si; })();
    const ok = si === ti || prevOk;
    if (!ok && !bad) bad = { t, truth: ti, shown: si };
    if (ok && bad) { report(bad, t); bad = null; }
  }
  console.log('lines', truth.length);
})();
