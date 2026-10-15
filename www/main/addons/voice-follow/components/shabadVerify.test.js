// Shabad verifier (engine/shabadVerify.js): whole-Shabad fit over a stitched window.
const test = require('node:test');
const assert = require('node:assert');
const { shabadFit, stitch, BLANK } = require('../engine/shabadVerify');
const { Recognizer } = require('../engine/recognizer');

const C = 257;
// emissions that "hear" the given token ids in order, each for `per` frames, blanks between
function heard(ids, { per = 4, gap = 3, lead = 10 } = {}) {
  const seq = [];
  for (let i = 0; i < lead; i++) seq.push(BLANK);
  ids.forEach((id) => {
    for (let i = 0; i < per; i++) seq.push(id);
    for (let i = 0; i < gap; i++) seq.push(BLANK);
  });
  const data = new Float32Array(seq.length * C).fill(-12);
  seq.forEach((id, t) => {
    data[t * C + id] = -0.05;
  });
  return { data, frames: seq.length, C };
}

test('the Shabad that was sung fits better than one that was not', () => {
  const sung = [
    [5, 6, 7],
    [8, 9, 10],
  ];
  const other = [
    [40, 41, 42],
    [43, 44, 45],
  ];
  const emis = heard([5, 6, 7, 8, 9, 10]);
  assert.ok(shabadFit(emis, sung) > shabadFit(emis, other) + 20);
});

test('repeating a pangti (as kirtan does) still fits its own Shabad best', () => {
  const sung = [
    [5, 6, 7],
    [8, 9, 10],
  ];
  const other = [
    [8, 9, 10],
    [50, 51, 52],
  ];
  const emis = heard([5, 6, 7, 5, 6, 7, 8, 9, 10, 5, 6, 7]);
  assert.ok(shabadFit(emis, sung) > shabadFit(emis, other));
});

test('audio of nothing in the text costs every Shabad the same garbage price', () => {
  const emis = heard([]);
  const a = shabadFit(emis, [[5, 6]]);
  const b = shabadFit(emis, [[40, 41]]);
  assert.ok(Math.abs(a - b) < 1e-6);
});

test('stitch joins slices oldest to newest over the last 30 s', () => {
  const sr = 16000;
  const slices = [];
  for (let k = 0; k < 80; k++)
    slices.push({
      t0: k * 0.6 * sr,
      t1: (k + 1) * 0.6 * sr,
      frames: 15,
      C,
      data: new Float32Array(15 * C).fill(k),
    });
  const s = stitch(slices, { spanS: 30 });
  assert.ok(s.seconds >= 29.9 && s.seconds <= 30.6, `seconds ${s.seconds}`);
  assert.strictEqual(s.data[(s.frames - 1) * C], 79);
});

test('stitch returns null with no history', () => {
  assert.strictEqual(stitch([]), null);
});

test('the recognizer keeps the middle of each pass, tiling ~40 s, through a wrapper', async () => {
  const fake = {
    emissions: async (buf) => ({
      data: new Float32Array(Math.floor(buf.length / 640) * C),
      frames: Math.floor(buf.length / 640),
      C,
    }),
    decode: () => 'ਸਤਿਨਾਮ',
    greedy: () => [],
    confidence: () => 1,
  };
  const real = new Recognizer(fake, { inputSr: 16000 });
  const rec = Object.create(real); // as the bench driver wraps it
  rec.push = (pcm) => real.push(pcm);
  rec.passHistory.on = true;
  const chunk = new Float32Array(0.128 * 16000);
  // 60 s of audio, one chunk at a time (as the app pushes it)
  // eslint-disable-next-line no-await-in-loop
  for (let k = 0; k < Math.ceil(60 / 0.128); k++) await rec.push(chunk);
  const L = rec.passHistory.list;
  for (let k = 1; k < L.length; k++)
    assert.strictEqual(L[k].t0, L[k - 1].t1, 'slices tile with no gap');
  const s = stitch(L, { spanS: 30 });
  assert.ok(s && s.seconds >= 29.5, `stitched ${s && s.seconds} s`);
});
