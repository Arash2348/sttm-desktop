#!/usr/bin/env node
// kmatch.js <video dir> <allverses.json> — Shabad kirtan with full-screen slides (Gurmukhi / English / transliteration):
// OCR of one frame per slide (ocr.jsonl, runs.json) -> pangti per slide. Pass 1: every OCR line is matched against
// the whole STTM DB transliteration (trigram shortlist, then edit distance); the slide's line = its best-matching OCR
// line. Shabads with an anchor (>= 85) are the clip's Shabads (most anchors = the main Shabad, others = parmaans).
// Pass 2: each slide re-matched inside those Shabads only (>= 65), same words in one Shabad taken in order.
// Out: <dir>/timeline.json [{verseId, shabadId, start, end, how, score, tr, text, piece}] + <dir>/shabads.json
const fs = require('fs'); const path = require('path');
const [DIR, ALLF] = process.argv.slice(2);
const norm = (s) => String(s || '').toLowerCase().replace(/\(n\)/g, 'n').replace(/\|\|[\d|]*\|\|/g, '').replace(/[^a-z]/g, '');
function lev(a, b) { if (!a.length || !b.length) return 0; const m = a.length, n = b.length; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return 100 * (1 - p[n] / Math.max(m, n)); }
const ALL = JSON.parse(fs.readFileSync(ALLF)).map(([id, sh, tr]) => ({ id, sh, tr, n: norm(tr) })).filter((v) => v.n.length >= 4);
const tri = new Map(); ALL.forEach((v, k) => { const seen = new Set(); for (let i = 0; i + 3 <= v.n.length; i++) { const g = v.n.slice(i, i + 3); if (seen.has(g)) continue; seen.add(g); if (!tri.has(g)) tri.set(g, []); tri.get(g).push(k); } });
const byShabad = new Map(); ALL.forEach((v, k) => { if (!byShabad.has(v.sh)) byShabad.set(v.sh, []); byShabad.get(v.sh).push(k); });
function shortlist(o, n = 40) { const cnt = new Map(); const seen = new Set(); for (let i = 0; i + 3 <= o.length; i++) { const g = o.slice(i, i + 3); if (seen.has(g)) continue; seen.add(g); for (const k of tri.get(g) || []) cnt.set(k, (cnt.get(k) || 0) + 1); } return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]); }
function best(o, ks) { let b = null; for (const k of ks) { for (const w of [1, 2]) { if (w === 2 && (k + 1 >= ALL.length || ALL[k + 1].sh !== ALL[k].sh)) continue; const n = w === 1 ? ALL[k].n : ALL[k].n + ALL[k + 1].n; if (Math.abs(n.length - o.length) > 0.45 * o.length) continue; const s = lev(o, n); if (!b || s > b.s) b = { s, k, w }; } } return b; }
const runs = JSON.parse(fs.readFileSync(path.join(DIR, 'runs.json')));
const ocr = new Map(fs.readFileSync(path.join(DIR, 'ocr.jsonl'), 'utf8').trim().split('\n').map((l) => { const j = JSON.parse(l); return [+j.f.slice(0, 5), j.lines]; }));
const isTr = (t) => /[a-z]/.test(t) && !/Gurbani Rattan/i.test(t) && (t.match(/[A-Z]/g) || []).length <= 3 && !/\b(the|and|of|you|your|is|to|my|in|O)\b/.test(t);
for (const r of runs) {
  const L = (ocr.get(r.i) || []).sort((a, b) => a[0] - b[0]);
  // the transliteration may wrap onto two OCR lines: try each line and each pair of neighbouring lines
  const cands = []; L.forEach((l, i) => { if (isTr(l[2])) { cands.push(l[2]); if (L[i + 1] && isTr(L[i + 1][2])) cands.push(l[2] + ' ' + L[i + 1][2]); } });
  r.b = null; for (const c of cands) { const o = norm(c); if (o.length < 8) continue; const b = best(o, shortlist(o)); if (b && (!r.b || b.s > r.b.s)) { r.b = b; r.o = o; r.text = c; } }
}
const anchors = runs.filter((r) => r.b && r.b.s >= 85);
const cnt = new Map(); for (const r of anchors) { const sh = ALL[r.b.k].sh; cnt.set(sh, (cnt.get(sh) || 0) + (r.t1 - r.t0)); }
const shabads = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]); const main = shabads[0];
const pool = shabads.flatMap((sh) => byShabad.get(sh));
let last = -1; const tl = [];
for (const r of runs) {
  let b = null; if (r.o) { b = best(r.o, pool); if (b && b.s < 65) b = null; }
  if (b) { // same words more than once in a Shabad (rahao lines): prefer the next occurrence at or after the last one
    const same = pool.filter((k) => ALL[k].sh === ALL[b.k].sh && ALL[k].n === ALL[b.k].n); if (same.length > 1) { const nx = same.find((k) => k >= last) ?? same[0]; b = { ...b, k: nx }; } }
  const rec = { i: r.i, t0: r.t0, t1: r.t1, text: r.text || '', score: b ? +b.s.toFixed(1) : null, how: b ? (b.s >= 85 ? 'ocr' : 'order') : 'none' };
  if (b) { last = b.k; for (let j = 0; j < b.w; j++) { const v = ALL[b.k + j]; const d = (r.t1 - r.t0) / b.w; tl.push({ verseId: v.id, shabadId: v.sh, start: +(r.t0 + j * d).toFixed(2), end: +(r.t0 + (j + 1) * d).toFixed(2), how: rec.how, score: rec.score, tr: v.tr, text: rec.text, piece: v.sh === main ? 'main' : 'shabad', header: 0 }); } }
}
const merged = []; for (const r of tl) { const l = merged[merged.length - 1]; if (l && l.verseId === r.verseId && r.start - l.end < 2.5) { l.end = r.end; l.score = Math.min(l.score, r.score); } else merged.push(r); }
fs.writeFileSync(path.join(DIR, 'timeline.json'), JSON.stringify(merged));
fs.writeFileSync(path.join(DIR, 'shabads.json'), JSON.stringify({ main, shabads, seconds: Object.fromEntries(cnt) }));
console.log(`${path.basename(DIR)}: ${runs.length} slides, ${anchors.length} anchors, main Shabad ${main} (${shabads.length} Shabads: ${shabads.join(' ')}), ${merged.length} pangti rows, unmatched ${runs.filter((r) => !r.o).length}`);
