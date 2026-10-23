#!/usr/bin/env node
/* pangti-timeline.js — re-score the GAB viewer timelines at PANGTI level (owner's rule, 2026-10-22).
 *
 *   node pangti-timeline.js [--out <dir>] [--only <file substring>]
 *
 * Reads the viewer's current timeline files (private-fixed/timeline: clip list and metadata), the saved replay
 * screen-event traces (shared cache, read only) and the pangti answer keys, and writes timeline JSON in the same
 * format to timeline-pangti/ (default), plus timeline-pangti/rescore-report.json (kept/dropped per set, numbers).
 *
 * Per second (ten 0.1 s samples, majority; ties go to the worse category):
 *   a pangti is being sung/read (inside a scored pangti span of the key):
 *     P  the shown pangti is that pangti (same text anywhere in the Shabad/Bani counts; 1 s catch-up grace after each
 *        sung-pangti change, when the screen still shows the pangti sung before)
 *     B  as P, shown as a Bani's own copy of the pangti (a verse id outside every keyed Shabad, e.g. a Banis_Custom row): counts as P
 *     A  another pangti of the same Shabad/Bani        W  a different Shabad/Bani
 *     N  nothing on screen                             V  the Waheguru slide (counts like N)
 *   no pangti is being said (inside the Shabad key, between pangti spans: alaap, simran, pauses, talk):
 *     G  fine: a pangti of the current or previous Shabad, anything already shown earlier in this recording,
 *        the Waheguru slide, or nothing
 *     W  a Shabad not yet shown in this recording that is neither the current nor the previous one
 *   outside every answer key, or inside a pangti span the key marks as unscored (aligner check < 0.6, or rejected by
 *   an ear check): not scored (no run).
 * Headline "right pangti %" = (P + B) / (P + B + A + W + N + V) over the seconds a pangti is being said; G is out of
 * both numerator and denominator.
 * A recording is kept only with full pangti timing: human or publisher-slide (broadcast-caption) keys are complete
 * by their key file; aligner keys must cover >= COVER_MIN of the keyed time with scored pangti spans.
 *
 * runs: [start, end, cat, sungTextIdx, shownTextIdx]; texts hold full pangtis (never cut) from the STTM Desktop
 * database, 'ਵਾਹਿਗੁਰੂ slide', or 'Shabad: <first pangti>' when only a Shabad id was shown. sungTextIdx is -1 on G.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const H = os.homedir();
// the x86 replay tools; GAB_TOOLS overrides (gab-quick points it at its own copy of the same tools commit)
const TOOLS = process.env.GAB_TOOLS || path.join(H, 'personal/gab-tools-x86-tmpcheck/wt/research/level2-dataset/tools');
const sv = require(path.join(TOOLS, 'sangat-score.js'));
const GUI = path.resolve(__dirname, '..');
const SRC = path.join(GUI, 'private-fixed/timeline');
const REPLAYS = path.join(H, 'personal/live-darbar-venues/cache/replays');
const HF_DS = path.join(H, 'personal/live-darbar-venues/cache/gab-hf/701fee8e59c4'); // HF manifest copy (same lines.csv as hf-keys)
const KBV1_DS = path.join(H, 'personal/gab-builds/kbv1-bench');
const KBV1_SUB = { v1004: path.join(H, 'personal/gab-builds/timeline-kit/kbv1-sub-v1004'), c1: path.join(H, 'personal/gab-builds/timeline-kit/kbv1-sub-c1') };
const KBV1_GT = path.join(H, 'AAI/models/benchmark/live-gurbani-captioning-benchmark-v1-main/test');
// replay cache dirs (vf-check key sha1(tree|harness|model|codec)): x86 model output (codec q16-x86) for every set;
// Karanbir v1 replays are Mac (q16): 9.0.5 in d92de87b, 10.0.4 / 10.0.5 only as the screen submissions in KBV1_SUB
const CACHE = { v905: 'ce75fc883c46dba7', v1004: '8ff095849c52f875', c1: 'fc6c4b22c4730b31' };
const KBV1_CACHE = { v905: 'd92de87ba7c0bf37' };
const COVER_MIN = Number(process.env.COVER_MIN || 0.6);
const MIN_CONF = process.env.MIN_CONF != null ? Number(process.env.MIN_CONF) : null; // default: the dataset rule (aligned check >= 0.6)
const CATCH_S = 1.0;
const CATCH_NEXT = process.env.CATCH_NEXT === '1'; // diagnostic: also accept the next pangti < 1 s before it starts (sangat-score's rule)
const MERGE_GAP_S = 2;
const RANK = { W: 7, N: 6, V: 5, A: 4, G: 3, B: 2, P: 1 };
const CATS = ['P', 'B', 'A', 'W', 'N', 'V', 'G'];

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', path.join(GUI, 'timeline-pangti')));
const ONLY = arg('only', null);

// ---------------------------------------------------------------- STTM Desktop database ----------
const Realm = require(path.join(TOOLS, '../../../node_modules/realm'));
const anvaad = require(path.join(TOOLS, '../../../node_modules/anvaad-js'));
const APP = path.join(H, 'Library/Application Support/SikhiToTheMax');
const sch = JSON.parse(fs.readFileSync(path.join(APP, 'realm-schema-evergreen.json'), 'utf8'));
const realm = new Realm({ path: path.join(APP, 'sttmdesktop-evergreen-v2.realm'), schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const shabadOfVerse = new Map();
function shabadsOf(verseId) {
  if (verseId == null) return [];
  if (!shabadOfVerse.has(verseId)) {
    const v = realm.objectForPrimaryKey('Verse', Number(verseId));
    shabadOfVerse.set(verseId, v && v.Shabads ? [...v.Shabads].map((s) => String(s.ShabadID)) : []);
  }
  return shabadOfVerse.get(verseId);
}
const titleMemo = new Map();
const isHeader = (t) => /ੴ|ਮਹਲਾ|ਮਃ|^ਸਲੋਕ|^ਪਉੜੀ|^ਰਾਗੁ|^ਛੰਤ/.test(t) || t.replace(/[^਀-੿]/g, '').length < 14;
function unitTitle(id) {
  const k = String(id);
  if (!titleMemo.has(k)) {
    let s;
    if (k.startsWith('bani:')) { const b = realm.objectForPrimaryKey('Banis', Number(k.slice(5))); s = b ? `Bani: ${anvaad.unicode(b.Gurmukhi)}` : `Bani ${k.slice(5)}`; } else {
      const v = [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', Number(k)).sorted('ID')];
      const first = v.find((x) => x.Gurmukhi && !isHeader(anvaad.unicode(x.Gurmukhi))) || v[0];
      s = first ? `Shabad: ${anvaad.unicode(first.Gurmukhi)}` : `Shabad ${k}`;
    }
    titleMemo.set(k, s);
  }
  return titleMemo.get(k);
}

// ---------------------------------------------------------------- unit helpers (sangat-score's) ---
// sangat-score keeps its unit() private; rebuild the same thing over its exported text helpers
const unitCache = new Map();
function unit(id) {
  const key = String(id);
  if (unitCache.has(key)) return unitCache.get(key);
  let texts = [];
  if (key.startsWith('bani:')) {
    texts = [...realm.objects('Banis_Shabad').filtered('Bani.ID == $0', Number(key.slice(5))).sorted('Seq')]
      .map((r) => (r.Custom || r.Verse) && anvaad.unicode((r.Custom || r.Verse).Gurmukhi || ''));
  } else texts = [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', Number(key)).sorted('ID')].map((v) => anvaad.unicode(v.Gurmukhi || ''));
  const seq = texts.map(sv.norm).filter(Boolean);
  const u = { id: key, seq, set: new Set(seq), fuzzy: new Map() };
  unitCache.set(key, u);
  return u;
}
const inUnit = (u, s) => {
  if (u.set.has(s)) return true;
  if (!u.fuzzy.has(s)) u.fuzzy.set(s, u.seq.some((t) => sv.same(s, t)));
  return u.fuzzy.get(s);
};
const overlapUnits = (shownUnit, units) => {
  const u = unit(shownUnit);
  if (!u.seq.length) return 0;
  return u.seq.filter((t) => units.some((x) => inUnit(x, t))).length / u.seq.length;
};

// ---------------------------------------------------------------- truth ---------------------------
function truthOf(ds, row) {
  const truth = sv.loadTruth(ds, row);
  // listening end-corrections (clip-notes end_override_s; clip12, clip17): loadTruth trims the Shabad rows; trim the
  // pangti rows to the same end so nothing after it is scored
  if (truth.corrections.length && truth.shabads.length) {
    const end = Math.max(...truth.shabads.map((s) => s.end));
    truth.lines = truth.lines.filter((l) => l.start < end).map((l) => ({ ...l, end: Math.min(l.end, end) }));
  }
  if (MIN_CONF != null) for (const l of truth.lines) if (!l.rejected && l.src && /^aligned/.test(l.src)) l.scored = l.conf != null && l.conf >= MIN_CONF;
  let basis = truth.linesSource || null;
  if (basis && /^aligned/.test(basis)) basis = 'aligned';
  return { truth, basis };
}
// pangti segments: consecutive key rows with the same text and < 2 s apart are one pangti being sung (kirtan repeats)
function segments(lines) {
  const segs = [];
  for (const l of [...lines].sort((a, b) => a.start - b.start)) {
    const last = segs[segs.length - 1];
    if (last && last.scored === l.scored && last.norm === l.norm && l.start - last.end < MERGE_GAP_S) last.end = Math.max(last.end, l.end);
    else segs.push({ norm: l.norm, text: l.text, verseId: l.verseId, start: l.start, end: l.end, scored: l.scored });
  }
  return segs;
}

// ---------------------------------------------------------------- screen -------------------------
function statesFromTrace(file) { return sv.screenStates(sv.loadEvents(file).events); }
// Karanbir v1 for 10.0.4 / 10.0.5: the screen as submitted to his eval.py (verse segments in recording seconds)
function statesFromKbv1Sub(dir, row) {
  const m = /UEM start ([\d.]+) s/.exec(row.truth_provenance || '');
  const off = m ? Number(m[1]) : 0;
  const caseName = row.id.replace(/^kbv1_/, '').replace(/_c(\d\d)$/, '_cold$1');
  const sub = JSON.parse(fs.readFileSync(path.join(dir, `${caseName}.json`), 'utf8'));
  const out = [{ t: -1e9, verse: null, shabad: null, seeking: false }];
  let prevEnd = null;
  for (const s of sub.segments) {
    const a = s.start - off;
    if (prevEnd != null && a - prevEnd > 1e-6) out.push({ t: prevEnd, verse: null, shabad: null, seeking: false });
    out.push({ t: a, verse: s.verse_id ?? null, shabad: s.shabad_id != null ? String(s.shabad_id) : null, seeking: false });
    prevEnd = s.end - off;
  }
  if (prevEnd != null) out.push({ t: prevEnd, verse: null, shabad: null, seeking: false });
  return out;
}
function stateAt(states, t) {
  let lo = 0; let hi = states.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (states[m].t <= t) lo = m; else hi = m - 1; }
  return lo;
}
function eventsFile(cacheDir, row) {
  for (const sj of (row.suite_jobs || '').split(';').filter(Boolean)) {
    const [suite, jid] = sj.split(':');
    for (const name of [jid, row.id, row.cache_id].filter(Boolean)) {
      const f = path.join(cacheDir, suite, 'trace', `${name}.events.jsonl`);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

// ---------------------------------------------------------------- one clip ----------------------
function scoreClip({ meta, truth, basis, states, texts: T }) {
  const dur = meta.dur;
  const segs = segments(truth.lines);
  const scoredSegs = segs.filter((s) => s.scored);
  const sh = truth.shabads;
  // what the screen shows at each state: normalised text (null = nothing), seeking, unit id, first-seen times
  const info = states.map((st) => {
    const txt = st.verse != null ? sv.textOf(st.verse) : null;
    return { ...st, txt, norm: txt ? sv.norm(txt) : null, unit: st.shabad != null ? String(st.shabad) : null };
  });
  // "already shown earlier": a Shabad id or pangti text whose first appearance is before the current contiguous run
  const firstUnit = new Map(); const firstText = new Map();
  info.forEach((x) => {
    if (x.seeking) return;
    if (x.unit && !firstUnit.has(x.unit)) firstUnit.set(x.unit, x.t);
    if (x.norm && !firstText.has(x.norm)) firstText.set(x.norm, x.t);
  });
  const runStart = (i, key) => { let j = i; while (j > 0 && key(info[j - 1]) === key(info[i]) && !info[j - 1].seeking) j--; return info[j].t; };
  const shownText = (x) => (x.seeking ? 'ਵਾਹਿਗੁਰੂ slide' : x.txt ? x.txt : x.unit ? unitTitle(x.unit) : null);
  const keyUnitsAt = (t, fallback) => {
    const rows = sh.filter((s) => s.start <= t && t < s.end);
    return (rows.length ? rows : fallback ? sh : []).flatMap((r) => r.ids).map(String);
  };
  const segAt = (list, t) => { let hit = null; for (const s of list) { if (s.start <= t && t < s.end) hit = s; if (s.start > t) break; } return hit; };

  const sample = (t) => {
    const keyedShabad = sh.some((s) => s.start <= t && t < s.end);
    const seg = segAt(scoredSegs, t);
    const unscored = !seg && segAt(segs.filter((s) => !s.scored), t);
    if (!seg && (unscored || !keyedShabad)) return null;
    const i = stateAt(info, t);
    const x = info[i];
    const si = T(shownText(x));
    if (seg) {
      const k = scoredSegs.indexOf(seg);
      const ti = T(seg.text);
      if (x.seeking) return { c: 'V', ti, si };
      if (!x.norm && !x.unit) return { c: 'N', ti, si };
      const keyUnits = [...new Set([...keyUnitsAt(t, true), ...shabadsOf(seg.verseId)])];
      if (x.norm) {
        const prev = k > 0 ? scoredSegs[k - 1] : null;
        const next = k + 1 < scoredSegs.length ? scoredSegs[k + 1] : null;
        // catch-up grace (first 1 s of a new sung pangti): the pangti sung before it, or the line just before it in the
        // Shabad/Bani text (a header such as ਪਉੜੀ ॥ / ਸਲੋਕੁ ਮਃ ੩ ॥ that the screen showed as the reader moved on)
        const early = t - seg.start < CATCH_S;
        const hit = sv.same(x.norm, seg.norm) || (early && prev && prev.norm !== seg.norm && sv.same(x.norm, prev.norm))
          || (early && keyUnits.map(unit).some((u) => u.seq.some((q, qi) => qi + 1 < u.seq.length && sv.same(u.seq[qi + 1], seg.norm) && sv.same(q, x.norm))))
          || (CATCH_NEXT && next && next.norm !== seg.norm && next.start - t < CATCH_S && sv.same(x.norm, next.norm)); // diagnostic only
        if (hit) return { c: x.unit && x.unit.startsWith('bani:') && x.verse != null && !shabadsOf(x.verse).some((u) => keyUnits.includes(u)) && !keyUnits.includes(x.unit) ? 'B' : 'P', ti, si };
        return { c: keyUnits.map(unit).some((u) => inUnit(u, x.norm)) ? 'A' : 'W', ti, si };
      }
      return { c: overlapUnits(x.unit, keyUnits.map(unit)) >= 0.5 ? 'A' : 'W', ti, si };
    }
    // no pangti being said, inside the Shabad key
    if (x.seeking || (!x.norm && !x.unit)) return { c: 'G', ti: -1, si };
    const prevSeg = [...scoredSegs].reverse().find((s) => s.end <= t);
    const nextSeg = scoredSegs.find((s) => s.start > t);
    const cur = new Set([...keyUnitsAt(t, false), ...(prevSeg ? shabadsOf(prevSeg.verseId) : []), ...(nextSeg ? shabadsOf(nextSeg.verseId) : [])]);
    // previous Shabad: the key row that ended last before this second (and is not a current one)
    const before = sh.filter((s) => s.end <= t && !s.ids.some((id) => cur.has(String(id)))).sort((a, b) => b.end - a.end)[0];
    const allowed = [...cur, ...(before ? before.ids.map(String) : [])];
    const units = allowed.map(unit);
    let ok = false;
    if (x.unit && allowed.includes(x.unit)) ok = true;
    else if (x.norm && units.some((u) => inUnit(u, x.norm))) ok = true;
    else if (!x.norm && x.unit && overlapUnits(x.unit, units) >= 0.5) ok = true;
    if (!ok) {
      const seenU = x.unit && firstUnit.get(x.unit) < runStart(i, (y) => y.unit);
      const seenT = x.norm && firstText.get(x.norm) < runStart(i, (y) => y.norm);
      ok = !!(seenU || seenT);
    }
    return { c: ok ? 'G' : 'W', ti: -1, si, nextKeyed: !ok && sh.some((s) => s.start > t && s.ids.map(String).includes(x.unit)) };
  };

  const cats = Array(dur).fill(null);
  let gapWNext = 0; let keyedS = 0; let pangtiS = 0;
  for (let s = 0; s < dur; s++) {
    const smp = [];
    for (let j = 0; j < 10; j++) smp.push(sample(s + 0.05 + 0.1 * j));
    const real = smp.filter(Boolean);
    if (!real.length) continue; // unkeyed / unscored (a partly keyed second counts, as in the earlier timelines)
    const n = {};
    for (const v of real) n[v.c] = (n[v.c] || 0) + 1;
    const c = Object.entries(n).sort((a, b) => b[1] - a[1] || RANK[b[0]] - RANK[a[0]])[0][0];
    const v = real.filter((y) => y.c === c).pop();
    cats[s] = [c, v.ti, v.si];
    if (c === 'W' && v.nextKeyed) gapWNext++;
  }
  // coverage: seconds inside scored pangti spans / seconds inside any key (Shabad rows or pangti spans)
  for (let s = 0; s < dur; s++) {
    const t = s + 0.5;
    const inSeg = !!segAt(scoredSegs, t);
    const keyed = inSeg || !!segAt(segs, t) || sh.some((r) => r.start <= t && t < r.end);
    if (keyed) keyedS++;
    if (inSeg) pangtiS++;
  }
  const runs = [];
  for (let s = 0; s < dur; s++) {
    if (!cats[s]) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === s && last[2] === cats[s][0] && last[3] === cats[s][1] && last[4] === cats[s][2]) last[1] = s + 1;
    else runs.push([s, s + 1, ...cats[s]]);
  }
  const n = Object.fromEntries(CATS.map((k) => [k, 0]));
  for (const x of cats) if (x) n[x[0]]++;
  return { runs, n, coverage: keyedS ? pangtiS / keyedS : 0, keyedS, pangtiS, gapWNext, nSegs: scoredSegs.length, basis };
}

// ---------------------------------------------------------------- main --------------------------
const headline = (n) => { const d = n.P + n.B + n.A + n.W + n.N + n.V; return d ? (100 * (n.P + n.B)) / d : null; };
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const hf = sv.loadDataset(HF_DS);
  const kb = sv.loadDataset(KBV1_DS);
  const report = { rule: 'owner pangti rule 2026-10-22', cover_min: COVER_MIN, files: {} };
  const files = fs.readdirSync(SRC).filter((f) => /^(v905|v1004|c1)-[0-9a-f]{8}-[a-z0-9]+\.json$/.test(f)).filter((f) => !ONLY || f.includes(ONLY)).sort();
  for (const f of files) {
    const b = f.split('-')[0];
    const setKey = f.replace(/\.json$/, '').split('-')[2];
    const src = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    const texts = []; const tIdx = new Map();
    const T = (s) => { if (s == null) return -1; if (!tIdx.has(s)) { tIdx.set(s, texts.length); texts.push(s); } return tIdx.get(s); };
    const clips = []; const dropped = []; const per = [];
    for (const meta of src.clips) {
      const ds = setKey === 'kbv1' ? kb : hf;
      const row = ds.find(meta.id);
      if (!row) { dropped.push({ id: meta.id, why: 'not in the manifest' }); continue; }
      const { truth, basis } = truthOf(ds, row);
      if (!truth.lines.some((l) => l.scored)) { dropped.push({ id: meta.id, why: 'no pangti key' }); continue; }
      let states;
      if (setKey === 'kbv1' && KBV1_SUB[b]) states = statesFromKbv1Sub(KBV1_SUB[b], row);
      else {
        const ev = eventsFile(path.join(REPLAYS, setKey === 'kbv1' ? KBV1_CACHE[b] : CACHE[b]), row);
        if (!ev) { dropped.push({ id: meta.id, why: 'no saved replay trace' }); continue; }
        states = statesFromTrace(ev);
      }
      const r = scoreClip({ meta, truth, basis, states, texts: T });
      const complete = basis === 'human' || basis === 'broadcast-caption';
      const keep = complete || r.coverage >= COVER_MIN;
      per.push({ id: meta.id, basis, coverage: +r.coverage.toFixed(3), keyed_s: r.keyedS, pangti_s: r.pangtiS, kept: keep, n: r.n, right: headline(r.n), gapW_nextShabad: r.gapWNext });
      if (!keep) { dropped.push({ id: meta.id, why: `pangti spans cover ${(100 * r.coverage).toFixed(0)}% of keyed time (< ${100 * COVER_MIN}%)`, basis }); continue; }
      const c = { id: meta.id, folder: meta.folder, gurdwara: meta.gurdwara, dur: meta.dur, basis, kb: meta.kb ?? null, yt: meta.yt ?? null, n: r.n, runs: r.runs };
      for (const k of ['bani', 'session', 'basis_note']) if (meta[k] != null) c[k] = meta[k];
      clips.push(c);
    }
    const out = { gab: src.gab, label: src.label ?? null, commit: src.commit, set: src.set, split: src.split, scoring: 'pangti', texts, clips };
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(out));
    const tot = Object.fromEntries(CATS.map((k) => [k, clips.reduce((a, c) => a + c.n[k], 0)]));
    const scored = CATS.reduce((a, k) => a + tot[k], 0);
    report.files[f] = { kept: clips.length, of: src.clips.length, dropped, totals: tot, right_pangti_pct: headline(tot), g_share_pct: scored ? (100 * tot.G) / scored : null, clips: per };
    console.log(`${f}: kept ${clips.length}/${src.clips.length}, right pangti ${headline(tot)?.toFixed(1)}%, G ${(scored ? (100 * tot.G) / scored : 0).toFixed(1)}% of scored s, totals ${JSON.stringify(tot)}`);
  }
  // real sessions: already pangti level against the sevadaar's own screen (no sung-pangti spans, so no G); copied
  // through with the new category list
  for (const f of fs.readdirSync(SRC).filter((x) => /^real-sessions-.*\.json$/.test(x) && (!ONLY || x.includes(ONLY)))) {
    const d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    for (const c of d.clips) { c.n = Object.fromEntries(CATS.map((k) => [k, c.n[k] || 0])); delete c.sung; }
    d.scoring = 'pangti (key = the sevadaar screen; no pangti spans, so no G)';
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(d));
    const tot = Object.fromEntries(CATS.map((k) => [k, d.clips.reduce((a, c) => a + c.n[k], 0)]));
    report.files[f] = { kept: d.clips.length, of: d.clips.length, dropped: [], totals: tot, right_pangti_pct: headline(tot), g_share_pct: 0, copied: true };
  }
  // private sets (hard, real sessions) go to their own report, next to their gitignored timelines
  const priv = { ...report, files: {} };
  for (const f of Object.keys(report.files)) if (/-hard\.json$|^real-sessions/.test(f)) { priv.files[f] = report.files[f]; delete report.files[f]; }
  const sfx = ONLY ? `.${ONLY}` : '';
  fs.writeFileSync(path.join(OUT, `rescore-report${sfx}.json`), JSON.stringify(report, null, 1));
  if (Object.keys(priv.files).length) fs.writeFileSync(path.join(OUT, `rescore-report-private${sfx}.json`), JSON.stringify(priv, null, 1));
  if (!ONLY) {
    for (const f of ['index.json', 'index-extra.json']) fs.copyFileSync(path.join(GUI, 'timeline-orig', f), path.join(OUT, f));
    fs.copyFileSync(path.join(SRC, 'index.json'), path.join(OUT, 'index-all.json')); // every tier incl. hard + real (private page)
  }
  sv.close();
  realm.close();
}
if (require.main === module) main();
// gab-quick.js uses the same scoring (one rule, one place)
module.exports = { scoreClip, segments, truthOf, statesFromTrace, headline, CATS, sv, close: () => { sv.close(); realm.close(); } };
