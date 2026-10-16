#!/usr/bin/env node
// keys-pr.js — GAB PR: pangti keys and Shabad windows for the Akhand Paath recordings whose truth was only a Shabad
// sequence (sp01-03), from lines/apaath-keys.js (two-model whole-clip alignment). Per recording: lines.csv = the sure
// pangti starts (both models within 1 s, words heard), labelled aligned-2model-audited like the rest of GAB's keys;
// shabads.csv = the Shabads actually read inside the clip, windowed first-to-last pangti (the rest of the sequence
// lies outside the 10-minute cut). manifest.csv: lines_n, lines_source, shabads_n of those rows only (self-checked).
//   node keys-pr.js            dry run      node keys-pr.js --commit   opens the PR (write token in HF_TOKEN)
const fs = require('fs');
const path = require('path');
const REPO = 'khalisfoundation/GurbaniAutopilotBench';
const API = `https://huggingface.co/api/datasets/${REPO}`;
const KEYS = process.env.KEYS || '/home/user/gab/lines/keys/4-akhand-paath';
const IDS = ['sp01_FGWBnA3nIOI_60-660', 'sp02_n-xzrmDTrqY_60-660', 'sp03_06tOxT1xYu0_60-660'];
const H = { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } };
const split = (l) => { const v = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q && ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(c); c = ''; } else c += ch; } v.push(c); return v; };
const join = (v) => v.map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',');
(async () => {
  const get = async (u) => { const r = await fetch(u, H); if (!r.ok) throw new Error(`HF ${r.status} ${u.replace(/\?.*/, '')}`); return r; };
  const sha = (await (await get(`${API}/revision/main`)).json()).sha;
  const manifest = await (await get(`https://huggingface.co/datasets/${REPO}/resolve/${sha}/manifest.csv`)).text();
  const files = []; const counts = {};
  for (const id of IDS) {
    const [lh, ...lrows] = fs.readFileSync(path.join(KEYS, id, 'lines.csv'), 'utf8').trim().split('\n');
    const sure = lrows.filter((r) => r.endsWith(',aligned-2model-sure')).map((r) => r.replace(/,aligned-2model-sure$/, ',aligned-2model-audited'));
    const [sh, ...srows] = fs.readFileSync(path.join(KEYS, id, 'shabads.csv'), 'utf8').trim().split('\n');
    const windowed = srows.filter((r) => !/^\d+,,,/.test(r));
    if (sure.length < 20 || !windowed.length) throw new Error(`${id}: too few keys (${sure.length} sure, ${windowed.length} Shabads)`);
    files.push({ path: `4-akhand-paath/${id}/lines.csv`, content: [lh, ...sure].join('\n') + '\n' });
    files.push({ path: `4-akhand-paath/${id}/shabads.csv`, content: [sh, ...windowed].join('\n') + '\n' });
    counts[id] = { lines: sure.length, shabads: windowed.length };
  }
  const [head, ...rows] = manifest.split('\n'); const k = split(head); const I = (n) => { const i = k.indexOf(n); if (i < 0) throw new Error(`no column ${n}`); return i; };
  const out = [head]; const changed = [];
  for (const l of rows) {
    if (!l.trim()) { out.push(l); continue; }
    const v = split(l); const id = v[I('id')];
    if (!counts[id]) { out.push(l); continue; }
    v[I('lines_n')] = String(counts[id].lines); v[I('lines_source')] = 'aligned-2model-audited'; v[I('shabads_n')] = String(counts[id].shabads);
    changed.push(id); out.push(join(v));
  }
  const before = rows.filter((l) => l.trim()).map(split); const after = out.slice(1).filter((l) => l.trim()).map(split);
  if (before.length !== after.length) throw new Error('row count changed');
  before.forEach((b, r) => b.forEach((x, c) => { if (x !== after[r][c] && !(changed.includes(b[I('id')]) && [I('lines_n'), I('lines_source'), I('shabads_n')].includes(c))) throw new Error(`row ${b[0]} column ${k[c]} would change`); }));
  rows.forEach((l, r) => { if (l.trim() && !changed.includes(split(l)[I('id')]) && out[r + 1] !== l) throw new Error(`row ${split(l)[0]} re-serialised differently`); });
  if (changed.length !== IDS.length) throw new Error(`manifest rows found: ${changed.length}`);
  files.push({ path: 'manifest.csv', content: out.join('\n') });
  console.log(`main @ ${sha.slice(0, 12)}: ${JSON.stringify(counts)}`);
  if (!process.argv.includes('--commit')) { console.log('dry run (add --commit to open the PR)'); return; }
  const nd = [{ key: 'header', value: { parentCommit: sha, summary: 'Akhand Paath sp01-03: pangti keys and Shabad windows (two-model aligned, audited rule)', description: `The three Akhand Paath recordings whose truth was only the sequence of Shabads read (onsets unknown) get pangti keys from whole-clip forced alignment with two speech models (the app's karansea int8 and surindersinghssj pa-v3-kirtan), kept only where both models put the pangti within 1 s and the heard words match (check >= 0.5): ${IDS.map((id) => `${id.split('_')[0]} ${counts[id].lines} pangtis / ${counts[id].shabads} Shabads`).join(', ')}. shabads.csv keeps the Shabads read inside the 10-minute cut, windowed first-to-last pangti. manifest.csv changes lines_n, lines_source and shabads_n on those three rows only. Same rule as GAB's other aligned-2model-audited keys (97% right pangti against GAB-Hard's human keys; owner spot check 20 of 20).` } }, ...files.map((f) => ({ key: 'file', value: { path: f.path, content: Buffer.from(f.content).toString('base64'), encoding: 'base64' } }))].map((x) => JSON.stringify(x)).join('\n');
  const r = await fetch(`${API}/commit/main?create_pr=1`, { method: 'POST', headers: { ...H.headers, 'Content-Type': 'application/x-ndjson' }, body: nd });
  const t = await r.text(); if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t); console.log(`PR opened: ${j.pullRequestUrl || j.commitUrl || t.slice(0, 200)}`);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
