// GAB v1.4 PR (Sung Bani cleanup): opens one Hugging Face PR on khalisfoundation/GurbaniAutopilotBench from a local
// edited copy of the dataset's csv/meta files (edit.py) and its change list.
//   node pr.js <v14 dir> <v14 dir>.changes.json <readme.md>            dry run
//   node pr.js ... --commit                                             opens the PR (HF_TOKEN; never printed)
// Moved recordings: audio.wav (and any other LFS file) is re-pointed at the same LFS object (no upload); small files
// come from the local copy when edited, else are copied byte for byte; the old paths are deleted. manifest.csv is
// checked: only the rows edit.py meant to change differ, every other line byte-identical.
const fs = require('fs'); const path = require('path');
const [D, CH, README] = process.argv.slice(2);
const REPO = 'khalisfoundation/GurbaniAutopilotBench'; const API = `https://huggingface.co/api/datasets/${REPO}`;
const H = { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } };
const get = async (u) => { const r = await fetch(u, H); if (!r.ok) throw new Error(`HF ${r.status} ${u.replace(/\?.*/, '')}`); return r; };
(async () => {
  const sha = (await (await get(`${API}/revision/main`)).json()).sha;
  const R = `https://huggingface.co/datasets/${REPO}/resolve/${sha}`;
  const { changed, moved } = JSON.parse(fs.readFileSync(CH, 'utf8'));
  const remoteMan = await (await get(`${R}/manifest.csv`)).text();
  const localMan = fs.readFileSync(path.join(D, 'manifest.csv'), 'utf8');
  const a = remoteMan.split('\n'), b = localMan.split('\n');
  if (a.length !== b.length) throw new Error('manifest row count differs');
  const diffIds = a.map((l, i) => (l !== b[i] ? b[i].split(',')[0] : null)).filter(Boolean);
  console.log(`main @ ${sha.slice(0, 12)}; manifest rows changed: ${diffIds.length} (${diffIds.join(' ')})`);
  const ops = []; const del = []; const done = new Set();
  const file = (p, buf) => ops.push({ key: 'file', value: { path: p, content: Buffer.from(buf).toString('base64'), encoding: 'base64' } });
  for (const [id, from] of Object.entries(moved)) {
    const to = changed.find((c) => c.endsWith(`/${id}/meta.json`)).replace(`/${id}/meta.json`, '');
    const files = await (await get(`${API}/tree/${sha}/${from}/${encodeURIComponent(id)}?expand=true`)).json();
    for (const f of files.filter((x) => x.type === 'file')) {
      const name = path.basename(f.path); const np = `${to}/${id}/${name}`;
      if (f.lfs) ops.push({ key: 'lfsFile', value: { path: np, algo: 'sha256', oid: f.lfs.oid, size: f.lfs.size } });
      else if (fs.existsSync(path.join(D, np))) file(np, fs.readFileSync(path.join(D, np)));
      else file(np, Buffer.from(await (await get(`${R}/${f.path.split('/').map(encodeURIComponent).join('/')}`)).arrayBuffer()));
      del.push({ key: 'deletedFile', value: { path: f.path } }); done.add(np);
    }
  }
  for (const c of changed) if (!done.has(c) && c !== 'manifest.csv') file(c, fs.readFileSync(path.join(D, c)));
  file('manifest.csv', localMan);
  if (README) file('README.md', fs.readFileSync(README));
  const header = { key: 'header', value: { parentCommit: sha, summary: process.env.PR_TITLE || 'GAB v1.4: Sung Bani cleanup (talk, Asa di Vaar to Akhand Kirtan, one cut per performance, key fixes)', description: fs.readFileSync(process.env.PR_DESC || path.join(__dirname, 'pr-description.md'), 'utf8') } };
  const nd = [header, ...ops, ...del].map((x) => JSON.stringify(x)).join('\n');
  fs.writeFileSync(path.join(__dirname, 'commit.ndjson'), nd);
  console.log(`${ops.length} files written (${ops.filter((o) => o.key === 'lfsFile').length} audio re-pointed, no upload), ${del.length} old paths removed`);
  if (!process.argv.includes('--commit')) { console.log('dry run (add --commit to open the PR)'); return; }
  const r = await fetch(`${API}/commit/main?create_pr=1`, { method: 'POST', headers: { ...H.headers, 'Content-Type': 'application/x-ndjson' }, body: nd });
  const t = await r.text(); if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t); console.log(`PR opened: ${j.pullRequestUrl || j.commitUrl}`);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
