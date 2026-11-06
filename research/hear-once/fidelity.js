#!/usr/bin/env node
/* fidelity.js — can Autopilot hear each second ONCE instead of ~20 times, and still hear the same?
 *
 * Today every consumer (line follower, Shabad recognizer) runs the model on its own trailing window
 * (4 s every 0.25 s, 4-10 s every 0.5 s): each second of audio is encoded 16-24 times.
 * "Hear once": encode the audio in pieces of C seconds, each with L seconds of left context and R seconds
 * of right context (the piece is committed R seconds late), stitch the model outputs into one timeline,
 * and serve every consumer's window as a slice of it. Cost per audio second: (L + C + R) / C.
 *
 * For each clip and each config this compares, at every commit time T, the 4 s window [T-4, T]:
 *   reference = one model pass on exactly that window (today)
 *   stitched  = the slice of the hear-once timeline
 * Reports text similarity of the greedy transcripts (what the follower/recognizer read), frame argmax
 * agreement, and the model compute per audio second for both.
 *   node fidelity.js <out.json> [clip.wav:fromS:toS ...]
 */
const fs = require('fs');
const path = require('path');

const ENGINE = path.resolve(__dirname, '../../www/main/addons/voice-follow/engine');
const { Infer } = require(path.join(ENGINE, 'infer'));
const { heardMatch, comparedLength } = require('./compare');
const anvaad = require('anvaad-js');
const Realm = require('realm');
const TOOLS = process.env.VF_TOOLS || '/Users/asingh02/personal/sttm-ws4/research/level2-dataset/tools';
const BENCH = process.env.VF_BENCHMARK || path.join(process.env.HOME, 'personal/vf-benchmark');
const MODEL = process.env.MODEL || path.join(process.env.HOME, 'personal/vf-shared-models/model.int8.onnx');
const SR = 16000;
const WIN = 4;

function readWav(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  let sr = SR;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(off + 12);
    if (id === 'data') {
      const n = Math.floor(sz / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i += 1) out[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      if (sr !== SR) throw new Error(`${file}: ${sr} Hz`);
      return out;
    }
    off += 8 + sz + (sz & 1);
  }
  throw new Error('no data');
}

