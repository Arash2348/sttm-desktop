// push a follow-up commit to an open GAB PR branch (refs/pr/N): every changed file whose content differs from the PR
// head is written from the local copy; recordings moved since the PR are re-pointed (LFS) and their old paths deleted.
//   node pr2.js <dir> <dir>.changes.json <readme> <pr num> "<summary>" [--commit]
const fs = require('fs'); const path = require('path');
const [D, CH, README, N, SUMMARY] = process.argv.slice(2);
const REPO = 'khalisfoundation/GurbaniAutopilotBench'; const API = `https://huggingface.co/api/datasets/${REPO}`;
const H = { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } };
const REF = encodeURIComponent(`refs/pr/${N}`);
const get = async (u, ok404) => { const r = await fetch(u, H); if (ok404 && r.status === 404) return null; if (!r.ok) throw new Error(`HF ${r.status} ${u.replace(/\?.*/, '')}`); return r; };
(async () => {
  const head = (await (await get(`${API}/revision/${REF}`)).json()).sha;
  const R = `https://huggingface.co/datasets/${REPO}/resolve/${head}`;
  const { changed, moved } = JSON.parse(fs.readFileSync(CH, 'utf8'));
  const ops = []; const del = []; const file = (p, buf) => ops.push({ key: 'file', value: { path: p, content: Buffer.from(buf).toString('base64'), encoding: 'base64' } });
  const remote = async (p) => { const r = await get(`${R}/${p.split('/').map(encodeURIComponent).join('/')}`, true); return r ? Buffer.from(await r.arrayBuffer()) : null; };
  for (const [id, from] of Object.entries(moved)) {
    const to = changed.find((c) => c.endsWith(`/${id}/meta.json`)).replace(`/${id}/meta.json`, '');
    const t = await get(`${API}/tree/${head}/${from}/${encodeURIComponent(id)}?expand=true`, true);
    if (!t) continue; // already moved in the PR
    for (const f of (await t.json()).filter((x) => x.type === 'file')) {
      const np = `${to}/${id}/${path.basename(f.path)}`;
      if (f.lfs) ops.push({ key: 'lfsFile', value: { path: np, algo: 'sha256', oid: f.lfs.oid, size: f.lfs.size } });
      else file(np, fs.existsSync(path.join(D, np)) ? fs.readFileSync(path.join(D, np)) : await remote(f.path));
      del.push({ key: 'deletedFile', value: { path: f.path } });
    }
  }
  const written = new Set(ops.map((o) => o.value.path));
  for (const c of [...changed, 'manifest.csv']) {
    if (written.has(c)) continue; written.add(c);
    const local = fs.readFileSync(path.join(D, c)); const r = await remote(c);
    if (!r || !r.equals(local)) file(c, local);
  }
  const rl = fs.readFileSync(README); const rr = await remote('README.md'); if (!rr || !rr.equals(rl)) file('README.md', rl);
  console.log(`PR ${N} head ${head.slice(0, 12)}: ${ops.length} files (${ops.filter((o) => o.key === 'lfsFile').length} audio re-pointed), ${del.length} deleted: ${ops.map((o) => o.value.path).join(' ')}`);
  if (!process.argv.includes('--commit')) return;
  const nd = [{ key: 'header', value: { parentCommit: head, summary: SUMMARY } }, ...ops, ...del].map((x) => JSON.stringify(x)).join('\n');
  const r = await fetch(`${API}/commit/${REF}`, { method: 'POST', headers: { ...H.headers, 'Content-Type': 'application/x-ndjson' }, body: nd });
  const t = await r.text(); if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  console.log('pushed', JSON.parse(t).commitOid || t.slice(0, 120));
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
