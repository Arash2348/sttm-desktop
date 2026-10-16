#!/usr/bin/env node
// apaath-keys.js <id>... — pangti keys for Akhand Paath recordings whose truth is only the SEQUENCE of Shabads read
// (shabads.csv with no times, e.g. sp01-03: "every Shabad of the Angs read, in order; onsets unknown"). The whole
// clip is force-aligned against all those Shabads' pangtis as one stream, with the two speech models (karanbir =
// the app's, surinder), the same way line-build.js keys a Shabad window: a start is "sure" when both models put the
// pangti within 1 s and the heard words match (check >= 0.5). Writes keys/4-akhand-paath/<id>/{lines.csv,
// shabads.csv} under /home/user/gab/lines (shabads.csv gains the Shabad windows: first to last pangti aligned).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const APP = '/home/user/sttm-desktop';
const BENCH = process.env.VF_BENCHMARK || '/home/user/gab/bench';
const LINES = process.env.LINES || '/home/user/gab/lines';
const FB = '/home/user/gab-tools/research/follower-bench';
const AGREE_S = 1.0, SURE_CHECK = 0.5;
const Realm = require(path.join(APP, 'node_modules/realm'));
const anvaad = require(path.join(APP, 'node_modules/anvaad-js'));
const sch = JSON.parse(fs.readFileSync('/home/user/gab/userdata/realm-schema-evergreen.json'));
const realm = new Realm({ path: '/home/user/gab/userdata/sttmdesktop-evergreen-v2.realm', schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const versesOf = (sid) => [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', sid).sorted('ID')]
  .map((v) => ({ verseId: v.ID, unicode: anvaad.unicode(v.Gurmukhi || ''), header: 0, shabadId: sid })).filter((v) => v.unicode);
const readCsv = (f) => { const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return rows.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };
function emisFor(model, id, wav) {
  const out = path.join(LINES, 'emis', model, `${id}.f32`);
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync('node', [path.join(__dirname, 'emis2.js'), model, wav, `${out}.part`], { env: { ...process.env, THREADS: process.env.THREADS || '2' }, encoding: 'utf8' });
  if (r.status) throw new Error(`${model} emis ${id}: ${(r.stderr || '').slice(-300)}`);
  fs.renameSync(`${out}.part`, out);
  return out;
}
function alignWhole(model, id, emisFile, verses) {
  const { align } = require(path.join(FB, 'align.js'));
  const work = path.join(LINES, 'work', model, id);
  fs.mkdirSync(path.join(work, 'cache'), { recursive: true });
  fs.mkdirSync(path.join(work, 'banis'), { recursive: true });
  const here = process.cwd();
  try {
    process.chdir(work);
    const bani = { id: 950000000, verses };
    fs.writeFileSync(path.join('banis', `${bani.id}.json`), JSON.stringify(bani));
    fs.copyFileSync(emisFile, path.join('cache', 'whole.emis.f32'));
    const r = align('whole', bani.id);
    return r.lines.map((l) => ({ verseId: l.verseId, text: l.text, start: +l.start.toFixed(2), end: +l.end.toFixed(2), check: l.check }));
  } finally { process.chdir(here); }
}
for (const id of process.argv.slice(2)) {
  const dir = path.join(BENCH, '4-akhand-paath', id);
  const wav = path.join(dir, 'audio.wav');
  const seq = readCsv(path.join(dir, 'shabads.csv')).map((r) => Number(r.shabadId)).filter(Boolean);
  const verses = seq.flatMap(versesOf);
  console.log(`${id}: ${seq.length} Shabads, ${verses.length} pangtis`);
  const A = alignWhole('karanbir', id, emisFor('karanbir', id, wav), verses);
  const B = alignWhole('surinder', id, emisFor('surinder', id, wav), verses);
  const agreed = A.map((s) => B.some((o) => o.verseId === s.verseId && Math.abs(o.start - s.start) <= AGREE_S));
  const sure = A.map((s, i) => agreed[i] && s.check >= SURE_CHECK);
  const src = (i) => (sure[i] ? 'aligned-2model-sure' : agreed[i] ? 'aligned-2model' : 'aligned-1model');
  const out = path.join(LINES, 'keys', '4-akhand-paath', id);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'lines.csv'), ['verseId,start_s,end_s,confidence,source', ...A.map((s, i) => `${s.verseId},${s.start},${s.end},${s.check},${src(i)}`)].join('\n') + '\n');
  // Shabad windows: from the first sure pangti of a Shabad to the last pangti before the next Shabad's first sure one
  const byShabad = new Map(verses.map((v) => [v.verseId, v.shabadId]));
  const rows = [];
  for (const sid of seq) {
    const mine = A.map((s, i) => ({ ...s, i })).filter((s) => byShabad.get(s.verseId) === sid && sure[s.i]);
    if (!mine.length) { rows.push(`${sid},,,aligned-2model-audited`); continue; }
    rows.push(`${sid},${mine[0].start},${mine[mine.length - 1].end},aligned-2model-audited`);
  }
  fs.writeFileSync(path.join(out, 'shabads.csv'), ['shabadId,start_s,end_s,source', ...rows].join('\n') + '\n');
  console.log(`  ${A.length} pangtis aligned, ${agreed.filter(Boolean).length} agreed, ${sure.filter(Boolean).length} sure; ${rows.filter((r) => !/,,,/.test(r)).length}/${seq.length} Shabads windowed`);
}
realm.close();
