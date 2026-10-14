/* gab-score.js — the ONE GAB scorecard (Gurbani Autopilot Bench), library for gab.js. See GAB.md.
 *
 * Input: replay outputs (vf-check side dirs: <suite>/trace/<cache id>.events.jsonl) + the benchmark manifest rows.
 * Every clip is scored by sangat-score.js against the benchmark truth (lines.csv / shabads.csv), text-compared:
 *   right Shabad/Bani on screen %   Shabad level: a text of the Shabad/Bani being sung or read is up (% of that time)
 *   sangat sees the right pangti %  line level: ON + catching up within 1 s; human-keyed truth is the headline,
 *                                   aligned truth (forced alignment) is shown apart and never headlined
 *   seconds behind                  line level: new pangti starts -> first on screen (median / p90 s)
 *   wrong Shabad s per hour         Shabad level: seconds a text from another Shabad/Bani is up, per hour sung
 *   time to find                    each truth Shabad/Bani window: window start -> first second it is up
 *                                   (median / p90 s; "not found" = never up in that window)
 * Rows: the four content folders, per-Bani rows under 2-bani-recited and 3-bani-sung-like-kirtan, and an all-folders row.
 * Mic path (gab-micpath.json): mixer-feed vs room-mic per row, and the 50/50 mean of the two (the headline weighting).
 * Deterministic: same traces + same truth -> byte-identical JSON apart from `createdAt` and `timings`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GAB_VERSION = 'GAB v1.0';
const { TOP, canonFolder } = require('./folder-names');
const TOP_TITLE = { '1-kirtan-shabad': 'Kirtan (Shabad)', '2-bani-recited': 'Bani recited (paath)', '3-bani-sung-like-kirtan': 'Bani sung like kirtan', '4-akhand-paath': 'Akhand Paath' };
const MIN_FIND_WINDOW_S = 3; // a truth Shabad window shorter than this is not a "find" (a passing tuk)
const r1 = (x) => (x == null || Number.isNaN(x) ? null : +x.toFixed(1));
const r2 = (x) => (x == null || Number.isNaN(x) ? null : +x.toFixed(2));
const quant = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

// ---------------------------------------------------------------- mic path ----------
function micPathOf(row, cfg) {
  for (const [re, cls, why] of cfg.byGurdwara) if (new RegExp(re, 'i').test(row.gurdwara || '')) return { cls, why };
  const a = cfg.byAcoustics[row.acoustics];
  if (a) return { cls: a, why: `acoustics=${row.acoustics}` };
  return { cls: 'unknown', why: `gurdwara "${row.gurdwara}", acoustics=${row.acoustics || '?'}` };
}
const loadMicCfg = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'gab-micpath.json'), 'utf8'));

// ---------------------------------------------------------------- per clip -----------
// Shabad-level trace (0.1 s steps inside truth windows) -> find times per truth window
function findTimes(trace) {
  const segs = [];
  for (const e of trace) {
    const last = segs[segs.length - 1];
    if (last && last.truth === e.truth && e.t - last.end < 1.0) { last.end = e.t; if (last.first == null && e.b === 'on') last.first = e.t; } else segs.push({ truth: e.truth, start: e.t, end: e.t, first: e.b === 'on' ? e.t : null });
  }
  return segs.filter((s) => s.end - s.start >= MIN_FIND_WINDOW_S).map((s) => ({ truth: s.truth, start: r1(s.start), len: r1(s.end - s.start), find: s.first == null ? null : r1(s.first - s.start) }));
}

function scoreClip(sv, ds, row, eventsFile) {
  const shabadTrace = [];
  const c = sv.scoreClip(ds, row, eventsFile, { shabadTrace, blankIsScored: true });
  return {
    id: row.id, folder: canonFolder(row.content_folder),
    line: c.line && c.line.acc ? { provenance: c.line.provenance, acc: c.line.acc } : { why: c.line && c.line.why },
    shabad: c.shabad && c.shabad.acc ? { provenance: c.shabad.provenance, acc: c.shabad.acc } : { why: c.shabad && c.shabad.why },
    finds: c.shabad && c.shabad.acc ? findTimes(shabadTrace) : [],
  };
}

// ---------------------------------------------------------------- aggregation --------
// headline line truth = human-keyed only (Jaspal's sevadaar screen, ear checks); aligned / broadcast captions are shown apart
const isHuman = (prov) => /^human/.test(String(prov || ''));
function group(sv, clips) {
  const sh = sv.summarize(sv.merge(clips.map((c) => c.shabad.acc).filter(Boolean)));
  const lh = clips.filter((c) => c.line.acc && isHuman(c.line.provenance));
  const la = clips.filter((c) => c.line.acc && !isHuman(c.line.provenance));
  const sH = sv.summarize(sv.merge(lh.map((c) => c.line.acc)));
  const sA = sv.summarize(sv.merge(la.map((c) => c.line.acc)));
  const finds = clips.flatMap((c) => c.finds);
  const found = finds.filter((f) => f.find != null).map((f) => f.find);
  return {
    clips: clips.length,
    audio_min: r1(clips.reduce((a, c) => a + (c.dur || 0), 0) / 60),
    right_shabad_pct: sh ? sh.right_pct : null,
    shabad_scored_min: sh ? r1(sh.voiced_s / 60) : null,
    pangti_human_pct: sH ? sH.right_pct : null, pangti_human_clips: lh.length,
    pangti_aligned_pct: sA ? sA.right_pct : null, pangti_aligned_clips: la.length,
    behind_p50_s: sH ? sH.lag_p50 : null, behind_p90_s: sH ? sH.lag_p90 : null,
    behind_aligned_p50_s: sA ? sA.lag_p50 : null, behind_aligned_p90_s: sA ? sA.lag_p90 : null,
    wrong_s_per_h: sh ? sh.wrong_s_per_h : null,
    blank_pct: sh ? sh.blank_pct : null,
    find_p50_s: r1(quant(found, 0.5)), find_p90_s: r1(quant(found, 0.9)),
    finds: finds.length, not_found: finds.length - found.length,
  };
}
// the metrics a mic split / 50/50 is shown for (all "percent / seconds", averaged 50/50 between mixer-feed and room-mic)
const MIC_METRICS = ['right_shabad_pct', 'pangti_human_pct', 'behind_p50_s', 'wrong_s_per_h', 'find_p50_s'];
function micSplit(sv, clips) {
  const by = {};
  for (const cls of ['mixer-feed', 'room-mic', 'studio', 'unknown']) {
    const cs = clips.filter((c) => c.mic === cls);
    if (cs.length) by[cls] = group(sv, cs);
  }
  const w = {};
  for (const m of MIC_METRICS) {
    const a = by['mixer-feed'] && by['mixer-feed'][m];
    const b = by['room-mic'] && by['room-mic'][m];
    w[m] = a != null && b != null ? r2((a + b) / 2) : null;
    if (a != null && b != null) w[`${m}_basis`] = '50/50';
    else if (a != null || b != null) w[`${m}_basis`] = a != null ? 'mixer-feed only' : 'room-mic only';
  }
  return { ...by, '50/50': w };
}

// rows: all-folders, then each top folder, then its sub folders (per Bani)
function build(sv, clips) {
  const rows = [];
  const push = (key, level, cs) => { if (cs.length) rows.push({ key, level, title: TOP_TITLE[key] || key.split('/').slice(1).join('/'), ...group(sv, cs), mic: micSplit(sv, cs) }); };
  push('all', 'all', clips);
  for (const top of TOP) {
    const cs = clips.filter((c) => c.folder.split('/')[0] === top);
    if (!cs.length) { rows.push({ key: top, level: 'folder', title: TOP_TITLE[top], clips: 0, note: 'no clip of this folder was run (see notRun)' }); continue; }
    push(top, 'folder', cs);
    const subs = [...new Set(cs.map((c) => c.folder).filter((f) => f.includes('/')))].sort();
    for (const sub of subs) push(sub, 'bani', cs.filter((c) => c.folder === sub));
  }
  return rows;
}

// ---------------------------------------------------------------- scorecard ----------
// clips: [{ row, suite, events }]; returns the scorecard object (json)
function scorecard({ sv, ds, clips: runs, meta }) {
  const cfg = loadMicCfg();
  const t0 = Date.now();
  const clips = [];
  const errors = [];
  for (const { row, suite, events } of runs) {
    try {
      const c = scoreClip(sv, ds, row, events);
      const mp = micPathOf(row, cfg);
      clips.push({ ...c, suite, split: row.split, gurdwara: row.gurdwara, mic: mp.cls, dur: Number(row.duration_s) || 0 });
    } catch (e) { errors.push({ id: row.id, error: String(e.message).split('\n')[0] }); }
  }
  clips.sort((a, b) => a.id.localeCompare(b.id));
  const rows = build(sv, clips);
  const micAssumptions = {};
  for (const r of runs) { const mp = micPathOf(r.row, cfg); micAssumptions[r.row.gurdwara] = `${mp.cls} (${mp.why})`; }
  return {
    gab: GAB_VERSION,
    ...meta,
    rows,
    micAssumptions: Object.fromEntries(Object.entries(micAssumptions).sort()),
    clips: clips.map((c) => {
      const s = c.shabad.acc ? sv.summarize(c.shabad.acc) : null;
      const l = c.line.acc ? sv.summarize(c.line.acc) : null;
      const found = c.finds.filter((f) => f.find != null).map((f) => f.find);
      return { id: c.id, folder: c.folder, suite: c.suite, split: c.split, mic: c.mic,
        right_shabad_pct: s ? s.right_pct : null, wrong_s_per_h: s ? s.wrong_s_per_h : null,
        pangti_pct: l ? l.right_pct : null, pangti_truth: l ? c.line.provenance : null, behind_p50_s: l ? l.lag_p50 : null,
        find_p50_s: r1(quant(found, 0.5)), finds: c.finds.length, not_found: c.finds.length - found.length };
    }),
    scoreErrors: errors,
    timings: { ...(meta.timings || {}), score_s: r1((Date.now() - t0) / 1000) },
  };
}

// ---------------------------------------------------------------- markdown -----------
const f = (v, unit = '') => (v == null ? '-' : `${v}${unit}`);
function cells(r) {
  if (!r.clips) return ['-', '-', '-', '-', '-', '-', '-'];
  const pangti = r.pangti_human_pct != null ? `**${r.pangti_human_pct}%** (${r.pangti_human_clips})` : '-';
  const aligned = r.pangti_aligned_pct != null ? `${r.pangti_aligned_pct}% (${r.pangti_aligned_clips})` : '-';
  const behind = r.behind_p50_s != null ? `${r.behind_p50_s} / ${r.behind_p90_s}` : r.behind_aligned_p50_s != null ? `(aligned ${r.behind_aligned_p50_s} / ${r.behind_aligned_p90_s})` : '-';
  const find = r.finds ? `${f(r.find_p50_s)} / ${f(r.find_p90_s)}${r.not_found ? `, ${r.not_found}/${r.finds} not found` : ''}` : '-';
  return [`${r.clips} · ${(r.audio_min / 60).toFixed(1)} h`, f(r.right_shabad_pct, '%'), pangti, aligned, behind, f(r.wrong_s_per_h), find];
}
function markdown(card) {
  const L = [];
  L.push(`## ${card.gab} scorecard — ${card.build.name || card.build.commit || card.build.root}`);
  L.push('');
  L.push(`build \`${card.build.root}\` @ ${card.build.commit || '?'}${card.build.dirty ? ' (uncommitted edits)' : ''} · manifest ${card.manifest.sha} (${card.manifest.rows} rows) · tier **${card.tier}** · split **${card.split}**${card.folders ? ` · folders ${card.folders}` : ''} · ${card.createdAt}`);
  L.push('');
  L.push('| content | clips · audio | right Shabad/Bani on screen | sangat sees the right pangti (human truth) | same, aligned truth (not a headline) | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of card.rows) {
    const name = r.level === 'all' ? '**All folders**' : r.level === 'folder' ? `**${r.title}** \`${r.key}\`` : `&nbsp;&nbsp;${r.title}`;
    L.push(`| ${name} | ${cells(r).join(' | ')} |`);
  }
  L.push('');
  L.push('Mic path (50/50 = mean of mixer feed and room mic; the headline weighting):');
  L.push('');
  L.push('| content | mic path | clips | right Shabad/Bani | right pangti (human) | seconds behind p50 | wrong Shabad s/h | time to find p50 s |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of card.rows.filter((x) => x.level !== 'bani' && x.clips)) {
    for (const cls of ['mixer-feed', 'room-mic', '50/50', 'studio', 'unknown']) {
      const m = r.mic[cls];
      if (!m) continue;
      if (cls === '50/50') {
        if (!MIC_METRICS.some((k) => m[k] != null || m[`${k}_basis`])) continue;
        const v = (k, u = '') => (m[k] != null ? `**${m[k]}${u}**` : m[`${k}_basis`] ? `(${m[`${k}_basis`]})` : '-');
        L.push(`| ${r.key === 'all' ? 'All folders' : r.title} | **50/50** | | ${v('right_shabad_pct', '%')} | ${v('pangti_human_pct', '%')} | ${v('behind_p50_s')} | ${v('wrong_s_per_h')} | ${v('find_p50_s')} |`);
      } else L.push(`| ${r.key === 'all' ? 'All folders' : r.title} | ${cls} | ${m.clips} | ${f(m.right_shabad_pct, '%')} | ${f(m.pangti_human_pct, '%')} | ${f(m.behind_p50_s)} | ${f(m.wrong_s_per_h)} | ${f(m.find_p50_s)} |`);
    }
  }
  L.push('');
  L.push(`Mic path assumptions (gab-micpath.json): ${Object.entries(card.micAssumptions).map(([g, a]) => `${g} = ${a.split(' (')[0]}`).join('; ')}.`);
  if (card.notRun && card.notRun.length) {
    const by = {};
    for (const n of card.notRun) (by[n.why] = by[n.why] || []).push(n.id);
    L.push('');
    L.push(`Not run (${card.notRun.length}): ${Object.entries(by).map(([why, ids]) => `${why}: ${ids.length > 6 ? `${ids.slice(0, 6).join(', ')} +${ids.length - 6}` : ids.join(', ')}`).join('; ')}.`);
  }
  if (card.scoreErrors && card.scoreErrors.length) L.push(`\nScoring errors: ${card.scoreErrors.map((e) => `${e.id}: ${e.error}`).join('; ')}`);
  const t = card.timings || {};
  L.push('');
  L.push(`Timing: total ${f(t.total_s)} s (replay ${f(t.replay_s)} s, scoring ${f(t.score_s)} s), ${t.clip_runs ?? '?'} clip runs, ${t.reused ?? '?'} reused; load average ${t.load ?? '?'}.`);
  return L.join('\n');
}

// ---------------------------------------------------------------- compare ------------
// metric -> [direction (+1 higher better), tolerance before a change counts as worse]
const GUARD = {
  right_shabad_pct: [1, 0.1, 'right Shabad/Bani %'],
  pangti_human_pct: [1, 0.1, 'right pangti % (human)'],
  behind_p50_s: [-1, 0.05, 'seconds behind p50'],
  behind_p90_s: [-1, 0.1, 'seconds behind p90'],
  wrong_s_per_h: [-1, 1, 'wrong Shabad s/h'],
  find_p50_s: [-1, 0.2, 'time to find p50 s'],
  not_found: [-1, 0, 'not found'],
};
const INFO = { pangti_aligned_pct: [1, 0.1, 'right pangti % (aligned, info)'], behind_aligned_p50_s: [-1, 0.05, 'seconds behind p50 (aligned, info)'], find_p90_s: [-1, 0.2, 'time to find p90 s (info)'] };
function compare(A, B) {
  const out = { gab: GAB_VERSION, a: A.build, b: B.build, manifest: [A.manifest.sha, B.manifest.sha], tier: A.tier, split: A.split, rows: [], pass: true, worse: [], better: [] };
  if (A.manifest.sha !== B.manifest.sha) out.warning = 'the two scorecards used different manifests';
  const byKey = (card) => new Map(card.rows.map((r) => [r.key, r]));
  const ma = byKey(A);
  const mb = byKey(B);
  const judge = (key, scope, a, b, spec, guarded) => {
    for (const [m, [dir, tol, label]] of Object.entries(spec)) {
      const x = a ? a[m] : null;
      const y = b ? b[m] : null;
      if (x == null && y == null) continue;
      let verdict = 'same';
      if (x == null || y == null) verdict = 'n/a';
      else if (Math.abs(y - x) < 1e-9) verdict = 'same';
      else if (dir * (y - x) > tol) verdict = 'better';
      else if (dir * (y - x) < -tol) verdict = guarded ? 'WORSE' : 'worse (info)';
      else verdict = 'within tolerance';
      const rec = { key, scope, metric: label, a: x, b: y, verdict };
      out.rows.push(rec);
      if (verdict === 'WORSE') { out.pass = false; out.worse.push(rec); }
      if (verdict === 'better') out.better.push(rec);
    }
  };
  for (const [key, ra] of ma) {
    const rb = mb.get(key);
    if (!ra.clips && !(rb && rb.clips)) continue;
    // guarded: all-folders + top folders, each mic path's 50/50 and its two halves; per-Bani rows are shown but informational
    const guarded = ra.level !== 'bani';
    judge(key, 'all clips', ra, rb, GUARD, guarded);
    judge(key, 'all clips', ra, rb, INFO, false);
    for (const cls of ['mixer-feed', 'room-mic', '50/50']) {
      const xa = ra.mic && ra.mic[cls];
      const xb = rb && rb.mic && rb.mic[cls];
      if (!xa && !xb) continue;
      const spec = Object.fromEntries(MIC_METRICS.map((m) => [m, GUARD[m]]));
      judge(key, cls, xa, xb, spec, guarded);
    }
  }
  return out;
}
function compareMarkdown(c, A, B) {
  const L = [];
  L.push(`## ${c.gab} compare — A: ${A.build.name || A.build.commit} vs B: ${B.build.name || B.build.commit}`);
  L.push('');
  L.push(`A \`${A.build.root}\` @ ${A.build.commit}${A.build.dirty ? ' (dirty)' : ''} · B \`${B.build.root}\` @ ${B.build.commit}${B.build.dirty ? ' (dirty)' : ''} · manifest ${c.manifest[0]} · tier ${c.tier} · split ${c.split}${c.warning ? ` · WARNING: ${c.warning}` : ''}`);
  L.push('');
  L.push('| content | scope | metric | A | B | verdict |');
  L.push('|---|---|---|---|---|---|');
  const title = (k) => (k === 'all' ? 'All folders' : TOP_TITLE[k] || k);
  const nSame = c.rows.filter((r) => r.verdict === 'same' || r.verdict === 'n/a').length;
  for (const r of c.rows) {
    if (r.verdict === 'same' || r.verdict === 'n/a') continue;
    L.push(`| ${title(r.key)} | ${r.scope} | ${r.metric} | ${f(r.a)} | ${f(r.b)} | ${r.verdict === 'WORSE' ? '**WORSE**' : r.verdict === 'better' ? '**better**' : r.verdict} |`);
  }
  L.push(`| (${nSame} more metric cells unchanged) | | | | | |`);
  L.push('');
  L.push(`GUARDRAILS: ${c.pass ? 'PASS (no guarded metric worse)' : `FAIL (${c.worse.length} worse: ${c.worse.map((w) => `${title(w.key)} ${w.scope} ${w.metric} ${w.a} -> ${w.b}`).join('; ')})`} · ${c.better.length} better`);
  L.push('Guarded = all folders + each content folder, all clips and per mic path (mixer feed, room mic, 50/50); per-Bani rows and aligned-truth rows are information only. Tolerances: right % 0.1 pt, seconds behind 0.05 s (p50) / 0.1 s (p90), wrong s/h 1, time to find 0.2 s, not found 0.');
  return L.join('\n');
}

const manifestSha = (text) => sha1(text).slice(0, 12);
module.exports = { GAB_VERSION, TOP, scorecard, markdown, compare, compareMarkdown, micPathOf, loadMicCfg, manifestSha, findTimes, GUARD };
