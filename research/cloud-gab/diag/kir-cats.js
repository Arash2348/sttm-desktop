#!/usr/bin/env node
// Usage: GAB_TOOLS=<gab tools dir> FUZZ=<repo>/www/main/addons/voice-follow/engine/fuzz.js node kir-cats.js <replay key dir> <dataset dir> <scorecard.json> [--dump <category prefix> --n 10 --out f.json]
// kir-diag.js <replay key dir> <dataset dir> <scorecard.json> [--split dev|test] [--dump cat N]
// P0 Kirtan: where the not-right pangti time goes, by kind of pangti change, and whether the model ever heard the
// sung pangti. Same per-moment rules as GAB (sangat-score trace, 0.1 s steps).
const fs = require('fs');
const path = require('path');
const TOOLS = process.env.GAB_TOOLS;
const sv = require(path.join(TOOLS, 'sangat-score'));
const { partialRatio } = require(process.env.FUZZ);
const [runDir, dsDir, cardFile] = process.argv.slice(2);
const argOf = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const card = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
const want = new Set(card.clips.filter((c) => c.folder === '1-kirtan-shabad').map((c) => c.id));
const ds = sv.loadDataset(dsDir);
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.events.jsonl')) files.push(p); } })(runDir);
const N = (s) => sv.norm(s || '');
const isRahao = (t) => /ਰਹਾਉ/.test(t || '');
const isHeader = (t) => !/॥/.test(t || '') || (/ਮਹਲਾ|ਮਃ|ਸਲੋਕੁ|ਪਉੜੀ/.test(t) && N(t).length < 22);
const cats = {}; const add = (k, s) => { cats[k] = (cats[k] || 0) + s; };
const lagBy = {}; const lagAll = [];
const samples = {};
const DELTAS = [0.25, 0.5, 1.0]; const shiftGain = {}; const shiftBy = {}; const lagSrc = {}; const rowT = {}, rowR = {}; let oracle = 0; const oracleBy = {}; const hearLag = [], gapHS = []; let ctrlN = 0, ctrlHit = 0, heardN = 0, segN = 0; let voiced = 0, notRight = 0, clips = 0;
const STEP = 0.1;
for (const f of files) {
  const key = path.basename(f).replace(/\.events\.jsonl$/, '');
  const row = ds.find(key) || ds.find(key.split('_')[0]);
  if (!row || !want.has(row.id)) continue;
  const trace = [];
  let r; try { r = sv.scoreClip(ds, row, f, { trace }); } catch (e) { continue; }
  if (!r.line || !r.line.acc || !trace.length) continue;
  clips++;
  const ev = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const tx = ev.filter((e) => e.type === 'transcript').map((e) => ({ t: e.t, n: N(e.text) }));
  const fol = ev.filter((e) => e.type === 'follower');
  const truth = sv.loadTruth(ds, row);
  // segments as scoreLines builds them
  const segs = [];
  for (const l of truth.lines) {
    const last = segs[segs.length - 1];
    if (last && last.norm === l.norm && l.start - last.end < 2) { last.end = Math.max(last.end, l.end); } else segs.push({ norm: l.norm, text: l.text, start: l.start, end: l.end, vid: l.verseId, src: l.src });
  }
  const segOf = (t) => { for (let k = segs.length - 1; k >= 0; k--) if (segs[k].start <= t + 1e-6) return k; return -1; };
  const seenBefore = new Set();
  const info = segs.map((s, k) => {
    const p = segs[k - 1];
    let kind;
    if (!p) kind = 'first pangti (Shabad find)';
    else {
      const d = s.vid - p.vid;
      if (Math.abs(d) > 40) kind = 'new Shabad / parmaan';
      else if (s.start - p.end > 4) kind = 'after a gap in the key';
      else if (isHeader(s.text)) kind = 'header line';
      else if (d === 1) kind = 'next pangti';
      else if (d > 1) kind = 'skip ahead';
      else if (isRahao(s.text)) kind = 'rahao return';
      else if (d === -1) kind = 'repeat (back one)';
      else kind = 'step-back (2+)';
    }
    // heard: a 4 s decode during the pangti (or just after) that matches it, and fits it better than the one before
    let heard = 0, ctrl = 0, hearT = null;
    const pd = [...segs.slice(0, k)].reverse().find((z) => z.norm !== s.norm);
    const c = segs.find((z, j) => j > k + 1 && z.norm !== s.norm && (!p || z.norm !== p.norm)) || segs.find((z, j) => j < k - 1 && z.norm !== s.norm && (!p || z.norm !== p.norm));
    for (const x of tx) {
      if (c && x.t >= s.start + 0.5 && x.t <= s.end + 1.5 && x.n.length >= 5) { const a2 = partialRatio(x.n, c.norm); const b2 = pd ? partialRatio(x.n, pd.norm) : 0; if (a2 >= 75 && a2 - b2 >= 10) ctrl++; }
      if (x.t < s.start + 0.5 || x.t > s.end + 1.5 || x.n.length < 5) continue;
      const a = partialRatio(x.n, s.norm);
      const b = pd ? partialRatio(x.n, pd.norm) : 0;
      if (a >= 75 && a - b >= 10) { heard++; if (hearT == null) hearT = x.t; }
    }
    seenBefore.add(s.norm);
    if (c) { ctrlN++; if (ctrl > 0) ctrlHit++; } if (heard > 0) heardN++; segN++;
    return { kind, heard, hearT };
  });
  // moments
  const firstOn = new Map();
  for (const m of trace) { const k = segOf(m.t); if (m.b === 'on' && !firstOn.has(k)) firstOn.set(k, m.t); }
  for (const m of trace) {
    { const k0 = segOf(m.t); const L = segs[k0].end - segs[k0].start; const bin = L > 20 ? '>20s' : L > 12 ? '12-20s' : '<=12s'; rowT[bin] = (rowT[bin] || 0) + STEP; if (m.b === 'on' || m.b === 'catching') rowR[bin] = (rowR[bin] || 0) + STEP; }
    voiced += STEP;
    if (m.b === 'on' || m.b === 'catching') continue;
    notRight += STEP;
    const k = segOf(m.t); const s = segs[k]; const inf = info[k];
    let cat;
    const fo = firstOn.get(k);
    if (m.b === 'wrong') cat = 'other Shabad on screen';
    else if (m.b === 'blank' && (m.screen === '(Waheguru slide)' || m.screen === '(nothing)')) cat = 'blank / Waheguru slide';
    else if (fo != null && m.t > fo) cat = `left the pangti after showing it: ${m.b}`;
    else {
      const never = inf.heard === 0;
      const d = m.verse != null ? Number(m.verse) - Number(s.vid) : null;
      const rah = isRahao(s.text) || isRahao(sv.textOf(Number(s.vid) + 1));
      let rel;
      if (d == null || Math.abs(d) > 40) rel = 'screen: other';
      else if (d === -1) rel = 'late to the next pangti (screen on the one before)';
      else if (d < -1) rel = 'late, screen 2+ pangtis back in the text';
      else if (rah) rel = 'late on a rahao return';
      else if (d === 1) rel = 'late on a repeat (back one; screen on the next)';
      else rel = 'late on a step-back (screen 2+ ahead)';
      cat = never ? 'pangti never heard by the model' : rel;
      // follower already on the sung pangti but screen not moved?
      const lf = [...fol].reverse().find((e) => e.t <= m.t);
      if (lf && String(lf.verseId) === String(s.vid)) add('  (of entry time: follower already on it, screen held)', STEP);
    }
    add(cat, STEP);
    if (s.end - s.start > 20) add(`  (inside a key row longer than 20 s) ${cat.startsWith('left') ? 'left after showing' : 'other'}`, STEP);
    // key check: what the model heard just after this moment (4 s windows that contain it)
    const near = tx.filter((x) => x.t >= m.t + 0.5 && x.t <= m.t + 2.5 && x.n.length >= 5);
    const sN = m.screen && !m.screen.startsWith('(') ? N(m.screen) : null;
    let kS = 0, sS = 0;
    for (const x of near) { kS = Math.max(kS, partialRatio(x.n, s.norm)); if (sN) sS = Math.max(sS, partialRatio(x.n, sN)); }
    const sus = sN && sN !== s.norm && sS >= 80 && sS - kS >= 20;
    if (sus) add(`  (key suspect) ${cat}`, STEP);
    (samples[cat] = samples[cat] || []).push({ id: row.id, t: +m.t.toFixed(1), key: s.text, keyAt: [s.start, s.end], prevKey: segs[k - 1] ? `${segs[k - 1].text} @${segs[k - 1].start}-${segs[k - 1].end}` : null, nextKey: segs[k + 1] ? `${segs[k + 1].text} @${segs[k + 1].start}` : null, screen: m.screen, heard: tx.filter((x) => x.t >= m.t - 1 && x.t <= m.t + 3).map((x) => `${x.t.toFixed(1)}:${x.n}`).join(' '), kS: Math.round(kS), sS: Math.round(sS), sus, k });
  }
  // what-if: every pangti that did appear appears delta s sooner (only in-Shabad late-entry time counts)
  for (const m of trace) {
    if (m.b === 'on' || m.b === 'catching' || m.b === 'wrong' || m.b === 'blank') continue;
    const k = segOf(m.t); const fo = firstOn.get(k); if (fo == null || m.t >= fo) continue;
    for (const dl of DELTAS) if (m.t >= fo - dl) { shiftGain[dl] = (shiftGain[dl] || 0) + STEP; shiftBy[`${dl}|${info[k].kind}`] = (shiftBy[`${dl}|${info[k].kind}`] || 0) + STEP; }
  }
  // oracle: screen moves at the first distinct transcript of the sung pangti (if that is before the screen did)
  for (const m of trace) {
    if (m.b === 'on' || m.b === 'catching') continue;
    const k = segOf(m.t); const inf = info[k]; const fo = firstOn.get(k);
    if (inf.hearT != null && m.t >= inf.hearT && (fo == null || m.t < fo) && m.b !== 'wrong') { oracle += STEP; oracleBy[inf.kind] = (oracleBy[inf.kind] || 0) + STEP; }
  }
  segs.forEach((s, k) => {
    const fo = firstOn.get(k); const h = info[k].hearT;
    if (h != null) { hearLag.push(h - s.start); if (fo != null) gapHS.push(fo - h); }
    if (fo == null) return;
    const lag = Math.max(0, fo - s.start);
    lagAll.push(lag); (lagSrc[s.src] = lagSrc[s.src] || []).push(lag); if (info[k].kind === 'next pangti') (lagSrc['next:' + s.src] = lagSrc['next:' + s.src] || []).push(lag); (lagBy[info[k].kind] = lagBy[info[k].kind] || []).push(lag);
  });
}
sv.close();
const pct = (x) => `${(100 * x / voiced).toFixed(1)}%`;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log(`${clips} recordings, ${(voiced / 60).toFixed(1)} min scored, right ${pct(voiced - notRight)}, not right ${pct(notRight)} (${notRight.toFixed(0)} s)`);
for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(48)} ${v.toFixed(0).padStart(6)} s  ${pct(v).padStart(6)}`);
console.log(`heard check: ${heardN}/${segN} sung pangtis heard; control (a pangti NOT sung then): ${ctrlHit}/${ctrlN}`);
console.log(`\nbehind the singer (p50 of first-on lag): all ${med(lagAll)?.toFixed(2)} s over ${lagAll.length} pangti changes`);
for (const [k, a] of Object.entries(lagBy).sort((x, y) => y[1].length - x[1].length)) {
  const sum = a.reduce((x, y) => x + y, 0);
  console.log(`  ${k.padEnd(30)} n=${String(a.length).padStart(4)} p50 ${med(a).toFixed(2)} s  mean ${(sum / a.length).toFixed(2)} s  share of lag-seconds ${(100 * sum / lagAll.reduce((x, y) => x + y, 0)).toFixed(0)}%`);
}
console.log(`\nfirst distinct transcript of the sung pangti: p50 ${med(hearLag).toFixed(2)} s after the key start; screen on it p50 ${med(gapHS).toFixed(2)} s after that (p25 ${[...gapHS].sort((a,b)=>a-b)[Math.floor(gapHS.length/4)].toFixed(2)}, p75 ${[...gapHS].sort((a,b)=>a-b)[Math.floor(3*gapHS.length/4)].toFixed(2)})`);
console.log(`oracle (move at that first transcript, never wrong): +${pct(oracle)} right pangti`, Object.entries(oracleBy).map(([k,v])=>`${k} ${pct(v)}`).join(', '));
for (const dl of DELTAS) console.log(`what-if every pangti shows ${dl} s sooner: +${pct(shiftGain[dl] || 0)} right pangti; lag p50 ${(med(lagAll.map((x) => Math.max(0, x - dl)))).toFixed(2)} s;`, Object.entries(shiftBy).filter(([k]) => k.startsWith(dl + '|')).map(([k, v]) => `${k.split('|')[1]} ${pct(v)}`).join(', '));
for (const b of Object.keys(rowT)) console.log(`key rows ${b}: ${pct(rowT[b])} of scored time, right ${(100 * (rowR[b] || 0) / rowT[b]).toFixed(1)}%`);
for (const [k, a] of Object.entries(lagSrc)) console.log(`lag by key source ${k}: n=${a.length} p50 ${med(a).toFixed(2)} s`);
// spot-check dump: one sample per distinct (clip, pangti) for a category
const dc = argOf('--dump');
if (dc) {
  const out = []; const seen = new Set();
  const all = Object.entries(samples).filter(([k]) => k.startsWith(dc)).flatMap(([, v]) => v);
  // shuffle deterministically
  all.sort((a, b) => ((a.t * 7919 + a.id.length * 31) % 97) - ((b.t * 7919 + b.id.length * 31) % 97));
  for (const s of all) { const key = `${s.id}|${s.k}`; if (seen.has(key)) continue; seen.add(key); out.push(s); if (out.length >= Number(argOf('--n') || 10)) break; }
  fs.writeFileSync(argOf('--out') || '/dev/stdout', JSON.stringify(out, null, 1));
}
