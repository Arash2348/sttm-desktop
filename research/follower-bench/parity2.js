// The shipped engine (sttm-follower2 engine/follower2.js + index createFollower2 logic)
// on raw audio, pushed in 2048-sample chunks at 16 kHz with the real model, vs the
// cached replay of the research v2. Prints both line timelines and whether they match.
//   node parity2.js <clip> <baniId> <engineDir>
const fs = require('fs');
const path = require('path');
const makeInfer = require('./infer');
const { CachedInfer } = require('./replay');
const VARIANTS = require('./variants');
const [clip, baniId, engineDir] = process.argv.slice(2);
const { FollowerV2 } = require(path.join(engineDir, 'follower2'));
const NITNEM = require(path.join(engineDir, 'assets/nitnem-lines'));
const tok = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);
(async () => {
  const verses = JSON.parse(fs.readFileSync(`banis/${baniId}.json`)).verses.filter((v) => tok(v.unicode).length);
  const lines = verses.map((v) => ({ verseId: v.verseId, words: tok(v.unicode), text: v.unicode }));
  const background = Object.entries(NITNEM).filter(([id]) => Number(id) !== Number(baniId)).flatMap(([, l]) => l);
  const live = new FollowerV2(await makeInfer(), lines, { inputSr: 16000, background });
  const b = fs.readFileSync(`/Users/asingh02/personal/live-darbar-venues/clips/${clip}.wav`);
  const pcm = Float32Array.from(new Int16Array(b.buffer, b.byteOffset + 44, (b.length - 44) >> 1), (x) => x / 32768);
  const a = [];
  let cur;
  for (let i = 0; i + 2048 <= pcm.length; i += 2048) {
    const out = await live.push(pcm.subarray(i, i + 2048));
    if (out && out.verseId !== cur) { cur = out.verseId; a.push(`${((i + 2048) / 16000).toFixed(2)}:${cur}`); }
  }
  const cache = JSON.parse(fs.readFileSync(`cache/${clip}.hyps.json`));
  const f = VARIANTS.v2(new CachedInfer(cache.hyps), lines, { baniId: Number(baniId) });
  const c = [];
  cur = undefined;
  for (let k = 0; k < cache.hyps.length + 3; k++) {
    const out = await f.push(new Float32Array(4000));
    if (out && out.verseId !== cur) { cur = out.verseId; c.push(`${((k + 1) * 0.25).toFixed(2)}:${cur}`); }
  }
  const seq = (x) => x.map((s) => s.split(':')[1]).join(',');
  console.log(clip, 'live moves', a.length, 'cached moves', c.length, 'same line sequence:', seq(a) === seq(c));
  if (seq(a) !== seq(c)) { console.log('live  ', a.slice(0, 30).join(' ')); console.log('cached', c.slice(0, 30).join(' ')); }
})();
