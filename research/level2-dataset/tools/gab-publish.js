/* gab-publish.js — gab publish <scorecard.json> --name "<build name>" [--status merged|candidate] [--note "..."]
 *                               [--order N] [--dry-run] [--allow-dirty] [--site-only] [--reconcile <reconcile.json>]
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
 * --site-only: push the page files (and --reconcile) only, no result.
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
const KEEP = ['key', 'level', 'title', 'note', 'clips', 'hours', 'sessions', 'right_shabad_pct', 'shabad_clips', 'wrong_s_per_h', 'blank_pct', 'pangti_pct', 'pangti_basis', 'pangti_clips', 'pangti_never_shown',
  'behind_p50_s', 'behind_p90_s', 'behind_n', 'lines', 'find_p50_s', 'find_p90_s', 'find_n', 'find_cold_n', 'not_found', 'switch_p50_s', 'switch_p90_s', 'switch_n', 'switch_missed', 'thin'];
function resultOf(card, { name, status, note, order }) {
  const cacheMiss = (card.notRun || []).filter((n) => /left the cache|not in the local or Azure cache/.test(n.why));
  const rows = card.rows.filter((r) => r.level !== 'all').map((r) => {
    const o = Object.fromEntries(KEEP.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));
    if (r.mic) o.mic = Object.fromEntries(Object.entries(r.mic).map(([cls, m]) => [cls, m]));
    const scope = r.level === 'set' ? (G.loadSets().sets.find((x) => x.key === r.key) || {}).folder : r.key;
    const miss = scope ? cacheMiss.filter((n) => n.folder === scope || n.folder.startsWith(`${scope}/`)) : [];
    if (miss.length) return { key: r.key, level: r.level, title: r.title, clips: 0, incomplete: miss.length, note: `incomplete: ${miss.length} clips need speech-model windows that are not in the cache yet (gab fill), so this build has no comparable number here` };
    return o;
  });
  return {
    gab: card.gab, name, status, note: note || null, order: order ?? null,
    commit: card.build.commit, vf_feature_version: card.build.featureVersion || null, subject: card.build.subject || null,
    split: card.split.split(' ')[0], tier: card.tier, date: card.createdAt.slice(0, 10), manifest: card.manifest.sha,
    not_run: (card.notRun || []).map((n) => ({ id: n.id.split('_')[0], why: n.why })),
    rows,
  };
}
const slugOf = (name, commit) => `${name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}-${String(commit).slice(0, 8)}`;

// the short table in the dataset card: one line per build, a few headline numbers per behaviour
function section(entries) {
  const cell = (res, key, k, u = '') => { const r = res.rows.find((x) => x.key === key); return r && r.clips && r[k] != null ? `${r[k]}${u}` : r && r.incomplete ? 'incomplete' : '-'; };
  const lines = entries.map((e) => `| ${e.name}${e.status === 'merged' ? '' : ' (candidate)'} | ${e.commit} | ${e.vf_feature_version || '-'} | ${cell(e, '1-kirtan-shabad', 'right_shabad_pct', '%')} | ${cell(e, '1-kirtan-shabad', 'pangti_pct', '%')} | ${cell(e, '2-bani-recited', 'right_shabad_pct', '%')} | ${cell(e, '3-bani-sung-like-kirtan', 'right_shabad_pct', '%')} | ${cell(e, '1-kirtan-shabad', 'wrong_s_per_h')} |`);
  return [START, '## Leaderboard', '',
    `The leaderboard lives in the private Space [${SPACE}](${SPACE_URL}) (how to read it is on its About tab). A short copy, ${G.GAB_VERSION}, practice split (train + dev; the test split is never published). Higher is better for the % columns, lower for wrong seconds per hour. "Sangat sees the pangti" for kirtan rests only on the Fremont laptop-mic recordings (human answer key = the sevadaar's screen).`, '',
    '| Build | Commit | Voice-Follow | Kirtan: right Shabad | Kirtan: sangat sees the pangti | Bani recited: right Bani | Bani sung: right Bani | Kirtan: wrong Shabad s/h |',
    '|---|---|---|---|---|---|---|---|', ...lines, '', END].join('\n');
}

function push(repo, type, ops, msg, S) {
  const py = `
import os, sys, json
from huggingface_hub import HfApi, CommitOperationAdd
api = HfApi(token=os.environ['HF_TOKEN'])
repo, typ, msg, s = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
ops = [CommitOperationAdd(dst, os.path.join(s, src)) for dst, src in json.load(open(os.path.join(s, 'ops.json')))]
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
  const S = fs.mkdtempSync(path.join(os.tmpdir(), 'gab-publish-'));
  try {
    const spaceOps = [];
    for (const f of ['index.html', 'about.html', 'README.md']) { fs.copyFileSync(path.join(SITE, f), path.join(S, `site-${f}`)); spaceOps.push([f, `site-${f}`]); }
    const rec = opt('reconcile') || path.join(SITE, 'reconcile.json');
    if (fs.existsSync(rec)) { fs.copyFileSync(rec, path.join(S, 'reconcile.json')); spaceOps.push(['reconcile.json', 'reconcile.json']); }
    let msg = 'GAB leaderboard: page files';
    let card = null;
    let res = null;
    let slug = null;
    let index = null;
    if (!siteOnly) {
      const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json') && a !== opt('reconcile'));
      const name = opt('name');
      if (!file || !name) throw new Error('gab publish <scorecard.json> --name "<build name>" [--status merged|candidate]');
      card = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (card.gab !== G.GAB_VERSION) throw new Error(`scorecard is ${card.gab}, this tool publishes ${G.GAB_VERSION}`);
      if (/^test/.test(card.split) || /test/.test(card.split.split(' ')[0])) throw new Error('test-split numbers are never published (GAB.md, split rule)');
      if (card.build.dirty && !args.includes('--allow-dirty')) throw new Error('the build had uncommitted edits; commit them and re-run gab (or pass --allow-dirty)');
      const status = (opt('status') || 'merged') === 'merged' ? 'merged' : 'candidate, not merged';
      res = resultOf(card, { name: name.replace(/\|/g, '/'), status, note: opt('note'), order: opt('order') != null ? Number(opt('order')) : null });
      slug = slugOf(name, card.build.commit);
      fs.writeFileSync(path.join(S, 'result.json'), JSON.stringify(res, null, 1));
      spaceOps.push([`results/${slug}.json`, 'result.json']);
      const prev = JSON.parse(await hfText('space', SPACE, 'results/index.json') || '{"results":[]}');
      index = { results: [...prev.results.filter((x) => x.slug !== slug), { slug, file: `${slug}.json`, name: res.name, commit: res.commit, date: res.date, order: res.order }] };
      fs.writeFileSync(path.join(S, 'index.json'), JSON.stringify(index, null, 1));
      spaceOps.push(['results/index.json', 'index.json']);
      msg = `GAB leaderboard: ${res.name} (${res.commit}, ${res.split}, ${res.tier})`;
      console.log(`row: ${res.name} | ${res.status} | ${res.commit} | Voice-Follow ${res.vf_feature_version || 'not stamped'} | ${res.gab} | ${res.split} ${res.tier} | ${res.date}`);
    }
    if (dry) { console.log(`dry run: would commit ${spaceOps.map((o) => o[0]).join(', ')} to ${SPACE}${siteOnly ? '' : ` and the Leaderboard section + scores/gab/${slug}/ to ${DATASET}`}`); return; }
    console.log(push(SPACE, 'space', spaceOps, msg, S));
    if (siteOnly) return;
    // dataset card: rebuild the short table from every published result (read fresh), only between the markers
    const all = [];
    for (const e of index.results) all.push(e.slug === slug ? res : JSON.parse(await hfText('space', SPACE, `results/${e.file}`)));
    all.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.date.localeCompare(b.date));
    const readme = await hfText('dataset', DATASET, 'README.md');
    if (!readme) throw new Error('could not read README.md from the dataset');
    const newReadme = readme.includes(START)
      ? readme.slice(0, readme.indexOf(START)) + section(all) + readme.slice(readme.indexOf(END) + END.length)
      : `${readme.replace(/\s*$/, '')}\n\n${section(all)}\n`;
    fs.writeFileSync(path.join(S, 'README.md'), newReadme);
    fs.writeFileSync(path.join(S, 'LEADERBOARD.md'), `# GAB leaderboard\n\nThe leaderboard moved to the private Space [${SPACE}](${SPACE_URL}) with ${G.GAB_VERSION} (Oct 14 2026). The ${'GAB v1.0'} rows that were here are retired: their kirtan line number counted recordings where nothing was ever shown as 0%, their find time was measured from a window that opened mid-Shabad (so mostly 0 s), and the headline mixed behaviours. Full scorecards per build: scores/gab/.\n`);
    fs.copyFileSync(path.resolve(args.find((a) => !a.startsWith('--') && a.endsWith('.json') && a !== opt('reconcile'))), path.join(S, 'scorecard.json'));
    fs.writeFileSync(path.join(S, 'scorecard.md'), `${G.markdown(card)}\n`);
    console.log(push(DATASET, 'dataset', [['README.md', 'README.md'], ['LEADERBOARD.md', 'LEADERBOARD.md'], [`scores/gab/${slug}/scorecard.json`, 'scorecard.json'], [`scores/gab/${slug}/scorecard.md`, 'scorecard.md']], msg, S));
    console.log(`published: ${SPACE_URL} (results/${slug}.json) and the dataset card's Leaderboard section`);
  } finally { fs.rmSync(S, { recursive: true, force: true }); }
}

module.exports = { main, resultOf, section };
