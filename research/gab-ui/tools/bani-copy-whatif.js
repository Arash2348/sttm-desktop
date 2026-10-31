/* bani-copy-whatif.js — what the GAB Shabad-level numbers would be if "the right pangti's text shown from a Bani
 * copy" counted as right. Owner decision pending (Oct 31 2026): the scorer's default is NOT changed here.
 *
 *   node bani-copy-whatif.js <gab run --keep out dir> [<out dir> ...] [--slice <slice-v1.json>] [--json <file>]
 *
 * For every clip of each run (scorecard.json + replay/base/<suite>/trace/<job>.events.jsonl, so run `gab run --keep`),
 * the Shabad-level samples (sangat-score.js: 0.1 s steps over the truth windows) are scored again and each WRONG
 * sample is classified:
 *   bani_unit   the screen shows a Bani the app opened (shabad 'bani:N'), any pangti of it
 *   copy        the shown pangti's text is the key Shabad's pangti in another form: one contains the other (a half
 *               line, or a line split differently in the Bani) or they differ by <= 25 % (a copy's spelling)
 *   line        a line answer key says this pangti (or its copy) is being sung right now
 * The what-if counts WRONG samples with bani_unit && (copy || line) as ON ("bani_copy"); a second, wider what-if
 * counts copy || line from any unit ("copy_any": a Shabad copy of the same pangti elsewhere in the Granth that the
 * scorer's same() rejected). Tables per behaviour on the slice rows (fail / canary), hours-weighted like
 * fail_first_table.py; the default scorer's numbers are recomputed here and must equal the scorecard's.
 */
const fs = require('fs');
const path = require('path');
// The GAB bench tools (sangat-score.js and friends, branch gab-harness: research/level2-dataset/tools); this script
// needs sangat-score to export `unit` (the scratch bench copy does).
const TOOLS = process.env.VF_BENCH_TOOLS || __dirname;
const sv = require(path.join(TOOLS, 'sangat-score'));

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const dirs = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const STEP = 0.1;
const r1 = (x) => +x.toFixed(1);

