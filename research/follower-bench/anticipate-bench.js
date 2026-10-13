// Paath follower anticipation bench: cached-window replay (no acoustic model: each window's
// transcript comes from cache/*.hyps.json), scored on VOICED time and per-flip timing.
//   node anticipate-bench.js <set> [variant ...]     sets: rehras, rehras-slow, sohila, rec55, sung,
//                                                    rehras:<t0>-<t1> (a slice, for quick checks)
//   variants: base (7165bd24 follower2, copy in BASE_F2), cand (this worktree's follower2);
//   env OPTS='{"anticipate":1}' extra follower options for cand. OUT=<file.json> per-clip rows.
//
// Metrics (only confident truth lines scored):
//   voiced    share of voiced time (inside [start_i, end_i) of a truth line) the screen shows line i
//   exact     as scorer3 / renton-score: time from line i's start to line i+1's start (pause counts as i)
//   within1   same span, shown line index within 1 of the read line
//   flips to the next line i+1 (screen was on i):  PREMATURE  inside [start_i, end_i) (line i still voiced)
//             GOOD  inside the pause [end_i, start_{i+1})     LAG  after start_{i+1} (seconds late)
//   aheadV    share of voiced time the screen shows a line AFTER the one being voiced
//   lag       per line: first time shown minus its start (negative = shown in the pause before it);
//             lagHi = same, only lines with alignment conf >= CONF_MIN (decent alignment)
//   backs     truth index decreases (reader went back): followed / not followed, median time
const fs = require('fs');
const path = require('path');
const HOME = process.env.HOME;
const S = '/private/tmp/claude-501/-Users-asingh02-personal-sttm-desktop/7dc20a33-cab3-495f-b630-6acf57f0287c/scratchpad';
const PB = `${HOME}/personal/sttm-paath/research/follower-bench`; // 55-clip caches + truth
const W = `${S}/vf-fix/paath/work`; // Renton caches + truth
const A = `${__dirname}/anticipate`;
const BASE_F2 = process.env.BASE_F2 || `${S}/ant/follower2.base.js`;
const CAND_F2 = `${__dirname}/../../www/main/addons/voice-follow/engine/follower2.js`;
const NITNEM = require('../../www/main/addons/voice-follow/engine/assets/nitnem-lines');
const STEP = 0.02;
const GATE = 0.4; // app moves the screen only on confidence >= 0.4
const MINCHK = 0.6;
const CONF_MIN = Number(process.env.CONF_MIN || -2.5);
const tokenize = (u) => (u || '').replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean);
const bg = (id) => Object.entries(NITNEM).filter(([b]) => Number(b) !== Number(id)).flatMap(([, l]) => l);

class CachedInfer {
  constructor(hyps) { this.hyps = hyps; this.i = -1; }
  async emissions() { this.i += 1; return { data: new Float32Array(0), frames: 0, C: 257, i: this.i }; }
  greedy() { return []; }
  decode() { return this.hyps[this.i] || ''; }
}

