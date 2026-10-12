// The desktop engine's inference core, capped to a few threads so the benchmark never
// crowds out whoever is using this Mac (BENCH_THREADS, default 2).
const path = require('path');
const ort = require('onnxruntime-node');
const { Infer } = require('../../www/main/addons/voice-follow/engine/infer');
const VOCAB = require('../../www/main/addons/voice-follow/engine/assets/vocab');
const MODEL = process.env.MODEL_PATH || path.join(process.env.HOME, 'Library/Application Support/SikhiToTheMax/voice-follow/model.int8.onnx');
module.exports = async () => {
  const n = parseInt(process.env.BENCH_THREADS || '2', 10);
  const sess = await ort.InferenceSession.create(MODEL, { intraOpNumThreads: n, interOpNumThreads: 1 });
  return new Infer(sess, VOCAB);
};
