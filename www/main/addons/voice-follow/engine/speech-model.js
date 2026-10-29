// Which speech model the engine runs. By default: Karanbir's karansea CTC model, its vocabulary and
// tokenizer built into assets/ (blank id 256), downloaded by model-manager. A developer or a
// benchmark can run another CTC model instead by pointing VF_SPEECH_MODEL at a model pack: a folder
// with the model's own files and a model.json, for example
//
//   { "name": "jaspal-v1", "onnx": "sggs-large-epoch90.int8.onnx", "tokenizer": "bpe.model", "blank": 0 }
//
// and, for a model whose ONNX takes features rather than audio, a front-end ONNX (audio -> features)
// plus the input/output names of both:
//
//   "frontend": { "onnx": "frontend-from-v1.onnx", "features": "/Div_output_0", "featuresLen": "/Where_output_0" },
//   "io": { "audio": "x", "audioLen": "x_lens", "logProbs": "log_probs", "outLen": "log_probs_len" }
//
// "tokenizer" is the model's SentencePiece .model file as shipped (read here, no Python needed). Ids are
// the model's output classes: vocab[id] is the piece the model emits at that index, and the blank id is
// never a token (a model whose blank shares an id with a piece, like Jaspal's id 0, never emits it).
// The pack is read once per process; unset = exactly the built-in model.
const fs = require('fs');
const path = require('path');

const DEFAULT_IO = {
  audio: 'audio',
  audioLen: 'audio_len',
  logProbs: 'log_probs',
  outLen: 'out_len',
};

// Minimal protobuf reader for sentencepiece_model.proto: ModelProto.pieces (field 1, repeated
// SentencePiece {piece = 1, score = 2, type = 3}) and ModelProto.trainer_spec.model_type (2 -> 3).
function readVarint(buf, start) {
  let v = 0;
  let mul = 1;
  for (let pos = start; pos < buf.length; pos += 1) {
    const b = buf[pos];
    v += (b % 128) * mul;
    if (b < 128) return [v, pos + 1];
    mul *= 128;
  }
  throw new Error('tokenizer: truncated varint');
}

function fields(buf, onField) {
  let pos = 0;
  while (pos < buf.length) {
    let key;
    [key, pos] = readVarint(buf, pos);
    const no = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      let v;
      [v, pos] = readVarint(buf, pos);
      onField(no, wire, v);
    } else if (wire === 1) {
      onField(no, wire, buf.subarray(pos, pos + 8));
      pos += 8;
    } else if (wire === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      onField(no, wire, buf.subarray(pos, pos + len));
      pos += len;
    } else if (wire === 5) {
      onField(no, wire, buf.subarray(pos, pos + 4));
      pos += 4;
    } else throw new Error(`tokenizer: unsupported wire type ${wire}`);
  }
}

// SentencePiece .model bytes -> { pieces: [{p, s, type}], modelType } (modelType 1 unigram, 2 BPE).
function parseSentencePiece(buf) {
  const pieces = [];
  let modelType = 1;
  fields(buf, (no, wire, v) => {
    if (no === 1 && wire === 2) {
      const e = { p: '', s: 0, type: 1 };
      fields(v, (n, w, x) => {
        if (n === 1 && w === 2) e.p = Buffer.from(x).toString('utf8');
        else if (n === 2 && w === 5) e.s = Buffer.from(x).readFloatLE(0);
        else if (n === 3 && w === 0) e.type = x;
      });
      pieces.push(e);
    } else if (no === 2 && wire === 2) {
      fields(v, (n, w, x) => {
        if (n === 3 && w === 0) modelType = x;
      });
    }
  });
  return { pieces, modelType };
}

function loadPack(dir) {
  const root = path.resolve(dir);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'model.json'), 'utf8'));
  const file = (f) => {
    const p = path.resolve(root, f);
    if (!fs.existsSync(p)) throw new Error(`speech model pack ${root}: missing ${f}`);
    return p;
  };
  if (!cfg.onnx || !cfg.tokenizer || !Number.isInteger(cfg.blank)) {
    throw new Error(
      `speech model pack ${root}: model.json needs onnx, tokenizer and an integer blank`,
    );
  }
  const { pieces, modelType } = parseSentencePiece(fs.readFileSync(file(cfg.tokenizer)));
  if (!pieces.length) throw new Error(`speech model pack ${root}: no pieces in ${cfg.tokenizer}`);
  const fe = cfg.frontend
    ? {
        onnx: file(cfg.frontend.onnx),
        features: cfg.frontend.features,
        featuresLen: cfg.frontend.featuresLen,
      }
    : null;
  return {
    name: cfg.name || path.basename(root),
    dir: root,
    onnx: file(cfg.onnx),
    frontend: fe,
    io: { ...DEFAULT_IO, ...(cfg.io || {}) },
    blank: cfg.blank,
    vocab: pieces.map((e) => e.p),
    pieces: pieces.map(({ p, s }) => ({ p, s })),
    modelType,
  };
}

function builtin() {
  return {
    name: 'karanbir',
    dir: null,
    onnx: null, // model-manager: bundled copy or the per-user download
    frontend: null,
    io: DEFAULT_IO,
    blank: 256,
    // eslint-disable-next-line global-require
    vocab: require('./assets/vocab'),
    // eslint-disable-next-line global-require
    pieces: require('./assets/pieces'),
    modelType: 2,
  };
}

let current = null;
function active() {
  if (!current)
    current = process.env.VF_SPEECH_MODEL ? loadPack(process.env.VF_SPEECH_MODEL) : builtin();
  return current;
}

// Output classes per frame: every piece, plus the blank when it sits after the last piece.
const classes = (m) => m.vocab.length + (m.blank >= m.vocab.length ? 1 : 0);

module.exports = { active, loadPack, builtin, parseSentencePiece, classes, DEFAULT_IO };
