// research/cloud-gab/hf-move-akhand/move.js — give Akhand Kirtan its own GAB folder (user, Oct 16 2026).
// Moves every recording of the GAB-Akhand Kirtan tier (the tier rule in gab-sets.json, the same one scoring uses)
// from 1-kirtan-shabad/<id>/ to 5-akhand-kirtan/<id>/ in the GurbaniAutopilotBench dataset, as one Hugging Face PR:
//   audio.wav      re-pointed at the same LFS object (no re-upload, byte-identical)
//   *.csv          copied unchanged; meta.json with content_folder updated
//   manifest.csv   only content_folder and audio change, only on those rows (every other byte kept; self-checked)
//   README.md      the folder table: the kirtan row recounted, a 5-akhand-kirtan row added
// Scores do not change: tiers are found by gurdwara, not folder; the model-output cache is keyed by cache_id.
//
//   node move.js            dry run: builds <scratch>/commit.ndjson and prints what would change
//   node move.js --commit   opens the PR (needs a write token in HF_TOKEN; never printed)
const fs = require('fs');
const path = require('path');
const REPO = 'khalisfoundation/GurbaniAutopilotBench';
const API = `https://huggingface.co/api/datasets/${REPO}`;
const TOOLS = process.env.GAB_TOOLS || '/home/user/gab-tools/research/level2-dataset/tools';
const { tierOf } = require(path.join(TOOLS, 'gab-score'));
const OUT = process.env.OUT || path.join(__dirname, '.work');
const FROM = '1-kirtan-shabad';
const TO = '5-akhand-kirtan';
const H = { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } };
const get = async (u) => { const r = await fetch(u, H); if (!r.ok) throw new Error(`HF ${r.status} ${u.replace(/\?.*/, '')}`); return r; };
// RFC 4180 fields: a doubled quote inside a quoted field is one literal quote
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const sha = (await (await get(`${API}/revision/main`)).json()).sha;
  const R = `https://huggingface.co/datasets/${REPO}/resolve/${sha}`;
  const manifest = await (await get(`${R}/manifest.csv`)).text();
  const readme = await (await get(`${R}/README.md`)).text();
  const [head, ...rows] = manifest.split('\n');
  const k = split(head); const I = (n) => { const i = k.indexOf(n); if (i < 0) throw new Error(`no column ${n}`); return i; };
  const out = [head]; const moved = [];
  for (const l of rows) {
    if (!l.trim()) { out.push(l); continue; }
    const v = split(l); const row = Object.fromEntries(k.map((c, i) => [c, v[i]]));
    if (row.content_folder === FROM && tierOf(row) === 'akhand') {
      v[I('content_folder')] = TO;
      if (v[I('audio')]) v[I('audio')] = v[I('audio')].replace(new RegExp(`^${FROM}/`), `${TO}/`);
      moved.push(row.id); out.push(join(v));
    } else out.push(l); // every other row stays byte for byte
  }
  // safety: only content_folder / audio of the moved rows differ; nothing else anywhere
  const before = rows.filter((l) => l.trim()).map(split); const after = out.slice(1).filter((l) => l.trim()).map(split);
  if (before.length !== after.length) throw new Error('row count changed');
  before.forEach((b, r) => b.forEach((x, c) => { if (x !== after[r][c] && !(moved.includes(b[I('id')]) && (c === I('content_folder') || c === I('audio')))) throw new Error(`row ${b[0]} column ${k[c]} would change`); }));
  rows.forEach((l, r) => { if (l.trim() && !moved.includes(split(l)[I('id')]) && out[r + 1] !== l) throw new Error(`row ${split(l)[0]} re-serialised differently`); });
  if (!moved.length) throw new Error('no Akhand Kirtan rows found in 1-kirtan-shabad (already moved?)');

  const ops = []; const del = []; let lfs = 0; let bytes = 0;
  for (const id of moved) {
    const files = await (await get(`${API}/tree/${sha}/${FROM}/${encodeURIComponent(id)}?expand=true`)).json();
    for (const f of files.filter((x) => x.type === 'file')) {
      const to = f.path.replace(`${FROM}/`, `${TO}/`);
      if (f.lfs) { ops.push({ key: 'lfsFile', value: { path: to, algo: 'sha256', oid: f.lfs.oid, size: f.lfs.size } }); lfs++; bytes += f.lfs.size; } else {
        let txt = await (await get(`${R}/${f.path.split('/').map(encodeURIComponent).join('/')}`)).text();
        if (f.path.endsWith('/meta.json')) { const m = JSON.parse(txt); if (m.content_folder !== FROM) throw new Error(`${f.path}: content_folder ${m.content_folder}`); m.content_folder = TO; txt = `${JSON.stringify(m, null, 2)}\n`; }
        ops.push({ key: 'file', value: { path: to, content: Buffer.from(txt).toString('base64'), encoding: 'base64' } });
      }
      del.push({ key: 'deletedFile', value: { path: f.path } });
    }
  }
  // README folder table: recount the kirtan row, add the Akhand Kirtan row after Akhand Paath
  const count = (folder) => { const rs = after.filter((v) => v[I('content_folder')] === folder); return [rs.length, (rs.reduce((a, v) => a + Number(v[I('duration_s')] || 0), 0) / 3600).toFixed(1)]; };
  const [kn, kh] = count(FROM); const [an, ah] = count(TO);
  let rd = readme.replace(/^\| `1-kirtan-shabad` \| ([^|]*)\| \d+ \| [\d.]+ \|$/m, (m, what) => `| \`1-kirtan-shabad\` | ${what}| ${kn} | ${kh} |`);
  const apRow = rd.match(/^\| `4-akhand-paath` \|.*$/m);
  if (!apRow) throw new Error('README: no 4-akhand-paath row in the folder table');
  rd = rd.replace(apRow[0], `${apRow[0]}\n| \`5-akhand-kirtan\` | Akhand Kirtan smagams: many singers, the sangat singing along, many instruments (the GAB-Akhand Kirtan tier) | ${an} | ${ah} |`);
  ops.push({ key: 'file', value: { path: 'manifest.csv', content: Buffer.from(out.join('\n')).toString('base64'), encoding: 'base64' } });
  ops.push({ key: 'file', value: { path: 'README.md', content: Buffer.from(rd).toString('base64'), encoding: 'base64' } });

  const header = { key: 'header', value: { parentCommit: sha, summary: 'Akhand Kirtan gets its own folder: 5-akhand-kirtan', description: `The ${moved.length} GAB-Akhand Kirtan recordings (AKJ Toronto 2022, Manchester 2024 Rehnsabhai) move from 1-kirtan-shabad/ to 5-akhand-kirtan/ (owner's request, Oct 16 2026): many singers and the sangat singing along make it a different level of data. Audio is the same LFS object (byte-identical); manifest.csv changes only content_folder and audio on those rows; meta.json content_folder updated; README folder table recounted. Scores are unchanged: the tier is found by gurdwara, the model-output cache by cache_id.` } };
  const nd = [header, ...ops, ...del].map((x) => JSON.stringify(x)).join('\n');
  fs.writeFileSync(path.join(OUT, 'commit.ndjson'), nd);
  console.log(`main @ ${sha.slice(0, 12)}: ${moved.length} recordings move (${lfs} audio files, ${(bytes / 1e9).toFixed(2)} GB re-pointed, no upload), ${ops.length - 2 - lfs} small files copied, ${del.length} old paths removed`);
  console.log(`folder table: 1-kirtan-shabad ${kn} recordings ${kh} h; 5-akhand-kirtan ${an} recordings ${ah} h`);
  console.log(`ids: ${moved.join(' ')}`);
  if (!process.argv.includes('--commit')) { console.log(`dry run: ${path.join(OUT, 'commit.ndjson')} (run with --commit to open the PR)`); return; }
  const r = await fetch(`${API}/commit/main?create_pr=1`, { method: 'POST', headers: { ...H.headers, 'Content-Type': 'application/x-ndjson' }, body: nd });
  const t = await r.text();
  if (!r.ok) throw new Error(`commit: HF ${r.status} ${t.slice(0, 300)}`);
  const j = JSON.parse(t); console.log(`PR opened: ${j.pullRequestUrl || j.commitUrl || t.slice(0, 200)}`);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
