// build.js <work dir> <lines dir>: files.json = per-recording lines.csv (auto-accepted rows) + the updated manifest
const fs = require('fs');
const [W, L] = process.argv.slice(2);
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
const [head, ...rows] = fs.readFileSync(`${W}/manifest.main.csv`, 'utf8').split('\n');
const k = split(head); const I = (n) => k.indexOf(n);
const files = []; const out = [head]; let n = 0, starts = 0;
for (const l of rows) {
  if (!l.trim()) { out.push(l); continue; }
  const v = split(l); const id = v[I('id')], f = v[I('content_folder')]; const key = `${L}/keys/${f}/${id}/lines.csv`;
  if (fs.existsSync(key) && !/^human|^broadcast/.test(v[I('lines_source')])) {
    const [h, ...ls] = fs.readFileSync(key, 'utf8').trim().split('\n');
    const keep = ls.filter((x) => x.endsWith(',aligned-2model-sure')).map((x) => x.replace(/,aligned-2model-sure$/, ',aligned-2model-audited'));
    if (keep.length) { files.push({ path: `${f}/${id}/lines.csv`, content: [h, ...keep].join('\n') + '\n' }); v[I('lines_n')] = String(keep.length); v[I('lines_source')] = 'aligned-2model-audited'; n++; starts += keep.length; out.push(join(v)); continue; }
  }
  out.push(l); // unchanged rows stay byte for byte
}
// safety: re-parse both and confirm only lines_n / lines_source differ, and nothing else in any row
const before = rows.filter((l) => l.trim()).map(split), after = out.slice(1).filter((l) => l.trim()).map(split);
if (before.length !== after.length) throw new Error('row count changed');
let changedRows = 0;
before.forEach((b, r) => { let any = false; b.forEach((x, c) => { if (x !== after[r][c]) { if (c !== I('lines_n') && c !== I('lines_source')) throw new Error(`row ${b[0]} column ${k[c]} would change`); any = true; } }); if (any) changedRows++; });
// a byte check too: unchanged rows must be byte-identical to the original
rows.forEach((l, r) => { if (l.trim() && out[r + 1] !== l && !files.some((f) => f.path.endsWith(`/${split(l)[I('id')]}/lines.csv`))) throw new Error(`row ${split(l)[0]} re-serialised differently`); });
console.log(`manifest: ${changedRows} rows change, only lines_n / lines_source`);
files.push({ path: 'manifest.csv', content: out.join('\n') });
fs.writeFileSync(`${W}/files.json`, JSON.stringify(files));
console.log(`${n} recordings, ${starts} pangti starts, ${files.length} files`);
