// Scores follower variants on every clip that has a cache + truth.
//   node bench.js [variant ...]      (default: all variants in variants.js)
const fs = require('fs');
const { replay } = require('./replay');
const VARIANTS = require('./variants');
const CLIPS = JSON.parse(fs.readFileSync(process.env.CLIPS || 'clips.json')); // { clip: baniId }

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTS);
  const ready = Object.entries(CLIPS).filter(([c]) => fs.existsSync(`truth/${c}.json`) && fs.existsSync(`cache/${c}.hyps.json`));
  const rows = [];
  for (const name of names) {
    const per = [];
    for (const [clip, bani] of ready) per.push({ clip, ...(await replay(clip, bani, VARIANTS[name])) });
    // Weighted by scored TIME (steadyLines / segTime are counts of 0.05 s steps), so a
    // Bani with many short lines does not dominate; lag is the median over all lines.
    const tw = (k, wk) => +(per.reduce((a, r) => a + r[k] * r[wk], 0) / per.reduce((a, r) => a + r[wk], 0)).toFixed(4);
    const lags = per.flatMap((r) => r.lags).sort((a, b) => a - b);
    rows.push({ variant: name, clips: per.length, steady: tw('steadyWithin1s', 'steadyLines'), steadyWrong: tw('steadyWrong', 'steadyLines'),
      inLines: tw('segWithin1s', 'segTime'), inLinesWrong: tw('segWrong', 'segTime'), lagMedian: lags[lags.length >> 1],
      lagP90: lags[Math.floor(lags.length * 0.9)], missed: per.reduce((a, r) => a + r.missed, 0) });
    fs.writeFileSync(`results/${name}${process.env.CLIPS ? '-' + process.env.CLIPS.replace('.json', '') : ''}.json`, JSON.stringify(per, null, 1));
  }
  console.table(rows);
})();
