// Akhand Paath following: follower2's `anticipate` (the next pangti goes up as the current
// one's last letters are heard) and adopt() (a new reading window carries on from the old).
const test = require('node:test');
const assert = require('node:assert');
const { FollowerV2, simplify } = require('../engine/follower2');
const { spoken } = require('../engine/spoken');

const LINES = [
  'ਸਿਰੀਰਾਗੁ ਮਹਲਾ ੧ ॥',
  'ਵਣਜੁ ਕਰਹੁ ਵਣਜਾਰਿਹੋ ਵਖਰੁ ਲੇਹੁ ਸਮਾਲਿ ॥',
  'ਤੈਸੀ ਵਸਤੁ ਵਿਸਾਹੀਐ ਜੈਸੀ ਨਿਬਹੈ ਨਾਲਿ ॥',
  'ਅਗੈ ਸਾਹੁ ਸੁਜਾਣੁ ਹੈ ਲੈਸੀ ਵਸਤੁ ਸਮਾਲਿ ॥੧॥',
].map((text, i) => ({ verseId: 100 + i, text }));
const heard = (s) => [...simplify(spoken(s))];
const make = (opts) => new FollowerV2({}, LINES, { startLine: 1, startAt: true, ...opts });

test('anticipate: the next pangti goes up when the current one is heard to its end', () => {
  const f = make({ anticipate: true });
  f.decide(heard('ਵਣਜੁ ਕਰਹੁ ਵਣਜਾਰਿਹੋ'));
  assert.strictEqual(f.cur, 1);
  const out = f.decide(heard('ਕਰਹੁ ਵਣਜਾਰਿਹੋ ਵਖਰੁ ਲੇਹੁ ਸਮਾਲਿ'));
  assert.strictEqual(out.lineIndex, 2);
  // the breath pause: the same tail still in the window keeps the new pangti up
  assert.strictEqual(f.decide(heard('ਕਰਹੁ ਵਣਜਾਰਿਹੋ ਵਖਰੁ ਲੇਹੁ ਸਮਾਲਿ')).lineIndex, 2);
  // the new pangti begins: it stands
  assert.strictEqual(f.decide(heard('ਲੇਹੁ ਸਮਾਲਿ ਤੈਸੀ ਵਸਤੁ')).lineIndex, 2);
  assert.strictEqual(f.ant, null);
});

test('without anticipate the follower waits for the next pangti (unchanged behaviour)', () => {
  const f = make({});
  f.decide(heard('ਵਣਜੁ ਕਰਹੁ ਵਣਜਾਰਿਹੋ'));
  const out = f.decide(heard('ਕਰਹੁ ਵਣਜਾਰਿਹੋ ਵਖਰੁ ਲੇਹੁ ਸਮਾਲਿ'));
  assert.strictEqual(out.lineIndex, 1);
});

test('anticipate: reading the pangti again from its start goes back to it', () => {
  const f = make({ anticipate: true });
  f.decide(heard('ਵਣਜੁ ਕਰਹੁ ਵਣਜਾਰਿਹੋ'));
  f.decide(heard('ਕਰਹੁ ਵਣਜਾਰਿਹੋ ਵਖਰੁ ਲੇਹੁ ਸਮਾਲਿ'));
  assert.strictEqual(f.cur, 2);
  let out = null;
  for (let k = 0; k < 4 && f.cur !== 1; k += 1) out = f.decide(heard('ਸਮਾਲਿ ਵਣਜੁ ਕਰਹੁ ਵਣਜਾਰਿਹੋ'));
  assert.strictEqual(f.cur, 1);
  assert.ok(out && out.lineIndex === 1);
});

test('adopt: a new window carries on with the same audio and position', () => {
  const a = make({ anticipate: true });
  a.buf = new Float32Array(8000);
  a.acc = 1234;
  const b = new FollowerV2({}, LINES.slice(1), { anticipate: true });
  assert.ok(b.adopt(a, 1, 0));
  assert.strictEqual(b.buf, a.buf);
  assert.strictEqual(b.acc, 1234);
  assert.strictEqual(b.cur, 1);
  assert.strictEqual(b.ant, 0);
  // through a wrapper (as the benchmark harness builds them) it still moves the follower
  const c = new FollowerV2({}, LINES, {});
  const wrapped = Object.create(c);
  wrapped.adopt(a, 2);
  assert.strictEqual(c.cur, 2);
});
