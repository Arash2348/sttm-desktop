/* gab-publish.js — gab publish <scorecard.json> --name "<build name>" [--dry-run] [--allow-dirty]
 *
 * Adds one row per build to the leaderboard on the Hugging Face dataset page (khalisfoundation/GurbaniAutopilotBench):
 *   README.md  a short plain-language "Leaderboard" section (one table, one row per build) between
 *              <!-- GAB-LEADERBOARD:START --> / <!-- GAB-LEADERBOARD:END --> (added at the end the first time);
 *              the rest of the card is never touched. The README is read fresh right before the commit.
 *   LEADERBOARD.md  the same rows with the tier / split / manifest / commit detail
 *   scores/gab/<date>-<slug>/scorecard.{json,md}  the full scorecard
 * One commit (huggingface_hub, token from ~/.vf-hf-token, never printed). A scorecard of a build with uncommitted
 * edits is refused unless --allow-dirty. A test-split scorecard is marked "held-out test" in its row.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./gab-score');

const REPO = 'khalisfoundation/GurbaniAutopilotBench';
const START = '<!-- GAB-LEADERBOARD:START -->';
const END = '<!-- GAB-LEADERBOARD:END -->';
const UV = fs.existsSync(path.join(os.homedir(), '.local/bin/uv')) ? path.join(os.homedir(), '.local/bin/uv') : 'uv';
const token = () => process.env.HF_TOKEN || fs.readFileSync(path.join(os.homedir(), '.vf-hf-token'), 'utf8').trim();

async function hfText(file) {
  const r = await fetch(`https://huggingface.co/datasets/${REPO}/resolve/main/${file}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HF ${r.status} reading ${file}`);
  return r.text();
}

// the numbers a row shows: All folders, mic paths 50/50 where both exist (else all clips, marked)
function rowOf(card, name) {
  const all = card.rows.find((r) => r.key === 'all');
  const w = (all.mic && all.mic['50/50']) || {};
  const pick = (k, unit = '') => (w[k] != null ? `${w[k]}${unit}` : all[k] != null ? `${all[k]}${unit}*` : '-');
  const test = /^test/.test(card.split);
  return {
    name, date: card.createdAt.slice(0, 10), commit: card.build.commit, tier: card.tier, split: card.split.split(' ')[0], manifest: card.manifest.sha, test,
    cells: [pick('right_shabad_pct', '%'), pick('pangti_human_pct', '%'), pick('behind_p50_s', ' s'), pick('wrong_s_per_h'), pick('find_p50_s', ' s')],
    clips: all.clips,
  };
}

const HEAD_PLAIN = '| Build | Date | Tested on | Right Shabad or Bani on screen | Sangat sees the right line | Seconds behind the singer | Seconds of wrong Shabad per hour | Seconds to find a new Shabad |\n|---|---|---|---|---|---|---|---|';
const plainLine = (r) => `| ${r.name} | ${r.date} | ${r.test ? 'held-out test set' : 'practice set'} (${r.tier}, ${r.clips} clips) | ${r.cells.join(' | ')} |`;
const HEAD_FULL = '| build | date | commit | tier | split | manifest | clips | right Shabad/Bani | right pangti (human) | seconds behind p50 | wrong Shabad s/h | time to find p50 | scorecard |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
const fullLine = (r, dir) => `| ${r.name} | ${r.date} | ${r.commit} | ${r.tier} | ${r.split} | ${r.manifest} | ${r.clips} | ${r.cells.join(' | ')} | [scorecard](${dir}/scorecard.md) |`;

function section(rows) {
  return [START, '## Leaderboard', '',
    'Each row is one version of the app, tested on the same recordings. Higher is better for the first two numbers; lower is better for the last three. Numbers average the two kinds of microphone setup equally (mixer feed and a microphone in the hall); a * means only one kind was in the test.', '',
    HEAD_PLAIN, ...rows, '', END].join('\n');
}

async function main(args) {
  const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
  const i = args.indexOf('--name');
  const name = i >= 0 ? args[i + 1] : null;
  if (!file || !name) throw new Error('gab publish <scorecard.json> --name "<build name>"');
  const card = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (card.gab !== G.GAB_VERSION) throw new Error(`scorecard is ${card.gab}, this tool publishes ${G.GAB_VERSION}`);
  if (card.build.dirty && !args.includes('--allow-dirty')) throw new Error('the build had uncommitted edits; commit them and re-run gab (or pass --allow-dirty)');
  const r = rowOf(card, name.replace(/\|/g, '/'));
  const slug = `${r.date}-${name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')}-${r.tier}-${r.split.replace(/,/g, '+')}`;
  const dir = `scores/gab/${slug}`;
  // read fresh, modify only our section
  const readme = await hfText('README.md');
  if (!readme) throw new Error('could not read README.md from the dataset');
  const prevPlain = readme.includes(START) ? readme.slice(readme.indexOf(START), readme.indexOf(END)).split('\n').filter((l) => /^\| (?!Build \||---)/.test(l)) : [];
  const newReadme = readme.includes(START)
    ? readme.slice(0, readme.indexOf(START)) + section([...prevPlain, plainLine(r)]) + readme.slice(readme.indexOf(END) + END.length)
    : `${readme.replace(/\s*$/, '')}\n\n${section([plainLine(r)])}\n`;
  const lb = await hfText('LEADERBOARD.md');
  const prevFull = lb ? lb.split('\n').filter((l) => /^\| (?!build \||---)/.test(l)) : [];
  const newLb = `# GAB leaderboard (detail)\n\n${G.GAB_VERSION}. One row per published scorecard; the plain table is on the dataset card. Values: All folders, mixer feed and room mic averaged 50/50 (* = only one mic path present, all clips). How to read and reproduce: tools/GAB.md.\n\n${HEAD_FULL}\n${[...prevFull, fullLine(r, dir)].join('\n')}\n`;
  const S = fs.mkdtempSync(path.join(os.tmpdir(), 'gab-publish-'));
  try {
    fs.writeFileSync(path.join(S, 'README.md'), newReadme);
    fs.writeFileSync(path.join(S, 'LEADERBOARD.md'), newLb);
    fs.copyFileSync(file, path.join(S, 'scorecard.json'));
    fs.writeFileSync(path.join(S, 'scorecard.md'), `${G.markdown(card)}\n`);
    console.log(`row: ${plainLine(r)}`);
    if (args.includes('--dry-run')) { console.log(`dry run: would commit README.md (Leaderboard section only), LEADERBOARD.md and ${dir}/ to ${REPO}`); return; }
    const py = `
import os, sys
from huggingface_hub import HfApi, CommitOperationAdd
api = HfApi(token=os.environ['HF_TOKEN'])
s, d, msg = sys.argv[1], sys.argv[2], sys.argv[3]
ops = [CommitOperationAdd('README.md', f'{s}/README.md'), CommitOperationAdd('LEADERBOARD.md', f'{s}/LEADERBOARD.md'),
       CommitOperationAdd(f'{d}/scorecard.json', f'{s}/scorecard.json'), CommitOperationAdd(f'{d}/scorecard.md', f'{s}/scorecard.md')]
api.create_commit(repo_id='${REPO}', repo_type='dataset', operations=ops, commit_message=msg)
print('committed')
`;
    fs.writeFileSync(path.join(S, 'push.py'), py);
    console.log(execFileSync(UV, ['run', '-q', '--no-project', '--with', 'huggingface_hub', 'python', '-I', path.join(S, 'push.py'), S, dir, `GAB leaderboard: ${name} (${r.tier}, ${r.split})`], { encoding: 'utf8', env: { ...process.env, HF_TOKEN: token() } }).trim());
    console.log(`published to https://huggingface.co/datasets/${REPO} (Leaderboard section + LEADERBOARD.md + ${dir}/)`);
  } finally { fs.rmSync(S, { recursive: true, force: true }); }
}

module.exports = { main, rowOf };