const REC55 = 'bn01_dy1bAclA25k_0-520:21 bn02_6xT3M6QsmGs_0-520:21 bn03_jkwTfDew37g_0-324:23 bn04_UrDfndbuWyE_0-473:23 bn05_CJms83eJ88Q_0-206:10 bn06_K1BTe7T5gF0_0-159:10 pt15_KZVWcP8Qmdw_30-100:10 pt07_Juyj3z1_W8Q_1170-1240:4 pt13_YPPSuG2Kxt8_120-190:6 pt12_YPPSuG2Kxt8_10-80:6 pt02_vbkJ39xnza8_420-490:2 pt14_YPPSuG2Kxt8_230-300:6 pt06_Juyj3z1_W8Q_570-640:4 pt03_vbkJ39xnza8_920-990:2 pt16_KZVWcP8Qmdw_370-440:10 pt04_vbkJ39xnza8_1420-1490:2 pt11_m0vwa8RWzXg_250-320:9 pt10_m0vwa8RWzXg_120-190:9 pt09_m0vwa8RWzXg_10-80:9 pt08_Juyj3z1_W8Q_1870-1940:4 pt18_KZVWcP8Qmdw_1270-1340:10 pt20_KSgSkLjLuA0_170-240:21 pt21_KSgSkLjLuA0_370-440:21 pt24_KSgSkLjLuA0_970-1040:21 pt28_IQkag1vkfAU_10-80:23 pt17_KZVWcP8Qmdw_870-940:10 pt27_KSgSkLjLuA0_1570-1640:21 pt19_KSgSkLjLuA0_10-80:21 pt30_IQkag1vkfAU_220-290:23 pt23_KSgSkLjLuA0_770-840:21 pt22_KSgSkLjLuA0_570-640:21 pt26_KSgSkLjLuA0_1370-1440:21 pt29_IQkag1vkfAU_120-190:23 pt31_V0yK9gjb-uA_30-100:4 pt32_V0yK9gjb-uA_270-340:4 pt33_V0yK9gjb-uA_520-590:4 pt35_T8Qa1qq28IE_30-100:23 pt43_TgoswO8AtpY_30-100:23 pt39_Rvcw3XFSQbc_30-100:23 pt51_aRvTXC1DRt0_30-100:23 pt54_SC1gipmk214_0-55:2 pt57_JjW_SU0oBwU_0-55:2 pt60_4PEORBA2KdU_0-55:2 pt58_JjW_SU0oBwU_277-347:2 pt55_SC1gipmk214_432-502:2 pt59_JjW_SU0oBwU_546-616:2 pt63_KQIeS-hKWPk_0-55:2 pt61_4PEORBA2KdU_518-588:2 pt56_SC1gipmk214_837-907:2 pt65_KQIeS-hKWPk_1018-1088:2 pt62_4PEORBA2KdU_997-1067:2 pt64_KQIeS-hKWPk_529-599:2 pt01_vbkJ39xnza8_10-80:2 pt05_Juyj3z1_W8Q_30-100:4 pt34_V0yK9gjb-uA_770-840:4'.split(' ');

function hypsAt(dir, clip, every) {
  // 0.125 s cache: even windows are the 0.25 s grid (window k ends at 1 + k*0.25 s).
  const f125 = `${dir}/cache/${clip}.hop0.125.hyps.json`;
  let h;
  if (fs.existsSync(f125) && every === 0.5) return JSON.parse(fs.readFileSync(f125)).hyps;
  if (fs.existsSync(f125)) h = JSON.parse(fs.readFileSync(f125)).hyps.filter((_, k) => k % 2 === 0);
  else h = JSON.parse(fs.readFileSync(`${dir}/cache/${clip}.hyps.json`)).hyps;
  return every > 1 ? h.filter((_, k) => k % every === 0) : h;
}
function baniLines(file) {
  const bani = JSON.parse(fs.readFileSync(file));
  return bani.verses.filter((v) => tokenize(v.unicode).length).map((v) => ({ verseId: v.verseId, words: tokenize(v.unicode), text: v.unicode }));
}
// One replay item: { name, baniId, lines, hyps, every, truth: [{id, start, end, ok, conf}] }
function item(set, spec) {
  if (set === 'rehras' || set === 'rehras-slow' || set === 'rehras-fine') {
    const all = JSON.parse(fs.readFileSync(`${A}/app-rehras21-extralong.lines.json`)).all;
    const lines = all.map(([verseId, text]) => ({ verseId, words: tokenize(text), text }));
    const T = JSON.parse(fs.readFileSync(`${A}/rt11_rehrasX.app.truth.json`)).lines
      .filter((l) => l.appVerseId != null).map((l) => ({ id: l.appVerseId, start: l.start, end: l.end, ok: !!l.confident, conf: l.conf }));
    const every = { 'rehras-slow': 2, 'rehras-fine': 0.5 }[set] || 1;
    return { name: set, baniId: 21, lines, hyps: hypsAt(W, 'rt11_rehrasX', every), every, truth: T };
  }
  if (set === 'sohila' || set === 'aarti') {
    const b = set === 'sohila' ? 23 : 22;
    const T = JSON.parse(fs.readFileSync(`${W}/truth/rt11_${set}.json`)).lines.map((l) => ({ id: l.verseId, start: l.start, end: l.end, ok: (l.check ?? 1) >= MINCHK, conf: l.conf }));
    return { name: set, baniId: b, lines: baniLines(`${W}/banis/${b}.json`), hyps: hypsAt(W, `rt11_${set}`, 1), every: 1, truth: T };
  }
  // follower-bench clip  clip:baniId
  const [clip, b] = spec.split(':');
  const T = JSON.parse(fs.readFileSync(`${PB}/truth/${clip}.json`)).lines.map((l) => ({ id: l.verseId, start: l.start, end: l.end, ok: (l.check ?? 1) >= MINCHK, conf: l.conf }));
  return { name: clip, baniId: Number(b), lines: baniLines(`${PB}/banis/${b}.json`), hyps: hypsAt(PB, clip, 1), every: 1, truth: T };
}
function asaItem(clip) {
  const dir = `${S}/asa/align`;
  return { name: clip, baniId: 90, lines: baniLines(`${dir}/banis/90.json`), hyps: JSON.parse(fs.readFileSync(`${dir}/cache/${clip}.hyps.json`)).hyps, every: 1, truth: null };
}