function argmaxFrames({ data, frames, C }) {
  const a = new Int16Array(frames);
  for (let t = 0; t < frames; t += 1) {
    let best = 0;
    let bv = -Infinity;
    const o = t * C;
    for (let c = 0; c < C; c += 1) if (data[o + c] > bv) { bv = data[o + c]; best = c; }
    a[t] = best;
  }
  return a;
}
function lev(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const sim = (a, b) => (a.length || b.length ? 1 - lev(a, b) / Math.max(a.length, b.length) : 1);

async function main() {
  const out = process.argv[2];
  // Clips: benchmark ids with human pangti timelines (lines.csv); wav from the suites.
  const { parseCsv } = require(path.join(TOOLS, 'vf-manifest'));
  const { SUITES } = require(path.join(TOOLS, 'vf-suites'));
  const man = parseCsv(fs.readFileSync(path.join(BENCH, 'manifest.csv'), 'utf8'));
  const jobs = new Map();
  for (const suite of ['jaspal', 'l2', 'aarti', 'paath', 'asa']) {
    try { for (const j of SUITES[suite].jobs()) jobs.set(j.id, j); } catch (e) { /* missing */ }
  }
  const want = process.argv.slice(3);
  const MAXS = Number(process.env.MAXS || 150);
  const clips = man
    .filter((r) => Number(r.lines_n) > 0 && want.includes(r.id.split('_')[0]))
    .map((r) => ({ id: r.id.split('_')[0], f: jobs.get(r.cache_id) && jobs.get(r.cache_id).wav, row: r, a: 0, b: MAXS }))
    .filter((c) => c.f && fs.existsSync(c.f));
  const realm = await Realm.open({ path: path.join(process.env.HOME, 'Library/Application Support/SikhiToTheMax/sttmdesktop-evergreen-v2.realm'), readOnly: true });
  const verseText = new Map();
  const textOf = (vid) => {
    if (!verseText.has(vid)) {
      const v = realm.objects('Verse').filtered('ID == $0', vid)[0];
      verseText.set(vid, v ? anvaad.unicode(v.Gurmukhi) : ''); // the pangti as the database gives it
    }
    return verseText.get(vid);
  };
  const infer = await Infer.create(MODEL);
  // frames per second of audio (the model's output rate)
  const probe = await infer.run(new Float32Array(WIN * SR));
  const FPS = probe.frames / WIN;
  const configs = [
    { L: 2, C: 1, R: 0 },
    { L: 2, C: 1, R: 0.5 },
    { L: 2, C: 0.5, R: 0.5 },
    { L: 3, C: 1, R: 1 },
    { L: 1, C: 1, R: 0.5 },
  ];
  const results = [];
  for (const clip of clips) {
    const all = readWav(clip.f);
    const pcm = all.subarray(Math.floor(clip.a * SR), Math.min(all.length, Math.floor(clip.b * SR)));
    const dur = pcm.length / SR;
    const name = `${clip.id} ${clip.row.content_folder.split('-').slice(1).join('-')}`;
    const truth = parseCsv(fs.readFileSync(path.join(BENCH, clip.row.content_folder, clip.row.id, 'lines.csv'), 'utf8'))
      .map((l) => ({ v: Number(l.verseId), a: Number(l.start_s) - clip.a, b: Number(l.end_s) - clip.a }))
      .filter((l) => Number.isFinite(l.v) && l.b > 0);
    // How well a window's transcript matches the pangtis really sung in it (the app's own measure).
    const heard = (text, T) => {
      const lines = truth.filter((l) => l.a < T && l.b > T - WIN).map((l) => textOf(l.v)).filter(Boolean);
      if (!lines.length || comparedLength(text) < 4) return null;
      return Math.max(...lines.map((ln) => heardMatch(text, ln)));
    };
    // Reference: one pass per 4 s window at every 0.25 s (today's follower) — cached by end time.
    const ref = new Map();
    const refAt = async (T) => {
      const k = Math.round(T * 4);
      if (!ref.has(k)) {
        const w = pcm.subarray(Math.floor((T - WIN) * SR), Math.floor(T * SR));
        const e = await infer.run(w);
        ref.set(k, { text: infer.decode(infer.greedy(e)), arg: argmaxFrames(e), e });
      }
      return ref.get(k);
    };
    for (const cfg of configs) {
      const { L, C, R } = cfg;
      // Build the timeline: frames committed for [0, T) in steps of C.
      const nFrames = Math.ceil(dur * FPS) + 8;
      const Cdim = probe.C;
      const tl = new Float32Array(nFrames * Cdim).fill(-1e9);
      let passes = 0;
      let encodedS = 0;
      const sims = [];
      const agrees = [];
      const hRef = [];
      const hSt = [];
      for (let T = C; T + R <= dur; T += C) {
        const a0 = Math.max(0, T - C - L);
        const a1 = Math.min(dur, T + R);
        const e = await infer.run(pcm.subarray(Math.floor(a0 * SR), Math.floor(a1 * SR)));
        passes += 1;
        encodedS += a1 - a0;
        // commit frames for [T - C, T)
        const f0 = Math.round((T - C) * FPS);
        const f1 = Math.round(T * FPS);
        for (let f = f0; f < f1; f += 1) {
          const src = f - Math.round(a0 * FPS);
          if (src < 0 || src >= e.frames) continue;
          tl.set(e.data.subarray(src * Cdim, (src + 1) * Cdim), f * Cdim);
        }
        if (T < WIN) continue;
        // compare window [T-4, T]
        const r = await refAt(T);
        const s0 = Math.round((T - WIN) * FPS);
        const frames = r.e.frames;
        const st = { data: tl.subarray(s0 * Cdim, (s0 + frames) * Cdim), frames, C: Cdim };
        const text = infer.decode(infer.greedy(st));
        sims.push(sim(r.text.replace(/\s+/g, ''), text.replace(/\s+/g, '')));
        const hr = heard(r.text, T);
        const hs = heard(text, T);
        if (hr != null && hs != null) { hRef.push(hr); hSt.push(hs); }
        const sa = argmaxFrames(st);
        let ag = 0;
        for (let i = 0; i < frames; i += 1) if (sa[i] === r.arg[i]) ag += 1;
        agrees.push(ag / frames);
      }
      const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
      const sorted = sims.slice().sort((x, y) => x - y);
      results.push({
        clip: name, dur: +dur.toFixed(0), ...cfg,
        windows: sims.length,
        textSim: +mean(sims).toFixed(3),
        textSimP10: +(sorted[Math.floor(sorted.length * 0.1)] || 0).toFixed(3),
        exactText: +(sims.filter((x) => x >= 0.999).length / (sims.length || 1)).toFixed(3),
        frameAgree: +mean(agrees).toFixed(3),
        heardToday: +mean(hRef).toFixed(3),
        heardHearOnce: +mean(hSt).toFixed(3),
        heardWindows: hRef.length,
        encodePerAudioS: +(encodedS / dur).toFixed(2),
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
  }
  // today's cost for comparison: follower 4 s / 0.25 s + recognizer 4 s / 0.5 s while following
  console.log(JSON.stringify({ today: { followerEncodePerAudioS: WIN / 0.25, recognizerFollowingPerAudioS: WIN / 0.5, recognizerFindingPerAudioS: 10 / 0.5 } }));
  fs.writeFileSync(out, JSON.stringify({ fps: FPS, results }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
