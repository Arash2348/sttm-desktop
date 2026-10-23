#!/usr/bin/env node
// bani-verses.js <realm dir (a COPY of the app's evergreen realm + schema)> <out.json> <spec> [<spec> ...]
// Dumps the pangti (verse) ids + text of each Bani ('bani:<id>', same selection as line-build.js textFor: Banis_Shabad
// by Seq, MangalPosition != 'above', Custom || Verse) or Shabad ('<shabadId>') so make-candidates.py can confirm an
// aligned verseId belongs to the keyed Bani / Shabad. Output: {"bani:4": {"<verseId>": "<unicode>"}, "880": {...}}.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const Realm = require(path.join(ROOT, 'node_modules/realm'));
const anvaad = require(path.join(ROOT, 'node_modules/anvaad-js'));
const [dir, out, ...specs] = process.argv.slice(2);
const sch = JSON.parse(fs.readFileSync(path.join(dir, 'realm-schema-evergreen.json')));
const realm = new Realm({ path: path.join(dir, 'sttmdesktop-evergreen-v2.realm'), schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const res = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
for (const spec of specs) {
  const o = {};
  if (spec.startsWith('bani:')) {
    for (const r of realm.objects('Banis_Shabad').filtered('Bani.ID == $0', Number(spec.slice(5))).sorted('Seq')) {
      if (r.MangalPosition === 'above') continue;
      const v = r.Custom || r.Verse;
      if (v && v.Gurmukhi) o[v.ID] = anvaad.unicode(v.Gurmukhi);
    }
  } else {
    for (const v of realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', Number(spec)).sorted('ID')) if (v.Gurmukhi) o[v.ID] = anvaad.unicode(v.Gurmukhi);
  }
  res[spec] = o;
  console.log(spec, Object.keys(o).length);
}
fs.writeFileSync(out, JSON.stringify(res, null, 0));
realm.close();
