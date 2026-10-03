// Known answer: a Bani and a shabad on the same verse are agreement, and are counted.
// Human shows shabad 44 verse 464 for 0-29; the model shows shabad 44 verse 464 for 0-9,
// then bani 21 verse 464 for 10-29 (Voice-Follow opened Rehras from the shabad read in
// order). Loud singing throughout. Expected: 30 agree, 0 wrong, baniSameVerse 20.
const path = require('path');
const { scoreTimelines } = require(path.join(__dirname, '..', '..', 'www', 'main', 'addons', 'voice-follow', 'shadow', 'score.js'));
const activity = [];
for (let t = 0; t < 30; t += 1) activity.push({ t, level: 0.02, letters: 20, text: 'x' });
const r = scoreTimelines({
  human: [{ t: 0, shabadId: 44, verseId: 464, bani: null, ceremony: null, slide: null }],
  system: [{ t: 0, shabadId: 44, verseId: 464 }, { t: 10, bani: 21, shabadId: null, verseId: 464, slide: null }],
  activity,
  events: [{ t: 0, type: 'session_start' }],
});
const sc = r.score;
const want = { agree: 30, wrong: 0, baniSameVerse: 20, kirtan: 30 };
const bad = Object.keys(want).filter((k) => sc[k] !== want[k]);
// Reverse case: the sevadaar is inside Rehras, the model shows the shabad at the same verse.
const r2 = scoreTimelines({
  human: [{ t: 0, shabadId: null, verseId: 464, bani: 21, ceremony: null, slide: null }],
  system: [{ t: 0, shabadId: 44, verseId: 464 }],
  activity,
  events: [{ t: 0, type: 'session_start' }],
});
if (r2.score.agree !== 30 || r2.score.wrong !== 0 || r2.score.baniSameVerse !== 30) bad.push('reverse');
// Different verse: still wrong.
const r3 = scoreTimelines({
  human: [{ t: 0, shabadId: 44, verseId: 464, bani: null, ceremony: null, slide: null }],
  system: [{ t: 0, bani: 21, shabadId: null, verseId: 999, slide: null }],
  activity,
  events: [{ t: 0, type: 'session_start' }],
});
if (r3.score.wrong !== 30 || r3.score.baniSameVerse !== 0) bad.push('different verse');
if (bad.length) { console.error('FAIL', bad, sc); process.exit(1); }
console.log('PASS: same-verse Bani/shabad = agreement (3 cases)');
