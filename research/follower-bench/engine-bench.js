// The shipped engine follower2 with its own defaults, on every clip (HOP=0.125 cache).
const fs = require('fs');
const path = require('path');
const { replay } = require('./replay');
const [engineDir] = process.argv.slice(2);
const { FollowerV2 } = require(path.join(engineDir, 'follower2'));
const NITNEM = require(path.join(engineDir, 'assets/nitnem-lines'));
const CLIPS = JSON.parse(fs.readFileSync('clips.json'));
(async () => {
  const per = [];
  for (const [clip, bani] of Object.entries(CLIPS)) {
    const background = Object.entries(NITNEM).filter(([id]) => Number(id) !== bani).flatMap(([, l]) => l);
    per.push(await replay(clip, bani, (infer, lines) => new FollowerV2(infer, lines, { inputSr: 16000, background })));
  }
  const n = per.reduce((a, r) => a + r.lines, 0);
  const avg = (k) => +(per.reduce((a, r) => a + r[k] * r.lines, 0) / n * 100).toFixed(2);
  const lags = per.map((r) => r.lagMedian).sort((a, b) => a - b);
  console.log(JSON.stringify({ within1s: avg('within1s'), steady: avg('steadyWithin1s'), steadyWrong: avg('steadyWrong'), wrong: avg('wrongShown'), strict: avg('accuracy'), lagMedian: lags[lags.length >> 1] }));
})();
