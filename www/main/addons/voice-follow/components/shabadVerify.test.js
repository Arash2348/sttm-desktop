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

test('stitch joins non-overlapping 10 s passes, newest last', () => {
  const sr = 16000;
  const pass = (endS) => ({
    end: endS * sr,
    len: 10 * sr,
    emis: { data: new Float32Array(250 * C).fill(endS), frames: 250, C },
  });
  const history = [];
  for (let t = 10; t <= 40; t += 0.6) history.push(pass(Math.round(t * 10) / 10));
  const s = stitch(history, { spanS: 30 });
  assert.ok(s.seconds >= 29 && s.seconds <= 31, `seconds ${s.seconds}`);
  // last frame comes from the newest pass
  assert.strictEqual(s.data[(s.frames - 1) * C], history[history.length - 1].emis.data[0]);
});

test('stitch returns null with no history', () => {
  assert.strictEqual(stitch([]), null);
});

test('the recognizer keeps 35 s of passes, thinned, and stitch reaches 30 s from them', async () => {
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
  const rec = new Recognizer(fake, { inputSr: 16000 });
  rec.keepHistory = true;
  const chunk = new Float32Array(0.128 * 16000);
  // 50 s of audio, one chunk at a time (as the app pushes it)
  // eslint-disable-next-line no-await-in-loop
  for (let k = 0; k < Math.ceil(50 / 0.128); k++) await rec.push(chunk);
  const span = (rec.history[rec.history.length - 1].end - rec.history[0].end) / 16000;
  assert.ok(span >= 30 && span <= 35.5, `kept ${span} s`);
  assert.ok(rec.history.length < 50, `kept ${rec.history.length} passes`);
  const s = stitch(rec.history, { spanS: 30 });
  assert.ok(s && s.seconds >= 29, `stitched ${s && s.seconds} s`);
});
