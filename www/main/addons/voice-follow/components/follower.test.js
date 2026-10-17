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

test('armAt: once the last word of the pangti is heard, the next pangti wins as soon as its words outweigh the old ones', async () => {
  // A heard in full (last word reached), then a window where A still scores a little above B
  const half = norm(A).slice(16) + norm(B).slice(0, 16); // A 0.58, B 0.43
  const script = [nA, nA, nA, nA, half, half];
  const off = await run(script, { marginGate: 0.3, gateNear: true });
  const on = await run(script, { marginGate: 0.3, gateNear: true, armAt: 1, armBonus: 0.15 });
  assert.strictEqual(off[5], 0, 'without the pre-arm the window still says A');
  assert.strictEqual(on[4], 1, 'pre-armed: on B at the first window where B has begun');
});

// AP_FAST (fastPaceS): Akhand Paath fast readers. Four pangtis read one after another, each heard in 2 decodes (2 s).
const C4 = [A, B, 'ਚੁਪੈ ਚੁਪ ਨ ਹੋਵਈ ਜੇ ਲਾਇ ਰਹਾ ਲਿਵ ਤਾਰ', 'ਭੁਖਿਆ ਭੁਖ ਨ ਉਤਰੀ ਜੇ ਬੰਨਾ ਪੁਰੀਆ ਭਾਰ'];
const lines4 = C4.map((t, i) => ({ words: t.split(' '), verseId: 300 + i }));
const n4 = C4.map((t) => norm(t));
async function run4(script, opts) {
  const f = new Follower(fakeInfer(script), sp, lines4, { inputSr: SR, ...opts });
  const out = [];
  for (let i = 0; i < script.length; i++) out.push(await f.push(new Float32Array(SR)));
  return { lines: out.map((r) => (r ? r.lineIndex : null)), conf: out.map((r) => (r ? r.confidence : null)), f };
}
const FAST = { fastPaceS: 4, fastN: 3, fastTail: 6, fastGuard: 0.75, fastMargin: 0.15 };
// the window just after the reader starts pangti 1: mostly pangti 0, pangti 1's first letters at the end
const zeroThenOne = n4[0].slice(4) + n4[1].slice(0, 8);

test('fast reader: with a quick pace the next pangti shows as soon as its opening letters are heard', async () => {
  const script = [n4[0], n4[0], n4[0], n4[0], zeroThenOne];
  const off = await run4(script, {});
  const slow = await run4(script, { ...FAST, paceHist: [8, 9, 8] });
  const fast = await run4(script, { ...FAST, paceHist: [2, 2.5, 2] });
  assert.strictEqual(off.lines[4], 0, '9.0.4: the window still says pangti 0');
  assert.strictEqual(slow.lines[4], 0, 'slow pace (kirtan): as 9.0.4');
  assert.strictEqual(fast.lines[4], 1, 'fast pace: on pangti 1');
  assert.ok(fast.conf[4] >= 0.75, 'confident enough for the screen to move');
});

test('fast reader: off by default, a shared pace history alone changes nothing', async () => {
  const script = [n4[0], n4[0], n4[0], n4[0], zeroThenOne, n4[1], n4[1], n4[2], n4[2], n4[3]];
  const base = await run4(script, {});
  const histOnly = await run4(script, { paceHist: [2, 2, 2] });
  assert.deepStrictEqual(histOnly.lines, base.lines);
  assert.deepStrictEqual(histOnly.conf, base.conf);
});

test('fast reader: the pace is measured from the cursor steps and shared across followers', async () => {
  const hist = [];
  const script = [n4[0], n4[0], n4[0], n4[0], n4[1], n4[1], n4[2], n4[2], n4[3], n4[3]];
  await run4(script, { ...FAST, paceHist: hist });
  assert.ok(hist.length >= 2, `pangti durations noted: ${hist}`);
  hist.forEach((s) => assert.ok(s > 1 && s <= 3, `about 2 s per pangti: ${s}`));
  // a new Shabad's follower given the same history is fast from its first pangti
  const next = await run4([n4[0], n4[0], n4[0], n4[0], zeroThenOne], { ...FAST, paceHist: hist.concat([2]) });
  assert.strictEqual(next.lines[4], 1);
});

test('fast reader: a step back (a pangti said again) turns the fast hand-off off', async () => {
  const hist = [2, 2, 2];
  const f = new Follower(fakeInfer([]), sp, lines4, { inputSr: SR, ...FAST, paceHist: hist });
  assert.ok(f._fast());
  f.t = 10; f.moveT = 8; f._paced(2, 1);
  f._paced(1, 0);
  assert.strictEqual(f._fast(), false, 'two of the last three pangti steps were back');
});

test('fast reader: the opening letters must fit the next pangti clearly better than the current one', async () => {
  const shared = 'ਭੀ ਸਚੁ'; // ends pangti 0 and sits inside pangti 1
  const script = [n4[0], n4[0], n4[0], n4[0], n4[0].slice(10) + norm(shared)];
  const fast = await run4(script, { ...FAST, fastTail: 6, paceHist: [2, 2, 2] });
  assert.strictEqual(fast.lines[4], 0);
});

test('fast reader: fastConfirm and fastEndWords hold the hand-off until it is sure', async () => {
  const script = [n4[0], n4[0], n4[0], n4[0], zeroThenOne, zeroThenOne];
  const two = await run4(script, { ...FAST, fastConfirm: 2, paceHist: [2, 2, 2] });
  assert.deepStrictEqual(two.lines.slice(4), [0, 1], 'two decodes in a row');
  // pangti 0's last words never heard (only its first half, then pangti 1's opening): no hand-off
  const early = n4[0].slice(0, 14) + n4[1].slice(0, 8);
  const end = await run4([n4[0].slice(0, 14), n4[0].slice(0, 14), n4[0].slice(0, 14), n4[0].slice(0, 14), early], { ...FAST, fastEndWords: 2, paceHist: [2, 2, 2] });
  assert.strictEqual(end.lines[4], 0);
});
