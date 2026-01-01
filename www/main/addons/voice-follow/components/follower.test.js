// Line follower (engine/follower.js): the tail hand-off to the next pangti (tailAdv).
const test = require('node:test');
const assert = require('node:assert');
const { Follower } = require('../engine/follower');
const { norm, SR } = require('../engine/infer');

// two pangtis of a Shabad (words as the app passes them: { words, verseId })
const A = 'ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ਜਪੁ ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ਹੈ ਭੀ ਸਚੁ';
const B = 'ਨਾਨਕ ਹੋਸੀ ਭੀ ਸਚੁ ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ ਜੇ ਸੋਚੀ ਲਖ ਵਾਰ';
const lines = [A, B, 'ਚੁਪੈ ਚੁਪ ਨ ਹੋਵਈ ਜੇ ਲਾਇ ਰਹਾ ਲਿਵ ਤਾਰ'].map((t, i) => ({ words: t.split(' '), verseId: 100 + i }));
const sp = { encode: () => [] }; // no CTC word alignment in this test
// a recognizer that "hears" a scripted transcript per decode
function fakeInfer(script) {
  let k = 0;
  return {
    emissions: async () => ({ data: new Float32Array(257), frames: 1, C: 257 }),
    greedy: () => [],
    decode: () => script[Math.min(k++, script.length - 1)],
  };
}
async function run(script, opts) {
  const f = new Follower(fakeInfer(script), sp, lines, { inputSr: SR, ...opts });
  const out = [];
  for (let i = 0; i < script.length; i++) out.push(await f.push(new Float32Array(SR))); // 1 s per decode
  return out.map((r) => (r ? r.lineIndex : null));
}
const nA = norm(A);
const nB = norm(B);
// the window after pangti A ends: still mostly A, with B's first letters at the end
const aThenB = nA.slice(8) + nB.slice(0, 14);

test('with the tail rule the cursor moves to the next pangti as soon as its first letters are heard', async () => {
  const script = [nA, nA, nA, nA, aThenB];
  const off = await run(script, { tailAdv: 0 });
  const on = await run(script, { tailAdv: 12 });
  assert.strictEqual(off[3], 0, 'locked on A after initConfirm decodes');
  assert.strictEqual(off[4], 0, 'without the rule the window still says A');
  assert.strictEqual(on[4], 1, 'with the rule B has begun');
});

test('the tail rule does not fire while the current pangti is still being sung', async () => {
  const script = [nA, nA, nA, nA, nA.slice(5), nA.slice(10)];
  const on = await run(script, { tailAdv: 12 });
  assert.deepStrictEqual(on.slice(3), [0, 0, 0]);
});

test('the tail rule needs a clear margin: a tail that fits both pangtis does not move', async () => {
  const shared = 'ਭੀ ਸਚੁ'; // ends A and sits inside B
  const script = [nA, nA, nA, nA, nA.slice(10) + norm(shared)];
  const on = await run(script, { tailAdv: 6, tailSlack: 30 });
  assert.strictEqual(on[4], 0);
});
