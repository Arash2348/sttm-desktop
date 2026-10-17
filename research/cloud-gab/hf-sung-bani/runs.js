// runs.js <video> <out.json> — caption-change detection on the Gurmukhi row (yellow-text mask, 2 fps)
const { spawn } = require('child_process'); const fs = require('fs');
const [video, out] = process.argv.slice(2);
const W = 640, Y0 = 262, H = 24, FPS = 4;
const p = spawn('/Users/asingh02/.local/bin/ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', video, '-vf', `fps=${FPS},crop=${W}:${H}:0:${Y0}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
const FR = W * H * 3; let buf = Buffer.alloc(0); const masks = [];
p.stdout.on('data', (d) => { buf = Buffer.concat([buf, d]); while (buf.length >= FR) { const f = buf.subarray(0, FR); buf = buf.subarray(FR);
  const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) { const r = f[i * 3], g = f[i * 3 + 1], b = f[i * 3 + 2]; m[i] = r > 170 && g > 120 && b < 140 && r - b > 90 ? 1 : 0; } masks.push(m); } });
p.on('close', () => {
  const n = masks.length; const cnt = masks.map((m) => m.reduce((a, x) => a + x, 0));
  const diff = [0]; for (let k = 1; k < n; k++) { let d = 0; const a = masks[k - 1], b = masks[k]; for (let i = 0; i < a.length; i++) d += a[i] ^ b[i]; diff.push(d); }
  fs.writeFileSync(out, JSON.stringify({ fps: FPS, cnt, diff }));
  console.log('frames', n);
});
