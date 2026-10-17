#!/usr/bin/env node
// hf-pr.js <stage dir> [--commit] — open the GAB dataset PR from a staged folder with a contribute-only token:
// binaries (wav, png, csv>10MB) go to LFS storage first (lfs batch API: basic or multipart), then ONE commit with
// create_pr=1 (text files inline, binaries as lfsFile pointers). pr.json = {title, description, changes_rows}; not
// uploaded. Refuses if main's manifest moved (every main row must be in the staged manifest except changes_rows).
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const REPO = 'khalisfoundation/GurbaniAutopilotBench'; const API = `https://huggingface.co/api/datasets/${REPO}`;
const TOK = process.env.HF_TOKEN || fs.readFileSync(path.join(require('os').homedir(), '.vf-hf-token'), 'utf8').trim();
const H = { Authorization: `Bearer ${TOK}` };
const [ST] = process.argv.slice(2); const COMMIT = process.argv.includes('--commit');
const pr = JSON.parse(fs.readFileSync(path.join(ST, 'pr.json')));
const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (path.relative(ST, p) !== 'pr.json') files.push(path.relative(ST, p)); } }; walk(ST);
const isLfs = (f) => /\.(wav|png|mp3|flac)$/i.test(f) || fs.statSync(path.join(ST, f)).size > 5e6;
(async () => {
  const sha = (await (await fetch(`${API}/revision/main`, { headers: H })).json()).sha;
  const main = (await (await fetch(`https://huggingface.co/datasets/${REPO}/resolve/${sha}/manifest.csv`, { headers: H })).text()).split('\n');
  const staged = new Set(fs.readFileSync(path.join(ST, 'manifest.csv'), 'utf8').split('\n'));
  const missing = main.filter((l) => l.trim() && !staged.has(l));
  if (missing.length !== (pr.changes_rows || 0)) throw new Error(`main manifest moved: ${missing.length} main rows not in the stage (expected ${pr.changes_rows || 0})`);
  const lfs = files.filter(isLfs); const txt = files.filter((f) => !isLfs(f));
  console.log(`main @ ${sha.slice(0, 12)}: ${files.length} files (${lfs.length} LFS, ${txt.length} text)`);
  if (!COMMIT) { console.log('dry run (add --commit)'); return; }
  const ptr = {};
  for (const f of lfs) {
    const buf = fs.readFileSync(path.join(ST, f)); const oid = crypto.createHash('sha256').update(buf).digest('hex');
    ptr[f] = { oid, size: buf.length };
    const b = await (await fetch(`https://huggingface.co/datasets/${REPO}.git/info/lfs/objects/batch`, { method: 'POST', headers: { ...H, Accept: 'application/vnd.git-lfs+json', 'Content-Type': 'application/vnd.git-lfs+json' },
      body: JSON.stringify({ operation: 'upload', transfers: ['basic', 'multipart'], objects: [{ oid, size: buf.length }], hash_algo: 'sha256' }) })).json();
    const o = b.objects[0]; if (o.error) throw new Error(`lfs ${f}: ${JSON.stringify(o.error)}`);
    const a = o.actions || {};
    if (a.upload) {
      const hd = a.upload.header || {};
      if (hd.chunk_size) { // multipart: header keys "1","2",... are part URLs
        const cs = Number(hd.chunk_size); const parts = [];
        for (const k of Object.keys(hd).filter((x) => /^\d+$/.test(x)).sort((x, y) => x - y)) {
          const r = await fetch(hd[k], { method: 'PUT', body: buf.subarray((k - 1) * cs, k * cs) }); if (!r.ok) throw new Error(`part ${k} ${f}: ${r.status}`);
          parts.push({ partNumber: Number(k), etag: r.headers.get('etag') });
        }
        const r = await fetch(a.upload.href, { method: 'POST', headers: { ...H, 'Content-Type': 'application/vnd.git-lfs+json' }, body: JSON.stringify({ oid, parts }) }); if (!r.ok) throw new Error(`complete ${f}: ${r.status}`);
      } else {
        const r = await fetch(a.upload.href, { method: 'PUT', headers: hd, body: buf }); if (!r.ok) throw new Error(`put ${f}: ${r.status}`);
      }
      if (a.verify) { const r = await fetch(a.verify.href, { method: 'POST', headers: { ...(a.verify.header || {}), 'Content-Type': 'application/vnd.git-lfs+json' }, body: JSON.stringify({ oid, size: buf.length }) }); if (!r.ok) throw new Error(`verify ${f}: ${r.status}`); }
    }
    process.stdout.write('.');
  }
  console.log(' LFS done');
  const nd = [{ key: 'header', value: { parentCommit: sha, summary: pr.title, description: pr.description } },
    ...txt.map((f) => ({ key: 'file', value: { path: f, content: fs.readFileSync(path.join(ST, f)).toString('base64'), encoding: 'base64' } })),
    ...lfs.map((f) => ({ key: 'lfsFile', value: { path: f, algo: 'sha256', oid: ptr[f].oid, size: ptr[f].size } }))].map((x) => JSON.stringify(x)).join('\n');
  const r = await fetch(`${API}/commit/main?create_pr=1`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-ndjson' }, body: nd });
  const t = await r.text(); if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t); console.log(`PR opened: ${j.pullRequestUrl || j.commitUrl}`);
})().catch((e) => { console.error(String(e.message || e).replace(/hf_[A-Za-z0-9]+/g, 'hf_REDACTED')); process.exit(1); });
