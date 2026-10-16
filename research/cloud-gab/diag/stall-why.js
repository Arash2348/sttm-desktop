#!/usr/bin/env node
// stall-why.js <dataset dir> <trace.events.jsonl>... : for every pangti change the line follower caught 3 s or more
// late (or never), what was it doing meanwhile? Per decode during the wait: the window's best line was already the
// sung line but the move was held back (dwell / margin), the window still said the old line, the window said some
// other line, or the follower froze (no decode: too few letters, guard, margin gate).
const fs = require('fs');
const path = require('path');
const [dsDir, ...traces] = process.argv.slice(2);
const csv = (f) => { const [h, ...r] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return r.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };
const tot = { changes: 0, late3: 0, never: 0, lateSec: 0 };
const why = { 'window already said the sung line (held back)': 0, 'window still said the old line': 0, 'window said another line': 0, 'froze (no decode)': 0, 'no line held (searching)': 0 };
const jump = { next: 0, skip2plus: 0, back: 0 };
const fr = {}; // freeze reasons during the waits (seconds), and whether the sung line was among the window's top 2
for (const tr of traces) {
  const id = path.basename(tr).split('_')[0];
  const truth = csv(path.join(dsDir, '1-kirtan-shabad', id, 'lines.csv')).map((r) => ({ v: String(r.verseId), a: +r.start_s, b: +r.end_s }));
  const ev = fs.readFileSync(tr, 'utf8').trim().split('\n').map(JSON.parse);
  const ft = ev.filter((e) => e.type === 'ftrace' && !e.lines && !e.freeze);
  const fz = ev.filter((e) => e.type === 'ftrace' && e.freeze);
  const dump = ev.find((e) => e.type === 'ftrace' && e.lines); if (!dump) continue;
  const vids = dump.verseIds.map(String);
  const fol = ev.filter((e) => e.type === 'follower'); // outputs: when the screen line changed
  const hop = 0.25;
  for (let i = 1; i < truth.length; i++) {
    const seg = truth[i]; const ti = vids.indexOf(seg.v); if (ti < 0) continue;
    tot.changes++;
    const prevTi = vids.indexOf(truth[i - 1].v);
    const first = fol.find((f) => f.t >= seg.a && f.t < seg.b + 2 && f.lineIndex === ti);
    const lag = first ? first.t - seg.a : null;
    if (lag != null && lag < 3) continue;
    if (lag == null) tot.never++; else tot.late3++;
    const until = lag == null ? seg.b : seg.a + lag;
    tot.lateSec += until - seg.a;
    if (prevTi >= 0) { const d = ti - prevTi; if (d === 1) jump.next++; else if (d > 1) jump.skip2plus++; else jump.back++; }
    // walk the wait in hop steps; classify each step by the latest decode before it
    for (let t = seg.a; t < until; t += hop) {
      const d = [...ft].reverse().find((e) => e.t <= t && e.t > t - 1.0);
      if (!d) {
        why['froze (no decode)'] += hop;
        const f = [...fz].reverse().find((e) => e.t <= t && e.t > t - 1.0);
        const k = f ? `${f.freeze}${f.top2 && f.top2.some((x) => x[1] === ti) ? ' (sung line in top 2)' : ''}` : 'unknown';
        fr[k] = (fr[k] || 0) + hop;
        continue;
      }
      if (d.cur == null) why['no line held (searching)'] += hop;
      else if (d.top === ti) why['window already said the sung line (held back)'] += hop;
      else if (d.top === d.cur) why['window still said the old line'] += hop;
      else why['window said another line'] += hop;
    }
  }
}
console.log(`${tot.changes} pangti changes; ${tot.late3} caught 3 s or more late, ${tot.never} never; ${tot.lateSec.toFixed(0)} s of waiting in those`);
console.log(`of those changes: ${jump.next} were to the next pangti, ${jump.skip2plus} skipped ahead 2+, ${jump.back} went back (a repeat)`);
for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(48)} ${v.toFixed(0).padStart(5)} s  ${(100 * v / tot.lateSec).toFixed(0)}%`);
console.log('freezes, by reason:');
for (const [k, v] of Object.entries(fr).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(46)} ${v.toFixed(0).padStart(5)} s`);
