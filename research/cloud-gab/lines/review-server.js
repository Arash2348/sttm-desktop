#!/usr/bin/env node
// review-server.js — the pangti review app on localhost: one page (review.html, the "Pangti Start Check" design) over
// the review queue line-build.js writes (aligned starts the two models disagree on, weakly matched ones, and a 5% spot
// check of auto-accepted ones). Answers are appended to answers.jsonl (one JSON per answer; the last one per item wins).
//
//   node review-server.js [--lines /home/user/gab/lines] [--clips <dir of wavs>] [--manifest <manifest.csv>] [--port 8772]
//   open http://localhost:8772            (?clip=l3 shows only clips whose id starts with l3; ?kind=aligned-1model)
//
// Audio is served straight from the GAB wavs with HTTP range requests (no copies, no uploads); the waveform
// envelope is computed once per clip and kept in <lines>/env/. Then: node line-apply.js (answers -> answer keys).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const first = (...c) => c.find((p) => p && fs.existsSync(p));
const LINES = arg('lines', first(process.env.LINES, '/home/user/gab/lines', path.join(os.homedir(), 'personal/gab-lines')) || '/home/user/gab/lines');
const CLIPS = arg('clips', first(process.env.VF_CLIPS, '/home/user/gab/clips', path.join(os.homedir(), 'personal/live-darbar-venues/clips')));
const MANIFEST = arg('manifest', first(path.join(LINES, 'manifest.csv'), '/home/user/gab/bench/manifest.csv', path.join(os.homedir(), 'personal/vf-benchmark/manifest.csv')));
const PORT = Number(arg('port', 8772));
const ANSWERS = path.join(LINES, 'answers.jsonl');

function manifest() {
  const [h, ...rows] = fs.readFileSync(MANIFEST, 'utf8').split('\n');
  const k = h.split(',');
  const out = {};
  for (const l of rows) {
    if (!l.trim()) continue;
    // simple CSV (quoted fields with commas)
    const v = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(cur); cur = ''; } else cur += ch; }
    v.push(cur);
    const r = Object.fromEntries(k.map((x, i) => [x, v[i]]));
    out[r.id] = r;
  }
  return out;
}
const MAN = manifest();
const wavOf = (clip) => path.join(CLIPS, (MAN[clip] || {}).source_file || `${clip}.wav`);

function items() {
  const dir = path.join(LINES, 'review');
  const all = [];
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) if (f.endsWith('.items.json')) all.push(...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  // recordings with the fewest open pangtis first: each finished recording is fully human-checked (scoreable) sooner
  const n = {}; for (const it of all) n[it.clip] = (n[it.clip] || 0) + 1;
  all.sort((a, b) => n[a.clip] - n[b.clip] || a.clip.localeCompare(b.clip) || a.start - b.start);
  return all.map((it) => ({ ...it, source: `${(MAN[it.clip] || {}).gurdwara || ''}${it.why ? ` · ${it.why}` : ''}`, hasAudio: fs.existsSync(wavOf(it.clip)) }));
}
function answers() {
  const out = {};
  if (fs.existsSync(ANSWERS)) for (const l of fs.readFileSync(ANSWERS, 'utf8').split('\n')) { if (!l) continue; try { const a = JSON.parse(l); out[a.itemId] = a; } catch (_) { /* torn line */ } }
  return out;
}
// wav data offset + format (16-bit PCM)
function wavInfo(f) {
  const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(4096); fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd);
  let o = 12, sr = 16000, ch = 1;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); }
    if (id === 'data') return { data: o + 8, sr, ch };
    o += 8 + n + (n & 1);
  }
  return { data: 44, sr, ch };
}
function envelope(clip) {
  const out = path.join(LINES, 'env', `${clip}.json`);
  if (fs.existsSync(out)) return fs.readFileSync(out);
  const f = wavOf(clip); const w = wavInfo(f); const buf = fs.readFileSync(f).subarray(w.data);
  const hz = 50, step = Math.floor(w.sr / hz) * w.ch, n = Math.floor(buf.length / 2 / step), v = new Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let j = 0; j < step; j++) { const x = buf.readInt16LE(2 * (k * step + j)) / 32768; s += x * x; } v[k] = +Math.sqrt(s / step).toFixed(4); }
  const json = Buffer.from(JSON.stringify({ hz, v }));
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, json);
  return json;
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(__dirname, 'review.html'))); }
    if (u.pathname === '/items.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(items())); }
    if (u.pathname === '/answers.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(answers())); }
    if (u.pathname === '/answer' && req.method === 'POST') {
      let body = ''; req.on('data', (d) => { body += d; });
      return req.on('end', () => { const a = JSON.parse(body); a.savedAt = new Date().toISOString(); fs.appendFileSync(ANSWERS, `${JSON.stringify(a)}\n`); res.writeHead(200); res.end('{"ok":true}'); });
    }
    let m = u.pathname.match(/^\/env\/(.+)\.json$/);
    if (m) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(envelope(decodeURIComponent(m[1]))); }
    m = u.pathname.match(/^\/audio\/(.+)\.wav$/);
    if (m) {
      const f = wavOf(decodeURIComponent(m[1])); const size = fs.statSync(f).size;
      const r = (req.headers.range || '').match(/bytes=(\d*)-(\d*)/);
      if (!r) { res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': size, 'accept-ranges': 'bytes' }); return fs.createReadStream(f).pipe(res); }
      const a = r[1] ? Number(r[1]) : 0, b = r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
      res.writeHead(206, { 'content-type': 'audio/wav', 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1, 'accept-ranges': 'bytes' });
      return fs.createReadStream(f, { start: a, end: b }).pipe(res);
    }
    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
}).listen(PORT, '127.0.0.1', () => {
  const its = items();
  console.log(`pangti review: http://localhost:${PORT}  (${its.length} items, ${Object.keys(answers()).length} answered; audio from ${CLIPS}; ${its.filter((i) => !i.hasAudio).length} items without audio here)`);
});
