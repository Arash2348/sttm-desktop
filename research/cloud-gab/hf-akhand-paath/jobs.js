#!/usr/bin/env node
// research/cloud-gab/hf-akhand-paath/jobs.js — make Akhand Paath a scored GAB behaviour (owner's P0, Oct 16 2026).
// GAB's 4-akhand-paath folder has 23 recordings but none scores: no row names its replay runner (suite_jobs is empty),
// and every recording with pangti keys (burned-in publisher slides, `broadcast-caption`) sits in the test split, which
// is never published. This script edits manifest.csv:
//   - every 4-akhand-paath row gets `apaath:<id>` in suite_jobs (the Ang-after-Ang runner, akhand-bench.js)
//   - DEV_VIDEOS (4 of the 9 captioned videos, both speeds each) move from test to dev, so the practice split has
//     keyed Akhand Paath to score and tune on; the other 5 videos stay held back as test
// Nothing else changes (self-checked: only suite_jobs / split on those rows, every other byte kept).
//
//   node jobs.js                       dry run against GAB main: prints the rows that change
//   node jobs.js --commit              opens the Hugging Face PR (write token in HF_TOKEN; never printed)
//   node jobs.js --local <manifest>    applies the same edit to a local manifest.csv in place (the VM / a container
//                                      records and scores from it before the PR is merged)
const fs = require('fs');
const REPO = 'khalisfoundation/GurbaniAutopilotBench';
const API = `https://huggingface.co/api/datasets/${REPO}`;
const FOLDER = '4-akhand-paath';
const DEV_VIDEOS = ['PB6nfe3QKn4', '67Z-uUuScfs', '5N6Cgw8WAaY', 'q_dwf8YWdXY']; // 23, 26, 33 and 12 Shabads: the most varied
const H = { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } };
const split = (l) => {
  const v = []; let c = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q && ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(c); c = ''; } else c += ch;
  }
  v.push(c);
  return v;
};
const join = (v) => v.map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',');

function edit(manifest) {
  const [head, ...rows] = manifest.split('\n');
  const k = split(head); const I = (n) => { const i = k.indexOf(n); if (i < 0) throw new Error(`no column ${n}`); return i; };
  const out = [head]; const changed = [];
  for (const l of rows) {
    if (!l.trim()) { out.push(l); continue; }
    const v = split(l);
    if (v[I('content_folder')] !== FOLDER) { out.push(l); continue; }
    const id = v[I('id')]; const before = [v[I('suite_jobs')], v[I('split')]];
    const jobs = v[I('suite_jobs')].split(';').filter(Boolean);
    if (!jobs.some((j) => j.startsWith('apaath:'))) v[I('suite_jobs')] = [...jobs, `apaath:${id}`].join(';');
    if (DEV_VIDEOS.some((vid) => id.startsWith(`ytap_${vid}_`)) && v[I('split')] === 'test') v[I('split')] = 'dev';
    if (v[I('suite_jobs')] !== before[0] || v[I('split')] !== before[1]) { changed.push({ id, jobs: v[I('suite_jobs')], split: v[I('split')] }); out.push(join(v)); } else out.push(l);
  }
  const before = rows.filter((l) => l.trim()).map(split); const after = out.slice(1).filter((l) => l.trim()).map(split);
  if (before.length !== after.length) throw new Error('row count changed');
  before.forEach((b, r) => b.forEach((x, c) => { if (x !== after[r][c] && !(changed.some((ch) => ch.id === b[I('id')]) && (c === I('suite_jobs') || c === I('split')))) throw new Error(`row ${b[0]} column ${k[c]} would change`); }));
  rows.forEach((l, r) => { if (l.trim() && !changed.some((ch) => ch.id === split(l)[I('id')]) && out[r + 1] !== l) throw new Error(`row ${split(l)[0]} re-serialised differently`); });
  return { text: out.join('\n'), changed };
}

(async () => {
  const li = process.argv.indexOf('--local');
  if (li > 0) {
    const f = process.argv[li + 1]; const { text, changed } = edit(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(f, text); console.log(`${f}: ${changed.length} rows changed (${changed.filter((c) => c.split === 'dev').length} now dev)`); return;
  }
  const get = async (u) => { const r = await fetch(u, H); if (!r.ok) throw new Error(`HF ${r.status} ${u.replace(/\?.*/, '')}`); return r; };
  const sha = (await (await get(`${API}/revision/main`)).json()).sha;
  const manifest = await (await get(`https://huggingface.co/datasets/${REPO}/resolve/${sha}/manifest.csv`)).text();
  const { text, changed } = edit(manifest);
  if (!changed.length) throw new Error('nothing to change (already applied?)');
  console.log(`main @ ${sha.slice(0, 12)}: ${changed.length} rows change`);
  for (const c of changed) console.log(`  ${c.id.padEnd(34)} ${c.split.padEnd(4)} ${c.jobs}`);
  if (!process.argv.includes('--commit')) { console.log('dry run (add --commit to open the PR)'); return; }
  const dev = changed.filter((c) => c.split === 'dev').length;
  const nd = [
    { key: 'header', value: { parentCommit: sha, summary: 'Akhand Paath: give its recordings a replay runner; 4 captioned videos join the practice split', description: `Owner's P0 (Oct 16 2026): Akhand Paath becomes a scored GAB behaviour. Every 4-akhand-paath row names its runner (suite_jobs apaath:<id>, akhand-bench.js, Ang after Ang from t=0). ${dev} rows (videos ${DEV_VIDEOS.join(', ')}, both speeds) move from test to dev so the practice split has pangti-keyed Akhand Paath; the other 5 videos stay held back as test. Only suite_jobs and split change, on 4-akhand-paath rows; every other byte of manifest.csv is kept (self-checked). No audio or key changes.` } },
    { key: 'file', value: { path: 'manifest.csv', content: Buffer.from(text).toString('base64'), encoding: 'base64' } },
  ].map((x) => JSON.stringify(x)).join('\n');
  const r = await fetch(`${API}/commit/main?create_pr=1`, { method: 'POST', headers: { ...H.headers, 'Content-Type': 'application/x-ndjson' }, body: nd });
  const t = await r.text(); if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t); console.log(`PR opened: ${j.pullRequestUrl || j.commitUrl || t.slice(0, 200)}`);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
