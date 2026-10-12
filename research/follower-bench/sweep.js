// One v2 setting on every clip:   node sweep.js '{"minScore":0.4}'   -> one JSON line
const fs = require('fs');
const { replay } = require('./replay');
const { FollowerV2 } = require('./follower-v2');
const background = require('./background');
const CLIPS = JSON.parse(fs.readFileSync('clips.json'));
const opts = JSON.parse(process.argv[2] || '{}');
(async () => {
  const per = [];
  for (const [clip, bani] of Object.entries(CLIPS)) {
    per.push({ clip, bani, ...(await replay(clip, bani, (infer, lines, ctx) => new FollowerV2(infer, lines, { inputSr: 16000, hopS: ctx.hop, background: opts.nobg ? undefined : background(bani), ...opts }))) });
  }
  const w = per.reduce((a, r) => a + r.lines, 0);
  const avg = (k, rows = per) => +(rows.reduce((a, r) => a + r[k] * r.lines, 0) / rows.reduce((a, r) => a + r.lines, 0) * 100).toFixed(2);
  const jaap = per.filter((r) => r.bani === 4);
  console.log(JSON.stringify({ opts, within1s: avg('within1s'), wrong: avg('wrongShown'), strict: avg('accuracy'), jaapWithin: avg('within1s', jaap), jaapWrong: avg('wrongShown', jaap), missed: per.reduce((a, r) => a + r.missed, 0) }));
})();
