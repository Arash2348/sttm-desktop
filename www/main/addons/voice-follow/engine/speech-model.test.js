// node --test: the speech model pack loader (speech-model.js) and the tokenizer rules it feeds.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.VF_SPEECH_MODEL;
const { active, loadPack, parseSentencePiece, classes } = require('./speech-model');
const { SP } = require('./sentencepiece');

// A tiny sentencepiece .model, written with the same protobuf layout the real files use.
function varint(n) {
  const out = [];
  let v = n;
  while (v >= 128) {
    out.push((v % 128) + 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return Buffer.from(out);
}
const field = (no, wire, body) => Buffer.concat([varint(no * 8 + wire), body]);
const bytes = (no, b) => field(no, 2, Buffer.concat([varint(b.length), b]));
function pieceMsg(p, s, type = 1) {
  const f = Buffer.alloc(4);
  f.writeFloatLE(s, 0);
  return bytes(
    1,
    Buffer.concat([bytes(1, Buffer.from(p, 'utf8')), field(2, 5, f), field(3, 0, varint(type))]),
  );
}
function spModel(pieces, modelType = 2) {
  const trainer = bytes(2, field(3, 0, varint(modelType)));
  return Buffer.concat([...pieces.map(([p, s, t]) => pieceMsg(p, s, t)), trainer]);
}

test('unset VF_SPEECH_MODEL = the built-in Karanbir model, unchanged', () => {
  const m = active();
  assert.strictEqual(m.name, 'karanbir');
  assert.strictEqual(m.blank, 256);
  assert.strictEqual(m.vocab.length, 256);
  assert.strictEqual(classes(m), 257);
  assert.strictEqual(m.onnx, null);
});

test('parseSentencePiece reads pieces, scores, types and the model type', () => {
  const buf = spModel([
    ['<unk>', 0, 2],
    ['▁ਸ', -1.5],
    ['ਾ', -2],
  ]);
  const { pieces, modelType } = parseSentencePiece(buf);
  assert.strictEqual(modelType, 2);
  assert.deepStrictEqual(
    pieces.map((e) => [e.p, e.s, e.type]),
    [
      ['<unk>', 0, 2],
      ['▁ਸ', -1.5, 1],
      ['ਾ', -2, 1],
    ],
  );
});

test('a pack whose blank shares an id with a piece: that piece is never a token, unk is <unk>', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-pack-'));
  // Jaspal's layout: id 0 is both the first piece and the CTC blank; <unk> is id 1.
  fs.writeFileSync(
    path.join(dir, 'bpe.model'),
    spModel([
      ['▁ਸ', 0],
      ['<unk>', 0, 2],
      ['▁', -1],
      ['ਸ', -2],
      ['ਤ', -3],
    ]),
  );
  fs.writeFileSync(path.join(dir, 'm.onnx'), '');
  fs.writeFileSync(
    path.join(dir, 'model.json'),
    JSON.stringify({ name: 'toy', onnx: 'm.onnx', tokenizer: 'bpe.model', blank: 0 }),
  );
  const m = loadPack(dir);
  assert.strictEqual(m.name, 'toy');
  assert.strictEqual(m.blank, 0);
  assert.strictEqual(classes(m), 5);
  assert.deepStrictEqual(m.io, {
    audio: 'audio',
    audioLen: 'audio_len',
    logProbs: 'log_probs',
    outLen: 'out_len',
  });
  const sp = new SP(m.pieces, { blank: m.blank });
  // '▁ਸ' would be id 0 = blank: spelt '▁' + 'ਸ' instead; an unknown letter is <unk> (1), never 0.
  assert.deepStrictEqual(sp.encode('ਸ'), [2, 3]);
  assert.deepStrictEqual(sp.encode('ਕ'), [2, 1]);
  assert.ok(!sp.encode('ਸਤ ਸ').includes(0));
});

test('a pack missing a file or the blank is refused with a clear message', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-pack-'));
  fs.writeFileSync(
    path.join(dir, 'model.json'),
    JSON.stringify({ onnx: 'none.onnx', tokenizer: 't.model' }),
  );
  assert.throws(() => loadPack(dir), /integer blank/);
  fs.writeFileSync(
    path.join(dir, 'model.json'),
    JSON.stringify({ onnx: 'none.onnx', tokenizer: 't.model', blank: 0 }),
  );
  assert.throws(() => loadPack(dir), /missing t\.model/);
});

// With Karanbir's own tokenizer.model (VF_TEST_TOKENIZER=<path>), the parser must give exactly the
// built-in vocabulary and scores, so a pack of his model behaves like the built-in one.
test(
  'Karanbir tokenizer.model parses to the built-in assets',
  { skip: !process.env.VF_TEST_TOKENIZER },
  () => {
    const { pieces } = parseSentencePiece(fs.readFileSync(process.env.VF_TEST_TOKENIZER));
    const m = active();
    assert.deepStrictEqual(
      pieces.map((e) => e.p),
      m.vocab,
    );
    assert.deepStrictEqual(
      pieces.map((e) => e.s + 0), // + 0: the file stores -0 where the assets have 0
      m.pieces.map((e) => e.s + 0),
    );
  },
);
