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

test('gateNear: two near-equal pangtis that include the next one are decided, not frozen', async () => {
  // a window where A's end and B's start score alike: the gate freezes the recited profile; with gateNear the
  // line scores decide and the cursor moves on to B as more of B is heard
  const nA2 = norm(A);
  const half = nA2.slice(16) + norm(B).slice(0, 16); // A 0.58, B 0.43: within a 0.3 gate
  const more = nA2.slice(24) + norm(B).slice(0, 24); // A 0.42, B 0.65: B leads, still within the gate
  const script = [nA2, nA2, nA2, nA2, half, more, more, more];
  const off = await run(script, { marginGate: 0.3 });
  const on = await run(script, { marginGate: 0.3, gateNear: true });
  assert.strictEqual(off[7], null, 'gated: frozen, no decision');
  assert.strictEqual(on[7], 1, 'gateNear: moved to B');
});

test('revisitDwell: a return to the rahao pangti already sung needs one decode, not the far-jump dwell', async () => {
  const R = 'ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ਜਪੁ ਆਦਿ ਸਚੁ ਰਹਾਉ';
  const L3 = [R, B, 'ਚੁਪੈ ਚੁਪ ਨ ਹੋਵਈ ਜੇ ਲਾਇ ਰਹਾ ਲਿਵ ਤਾਰ', 'ਭੁਖਿਆ ਭੁਖ ਨ ਉਤਰੀ ਜੇ ਬੰਨਾ ਪੁਰੀਆ ਭਾਰ'].map((t, i) => ({ words: t.split(' '), verseId: 200 + i }));
  const nR = norm(R); const n1 = norm(L3[1].words.join(' ')); const n2 = norm(L3[2].words.join(' ')); const n3 = norm(L3[3].words.join(' '));
  const script = [nR, nR, nR, nR, n1, n1, n2, n2, n3, n3, nR, nR];
  const go = async (opts) => { const f = new Follower(fakeInfer(script), sp, L3, { inputSr: SR, ...opts }); const out = []; for (let i = 0; i < script.length; i++) out.push(await f.push(new Float32Array(SR))); return out.map((r) => (r ? r.lineIndex : null)); };
  const slow = await go({});
  const fast = await go({ revisitDwell: 1 });
  assert.strictEqual(slow[10], 3, 'recited: the first decode of the repeat still shows the last pangti');
  assert.strictEqual(fast[10], 0, 'revisitDwell 1: back on the rahao at once');
});