function makeFollower(variant, infer, it) {
  const { FollowerV2 } = require(variant === 'base' ? BASE_F2 : CAND_F2);
  const opts = { inputSr: 16000, hopS: 0.25 * Math.min(1, it.every), background: bg(it.baniId), baniId: it.baniId };
  return new FollowerV2(infer, it.lines, variant === 'base' ? opts : { ...opts, ...JSON.parse(process.env.OPTS || '{}') });
}

const WAVS = `${HOME}/personal/live-darbar-venues/clips`;
function wavOf(it) {
  const name = { rehras: 'rt11_rehras', 'rehras-slow': 'rt11_rehras', 'rehras-fine': 'rt11_rehras', sohila: 'rt11_sohila', aarti: 'rt11_aarti' }[it.name] || it.name;
  const f = `${WAVS}/${name}.wav`;
  if (!fs.existsSync(f)) return null;
  const b = fs.readFileSync(f);
  const i16 = new Int16Array(b.buffer, b.byteOffset + 44, (b.length - 44) >> 1);
  const x = new Float32Array(i16.length);
  for (let k = 0; k < i16.length; k++) x[k] = i16[k] / 32768;
  return x;
}
async function replay(variant, it) {
  const hop = 0.25 * it.every;
  const f = makeFollower(variant, new CachedInfer(it.hyps), it);
  const N = Math.round(16000 * hop);
  const pcm = process.env.PCM ? wavOf(it) : null;
  const zero = new Float32Array(N);
  const shown = [];
  let cur;
  const pre = Math.ceil(1 / hop) - 1;
  const n = it.hyps.length + pre;
  for (let k = 0; k < n; k++) {
    let chunk = zero;
    if (pcm) { chunk = pcm.subarray(k * N, (k + 1) * N); if (chunk.length < N) { const z = new Float32Array(N); z.set(chunk); chunk = z; } }
    const out = await f.push(chunk);
    if (!out || out.verseId == null || out.lineIndex == null || out.confidence < GATE) continue;
    if (out.lineIndex !== cur) { cur = out.lineIndex; shown.push({ t: +(1 + (k - pre) * hop).toFixed(3), i: cur, id: out.verseId }); }
  }
  return shown;
}

const q = (a, p) => (a.length ? +[...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2) : null);

