// Unit tests for engine/ctcLocal.js — run with: node --test www/main/addons/voice-follow/components/
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { localCtcScore, frameMax, BLANK } = require('../engine/ctcLocal');
const { Follower: AcousticFollower } = require('../engine/follower');

const C = BLANK + 1;
// Synthetic model output: each frame is confident (log-prob ~0) in one symbol, the rest -12.
function emissions(symbols) {
  const data = new Float32Array(symbols.length * C).fill(-12);
  symbols.forEach((sym, t) => {
    data[t * C + sym] = -0.05;
  });
  return { data, frames: symbols.length, C };
}
// A sung token: a few frames of the token, then blanks.
const sung = (ids) => ids.flatMap((id) => [id, id, BLANK, BLANK]);
const noise = (n, seed = 7) => Array.from({ length: n }, (_, i) => 100 + ((i * seed) % 50));

describe('localCtcScore', () => {
  const line = [10, 11, 12, 13, 14, 15];
  it('finds a line sung in the middle of the window', () => {
    const em = emissions([...noise(30), ...sung(line), ...noise(30, 3)]);
    const r = localCtcScore(em, line, { reward: 2 });
    assert.equal(r.tokens, 6);
    assert.equal(r.from, 0);
    assert.equal(r.to, 6);
    assert.ok(r.start >= 28 && r.start <= 31, `start ${r.start}`);
    assert.ok(r.score > 11, `score ${r.score}`);
  });
  it('scores a line that is not sung near zero', () => {
    const em = emissions([...noise(30), ...sung(line), ...noise(30, 3)]);
    const other = [40, 41, 42, 43, 44, 45];
    const r = localCtcScore(em, other, { reward: 2 });
    assert.ok(r.score < 2, `score ${r.score}`);
  });
  it('credits the part of a line that was heard', () => {
    const em = emissions([...noise(20), ...sung([12, 13, 14]), ...noise(20)]);
    const r = localCtcScore(em, line, { reward: 2 });
    assert.equal(r.from, 2);
    assert.equal(r.to, 5);
    assert.equal(r.tokens, 3);
  });
  it('ranks the sung line above a look-alike sharing half its tokens', () => {
    const em = emissions([...noise(10), ...sung(line), ...noise(10)]);
    const lookAlike = [10, 11, 12, 30, 31, 32];
    const a = localCtcScore(em, line, { reward: 2 });
    const b = localCtcScore(em, lookAlike, { reward: 2 });
    assert.ok(a.score > b.score + 4, `${a.score} vs ${b.score}`);
  });
  it('handles a repeated token (needs a blank between)', () => {
    const rep = [20, 20, 21];
    const em = emissions([...noise(5), 20, 20, BLANK, 20, BLANK, 21, BLANK, ...noise(5)]);
    const r = localCtcScore(em, rep, { reward: 2 });
    assert.equal(r.tokens, 3);
  });
  it('is empty for an empty line or window', () => {
    const em = emissions(noise(10));
    assert.equal(localCtcScore(em, [], {}).score, 0);
    assert.equal(localCtcScore(em, line, { t0: 5, t1: 5 }).tokens, 0);
  });
  it('can share one frameMax across lines', () => {
    const em = emissions([...noise(30), ...sung(line), ...noise(30, 3)]);
    const fmax = frameMax(em);
    assert.deepEqual(localCtcScore(em, line, { fmax }), localCtcScore(em, line));
  });
  it('a whole-window alignment misses a line sung after other audio (why this exists)', () => {
    const em = emissions([...noise(60), ...sung(line)]);
    const other = [40, 41, 42, 43, 44, 45];
    // eslint-disable-next-line no-underscore-dangle
    const whole = (y) => AcousticFollower.prototype._ctcScore(em, y, [0, em.frames]);
    const local = (y) => localCtcScore(em, y).score;
    assert.ok(local(line) - local(other) > 10);
    assert.ok(whole(line) - whole(other) < local(line) - local(other));
  });
  it('costs about a millisecond per line on a 10 s window', () => {
    const T = 250; // ~10 s at the model's frame rate
    const em = emissions(noise(T));
    const lines = Array.from({ length: 200 }, (_, i) =>
      Array.from({ length: 20 }, (__, k) => (i * 7 + k) % 250),
    );
    const fmax = frameMax(em);
    const t = process.hrtime.bigint();
    lines.forEach((y) => localCtcScore(em, y, { fmax }));
    const msPerLine = Number(process.hrtime.bigint() - t) / 1e6 / lines.length;
    assert.ok(msPerLine < 5, `${msPerLine.toFixed(3)} ms per line`);
  });
});