function lev(a, b) {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const memo = new Map();
// the shown text is the key pangti in another form (see the header)
function copyOf(shown, key) {
  if (!shown || !key) return false;
  const k = `${shown}|${key}`;
  if (memo.has(k)) return memo.get(k);
  let ok = false;
  const lo = Math.min(shown.length, key.length);
  const hi = Math.max(shown.length, key.length);
  if (lo >= 10 && (shown.includes(key) || key.includes(shown))) ok = true;
  else if (lo >= 10 && hi - lo <= 0.25 * hi && lev(shown, key) <= 0.25 * hi) ok = true;
  memo.set(k, ok);
  return ok;
}

function eventsOf(outDir, row) {
  for (const sj of (row.suite_jobs || '').split(';').filter(Boolean)) {
    const [suite, jid] = sj.split(':');
    for (const name of [jid, row.id, row.cache_id].filter(Boolean)) {
      const f = path.join(outDir, 'replay', 'base', suite, 'trace', `${name}.events.jsonl`);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

// one clip: the Shabad-level loop of sangat-score.scoreShabads with the WRONG samples classified
function scoreOne(ds, row, ev) {
  const truth = sv.loadTruth(ds, row);
  if (!truth.shabads.length) return null;
  const { events, dur } = sv.loadEvents(ev);
  const states = sv.screenStates(events);
  const until = dur || Infinity;
  for (const r of truth.shabads) r.ids.forEach(sv.unit);
  // memberOf, as sangat-score.covering(): a Bani row also covers its member pieces
  const banis = truth.shabads.filter((r) => r.ids.some((id) => String(id).startsWith('bani:')));
  const memberOf = new Map();
  const overlap = (shownUnit, set) => {
    const u = sv.unit(String(shownUnit));
    if (!u.seq.length) return 0;
    return u.seq.filter((t) => set.has(t) || [...set].some((x) => sv.same(t, x))).length / u.seq.length;
  };
  for (const r of truth.shabads) {
    if (banis.includes(r)) continue;
    const m = banis.filter((b) => r.ids.some((id) => overlap(id, new Set(b.ids.flatMap((x) => sv.unit(x).seq))) >= 0.5));
    if (m.length) memberOf.set(r, m);
  }
  const covering = (t) => {
    const a = truth.shabads.filter((s) => s.start <= t && t < s.end);
    for (const r of [...a]) for (const b of memberOf.get(r) || []) if (!a.includes(b)) a.push(b);
    return a;
  };
  const acc = { voiced: 0, on: 0, wrong: 0, blank: 0, bani_unit: 0, bani_copy: 0, copy_any: 0, line_only: 0 };
  const examples = new Map(); // shown text -> seconds (wrong, from a Bani, copy/line)
  const lo = Math.min(...truth.shabads.map((s) => s.start));
  const hi = Math.min(until, Math.max(...truth.shabads.map((s) => s.end)));
  let lineAt = 0;
  for (let t = Math.ceil(lo / STEP) * STEP; t < hi; t += STEP) {
    const rows = covering(t);
    if (!rows.length) continue;
    const units = rows.flatMap((r) => r.ids).map(sv.unit);
    const set = new Set(units.flatMap((u) => u.seq));
    const st = sv.stateAt ? sv.stateAt(states, t) : stateAt(states, t);
    acc.voiced += STEP;
    const seeking = st.seeking || (st.shabad == null && st.verse == null);
    let shown = null; // normalised text, or { unknownUnit }
    if (!seeking) {
      if (st.verse != null) { const x = sv.textOf(st.verse); shown = x ? sv.norm(x) : { unknownUnit: st.shabad }; } else shown = { unknownUnit: st.shabad };
    }
    let b;
    if (shown == null) b = 'blank';
    else if (typeof shown === 'object') b = overlap(shown.unknownUnit, set) >= 0.5 ? 'on' : 'wrong';
    else b = set.has(shown) || units.some((u) => posIn(u, shown)) ? 'on' : 'wrong';
    acc[b] += STEP;
    if (b !== 'wrong') continue;
    const baniUnit = st.shabad != null && String(st.shabad).startsWith('bani:');
    if (baniUnit) acc.bani_unit += STEP;
    const text = typeof shown === 'string' ? shown : null;
    const copy = !!text && [...set].some((k) => copyOf(text, k));
    // a line answer key (any source) naming the pangti sung now, or its copy
    while (lineAt < truth.lines.length && truth.lines[lineAt].end <= t) lineAt++;
    const sung = truth.lines.filter((l, i) => i >= lineAt && l.start <= t && t < l.end);
    const line = !!text && sung.some((l) => l.norm === text || sv.same(l.norm, text) || copyOf(text, l.norm));
    if (copy || line) {
      acc.copy_any += STEP;
      if (!copy) acc.line_only += STEP;
      if (baniUnit) { acc.bani_copy += STEP; examples.set(text, (examples.get(text) || 0) + STEP); }
    }
  }
  const pct = (x) => (acc.voiced ? +(100 * x / acc.voiced).toFixed(1) : null);
  const sph = (x) => (acc.voiced ? r1(x / (acc.voiced / 3600)) : null);
  return {
    id: row.id, folder: row.content_folder, voiced_s: r1(acc.voiced),
    right_pct: pct(acc.on), wrong_s_per_h: sph(acc.wrong), wrong_s: r1(acc.wrong), blank_s: r1(acc.blank),
    wrong_bani_unit_s: r1(acc.bani_unit), wrong_bani_copy_s: r1(acc.bani_copy), wrong_copy_any_s: r1(acc.copy_any), wrong_line_only_s: r1(acc.line_only),
    whatif_bani_copy: { right_pct: pct(acc.on + acc.bani_copy), wrong_s_per_h: sph(acc.wrong - acc.bani_copy) },
    whatif_copy_any: { right_pct: pct(acc.on + acc.copy_any), wrong_s_per_h: sph(acc.wrong - acc.copy_any) },
    examples: [...examples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, s]) => ({ s: r1(s), text })),
  };
}
function stateAt(states, t) {
  let lo = 0; let hi = states.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (states[m].t <= t) lo = m; else hi = m - 1; }
  return states[lo];
}
// sangat-score.posIn (same() over a unit's texts), memoised per unit
function posIn(u, s) {
  if (u.pos.has(s)) return true;
  if (!u.fuzzy2) u.fuzzy2 = new Map();
  if (!u.fuzzy2.has(s)) u.fuzzy2.set(s, u.seq.some((t) => sv.same(s, t)));
  return u.fuzzy2.get(s);
}

function main() {
  if (!dirs.length) { console.log('usage: bani-copy-whatif.js <gab run --keep out dir>... [--slice slice-v1.json] [--json out.json]'); process.exit(2); }
  const slice = arg('slice') ? JSON.parse(fs.readFileSync(arg('slice'), 'utf8')) : null;
  const rowsOf = {}; // behaviour -> [{id, hours, kind}]
  if (slice) for (const [b, v] of Object.entries(slice.sets)) rowsOf[b] = [...v.fail.map((r) => ({ ...r, kind: 'fail' })), ...v.canary.map((r) => ({ ...r, kind: 'canary' }))];
  const clips = [];
  for (const d of dirs) {
    const card = JSON.parse(fs.readFileSync(path.join(d, 'scorecard.json'), 'utf8'));
    const ds = sv.loadDataset(path.dirname(card.manifest.path));
    for (const c of card.clips) {
      const row = ds.by.get(c.id);
      const ev = row && eventsOf(d, row);
      if (!ev) { console.error(`${c.id}: no events in ${d} (run gab run --keep)`); continue; }
      const r = scoreOne(ds, row, ev);
      if (!r) continue;
      if (c.right_shabad_pct != null && Math.abs(c.right_shabad_pct - r.right_pct) > 0.15) console.error(`${c.id}: recomputed right ${r.right_pct} != scorecard ${c.right_shabad_pct}`);
      clips.push({ ...r, set: card.set, run: d });
    }
  }
  sv.close();
  const by = new Map(clips.map((c) => [c.id, c]));
  const L = [];
  L.push('| behaviour | rows | clips scored | right % default -> Bani-copy what-if -> any-copy what-if | wrong s/h default -> Bani-copy -> any-copy | wrong s from a Bani: any pangti / the right pangti (copy) |');
  L.push('|---|---|---|---|---|---|');
  const agg = (rows) => {
    const hit = rows.map((r) => [r, by.get(r.id)]).filter(([, c]) => c);
    const h = hit.reduce((a, [r]) => a + r.hours, 0);
    if (!hit.length || !h) return null;
    const w = (f) => hit.reduce((a, [r, c]) => a + f(c) * r.hours, 0) / h;
    return {
      n: hit.length, tot: rows.length,
      right: [w((c) => c.right_pct), w((c) => c.whatif_bani_copy.right_pct), w((c) => c.whatif_copy_any.right_pct)],
      wrong: [w((c) => c.wrong_s_per_h), w((c) => c.whatif_bani_copy.wrong_s_per_h), w((c) => c.whatif_copy_any.wrong_s_per_h)],
      baniS: hit.reduce((a, [, c]) => a + c.wrong_bani_unit_s, 0), copyS: hit.reduce((a, [, c]) => a + c.wrong_bani_copy_s, 0),
    };
  };
  const groups = slice ? Object.entries(rowsOf).flatMap(([b, rows]) => [[b, 'fail', rows.filter((r) => r.kind === 'fail')], [b, 'canary', rows.filter((r) => r.kind === 'canary')]])
    : [...new Set(clips.map((c) => c.folder.split('/')[0]))].map((f) => [f, 'all', clips.filter((c) => c.folder.split('/')[0] === f).map((c) => ({ id: c.id, hours: c.voiced_s / 3600 }))]);
  for (const [b, kind, rows] of groups) {
    const a = agg(rows);
    if (!a) { L.push(`| ${b} | ${kind} | 0/${rows.length} | - | - | - |`); continue; }
    L.push(`| ${b} | ${kind} | ${a.n}/${a.tot} | ${a.right.map((x) => x.toFixed(1)).join(' -> ')} | ${a.wrong.map((x) => x.toFixed(0)).join(' -> ')} | ${a.baniS.toFixed(0)} / ${a.copyS.toFixed(0)} |`);
  }
  L.push('');
  L.push('Clips with wrong time from a Bani the app opened (seconds: wrong total / from a Bani / the right pangti from a Bani):');
  for (const c of clips.filter((x) => x.wrong_bani_unit_s > 0).sort((x, y) => y.wrong_bani_unit_s - x.wrong_bani_unit_s)) {
    L.push(`- ${c.id} (${c.folder}): ${c.wrong_s} / ${c.wrong_bani_unit_s} / ${c.wrong_bani_copy_s}${c.examples.length ? `; shown: ${c.examples.map((e) => `${e.text} (${e.s} s)`).join(' | ')}` : ''}`);
  }
  console.log(L.join('\n'));
  if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify({ clips, table: L }, null, 1));
}
main();
