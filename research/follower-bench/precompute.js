// Runs the model once per clip and caches what every follower variant needs (the
// full-clip log-probs for truth alignment come from emis.js):
//   cache/<clip>.hyps.json greedy transcript of each streaming window (4 s, every 0.25 s),
//                          exactly the windows the desktop/web follower sees
// so follower variants replay in seconds without the model.
const fs = require('fs');
const path = require('path');
const makeInfer = require('./infer');
const SR = 16000;
const readWav = (f) => {
  const b = fs.readFileSync(f);
  return Float32Array.from(new Int16Array(b.buffer, b.byteOffset + 44, (b.length - 44) >> 1), (x) => x / 32768);
};
(async () => {
  const inf = await makeInfer();
  for (const wav of process.argv.slice(2)) {
    const name = path.basename(wav, '.wav');
    const HOP = Number(process.env.HOP || 0.25), tag = HOP === 0.25 ? '' : `.hop${HOP}`;
    if (fs.existsSync(`cache/${name}${tag}.hyps.json`)) continue;
    const pcm = readWav(wav);
    // Streaming windows.
    const hyps = [];
    for (let end = SR; end <= pcm.length; end += Math.round(SR * HOP)) {
      const w = pcm.subarray(Math.max(0, end - 4 * SR), end);
      hyps.push(inf.decode(inf.greedy(await inf.emissions(w))));
    }
    fs.writeFileSync(`cache/${name}${tag}.hyps.json`, JSON.stringify({ clip: name, hop: HOP, firstEnd: 1, window: 4, hyps }));
    console.log(name, (pcm.length / SR).toFixed(0), 's', hyps.length, 'windows');
  }
})();
