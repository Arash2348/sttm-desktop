/* gab-score.js — the ONE GAB scorecard (Gurbani Autopilot Bench), library for gab.js. See GAB.md.
 *
 * GAB v1.1 (Oct 14 2026; v1.0 numbers are not comparable, see GAB.md "v1.0 -> v1.1").
 * Input: replay outputs (vf-check side dirs: <suite>/trace/<cache id>.events.jsonl) + the benchmark manifest rows.
 * Every clip is scored by sangat-score.js against the benchmark truth (lines.csv / shabads.csv), text-compared.
 * Rows: one per behaviour (the four content folders), the Banis under them, and the named clip sets of earlier
 * reports (gab-sets.json). Per row:
 *   right Shabad/Bani %      Shabad level, human truth: % of the voiced time a text of the Shabad/Bani being sung or
 *                            read is on screen (ON; the Shabad-level sangat view)
 *   sangat sees the pangti % line level: ON + CATCHING UP (< 1 s into a new pangti) of the voiced time, on the best
 *                            line truth the row has: human > aligned + ear-checked > aligned (the basis is printed).
 *                            Only clips where the app put something on screen count (as kirtan-score); clips with
 *                            line truth where nothing was ever shown are counted apart ("never shown"): their loss is
 *                            already in right Shabad % and "not found".
 *   seconds behind p50/p90   line level, same truth basis: a new pangti starts -> first on screen
 *   wrong Shabad s/h         Shabad level: seconds a text from another Shabad/Bani is up, per hour voiced
 *   find p50/p90 (n)         the first Shabad/Bani of each clip: from t=0 when the clip was cut from inside a
 *                            performance (cold start: the app is started while it is sung), else from its start;
 *                            "not found" = never shown inside its window
 *   switch                   every later Shabad/Bani that differs from the one before it, from its start, when the
 *                            screen showed something else as it began: found within 10 s / later / never, p50/p90 over
 *                            found; a return to a main Shabad the screen never left = 'stayed on main' (counted apart);
 *                            parmaans (a Shabad quoted inside another) also counted shown / not shown
 *   coverage                 clips, hours, and the n behind each number; fewer than 3 = "thin" (flagged)
 * Mic path (gab-micpath.json): mixer-feed vs room-mic per row, and their 50/50 mean, as a second view.
 * Deterministic: same traces + same truth -> byte-identical JSON apart from `createdAt` and `timings`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GAB_VERSION = 'GAB v1.1';
const { TOP, canonFolder } = require('./folder-names');
const TOP_TITLE = { '1-kirtan-shabad': 'Kirtan of a Shabad', '2-bani-recited': 'Bani recited (paath)', '3-bani-sung-like-kirtan': 'Bani sung like kirtan', '4-akhand-paath': 'Akhand Paath (Ang after Ang)' };
const THIN = 3;
const r1 = (x) => (x == null || Number.isNaN(x) ? null : +x.toFixed(1));
const r2 = (x) => (x == null || Number.isNaN(x) ? null : +x.toFixed(2));
const quant = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const loadSets = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'gab-sets.json'), 'utf8'));

// ---------------------------------------------------------------- mic path ----------
function micPathOf(row, cfg) {
  for (const [re, cls, why, acoustics] of cfg.byGurdwara) if (new RegExp(re, 'i').test(row.gurdwara || '') && (!acoustics || acoustics === row.acoustics)) return { cls, why };
  const a = cfg.byAcoustics[row.acoustics];
  if (a) return { cls: a, why: `acoustics=${row.acoustics}` };
  return { cls: 'unknown', why: `gurdwara "${row.gurdwara}", acoustics=${row.acoustics || '?'}` };
}
const loadMicCfg = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'gab-micpath.json'), 'utf8'));

// ---------------------------------------------------------------- per clip -----------
// line truth basis: human (lines_source human: sevadaar screen, tapping) > aligned + ear-checked > aligned
const BASES = ['human', 'aligned+ear-checked', 'aligned'];
const BASIS_TITLE = { human: 'human', 'aligned+ear-checked': 'aligned, ear-checked', aligned: 'aligned (our own aligner, unaudited)' };
function basisOf(linesSource, audit) {
  if (/^human/.test(String(linesSource || ''))) return 'human';
  if (audit && audit.confirmed) return 'aligned+ear-checked';
  return 'aligned';
}
function scoreClip(sv, ds, row, eventsFile, suite, sets) {
  const c = sv.scoreClip(ds, row, eventsFile, {});
  const lineTruth = !!(c.truth && c.truth.linesSource);
  const basis = lineTruth ? basisOf(c.truth.linesSource, c.truth.audit) : null;
  const events = sv.findEvents(ds, row, eventsFile, { coldFirst: !!sets.coldFirst[suite] });
  return {
    id: row.id, folder: canonFolder(row.content_folder),
    line: c.line && c.line.acc ? { basis, acc: c.line.acc, audit: c.truth.audit || null } : { why: c.line && c.line.why, basis },
    neverShown: lineTruth && !(c.line && c.line.acc),
    shabad: c.shabad && c.shabad.acc ? { provenance: c.shabad.provenance, acc: c.shabad.acc } : { why: c.shabad && c.shabad.why },
    events,
  };
}

// ---------------------------------------------------------------- aggregation --------
function lineGroup(sv, clips, basis) {
  const withTruth = clips.filter((c) => c.line.basis === basis);
  const scored = withTruth.filter((c) => c.line.acc);
  const s = sv.summarize(sv.merge(scored.map((c) => c.line.acc)));
  if (!withTruth.length) return null;
  const audit = scored.reduce((a, c) => { const x = c.line.audit; if (x) for (const k of Object.keys(a)) a[k] += x[k] || 0; return a; }, { checked: 0, confirmed: 0, unsure: 0, rejected: 0 });
  return { basis, pct: s ? s.right_pct : null, clips: scored.length, never_shown: withTruth.length - scored.length, voiced_min: s ? r1(s.voiced_s / 60) : 0,
    behind_p50_s: s ? s.lag_p50 : null, behind_p90_s: s ? s.lag_p90 : null, behind_n: s ? s.lines - s.lines_missed : 0, lines_missed: s ? s.lines_missed : 0,
    audit: audit.checked ? audit : null };
}
function group(sv, clips) {
  const sh = sv.summarize(sv.merge(clips.map((c) => c.shabad.acc).filter(Boolean)));
  const lines = BASES.map((b) => lineGroup(sv, clips, b)).filter(Boolean);
  const head = lines.find((g) => g.clips) || lines[0] || null;
  const ev = clips.flatMap((c) => c.events);
  const finds = ev.filter((e) => e.kind === 'cold' || e.kind === 'begins');
  // a parmaan (a Shabad quoted inside another) is its own count, not a switch
  const sw = ev.filter((e) => e.kind === 'switch' && !e.parmaan);
  const pm = ev.filter((e) => e.kind === 'switch' && e.parmaan);
  const ok = (a) => a.filter((e) => e.find != null).map((e) => e.find);
  const hours = clips.reduce((a, c) => a + (c.dur || 0), 0) / 3600;
  const g = {
    clips: clips.length, hours: r2(hours), sessions: new Set(clips.map((c) => c.session || c.id)).size,
    right_shabad_pct: sh ? sh.right_pct : null, shabad_clips: clips.filter((c) => c.shabad.acc).length, shabad_voiced_min: sh ? r1(sh.voiced_s / 60) : null,
    wrong_s_per_h: sh ? sh.wrong_s_per_h : null, blank_pct: sh ? sh.blank_pct : null,
    // headline line metrics on the best basis present; every basis kept in `lines`
    pangti_pct: head ? head.pct : null, pangti_basis: head ? head.basis : null, pangti_clips: head ? head.clips : 0, pangti_never_shown: head ? head.never_shown : 0,
    behind_p50_s: head ? head.behind_p50_s : null, behind_p90_s: head ? head.behind_p90_s : null, behind_n: head ? head.behind_n : 0,
    lines,
    find_p50_s: r1(quant(ok(finds), 0.5)), find_p90_s: r1(quant(ok(finds), 0.9)), find_n: finds.length, not_found: finds.length - ok(finds).length,
    find_cold_n: finds.filter((e) => e.kind === 'cold').length,
    // switches: only events where the screen showed something else when the new Shabad/Bani began (returns to a
    // main Shabad the screen never left are 'stayed', counted apart); found within 10 s / later / never; p50 over found
    switch_p50_s: r1(quant(ok(sw), 0.5)), switch_p90_s: r1(quant(ok(sw), 0.9)), switch_n: sw.length, switch_missed: sw.length - ok(sw).length,
    switch_within10_n: ok(sw).filter((x) => x <= 10).length, switch_later_n: ok(sw).filter((x) => x > 10).length,
    stayed_main_n: ev.filter((e) => e.kind === 'stayed').length,
    parmaan_n: pm.length, parmaan_shown: ok(pm).length,
  };
  g.thin = ['pangti_clips', 'find_n', 'switch_n'].filter((k) => g[k] > 0 && g[k] < THIN).concat(g.clips < THIN ? ['clips'] : []);
  return g;
}
// the metrics a mic split / 50/50 is shown for (averaged 50/50 between mixer-feed and room-mic)
const MIC_METRICS = ['right_shabad_pct', 'pangti_pct', 'behind_p50_s', 'wrong_s_per_h', 'find_p50_s'];
function micSplit(sv, clips) {
  const by = {};
  for (const cls of ['mixer-feed', 'room-mic', 'studio', 'unknown']) {
    const cs = clips.filter((c) => c.mic === cls);
    if (cs.length) { const g = group(sv, cs); by[cls] = Object.fromEntries(['clips', 'hours', ...MIC_METRICS, 'pangti_basis', 'pangti_clips', 'find_n'].map((k) => [k, g[k]])); }
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

const setMatch = (s, c) => (!s.suite || (c.suiteJobs || '').split(';').some((j) => j.startsWith(`${s.suite}:`))) && (!s.folder || c.folder === s.folder || c.folder.startsWith(`${s.folder}/`)) && (!s.split || c.split === s.split);
// rows: each behaviour (top folder), its Banis (incl. expected ones with no clip), the named sets, and all folders
function build(sv, clips, sets) {
  const rows = [];
  const push = (key, level, title, cs, extra = {}) => { rows.push({ key, level, title, ...(cs.length ? { ...group(sv, cs), mic: micSplit(sv, cs) } : { clips: 0 }), ...extra }); };
  for (const top of TOP) {
    const cs = clips.filter((c) => c.folder.split('/')[0] === top);
    push(top, 'behaviour', TOP_TITLE[top], cs, cs.length ? {} : { note: top === '4-akhand-paath' ? 'no runner yet: the Sehaj Paath clips have the Shabads of each Ang in order but no times, and GAB has no replay suite for them' : 'no clip of this behaviour was run' });
    const subs = [...new Set([...cs.map((c) => c.folder).filter((f) => f.includes('/')), ...(sets.expectBanis[top] || []).map((b) => `${top}/${b}`)])].sort();
    for (const sub of subs) { const x = cs.filter((c) => c.folder === sub); push(sub, 'bani', sub.split('/').slice(1).join('/'), x, x.length ? {} : { note: 'no clips yet in this split' }); }
  }
  for (const s of sets.sets) { const x = clips.filter((c) => setMatch(s, c)); if (x.length) push(s.key, 'set', s.title, x); }
  push('all', 'all', 'All behaviours together (mixed; not a headline)', clips);
  return rows;
}

// ---------------------------------------------------------------- scorecard ----------
// clips: [{ row, suite, events }]; returns the scorecard object (json)
function scorecard({ sv, ds, clips: runs, meta }) {
  const cfg = loadMicCfg();
  const sets = loadSets();
  const t0 = Date.now();
  const clips = [];
  const errors = [];
  for (const { row, suite, events } of runs) {
    try {
      const c = scoreClip(sv, ds, row, events, suite, sets);
      const mp = micPathOf(row, cfg);
      clips.push({ ...c, suite, suiteJobs: row.suite_jobs, split: row.split, session: row.session || null, gurdwara: row.gurdwara, mic: mp.cls, dur: Number(row.duration_s) || 0 });
    } catch (e) { errors.push({ id: row.id, error: String(e.message).split('\n')[0] }); }
  }
  clips.sort((a, b) => a.id.localeCompare(b.id));
  const rows = build(sv, clips, sets);
  const micAssumptions = {};
  for (const r of runs) { const mp = micPathOf(r.row, cfg); micAssumptions[`${r.row.gurdwara} [${r.row.acoustics}]`] = `${mp.cls} (${mp.why})`; }
  return {
    gab: GAB_VERSION,
    ...meta,
    rows,
    micAssumptions: Object.fromEntries(Object.entries(micAssumptions).sort()),
    clips: clips.map((c) => {
      const s = c.shabad.acc ? sv.summarize(c.shabad.acc) : null;
      const l = c.line.acc ? sv.summarize(c.line.acc) : null;
      return { id: c.id, folder: c.folder, suite: c.suite, split: c.split, mic: c.mic, hours: r2(c.dur / 3600),
        right_shabad_pct: s ? s.right_pct : null, wrong_s_per_h: s ? s.wrong_s_per_h : null,
        pangti_pct: l ? l.right_pct : null, pangti_basis: c.line.basis || null, never_shown: c.neverShown, behind_p50_s: l ? l.lag_p50 : null,
        audit: c.line.audit || null, events: c.events };
    }),
    scoreErrors: errors,
    timings: { ...(meta.timings || {}), score_s: r1((Date.now() - t0) / 1000) },
  };
}

// ---------------------------------------------------------------- markdown -----------
const f = (v, unit = '') => (v == null ? '-' : `${v}${unit}`);
const thin = (r, k) => (r.thin && r.thin.includes(k) ? ' (thin)' : '');
function cellsOf(r) {
  if (!r.clips) return [r.note || '-', '', '', '', '', '', ''];
  const basis = r.pangti_basis ? BASIS_TITLE[r.pangti_basis] : null;
  const head = r.lines && r.lines.find((g) => g.basis === r.pangti_basis);
  const audit = head && head.audit ? `; ear check ${head.audit.confirmed} of ${head.audit.checked} line starts confirmed${head.audit.unsure ? `, ${head.audit.unsure} unsure` : ''}${head.audit.rejected ? `, ${head.audit.rejected} rejected (not scored)` : ''}` : '';
  const pangti = r.pangti_pct != null ? `${r.pangti_basis === 'aligned' ? '' : '**'}${r.pangti_pct}%${r.pangti_basis === 'aligned' ? '' : '**'} (${basis}; ${r.pangti_clips} clips${r.pangti_never_shown ? `, +${r.pangti_never_shown} never shown` : ''}${audit})${thin(r, 'pangti_clips')}` : r.pangti_never_shown ? `- (${r.pangti_never_shown} clips with line truth, nothing ever shown)` : '- (no line truth)';
  const behind = r.behind_p50_s != null ? `${r.behind_p50_s} / ${r.behind_p90_s} (${r.behind_n} pangtis, ${basis})` : '-';
  const find = r.find_n ? `${f(r.find_p50_s)} / ${f(r.find_p90_s)} (n ${r.find_n}${r.find_cold_n ? `, ${r.find_cold_n} cold` : ''}${r.not_found ? `, ${r.not_found} not found` : ''})${thin(r, 'find_n')}` : '-';
  const stayed = r.stayed_main_n ? `; ${r.stayed_main_n} stayed on main Shabad` : '';
  const pm = r.parmaan_n ? `; parmaan shown ${r.parmaan_shown} of ${r.parmaan_n}` : '';
  const sw = r.switch_n ? `${r.switch_within10_n ?? '-'} within 10 s / ${r.switch_later_n ?? '-'} later / ${r.switch_missed} never (n ${r.switch_n}); p50 ${f(r.switch_p50_s)} s over found${stayed}${pm}${thin(r, 'switch_n')}` : `- (no switch in these clips${stayed}${pm})`;
  return [`${r.clips} · ${r.hours} h${thin(r, 'clips')}`, `${f(r.right_shabad_pct, '%')}`, pangti, behind, f(r.wrong_s_per_h), find, sw];
}
function markdown(card) {
  const L = [];
  L.push(`## ${card.gab} scorecard — ${card.build.name || card.build.commit || card.build.root}`);
  L.push('');
  L.push(`build \`${card.build.root}\` @ ${card.build.commit || '?'}${card.build.dirty ? ' (uncommitted edits)' : ''}${card.build.featureVersion ? ` · Voice-Follow ${card.build.featureVersion}` : ''} · manifest ${card.manifest.sha} (${card.manifest.rows} rows) · tier **${card.tier}** · split **${card.split}**${card.folders ? ` · folders ${card.folders}` : ''} · ${card.createdAt}`);
  L.push('');
  L.push('| behaviour | clips · audio | right Shabad/Bani on screen (human truth) | sangat sees the right pangti (truth basis; coverage) | seconds behind p50 / p90 | wrong Shabad s per hour | time to find p50 / p90 s | switch: found within 10 s / later / never; p50 |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of card.rows.filter((x) => x.level === 'behaviour' || x.level === 'bani')) {
    const name = r.level === 'behaviour' ? `**${r.title}**` : `&nbsp;&nbsp;${r.title}`;
    L.push(`| ${name} | ${cellsOf(r).join(' | ')} |`);
  }
  L.push('');
  L.push('Named clip sets of earlier reports (so an old number can be checked on its own clips):');
  L.push('');
  L.push('| set | clips · audio | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 / p90 | wrong s/h | find p50 / p90 s | switch: within 10 s / later / never; p50 |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of card.rows.filter((x) => x.level === 'set' || x.level === 'all')) L.push(`| ${r.title} | ${cellsOf(r).join(' | ')} |`);
  L.push('');
  L.push('Mic path, second view (50/50 = mean of mixer feed and room mic):');
  L.push('');
  L.push('| behaviour | mic path | clips | right Shabad/Bani | sangat sees the right pangti | seconds behind p50 | wrong Shabad s/h | find p50 s |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of card.rows.filter((x) => x.level === 'behaviour' && x.clips)) {
    for (const cls of ['mixer-feed', 'room-mic', '50/50', 'studio', 'unknown']) {
      const m = r.mic[cls];
      if (!m) continue;
      if (cls === '50/50') {
        if (!MIC_METRICS.some((k) => m[k] != null)) continue;
        const v = (k, u = '') => (m[k] != null ? `**${m[k]}${u}**` : m[`${k}_basis`] ? `(${m[`${k}_basis`]})` : '-');
        L.push(`| ${r.title} | **50/50** | | ${v('right_shabad_pct', '%')} | ${v('pangti_pct', '%')} | ${v('behind_p50_s')} | ${v('wrong_s_per_h')} | ${v('find_p50_s')} |`);
      } else L.push(`| ${r.title} | ${cls} | ${m.clips} | ${f(m.right_shabad_pct, '%')} | ${m.pangti_pct != null ? `${m.pangti_pct}% (${BASIS_TITLE[m.pangti_basis]}, ${m.pangti_clips})` : '-'} | ${f(m.behind_p50_s)} | ${f(m.wrong_s_per_h)} | ${f(m.find_p50_s)} |`);
    }
  }
  L.push('');
  L.push(`Mic path assumptions (gab-micpath.json): ${Object.entries(card.micAssumptions).map(([g, a]) => `${g} = ${a.split(' (')[0]}`).join('; ')}.`);
  L.push('');
  L.push('How to read: right Shabad/Bani % and wrong s/h rest on human answer keys for every clip. Sangat-sees-pangti % and seconds behind need line-level answer keys; their basis is printed (human = the sevadaar\'s screen or a person; aligned, ear-checked = made by our aligner and spot-checked by ear; aligned = made by our aligner only, not a headline). Find = first Shabad/Bani of a clip ("cold" = the app was started while it was being sung, timed from t=0); switch = a later, different Shabad/Bani, timed from its start, counted only when the screen showed something else when it began (a return to the main Shabad after a parmaan that the screen never left is "stayed on main Shabad", correct, not a switch); p50 is over found switches only, so read it with "never"; a parmaan is also counted as shown / not shown. (thin) = fewer than 3 clips or events behind the number.');
  if (card.notRun && card.notRun.length) {
    const by = {};
    for (const n of card.notRun) (by[n.why] = by[n.why] || []).push(n.id);
    L.push('');
    L.push(`Not run (${card.notRun.length}): ${Object.entries(by).map(([why, ids]) => `${why}: ${ids.length > 8 ? `${ids.slice(0, 8).map((i) => i.split('_')[0]).join(', ')} +${ids.length - 8}` : ids.map((i) => i.split('_')[0]).join(', ')}`).join('; ')}.`);
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
  pangti_pct: [1, 0.1, 'sangat sees the right pangti %'],
  behind_p50_s: [-1, 0.05, 'seconds behind p50'],
  behind_p90_s: [-1, 0.1, 'seconds behind p90'],
  wrong_s_per_h: [-1, 1, 'wrong Shabad s/h'],
  find_p50_s: [-1, 0.2, 'time to find p50 s'],
  not_found: [-1, 0, 'not found'],
  switch_p50_s: [-1, 0.2, 'switch time p50 s'],
  switch_missed: [-1, 0, 'switches never found'],
  switch_within10_n: [1, 0, 'switches found within 10 s'],
};
const INFO = { find_p90_s: [-1, 0.2, 'time to find p90 s (info)'], switch_p90_s: [-1, 0.2, 'switch time p90 s (info)'], pangti_never_shown: [-1, 0, 'line-truth clips never shown (info)'], parmaan_shown: [1, 0, 'parmaans shown (info)'] };
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
    // guarded: each behaviour, all clips and per mic path; per-Bani rows, sets and the mixed all-row are information
    const guarded = ra.level === 'behaviour';
    judge(key, 'all clips', ra, rb, GUARD, guarded);
    judge(key, 'all clips', ra, rb, INFO, false);
    for (const cls of ['mixer-feed', 'room-mic', '50/50']) {
      const xa = ra.mic && ra.mic[cls];
      const xb = rb && rb.mic && rb.mic[cls];
      if (!xa && !xb) continue;
      judge(key, cls, xa, xb, Object.fromEntries(MIC_METRICS.map((m) => [m, GUARD[m]])), guarded);
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
  L.push('| row | scope | metric | A | B | verdict |');
  L.push('|---|---|---|---|---|---|');
  const title = (k) => (k === 'all' ? 'All behaviours' : TOP_TITLE[k] || k);
  const nSame = c.rows.filter((r) => r.verdict === 'same' || r.verdict === 'n/a').length;
  for (const r of c.rows) {
    if (r.verdict === 'same' || r.verdict === 'n/a') continue;
    L.push(`| ${title(r.key)} | ${r.scope} | ${r.metric} | ${f(r.a)} | ${f(r.b)} | ${r.verdict === 'WORSE' ? '**WORSE**' : r.verdict === 'better' ? '**better**' : r.verdict} |`);
  }
  L.push(`| (${nSame} more metric cells unchanged) | | | | | |`);
  L.push('');
  L.push(`GUARDRAILS: ${c.pass ? 'PASS (no guarded metric worse)' : `FAIL (${c.worse.length} worse: ${c.worse.map((w) => `${title(w.key)} ${w.scope} ${w.metric} ${w.a} -> ${w.b}`).join('; ')})`} · ${c.better.length} better`);
  L.push('Guarded = each behaviour, all clips and per mic path (mixer feed, room mic, 50/50); per-Bani rows, named sets and the mixed all-behaviours row are information only. Tolerances: right % 0.1 pt, seconds behind 0.05 s (p50) / 0.1 s (p90), wrong s/h 1, find / switch time 0.2 s, not found / switches never found / switches found within 10 s 0.');
  return L.join('\n');
}

const manifestSha = (text) => sha1(text).slice(0, 12);
module.exports = { GAB_VERSION, TOP, TOP_TITLE, BASIS_TITLE, scorecard, markdown, compare, compareMarkdown, micPathOf, loadMicCfg, loadSets, manifestSha, GUARD, THIN };