function score(it, shown) {
  const idxOf = new Map(); // verse id -> line indexes
  it.lines.forEach((l, i) => { if (!idxOf.has(l.verseId)) idxOf.set(l.verseId, []); idxOf.get(l.verseId).push(i); });
  const L = it.truth.filter((l) => idxOf.has(l.id)).sort((a, b) => a.start - b.start);
  // index of truth line: nearest occurrence to the previous truth line
  let prevI = 0;
  L.forEach((l) => { const c = idxOf.get(l.id); l.i = c.reduce((a, b) => (Math.abs(b - prevI) < Math.abs(a - prevI) ? b : a)); prevI = l.i; });
  const t0 = L[0].start, t1 = L[L.length - 1].end;
  const dist = (shownI, l) => shownI - l.i;
  let si = -1, k = -1;
  let V = 0, vOk = 0, vAhead = 0, T = 0, ex = 0, w1 = 0;
  for (let t = t0; t < t1; t += STEP) {
    while (k + 1 < L.length && L[k + 1].start <= t) k++;
    while (si + 1 < shown.length && shown[si + 1].t <= t) si++;
    const l = L[k];
    if (!l.ok) continue;
    const d = si >= 0 ? dist(shown[si].i, l) : null;
    T++;
    if (d === 0) ex++;
    if (d !== null && Math.abs(d) <= 1) w1++;
    if (t < l.end) { V++; if (d === 0) vOk++; if (d !== null && d > 0) vAhead++; }
  }
  // Flips.
  const fl = { premature: 0, good: 0, lag: 0, other: 0, lags: [], early: [], goodNearEnd: 0 };
  const segAt = (t) => { let j = -1; while (j + 1 < L.length && L[j + 1].start <= t) j++; return j; };
  shown.forEach((s, j) => {
    if (j === 0) return;
    const p = shown[j - 1].i;
    if (s.t < L[0].start || s.t > L[L.length - 1].end + 1) return;
    const kk = segAt(s.t);
    if (kk < 0) return;
    const a = L[kk], b = L[kk + 1];
    if (!a.ok) return;
    if (b && s.i === b.i && p === a.i) { // to the next line while on the current
      if (!b.ok) return;
      if (s.t < a.end) { fl.premature++; fl.early.push(+(a.end - s.t).toFixed(2)); } else { fl.good++; if (s.t - a.end < 0.2) fl.goodNearEnd++; }
    } else if (s.i === a.i && p === (kk > 0 ? L[kk - 1].i : -1)) { fl.lag++; fl.lags.push(+(s.t - a.start).toFixed(2)); } else fl.other++;
  });
  // Per-line lag (first show of the line from 3 s before its start / after the previous hit).
  const lag = [], lagHi = [];
  let missed = 0, lastHit = -Infinity;
  L.forEach((l, j) => {
    const until = (L[j + 1] ? L[j + 1].start : l.end) + 2;
    const from = Math.max(l.start - 3, lastHit, j > 0 ? L[j - 1].start : -Infinity);
    // shown already at `from` counts at `from`
    let at = null;
    let curS = null; for (const s of shown) { if (s.t <= from) curS = s; else break; }
    if (curS && curS.i === l.i) at = from; else { const h = shown.find((s) => s.i === l.i && s.t > from && s.t <= until); if (h) at = h.t; }
    if (at !== null) lastHit = at;
    if (!l.ok) return;
    if (at === null) { missed++; return; }
    lag.push(at - l.start); if (l.conf >= CONF_MIN) lagHi.push(at - l.start);
  });
  // Step-backs in truth.
  let backs = 0, backOk = 0; const backT = [];
  L.forEach((l, j) => {
    if (j === 0 || l.i >= L[j - 1].i || !l.ok) return;
    backs++;
    const until = (L[j + 1] ? L[j + 1].start : l.end) + 3;
    let curS = null; for (const s of shown) { if (s.t <= l.start) curS = s; else break; }
    if (curS && curS.i === l.i) { backOk++; backT.push(0); return; }
    const h = shown.find((s) => s.i === l.i && s.t > l.start && s.t <= until);
    if (h) { backOk++; backT.push(+(h.t - l.start).toFixed(2)); }
  });
  const flips = fl.premature + fl.good + fl.lag;
  const pausePairs = [];
  for (let j = 0; j + 1 < L.length; j++) if (L[j].ok && L[j + 1].ok && L[j + 1].i === L[j].i + 1) pausePairs.push(L[j + 1].start - L[j].end);
  return {
    voicedS: +(V * STEP).toFixed(0), voiced: +(100 * vOk / V).toFixed(1), aheadV: +(100 * vAhead / V).toFixed(2),
    exact: +(100 * ex / T).toFixed(1), within1: +(100 * w1 / T).toFixed(1),
    flips, premature: fl.premature, good: fl.good, lagFlips: fl.lag, other: fl.other,
    prematurePct: flips ? +(100 * fl.premature / flips).toFixed(1) : 0, goodNearEnd: fl.goodNearEnd,
    lagMed: q(lag, 0.5), lagP90: q(lag, 0.9), lagHiMed: q(lagHi, 0.5), lagHiP90: q(lagHi, 0.9), missed,
    backs, backOk, backMed: q(backT, 0.5), _lagFlips: fl.lags, _early: fl.early, _pauses: pausePairs,
  };
}

