// compare.js — how well heard text matches a pangti, for research scoring only.
// The pangti is used exactly as the database gives it: nothing is removed from or changed in it.
// When comparing, spaces, dandas, numbers and punctuation are simply skipped over (ignored), in
// both the pangti and the heard text; the comparison walks the characters it does compare.
const path = require('path');
const { ratioArr } = require(path.resolve(__dirname, '../../www/main/addons/voice-follow/engine/fuzz'));

const IGNORE = /[\s।॥|0-9੦-੯.,;:!?\-]/;
// The characters a comparison looks at, read in place from the text (the text itself is not altered).
const compared = (text) => [...(text || '')].filter((ch) => !IGNORE.test(ch));

// Same measure as the engine's partialRatio (best window of the shorter inside the longer), 0..1.
function heardMatch(heard, pangti) {
  let a = compared(heard);
  let b = compared(pangti);
  if (!a.length || !b.length) return 0;
  if (a.length > b.length) [a, b] = [b, a];
  if (a.length === b.length) return ratioArr(a, b) / 100;
  let best = 0;
  for (let s = 0; s + a.length <= b.length && best < 100; s += 1) best = Math.max(best, ratioArr(a, b.slice(s, s + a.length)));
  return best / 100;
}
const comparedLength = (text) => compared(text).length;
module.exports = { heardMatch, comparedLength };
