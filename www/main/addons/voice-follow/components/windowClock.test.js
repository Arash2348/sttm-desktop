// Window alignment (engine/clock): the session grid, seeding, and the same window for every
// engine that decodes on a grid point. node --test www/main/addons/voice-follow/components/
const test = require('node:test');
const assert = require('node:assert');
const { SessionClock, clockOpts, appendTo } = require('../engine/clock');

const SR = 16000;
const chunks = (n, len) =>
  Array.from({ length: n }, (_, k) => Float32Array.from({ length: len }, (__, i) => k * len + i));

function dueChunks(len, stepS, n = 48, inputSr = SR) {
  const clock = new SessionClock({ inputSr });
  const out = [];
  chunks(n, len).forEach((pcm, k) => {
    clock.advance(pcm);
    if (clock.due(pcm, stepS)) out.push(k + 1);
  });
  return out;
}

test('grid: the engines keep their cadence (2048-sample chunks at 16 kHz)', () => {
  assert.deepStrictEqual(dueChunks(2048, 0.25).slice(0, 5), [2, 4, 6, 8, 10]);
  assert.deepStrictEqual(dueChunks(2048, 0.5).slice(0, 4), [4, 8, 12, 16]);
  assert.deepStrictEqual(dueChunks(2048, 1.0).slice(0, 3), [8, 16, 24]);
});

test('grid: the microphone chunk (2048 at 48 kHz = 683 at 16 kHz): every 6 / 12 chunks', () => {
  assert.deepStrictEqual(dueChunks(2048, 0.25, 40, 48000).slice(0, 4), [6, 12, 18, 24]);
  assert.deepStrictEqual(dueChunks(2048, 0.5, 40, 48000).slice(0, 3), [12, 24, 36]);
});

test('grid: every step lies on the 0.25 s grid (44.1 kHz too)', () => {
  const f = new Set(dueChunks(2048, 0.25, 200, 44100));
  dueChunks(2048, 0.5, 200, 44100).forEach((k) => assert.ok(f.has(k), `0.5 s point ${k}`));
  dueChunks(2048, 1.0, 200, 44100).forEach((k) => assert.ok(f.has(k), `1 s point ${k}`));
});

test('seed: an engine joining mid-session has the same window as one that was always there', () => {
  const clock = new SessionClock({ inputSr: SR });
  const win = 4 * SR;
  const always = { buf: new Float32Array(0) };
  let joined = null;
  chunks(60, 2048).forEach((pcm, k) => {
    clock.advance(pcm);
    appendTo(always, pcm, pcm, win);
    if (k === 37) {
      joined = { buf: new Float32Array(0) };
      clockOpts(joined, { clock }); // created mid-session; joins at its first push
    }
    if (joined) appendTo(joined, pcm, pcm, win); // the chunk the seed ends with: not twice
    if (joined) assert.deepStrictEqual(joined.buf, always.buf, `chunk ${k}`);
  });
  assert.strictEqual(always.buf.length, win);
});

test('seed: shorter than a window early in the session; unseeded engines start empty', () => {
  const clock = new SessionClock({ inputSr: SR });
  const pcms = chunks(4, 2048);
  pcms.slice(0, 3).forEach((pcm) => clock.advance(pcm));
  const e = { buf: new Float32Array(0) };
  clockOpts(e, { clock });
  appendTo(e, pcms[2], pcms[2], 4 * SR);
  assert.strictEqual(e.buf.length, 3 * 2048);
  const r = { buf: new Float32Array(0) };
  clockOpts(r, { clock, seed: false });
  clock.advance(pcms[3]);
  appendTo(r, pcms[3], pcms[3], 4 * SR);
  assert.strictEqual(r.clock, clock);
  assert.strictEqual(r.buf.length, 2048);
});

test('no clock: the engine is left as it was', () => {
  const e = {};
  clockOpts(e, {});
  assert.deepStrictEqual(e, {});
});

test('a merged backlog push decodes once', () => {
  const clock = new SessionClock({ inputSr: SR });
  const first = chunks(1, 2048)[0];
  clock.advance(first);
  const merged = new Float32Array(5 * 2048);
  clock.advance(merged);
  assert.strictEqual(clock.due(merged, 0.25), true);
  assert.strictEqual(clock.due(first, 0.25), false); // a stale chunk is never due
});
