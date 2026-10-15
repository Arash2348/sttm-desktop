// build.js <work dir> <lines dir>: files.json = per-recording lines.csv (auto-accepted rows) + the updated manifest
const fs = require('fs');
const [W, L] = process.argv.slice(2);
const split = (l) => { const v = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(c); c = ''; } else c += ch; } v.push(c); return v; };
const join = (v) => v.map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',');
const [head, ...rows] = fs.readFileSync(`${W}/manifest.main.csv`, 'utf8').split('\n');
const k = split(head); const I = (n) => k.indexOf(n);
const files = []; const out = [head]; let n = 0, starts = 0;
for (const l of rows) {
  if (!l.trim()) { out.push(l); continue; }
  const v = split(l); const id = v[I('id')], f = v[I('content_folder')]; const key = `${L}/keys/${f}/${id}/lines.csv`;
  if (fs.existsSync(key) && !/^human|^broadcast/.test(v[I('lines_source')])) {
    const [h, ...ls] = fs.readFileSync(key, 'utf8').trim().split('\n');
    const keep = ls.filter((x) => x.endsWith(',aligned-2model-sure')).map((x) => x.replace(/,aligned-2model-sure$/, ',aligned-2model-audited'));
    if (keep.length) { files.push({ path: `${f}/${id}/lines.csv`, content: [h, ...keep].join('\n') + '\n' }); v[I('lines_n')] = String(keep.length); v[I('lines_source')] = 'aligned-2model-audited'; n++; starts += keep.length; }
  }
  out.push(join(v));
}
files.push({ path: 'manifest.csv', content: out.join('\n') });
fs.writeFileSync(`${W}/files.json`, JSON.stringify(files));
console.log(`${n} recordings, ${starts} pangti starts, ${files.length} files`);
