#!/usr/bin/env node
// bani_dump.js <out.json> bani:<id> ...   (2026-10-23 full run)
// Ordered pangtis of each Bani from the STTM Desktop Gurbani database (read only): the same selection as
// labels/tools/bani-verses.js (Banis_Shabad by Seq, MangalPosition != 'above', Custom || Verse), but kept as an
// ORDERED list [[verseId, unicode], ...] so the Paath HMM's 'next pangti' follows the Bani's own order.
// Text is only read (anvaad unicode of the database Gurmukhi); nothing is written back.
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const Realm = require(path.join(ROOT, 'node_modules/realm'));
const anvaad = require(path.join(ROOT, 'node_modules/anvaad-js'));
const APP = path.join(os.homedir(), 'Library/Application Support/SikhiToTheMax');
const [out, ...specs] = process.argv.slice(2);
const sch = JSON.parse(fs.readFileSync(path.join(APP, 'realm-schema-evergreen.json'), 'utf8'));
const realm = new Realm({ path: path.join(APP, 'sttmdesktop-evergreen-v2.realm'), schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const res = {};
for (const spec of specs) {
  const o = [];
  for (const r of realm.objects('Banis_Shabad').filtered('Bani.ID == $0', Number(spec.slice(5))).sorted('Seq')) {
    if (r.MangalPosition === 'above') continue;
    const v = r.Custom || r.Verse;
    if (v && v.Gurmukhi) o.push([v.ID, anvaad.unicode(v.Gurmukhi)]);
  }
  res[spec] = o;
  console.log(spec, o.length);
}
fs.writeFileSync(out, JSON.stringify(res));
realm.close();
