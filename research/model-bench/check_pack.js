#!/usr/bin/env node
// check_pack.js - does the app engine hear exactly what infer.py hears with a model pack?
//   node check_pack.js <pack folder> [--py .venv/bin/python] [--clips id1,id2] [--windows 12]
// Transcribes the same 10 s windows (from data/clips, fetched by fetch.py) with the app's engine
// (VF_SPEECH_MODEL=<pack>) and with infer.py's Model, and prints how many come out identical.
// Expected: all of them. A difference means the pack's blank, tokenizer, front-end or io names are wrong.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const pack = path.resolve(argv[0] || '');
if (!argv[0] || !fs.existsSync(path.join(pack, 'model.json'))) {
  console.error('usage: node check_pack.js <pack folder with model.json> [--py <python>] [--clips a,b] [--windows N]');
  process.exit(2);
}
const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');
const PY = opt('py', path.join(HERE, '.venv', 'bin', 'python'));
const sample = JSON.parse(fs.readFileSync(path.join(HERE, 'sample.json'), 'utf8'));
const clips = (opt('clips', '') || sample.clips.slice(0, 2).map((c) => c.id).join(',')).split(',');
const N = Number(opt('windows', 12));
const cfg = JSON.parse(fs.readFileSync(path.join(pack, 'model.json'), 'utf8'));
const wins = [];
clips.forEach((id) => {
  for (let k = 0; k < N; k += 1) wins.push({ id, t: 30 + 10 * k });
});

// infer.py's answer
const py = `
import sys, json, wave, numpy as np
sys.path.insert(0, ${JSON.stringify(HERE)})
from infer import Model
a = json.loads(sys.argv[1])
m = Model(a['onnx'], a['tok'], a['blank'], a['fe'], 4)
out = []
for w in a['wins']:
    f = wave.open(a['data'] + '/clips/' + w['id'] + '/audio.wav')
    pcm = np.frombuffer(f.readframes(f.getnframes()), np.int16).astype(np.float32) / 32768
    out.append(m.transcribe(np.ascontiguousarray(pcm[w['t'] * 16000:(w['t'] + 10) * 16000])))
print(json.dumps(out, ensure_ascii=False))
`;
const a = {
  onnx: path.join(pack, cfg.onnx),
  tok: path.join(pack, cfg.tokenizer),
  blank: cfg.blank,
  fe: cfg.frontend ? path.join(pack, cfg.frontend.onnx) : null,
  wins,
  data: path.join(HERE, 'data'),
};
const r = spawnSync(PY, ['-c', py, JSON.stringify(a)], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (r.status) {
  console.error(r.stderr);
  process.exit(1);
}
const ref = JSON.parse(r.stdout.trim().split('\n').pop());

// the app engine's answer
process.env.VF_SPEECH_MODEL = pack;
// eslint-disable-next-line import/no-dynamic-require
const { Infer, MODEL } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/infer'));
function pcm16(f) {
  const b = fs.readFileSync(f);
  let o = 12;
  let d;
  while (o < b.length) {
    const n = b.readUInt32LE(o + 4);
    if (b.toString('ascii', o, o + 4) === 'data') {
      d = b.subarray(o + 8, o + 8 + n);
      break;
    }
    o += 8 + n + (n % 2);
  }
  const x = new Float32Array(d.length / 2);
  for (let i = 0; i < x.length; i += 1) x[i] = d.readInt16LE(i * 2) / 32768;
  return x;
}
(async () => {
  const inf = await Infer.create(MODEL.onnx);
  const audio = {};
  let same = 0;
  for (let i = 0; i < wins.length; i += 1) {
    const w = wins[i];
    audio[w.id] = audio[w.id] || pcm16(path.join(HERE, 'data', 'clips', w.id, 'audio.wav'));
    // eslint-disable-next-line no-await-in-loop
    const out = await inf.run(audio[w.id].slice(w.t * 16000, (w.t + 10) * 16000));
    const txt = inf.decode(inf.greedy(out));
    if (txt === ref[i]) same += 1;
    else if (same + 3 > i) console.log(`differs at ${w.id} ${w.t}s\n  app:      ${txt}\n  infer.py: ${ref[i]}`);
  }
  console.log(`${MODEL.name}: app engine = infer.py on ${same}/${wins.length} windows`);
  process.exit(same === wins.length ? 0 : 1);
})();
