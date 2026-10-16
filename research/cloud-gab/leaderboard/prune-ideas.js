#!/usr/bin/env node
// prune-ideas.js — the leaderboard shows the app's versions plus the ideas still under evaluation; a dropped idea
// comes off (owner, Oct 16 2026). Opens one Space PR that removes the given rows (their results file and index
// entry) and, with --page, also ships this folder's index.html (the Akhand Paath column).
//   node prune-ideas.js <slug-or-label-regex>... [--page] [--commit]
const fs = require('fs');
const path = require('path');
const SPACE = 'khalisfoundation/GAB-leaderboard';
const API = `https://huggingface.co/api/spaces/${SPACE}`;
const H = { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } };
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const commit = process.argv.includes('--commit'); const page = process.argv.includes('--page');
(async () => {
  const get = async (u) => { const r = await fetch(u, H); if (!r.ok) throw new Error(`HF ${r.status} ${u.replace(/\?.*/, '')}`); return r; };
  const sha = (await (await get(`${API}/revision/main`)).json()).sha;
  const idx = JSON.parse(await (await get(`https://huggingface.co/spaces/${SPACE}/resolve/${sha}/results/index.json`)).text());
  const drop = idx.results.filter((r) => args.some((a) => new RegExp(a, 'i').test(`${r.slug} ${r.label || ''} ${r.name || ''}`)));
  if (!drop.length && !page) throw new Error('no row matches');
  const keep = { ...idx, results: idx.results.filter((r) => !drop.includes(r)) };
  console.log(`main @ ${sha.slice(0, 12)}: dropping ${drop.map((r) => `${r.slug} (${r.label || r.name})`).join(', ')}; ${keep.results.length} rows stay${page ? '; page from this folder' : ''}`);
  if (!commit) { console.log('dry run (add --commit to open the PR)'); return; }
  const ops = [
    { key: 'header', value: { parentCommit: sha, summary: drop.length ? `Leaderboard: drop ${drop.length} idea row(s) no longer under evaluation${page ? '; page update' : ''}` : 'Leaderboard page update', description: `${drop.length ? `Removed: ${drop.map((r) => r.label || r.name || r.slug).join(', ')} (superseded by later work; the owner keeps only live ideas on the board). ` : ''}${page ? (process.env.PAGE_NOTE || 'index.html from research/cloud-gab/leaderboard on the sttm-desktop fork.') : ''}` } },
    { key: 'file', value: { path: 'results/index.json', content: Buffer.from(JSON.stringify(keep, null, 1)).toString('base64'), encoding: 'base64' } },
    ...drop.map((r) => ({ key: 'deletedFile', value: { path: `results/${r.file}` } })),
    ...(page ? [{ key: 'file', value: { path: 'index.html', content: fs.readFileSync(path.join(__dirname, 'index.html')).toString('base64'), encoding: 'base64' } }] : []),
  ].map((x) => JSON.stringify(x)).join('\n');
  const r = await fetch(`${API}/commit/main?create_pr=1`, { method: 'POST', headers: { ...H.headers, 'Content-Type': 'application/x-ndjson' }, body: ops });
  const t = await r.text(); if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t); console.log(`PR opened: ${j.pullRequestUrl || j.commitUrl || t.slice(0, 200)}`);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
