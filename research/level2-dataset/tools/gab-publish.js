/* gab-publish.js — gab publish <main scorecard.json> --hard <hard scorecard.json> --name "<build name>" [--status merged|candidate]
 *                               [--note "..."] [--order N] [--base <commit>] [--preview <dir>] [--dry-run] [--allow-dirty] [--site-only] [--reconcile <reconcile.json>]
 *                 gab publish --batch <batch.json> [--preview <dir>] [--dry-run]
 *                               batch.json = [{ "main": "<file>", "hard": "<file>", "name", "status", "order", "base", "note" }, ...]:
 *                               every build in one commit per repo (use it when the GAB version changes: all rows re-scored)
 *
 * Tiers: a build's result holds the main GAB rows (`rows`) and the GAB-Hard rows (`hard.rows`), each from its own
 * scorecard (gab run --set main / --set hard of the same commit). Each tier gets its own "vs base" verdict (`vs`,
 * `hard.vs`); a main scorecard is never accepted in the hard slot or the other way round, and tiers are never mixed.
 *
 * Publishes one build's GAB result to the leaderboard Space khalisfoundation/GAB-leaderboard (private, static, free):
 *   results/<slug>.json   the build's rows (behaviours, Banis, named sets; no per-clip detail), build name, commit,
 *                         Voice-Follow feature version, GAB version, split, tier, date, status
 *   results/index.json    the list the page loads (an entry with the same slug is replaced)
 *   index.html, about.html, README.md, reconcile.json (from tools/gab-space/; --reconcile <file> overrides the last)
 * and keeps a short table in the dataset card (khalisfoundation/GurbaniAutopilotBench README.md, only between
 * <!-- GAB-LEADERBOARD:START --> / <!-- GAB-LEADERBOARD:END -->; the rest of the card is never touched), plus the full
 * scorecard under scores/gab/<slug>/ in the dataset. The Space reads only its own files: no token, no secret.
 * Refused: a test-split scorecard (the test split is never published), a GAB version other than this tool's, a build
 * with uncommitted edits (unless --allow-dirty). A behaviour with clips the replay could not finish from the cache
 * (they need new speech-model windows) is published as "incomplete", without numbers.
 * One commit per repo (huggingface_hub; token from ~/.vf-hf-token, never printed, never uploaded).
 * Every publish recomputes each row's "vs base" verdict (gab compare's guardrails): a candidate against --base <commit>
 * (required for a candidate), a merged build against the merged build before it (by --order).
 * --preview <dir>: write the Space as it would be into <dir> (to serve locally), push nothing.
 * --site-only: push the page files (and --reconcile) and the recomputed verdicts only, no new result. --replace <slug>: the new row takes the place of
 * that earlier row (its results file is deleted), e.g. a candidate that has since been merged.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./gab-score');

const DATASET = 'khalisfoundation/GurbaniAutopilotBench';
const SPACE = 'khalisfoundation/GAB-leaderboard';
const SPACE_URL = `https://huggingface.co/spaces/${SPACE}`;
const SITE = path.join(__dirname, 'gab-space');
const START = '<!-- GAB-LEADERBOARD:START -->';
const END = '<!-- GAB-LEADERBOARD:END -->';
const UV = fs.existsSync(path.join(os.homedir(), '.local/bin/uv')) ? path.join(os.homedir(), '.local/bin/uv') : 'uv';
const token = () => process.env.HF_TOKEN || fs.readFileSync(path.join(os.homedir(), '.vf-hf-token'), 'utf8').trim();

async function hfText(kind, repo, file) {
  const r = await fetch(`https://huggingface.co/${kind === 'space' ? 'spaces/' : 'datasets/'}${repo}/resolve/main/${file}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HF ${r.status} reading ${repo}/${file}`);
  return r.text();
}

// scorecard -> the compact result the page shows
const KEEP = ['key', 'level', 'title', 'note', 'clips', 'hours', 'sessions', 'right_shabad_pct', 'shabad_clips', 'wrong_s_per_h', 'blank_pct', 'pangti_pct', 'pangti_near_pct', 'pangti_basis', 'pangti_clips', 'pangti_never_shown',
  'behind_p50_s', 'behind_p90_s', 'behind_n', 'lines', 'find_p50_s', 'find_p90_s', 'find_n', 'find_cold_n', 'not_found', 'switch_p50_s', 'switch_p90_s', 'switch_n', 'switch_missed',
  'switch_within10_n', 'switch_later_n', 'stayed_main_n', 'parmaan_n', 'parmaan_shown', 'thin'];
function tierRows(card) {
  const cacheMiss = (card.notRun || []).filter((n) => /left the cache|not in the local or Azure cache/.test(n.why));
  return card.rows.filter((r) => r.level !== 'all').map((r) => {
    const o = Object.fromEntries(KEEP.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));
    if (r.mic) o.mic = Object.fromEntries(Object.entries(r.mic).map(([cls, m]) => [cls, m]));
    const scope = r.level === 'set' ? (G.loadSets().sets.find((x) => x.key === r.key) || {}).folder : r.key;
    const miss = scope ? cacheMiss.filter((n) => n.folder === scope || n.folder.startsWith(`${scope}/`)) : [];
    if (miss.length) return { key: r.key, level: r.level, title: r.title, clips: 0, incomplete: miss.length, note: `incomplete: ${miss.length} clips need speech-model windows that are not in the cache yet (gab fill), so this build has no comparable number here` };
    return o;
  });
}
const notRunOf = (card) => (card.notRun || []).map((n) => ({ id: n.id.split('_')[0], why: n.why }));
function checkCard(card, want, allowDirty) {
  if (card.gab !== G.GAB_VERSION) throw new Error(`scorecard is ${card.gab}, this tool publishes ${G.GAB_VERSION}`);
  if ((card.set || 'pre-tier') !== want) throw new Error(`the ${want} slot needs a --set ${want} scorecard (got ${card.set || 'a pre-tier scorecard'}); tiers are never mixed`);
  if (/^test/.test(card.split) || /test/.test(card.split.split(' ')[0])) throw new Error('test-split numbers are never published (GAB.md, split rule)');
  if (card.build.dirty && !allowDirty) throw new Error('the build had uncommitted edits; commit them and re-run gab (or pass --allow-dirty)');
}
function resultOf(card, hardCard, { name, status, note, order, base }) {
  if (hardCard && hardCard.build.commit !== card.build.commit) throw new Error(`main and hard scorecards are different builds (${card.build.commit} vs ${hardCard.build.commit})`);
  return {
    gab: card.gab, name, status, note: note || null, order: order ?? null, base: base || null,
    commit: card.build.commit, vf_feature_version: card.build.featureVersion || null, subject: card.build.subject || null,
    split: card.split.split(' ')[0], tier: card.tier, date: card.createdAt.slice(0, 10), manifest: card.manifest.sha,
    set: 'main', set_title: card.setTitle || G.tierTitle('main'),
    not_run: notRunOf(card),
    rows: tierRows(card),
    hard: hardCard ? { set: 'hard', set_title: hardCard.setTitle || G.tierTitle('hard'), manifest: hardCard.manifest.sha, split: hardCard.split.split(' ')[0], tier: hardCard.tier, not_run: notRunOf(hardCard), rows: tierRows(hardCard) } : null,
  };
}
// "vs its base" verdict for every row, with gab compare's guardrail logic (G.compare): a candidate against the build it
// was made from (--base <commit>), a merged build against the merged build before it (by order). Recomputed for every
// result on every publish, so a new or re-scored build never leaves a stale verdict.
// one tier of a result as a scorecard for G.compare (main: res.rows; hard: res.hard.rows)
const part = (res, set) => (set === 'hard' ? res.hard : res);
const asCard = (res, set = 'main') => ({ set, build: { name: res.name, commit: res.commit }, manifest: { sha: part(res, set).manifest }, tier: part(res, set).tier, split: part(res, set).split, rows: part(res, set).rows });
const TITLE = { '1-kirtan-shabad': 'Kirtan', '2-bani-recited': 'Bani recited', '3-bani-sung-like-kirtan': 'Bani sung', '4-akhand-paath': 'Akhand Paath' };
function verdicts(all) {
  for (const set of ['main', 'hard']) verdictsFor(all.filter((r) => part(r, set)), set);
  return all;
}
function verdictsFor(all, set) {
  const put = (res, vs) => { part(res, set).vs = vs; };
  const byOrder = [...all].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.date.localeCompare(b.date));
  for (const res of all) {
    let ref = null;
    let kind = null;
    if (res.status === 'merged') {
      ref = byOrder.filter((x) => x.status === 'merged' && (x.order ?? 99) < (res.order ?? 99)).pop() || null;
      kind = 'previous merged build';
    } else if (res.base) {
      ref = all.find((x) => x !== res && String(x.commit).startsWith(String(res.base).slice(0, 8))) || null;
      kind = 'its base';
    }
    if (!ref) { put(res, res.status === 'merged' ? { kind: 'first merged build', against: null } : { kind: 'its base', against: res.base || null, missing: true }); continue; }
    const c = G.compare(asCard(ref, set), asCard(res, set));
    const pick = (r) => ({ row: r.key, title: TITLE[r.key] || (r.key.startsWith('set:') ? r.key.slice(4) : r.key), scope: r.scope, metric: r.metric, a: r.a, b: r.b });
    // information-only named clip sets of earlier reports (L2-41, Aarti-50, ...) that got worse are listed too, apart
    const LINE_M = /sangat sees the right pangti|seconds behind/;
    const rowIn = (x, key) => part(x, set).rows.find((r) => r.key === key);
    const infoWorse = c.rows.filter((r) => r.verdict === 'worse (info)' && r.scope === 'all clips' && r.key.startsWith('set:') && !/\(info\)/.test(r.metric)
      && (!LINE_M.test(r.metric) || (lineShown(rowIn(ref, r.key)) && lineShown(rowIn(res, r.key)))));
    const incomplete = part(res, set).rows.filter((r) => r.level === 'behaviour' && r.incomplete && part(ref, set).rows.some((x) => x.key === r.key && x.clips)).map((r) => TITLE[r.key] || r.key);
    put(res, { kind, against: ref.name, against_commit: ref.commit, pass: c.pass, worse: c.worse.map(pick), better_n: c.better.length, info_worse: infoWorse.map(pick), not_compared: incomplete });
  }
}
const slugOf = (name, commit) => `${name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}-${String(commit).slice(0, 8)}`;

// the short table in the dataset card: one line per build, a few headline numbers per behaviour
// a line number is a headline only on human or ear-checked line answers and at least THIN clips
const lineShown = (r) => r && r.pangti_pct != null && r.pangti_basis !== 'aligned' && r.pangti_clips >= G.THIN;
function section(entries) {
  const cell = (rows, key, k, u = '') => { const r = (rows || []).find((x) => x.key === key); return r && r.clips && r[k] != null ? `${r[k]}${u}` : r && r.incomplete ? 'incomplete' : '-'; };
  const line = (rows, key) => { const r = (rows || []).find((x) => x.key === key); return lineShown(r) ? `${r.pangti_pct}% / ${r.pangti_near_pct}%` : 'no line answers'; };
  const lines = entries.map((e) => `| ${e.name}${e.status === 'merged' ? '' : ' (candidate)'} | ${e.commit} | ${e.vf_feature_version || '-'} | ${cell(e.rows, '1-kirtan-shabad', 'right_shabad_pct', '%')} | ${cell(e.rows, '1-kirtan-shabad', 'wrong_s_per_h')} | ${cell(e.rows, '2-bani-recited', 'right_shabad_pct', '%')} | ${cell(e.rows, '3-bani-sung-like-kirtan', 'right_shabad_pct', '%')} | ${e.hard ? cell(e.hard.rows, '1-kirtan-shabad', 'right_shabad_pct', '%') : '-'} | ${e.hard ? line(e.hard.rows, '1-kirtan-shabad') : '-'} |`);
  return [START, '## Leaderboard', '',
    `The leaderboard lives in the private Space [${SPACE}](${SPACE_URL}) (how to read it is on its About tab). A short copy, ${G.GAB_VERSION}, practice split (train + dev; the test split is never published). Higher is better for the % columns, lower for wrong seconds per hour. Main GAB (the priority) is everything except the Fremont hall laptop-mic recordings; those are GAB-Hard, tracked apart (resonant hall, laptop mic far from the ragis, little clean audio). Main kirtan has no line-by-line answers yet, so it is right Shabad only; the GAB-Hard pangti column is strict / same or neighbouring pangti, on the sevadaar's screen as the answer key.`, '',
    '| Build | Commit | Voice-Follow | Kirtan: right Shabad | Kirtan: wrong Shabad s/h | Bani recited: right Bani | Bani sung: right Bani | GAB-Hard kirtan: right Shabad | GAB-Hard kirtan: pangti strict / neighbouring |',
    '|---|---|---|---|---|---|---|---|---|', ...lines, '', END].join('\n');
}

function push(repo, type, ops, msg, S) {
  const py = `
import os, sys, json
from huggingface_hub import HfApi, CommitOperationAdd, CommitOperationDelete
api = HfApi(token=os.environ['HF_TOKEN'])
repo, typ, msg, s = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
ops = [CommitOperationAdd(dst, os.path.join(s, src)) if src else CommitOperationDelete(dst) for dst, src in json.load(open(os.path.join(s, 'ops.json')))]
api.create_commit(repo_id=repo, repo_type=typ, operations=ops, commit_message=msg)
print('committed', len(ops), 'files to', repo)
`;
  fs.writeFileSync(path.join(S, 'push.py'), py);
  fs.writeFileSync(path.join(S, 'ops.json'), JSON.stringify(ops));
  return execFileSync(UV, ['run', '-q', '--no-project', '--with', 'huggingface_hub', 'python', '-I', path.join(S, 'push.py'), repo, type, msg, S], { encoding: 'utf8', env: { ...process.env, HF_TOKEN: token() } }).trim();
}

async function main(args) {
  const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
  const dry = args.includes('--dry-run');
  const siteOnly = args.includes('--site-only');
  const allowDirty = args.includes('--allow-dirty');
  const S = fs.mkdtempSync(path.join(os.tmpdir(), 'gab-publish-'));
  try {
    const spaceOps = [];
    for (const f of ['index.html', 'about.html', 'README.md']) { fs.copyFileSync(path.join(SITE, f), path.join(S, `site-${f}`)); spaceOps.push([f, `site-${f}`]); }
    const rec = opt('reconcile') || path.join(SITE, 'reconcile.json');
    if (fs.existsSync(rec)) { fs.copyFileSync(rec, path.join(S, 'reconcile.json')); spaceOps.push(['reconcile.json', 'reconcile.json']); }
    let msg = 'GAB leaderboard: page files';
    // the builds to publish now: [{ res, slug, card, hardCard }] (one, or a --batch)
    const pub = [];
    const readCard = (f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
    const addOne = (o) => {
      const card = readCard(o.main);
      checkCard(card, 'main', allowDirty);
      if (!o.hard) throw new Error(`${o.name}: every build needs its GAB-Hard scorecard too (--hard <gab run --set hard scorecard.json>)`);
      const hardCard = readCard(o.hard);
      checkCard(hardCard, 'hard', allowDirty);
      const status = (o.status || 'merged') === 'merged' ? 'merged' : 'candidate, not merged';
      if (status !== 'merged' && !o.base) throw new Error(`${o.name}: a candidate needs --base <commit of the build it was made from> (its "vs base" verdict)`);
      const res = resultOf(card, hardCard, { name: o.name.replace(/\|/g, '/'), status, note: o.note, order: o.order != null ? Number(o.order) : null, base: o.base });
      pub.push({ res, slug: slugOf(o.name, card.build.commit), card, hardCard, files: o });
    };
    if (opt('batch')) for (const o of JSON.parse(fs.readFileSync(opt('batch'), 'utf8'))) addOne(o);
    else if (!siteOnly) {
      const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json') && a !== opt('reconcile') && a !== opt('hard'));
      if (!file || !opt('name')) throw new Error('gab publish <main scorecard.json> --hard <hard scorecard.json> --name "<build name>" [--status merged|candidate]   (or --batch <batch.json>)');
      addOne({ main: file, hard: opt('hard'), name: opt('name'), status: opt('status'), order: opt('order'), base: opt('base'), note: opt('note') });
    }
    const prev = JSON.parse(await hfText('space', SPACE, 'results/index.json') || '{"results":[]}');
    // --replace <slug>: the new result takes the place of an earlier row (a candidate that has since been merged)
    const gone = (opt('replace') || '').split(',').filter(Boolean);
    for (const g of gone) { const e = prev.results.find((x) => x.slug === g); if (!e) throw new Error(`--replace ${g}: no such row`); spaceOps.push([`results/${e.file}`, null]); }
    const slugs = new Set(pub.map((p) => p.slug));
    const index = { results: [...prev.results.filter((x) => !slugs.has(x.slug) && !gone.includes(x.slug)), ...pub.map((p) => ({ slug: p.slug, file: `${p.slug}.json`, name: p.res.name, commit: p.res.commit, date: p.res.date, order: p.res.order }))] };
    for (const p of pub) console.log(`row: ${p.res.name} | ${p.res.status} | ${p.res.commit} | Voice-Follow ${p.res.vf_feature_version || 'not stamped'} | ${p.res.gab} | ${p.res.split} ${p.res.tier} | ${p.res.date} | main ${p.card.rows.filter((r) => r.level === 'behaviour').reduce((a, r) => a + (r.clips || 0), 0)} clips, hard ${p.hardCard.rows.filter((r) => r.level === 'behaviour').reduce((a, r) => a + (r.clips || 0), 0)} clips`);
    if (pub.length) msg = pub.length === 1 ? `GAB leaderboard: ${pub[0].res.name} (${pub[0].res.commit}, ${pub[0].res.split}, ${pub[0].res.tier}, main + hard)` : `GAB leaderboard: ${G.GAB_VERSION}, ${pub.length} builds re-scored (main GAB + GAB-Hard)`;
    fs.writeFileSync(path.join(S, 'index.json'), JSON.stringify(index, null, 1));
    spaceOps.push(['results/index.json', 'index.json']);
    // every result (read fresh), with its "vs base" verdicts recomputed per tier; each results file is rewritten.
    // A kept result of another GAB version (or without a GAB-Hard part) would be compared across versions: refused.
    const all = [];
    for (const e of index.results) {
      const p = pub.find((x) => x.slug === e.slug);
      const res = p ? p.res : JSON.parse(await hfText('space', SPACE, `results/${e.file}`));
      if (res.gab !== G.GAB_VERSION || !res.hard) throw new Error(`results/${e.file} is ${res.gab}${res.hard ? '' : ' without GAB-Hard'}: re-score every build and publish them together with --batch`);
      all.push(res);
    }
    verdicts(all);
    index.results.forEach((e, i) => { fs.writeFileSync(path.join(S, `result-${i}.json`), JSON.stringify(all[i], null, 1)); spaceOps.push([`results/${e.file}`, `result-${i}.json`]); });
    const sorted = [...all].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.date.localeCompare(b.date));
    const vsText = (v) => (v && v.against ? `${v.against}: ${v.pass ? 'PASS' : `FAIL (${v.worse.map((w) => `${w.title} ${w.scope} ${w.metric} ${w.a} -> ${w.b}`).join('; ')})`}${v.info_worse && v.info_worse.length ? ` | info rows worse: ${v.info_worse.map((w) => `${w.title} ${w.metric} ${w.a} -> ${w.b}`).join('; ')}` : ''}` : '-');
    for (const r of sorted) console.log(`${r.name}\n   main vs ${r.vs.kind}: ${vsText(r.vs)}\n   hard vs ${r.hard.vs.kind}: ${vsText(r.hard.vs)}`);
    // --preview <dir>: write the Space as it would be (page files + results) into <dir> and stop (nothing pushed)
    if (opt('preview')) {
      const P = path.resolve(opt('preview'));
      fs.mkdirSync(path.join(P, 'results'), { recursive: true });
      for (const [dst, src] of spaceOps) if (src) fs.copyFileSync(path.join(S, src), path.join(P, dst));
      console.log(`preview written to ${P}`);
      return;
    }
    if (dry) { console.log(`dry run: would commit ${spaceOps.map((o) => o[0]).join(', ')} to ${SPACE}${pub.length ? ` and the Leaderboard section (if its numbers changed) + scores/gab/<slug>/ for ${pub.length} builds to ${DATASET}` : ''}`); return; }
    console.log(push(SPACE, 'space', spaceOps, msg, S));
    if (!pub.length) return;
    // dataset card: rebuild the short table from every published result, only between the markers; left alone when
    // its numbers did not change. Full scorecards (main + hard) under scores/gab/<slug>/ (added or replaced, never deleted).
    const readme = await hfText('dataset', DATASET, 'README.md');
    if (!readme) throw new Error('could not read README.md from the dataset');
    const newReadme = readme.includes(START)
      ? readme.slice(0, readme.indexOf(START)) + section(sorted) + readme.slice(readme.indexOf(END) + END.length)
      : `${readme.replace(/\s*$/, '')}\n\n${section(sorted)}\n`;
    fs.writeFileSync(path.join(S, 'README.md'), newReadme);
    fs.writeFileSync(path.join(S, 'LEADERBOARD.md'), `# GAB leaderboard\n\nThe leaderboard moved to the private Space [${SPACE}](${SPACE_URL}) (Oct 14 2026; now ${G.GAB_VERSION}: main GAB + GAB-Hard). The GAB v1.0 rows that were here are retired: their kirtan line number counted recordings where nothing was ever shown as 0%, their find time was measured from a window that opened mid-Shabad (so mostly 0 s), and the headline mixed behaviours. Full scorecards per build: scores/gab/.\n`);
    const dsOps = [];
    pub.forEach((p, i) => {
      fs.copyFileSync(path.resolve(p.files.main), path.join(S, `sc-${i}.json`));
      fs.writeFileSync(path.join(S, `sc-${i}.md`), `${G.markdown(p.card)}\n`);
      fs.copyFileSync(path.resolve(p.files.hard), path.join(S, `sch-${i}.json`));
      fs.writeFileSync(path.join(S, `sch-${i}.md`), `${G.markdown(p.hardCard)}\n`);
      dsOps.push([`scores/gab/${p.slug}/scorecard.json`, `sc-${i}.json`], [`scores/gab/${p.slug}/scorecard.md`, `sc-${i}.md`], [`scores/gab/${p.slug}/scorecard-hard.json`, `sch-${i}.json`], [`scores/gab/${p.slug}/scorecard-hard.md`, `sch-${i}.md`]);
    });
    if (newReadme !== readme) dsOps.push(['README.md', 'README.md'], ['LEADERBOARD.md', 'LEADERBOARD.md']);
    else console.log('dataset card: Leaderboard section unchanged, not touched');
    console.log(push(DATASET, 'dataset', dsOps, msg, S));
    console.log(`published: ${SPACE_URL} (${pub.length} results) and the dataset card's Leaderboard section`);
  } finally { fs.rmSync(S, { recursive: true, force: true }); }
}

module.exports = { main, resultOf, section, verdicts, slugOf, lineShown };
