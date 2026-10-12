// Which Bani is each recitation clip? Align it against every candidate Bani and keep
// the best-scoring fit (align.js score: higher = more of the audio explained by the
// text, in order). Writes truth/<clip>.json for the winner and adds it to clips.json.
const fs = require('fs');
const { align } = require('./align');
const CANDIDATES = [2, 4, 6, 9, 10, 21, 23, 31];
for (const clip of process.argv.slice(2)) {
  if (!fs.existsSync(`cache/${clip}.emis.f32`)) continue;
  const scored = CANDIDATES.map((b) => ({ b, r: align(clip, b) })).sort((x, y) => y.r.score - x.r.score);
  const [best, next] = scored;
  fs.writeFileSync(`truth/${clip}.json`, JSON.stringify(best.r, null, 1));
  const perFrame = (x) => (x.r.score / x.r.frames).toFixed(2);
  console.log(clip, 'bani', best.b, perFrame(best), 'next', next.b, perFrame(next), 'lines', best.r.lines.length);
}