function sum(rows) {
  // voiced-time weighted
  const tw = (k, w) => +(rows.reduce((a, r) => a + r[k] * r[w], 0) / rows.reduce((a, r) => a + r[w], 0)).toFixed(2);
  const s = (k) => rows.reduce((a, r) => a + r[k], 0);
  return { name: `ALL(${rows.length})`, voicedS: s('voicedS'), voiced: tw('voiced', 'voicedS'), aheadV: tw('aheadV', 'voicedS'), exact: tw('exact', 'voicedS'), within1: tw('within1', 'voicedS'),
    flips: s('flips'), premature: s('premature'), good: s('good'), lagFlips: s('lagFlips'), other: s('other'), prematurePct: +(100 * s('premature') / Math.max(1, s('flips'))).toFixed(1),
    goodNearEnd: s('goodNearEnd'), missed: s('missed'), backs: s('backs'), backOk: s('backOk') };
}

(async () => {
  const [set, ...vs] = process.argv.slice(2);
  const variants = vs.length ? vs : ['base', 'cand'];
  let items;
  let slice = null;
  if (set === 'rec55') items = REC55.map((c) => item('clip', c));
  else if (set === 'sung') items = [item('aarti'), item('clip', 'bn07_T8Qa1qq28IE_0-520:22'), item('clip', 'bn08_1dMpII7oxEg_0-520:22'), asaItem('nw11_asa1'), asaItem('nw11_asa2'), asaItem('ytasa1_4IXk2t_Irqo_900-1620')];
  else if (set.startsWith('rehras:')) {
    slice = set.split(':')[1].split('-').map(Number);
    const it = item('rehras');
    it.hyps = it.hyps.slice(0, Math.ceil((slice[1] + 2 - 1) / 0.25));
    items = [it];
  }
  else items = [item(set)];
  const out = {};
  for (const v of variants) {
    const rows = [];
    for (const it of items) {
      const shown = await replay(v, it);
      if (set === 'sung') { rows.push({ name: it.name, shown: shown.length, sig: shown.map((s) => `${s.t}:${s.i}`).join(' ') }); continue; }
      let itS = it;
      if (slice) itS = { ...it, truth: it.truth.filter((l) => l.start >= slice[0] && l.end <= slice[1]) };
      const r = { name: it.name, ...score(itS, shown) };
      r._shown = shown;
      rows.push(r);
    }
    out[v] = rows;
  }
  if (set === 'sung') {
    for (const it of out[variants[0]]) {
      const o = out[variants[1]]?.find((x) => x.name === it.name);
      console.log(it.name, 'moves', it.shown, o ? (o.sig === it.sig ? 'IDENTICAL' : 'DIFFERENT') : '');
    }
    return;
  }
  const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k2]) => !k2.startsWith('_')));
  const table = [];
  for (const v of variants) {
    const rows = out[v];
    if (rows.length > 1) table.push({ variant: v, ...sum(rows) });
    else table.push({ variant: v, ...strip(rows[0]) });
  }
  console.table(table);
  if (process.env.VERBOSE) for (const v of variants) for (const r of out[v]) console.log(v, r.name, JSON.stringify(strip(r)));
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
})();
