#!/usr/bin/env node
// tail-sweep.js <dataset dir> <trace.events.jsonl>... : offline tuning of the line follower's tail hand-off (tailAdv,
// tailGuard, tailMargin) on real decodes. Input: bench traces made with VF_FTRACE=1 on a build whose follower dumps
// its lines (follower.js onTrace: {lines, verseIds} once, then per decode {t, hyp, cur}). Truth: lines.csv of each
// recording. For every decode while a line is held: would the rule fire, and is the next line really being sung?
const fs = require('fs');
const path = require('path');
const { partialRatio } = require('/home/user/sttm-desktop/www/main/addons/voice-follow/engine/fuzz');
const [dsDir, ...traces] = process.argv.slice(2);
const csv = (f) => { const [h, ...r] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return r.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };
const sets = [];
// rule A: the tail alone.  rule B (end: true): the current line's last word has been heard (the follower's CTC word
// position) AND the tail fits the next line's start at a looser bar than it fits the current line.
for (const L of [8, 10, 12]) for (const g of [0.5, 0.6, 0.7, 0.75]) for (const m of [0, 0.1]) sets.push({ L, g, m, end: false, fire: 0, right: 0, same: 0, other: 0, lagMoments: 0, lagHit: 0 });
for (const L of [6, 8, 10]) for (const g of [0.3, 0.4, 0.5, 0.6]) for (const m of [-0.1, 0, 0.1]) sets.push({ L, g, m, end: true, fire: 0, right: 0, same: 0, other: 0, lagMoments: 0, lagHit: 0 });
let decodes = 0, lagAll = 0;
for (const tr of traces) {
  const id = path.basename(tr).split('_')[0];
  const folder = fs.existsSync(path.join(dsDir, '1-kirtan-shabad', id)) ? '1-kirtan-shabad' : null;
  if (!folder) { console.error(`${id}: no truth dir`); continue; }
  const truth = csv(path.join(dsDir, folder, id, 'lines.csv')).map((r) => ({ v: String(r.verseId), a: +r.start_s, b: +r.end_s }));
  const ev = fs.readFileSync(tr, 'utf8').trim().split('\n').map(JSON.parse).filter((e) => e.type === 'ftrace');
  let lines = null, vids = null, nwords = null;
  for (const e of ev) {
    if (e.lines) { lines = e.lines; vids = e.verseIds.map(String); nwords = e.nwords || null; continue; }
    if (!lines || e.cur == null || e.cur + 1 >= lines.length) continue;
    const row = truth.find((r) => e.t >= r.a && e.t < r.b);
    if (!row) continue;
    const ti = vids.indexOf(row.v); if (ti < 0) continue;
    decodes++;
    const lag = ti === e.cur + 1; if (lag) lagAll++;
    for (const s of sets) {
      if (e.hyp.length < s.L) continue;
      const tail = e.hyp.slice(-s.L); const head = lines[e.cur + 1].slice(0, s.L + 6);
      const tNext = head.length >= s.L ? partialRatio(tail, head) / 100 : 0;
      const tCur = lines[e.cur] ? partialRatio(tail, lines[e.cur]) / 100 : 0;
      if (lag) s.lagMoments++;
      const atEnd = nwords && e.wiLine === e.cur && e.maxWi >= nwords[e.cur] - 1;
      if (s.end && !atEnd) continue;
      if (tNext >= s.g && tNext - tCur >= s.m) { s.fire++; if (lag) { s.right++; s.lagHit++; } else if (ti === e.cur) s.same++; else s.other++; }
    }
  }
}
console.log(`${traces.length} recordings, ${decodes} decodes while a line was held; ${lagAll} of them while the NEXT line was already being sung (the lag)`);
console.log('rule L  guard margin | fires  right(next sung)  wrong(still current)  other | share of lag moments caught');
for (const s of sets) console.log(`${s.end ? 'B   ' : 'A   '}${String(s.L).padEnd(2)} ${String(s.g).padEnd(5)} ${String(s.m).padEnd(6)} | ${String(s.fire).padEnd(6)} ${String(s.right).padEnd(16)} ${String(s.same).padEnd(21)} ${String(s.other).padEnd(5)} | ${s.lagMoments ? (100 * s.lagHit / s.lagMoments).toFixed(0) : '-'}%`);
