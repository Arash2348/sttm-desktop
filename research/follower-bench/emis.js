// Full-clip log-probs for truth alignment, built from short overlapping chunks: the
// model loses words on long inputs (40 s chunks dropped whole phrases), so each 10 s
// chunk contributes only its middle 6 s.
//   node emis.js <wav> ...   -> cache/<clip>.emis.f32 (frames x 257, 25 fps)
const fs = require('fs');
const path = require('path');
const makeInfer = require('./infer');
const SR = 16000, FPS = 25, C = 257, KEEP = 6, PAD = 2;
const readWav = (f) => {
  const b = fs.readFileSync(f);
  return Float32Array.from(new Int16Array(b.buffer, b.byteOffset + 44, (b.length - 44) >> 1), (x) => x / 32768);
};
(async () => {
  const inf = await makeInfer();
  for (const wav of process.argv.slice(2)) {
    const name = path.basename(wav, '.wav');
    const pcm = readWav(wav);
    const dur = pcm.length / SR, total = Math.floor(dur * FPS), out = new Float32Array(total * C);
    for (let s = 0; s < dur; s += KEEP) {
      const a = Math.max(0, s - PAD), b = Math.min(dur, s + KEEP + PAD);
      const e = await inf.emissions(pcm.subarray(Math.floor(a * SR), Math.floor(b * SR)));
      const f0 = Math.round((s - a) * FPS), f1 = Math.min(e.frames, f0 + KEEP * FPS);
      for (let f = f0; f < f1; f++) {
        const g = Math.round(a * FPS) + f;
        if (g < total) out.set(e.data.subarray(f * C, (f + 1) * C), g * C);
      }
    }
    fs.writeFileSync(`cache/${name}.emis.f32`, Buffer.from(out.buffer));
    console.log(name, 'emis', total, 'frames');
  }
})();
