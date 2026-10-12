// Robustness: a follower given the WRONG Bani should show nothing (or almost nothing).
// For each clip, every other Bani in the set is loaded instead of the right one; we
// count line changes per minute of audio and the share of time any line is shown.
//   node foreign.js <variant>
const fs = require('fs');
const VARIANTS = require('./variants');
const { CachedInfer } = require('./replay');
const tokenize = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);
const CLIPS = JSON.parse(fs.readFileSync('clips.json'));
const BANIS = [2, 4, 6, 9, 10, 21, 23];
// Banis that contain each other's text (Rehras has Chaupai and Anand) are not "foreign".
const overlaps = (a, b) => a === b || [a, b].includes(21) && ([a, b].includes(9) || [a, b].includes(10));
(async () => {
  const name = process.argv[2];
  const extra = JSON.parse(process.argv[3] || '{}');
  let moves = 0, shownT = 0, totalT = 0;
  for (const [clip, right] of Object.entries(CLIPS)) {
    const tag = process.env.HOP && Number(process.env.HOP) !== 0.25 ? `.hop${Number(process.env.HOP)}` : '';
    const cache = JSON.parse(fs.readFileSync(`cache/${clip}${tag}.hyps.json`));
    const hop = cache.hop || 0.25;
    for (const b of BANIS) {
      if (overlaps(b, right)) continue;
      const verses = JSON.parse(fs.readFileSync(`banis/${b}.json`)).verses.filter((v) => tokenize(v.unicode).length);
      const f = VARIANTS[name](new CachedInfer(cache.hyps), verses.map((v) => ({ verseId: v.verseId, words: tokenize(v.unicode), text: v.unicode })), { baniId: b, extra, hop, exclude: process.env.STRICT_FOREIGN ? right : null });
      let cur = null;
      for (let k = 0; k < cache.hyps.length + Math.round(1 / hop) - 1; k++) {
        const out = await f.push(new Float32Array(Math.round(16000 * hop)));
        if (out && out.verseId !== undefined && out.verseId !== cur) { cur = out.verseId; if (cur != null) moves++; }
        if (cur != null) shownT += hop;
        totalT += hop;
      }
    }
  }
  console.log(JSON.stringify({ variant: name, extra, minutes: +(totalT / 60).toFixed(1), movesPerMin: +(moves / (totalT / 60)).toFixed(3), shownShare: +(shownT / totalT).toFixed(4) }));
})();
