// Downloads + caches the speech model so voice-follow needs zero user setup. On first use we
// fetch the model from Hugging Face into the app's userData dir; later runs use the cached copy.
//
// Model swap: every model below honours the app's one ONNX contract, so nothing else changes
// when the model does (engine/infer.js, the followers, GAB's replay harness):
//   inputs  audio [1, T] float32 16 kHz mono, audio_len [1] int64
//   outputs log_probs [1, F, 257] (log-softmax; 40 ms frames), out_len [1] int64
//   classes = the pa sentencepiece (256 pieces, engine/assets/vocab.js) + blank 256; the mel
//   front-end is inside the graph.
// Bhai Surinder Singh's IndicConformer pa-v3-kirtan (Apache-2.0) is exported to this contract by
// research/model-swap/export_app_onnx.py (NeMo front-end from the .nemo config as a conv STFT, the
// CTC head cut to the pa slice + blank, int8 = MatMul/Gemm weights only). Its tokenizer is
// byte-identical to Karanbir's (sha256 63a2e8f1...), so vocab.js / pieces.js are shared.
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const MODELS = {
  // Karanbir Singh's karansea IndicConformer CTC, int8 (MIT): the model the app has always run.
  'karanbir-int8': {
    file: 'model.int8.onnx',
    bytes: 184311219,
    url: 'https://huggingface.co/karansea/indicconformer-stt-pa-ctc-shabad-preview/resolve/main/model.int8.onnx?download=true',
  },
  // Bhai Surinder Singh's indicconformer-pa-v3-kirtan, exported to the app contract.
  // url: null until the export is hosted (owner's call); place the file in modelDir() to use it.
  'surinder-v3-int8': {
    file: 'surinder-pa-v3-kirtan.int8.onnx',
    bytes: 187678637,
    url: null,
  },
  'surinder-v3-fp32': {
    file: 'surinder-pa-v3-kirtan.fp32.onnx',
    bytes: 483094357,
    url: null,
  },
};

// Which speech model Voice Autopilot runs. Default = the current model (no behaviour change).
// VF_ASR_MODEL=<id> (benchmarks, testers) overrides it; VF_ASR_MODEL_PATH=<file.onnx> runs any
// file that honours the contract above (no size check, no download).
const ASR_MODEL = 'karanbir-int8';

function env(name) {
  return (process.env && process.env[name]) || '';
}

function modelId() {
  const id = env('VF_ASR_MODEL') || ASR_MODEL;
  if (!MODELS[id])
    throw new Error(`unknown speech model ${id} (known: ${Object.keys(MODELS).join(', ')})`);
  return id;
}

function spec() {
  return MODELS[modelId()];
}

const MODEL_FILE = MODELS[ASR_MODEL].file;
const MODEL_BYTES = MODELS[ASR_MODEL].bytes; // known size; used to detect a truncated download
const MODEL_URL = MODELS[ASR_MODEL].url;

function modelDir() {
  // Lazy require so this module is usable outside Electron (tests).
  // eslint-disable-next-line global-require
  const { app } = require('electron');
  // Electron exposes app directly in main and through remote in this renderer.
  // eslint-disable-next-line global-require
  const electronApp = app || (process.type === 'renderer' ? require('@electron/remote').app : null);
  const base = electronApp ? electronApp.getPath('userData') : path.join(os.tmpdir(), 'sttm');
  return path.join(base, 'voice-follow');
}

// A copy shipped inside the installer (tester builds bundle it so a Gurdwara never has
// to download 184 MB). Used when present and complete; otherwise the per-user download.
function bundledModelPath() {
  try {
    const res = process.resourcesPath;
    return res ? path.join(res, 'voice-follow', spec().file) : null;
  } catch (_) {
    return null;
  }
}

function modelPath() {
  if (env('VF_ASR_MODEL_PATH')) return env('VF_ASR_MODEL_PATH');
  const bundled = bundledModelPath();
  // eslint-disable-next-line no-use-before-define
  if (bundled && isComplete(bundled)) return bundled;
  return path.join(modelDir(), spec().file);
}

function isComplete(file) {
  try {
    const { size } = fs.statSync(file);
    return env('VF_ASR_MODEL_PATH') ? size > 0 : size === spec().bytes;
  } catch (_) {
    return false;
  }
}

function isReady() {
  return isComplete(modelPath());
}

function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('too many redirects'));
      return;
    }
    const req = https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(download(res.headers.location, dest, onProgress, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`download failed: HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const tmp = `${dest}.part`;
      const out = fs.createWriteStream(tmp);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress && total) onProgress(received, total);
      });
      res.pipe(out);
      out.on('finish', () =>
        out.close(() => {
          try {
            fs.renameSync(tmp, dest);
            resolve(dest);
          } catch (e) {
            reject(e);
          }
        }),
      );
      out.on('error', (e) => {
        try {
          fs.unlinkSync(tmp);
        } catch (_) {
          /* A failed download may already have removed the partial file. */
        }
        reject(e);
      });
    });
    req.on('error', reject);
  });
}

// Ensure the model exists locally; download it if missing. onProgress(0..1).
async function ensureModel(onProgress) {
  if (isReady()) return modelPath();
  if (env('VF_ASR_MODEL_PATH'))
    throw new Error(`speech model not found: ${env('VF_ASR_MODEL_PATH')}`);
  fs.mkdirSync(modelDir(), { recursive: true });
  // Earlier renderer versions accidentally used the plain-Node temporary path.
  // Preserve that cache while copying it atomically into the persistent profile.
  const legacy = path.join(os.tmpdir(), 'sttm', 'voice-follow', spec().file);
  const dest = modelPath();
  if (legacy !== dest && isComplete(legacy)) {
    const temporary = `${dest}.${process.pid}.migrate.part`;
    try {
      fs.copyFileSync(legacy, temporary);
      if (!isComplete(temporary)) throw new Error('cached model migration is incomplete');
      fs.renameSync(temporary, dest);
    } catch (e) {
      try {
        fs.unlinkSync(temporary);
      } catch (_) {
        /* No partial copy to remove. */
      }
      throw e;
    }
    return dest;
  }
  if (!spec().url)
    throw new Error(
      `speech model ${modelId()} is not hosted yet: put ${spec().file} in ${modelDir()}`,
    );
  await download(spec().url, modelPath(), (r, t) => {
    if (onProgress) onProgress(r / t);
  });
  if (!isReady()) throw new Error('downloaded model is incomplete');
  return modelPath();
}

module.exports = {
  ensureModel,
  isReady,
  modelPath,
  modelDir,
  modelId,
  MODELS,
  ASR_MODEL,
  MODEL_FILE,
  MODEL_BYTES,
  MODEL_URL,
};
