// "Other Gurbani" for a follower on Bani `id`: the lines of the other benchmark Banis,
// minus any that share text with it (Rehras contains Chaupai and parts of Anand).
// In the product this is a fixed Gurbani sample shipped with the engine.
const fs = require('fs');
const ALL = process.env.BG_BANIS ? JSON.parse(process.env.BG_BANIS) : [2, 4, 9, 10, 21, 23]; // the six Nitnem Banis the app ships (engine/assets/nitnem-lines.js)
const SHARED = { 21: [9, 10], 9: [21], 10: [21] };
const cache = {};
module.exports = (id, exclude = null) => {
  const key = `${id}:${exclude}`;
  if (!cache[key]) {
    cache[key] = ALL.filter((b) => b !== id && b !== exclude && !(SHARED[id] || []).includes(b) && !(SHARED[exclude] || []).includes(b))
      .flatMap((b) => JSON.parse(fs.readFileSync(`${__dirname}/banis/${b}.json`)).verses.map((v) => v.unicode));
  }
  return cache[key];
};
