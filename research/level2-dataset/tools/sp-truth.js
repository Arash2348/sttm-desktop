// Line truth for the Sehaj Paath clips (sp01-sp03): forced alignment of the whole clip against
// every Shabad of the clip's Angs in order (paath-seq-tests.json sequence), with follower-bench
// emis.js + align.js. Run on a machine with the model + the app Realm. cwd = work dir.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const ROOT = process.env.VF_DRIVER_ROOT || path.join(os.homedir(), 'personal/sttm-akhand9');
const FB = path.join(ROOT, 'research/follower-bench');
const DS = path.join(ROOT, 'research/level2-dataset');
const APP = path.join(os.homedir(), 'Library/Application Support/SikhiToTheMax');
const CLIPS = path.join(os.homedir(), 'personal/live-darbar-venues/clips');
const MODEL = process.env.MODEL || path.join(os.homedir(), 'AAI/models/karansea-shabad-ctc/model.int8.onnx');
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
for (const d of ['cache', 'banis', 'truth']) fs.mkdirSync(d, { recursive: true });
const Realm = require(path.join(ROOT, 'node_modules/realm'));
const anvaad = require(path.join(ROOT, 'node_modules/anvaad-js'));
const sch = JSON.parse(fs.readFileSync(path.join(APP, 'realm-schema-evergreen.json')));
const realm = new Realm({ path: path.join(APP, 'sttmdesktop-evergreen-v2.realm'), schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const rows = JSON.parse(fs.readFileSync(path.join(DS, 'paath-seq-tests.json')));
for (const row of rows) {
  if (only && !only.has(row.name)) continue;
  const clip = row.clip.replace(/\.wav$/, '');
  if (fs.existsSync(`truth/${clip}.json`)) continue;
  const verses = row.sequence.flatMap((sid) => [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', sid).sorted('ID')]
    .map((v) => ({ verseId: v.ID, shabadId: sid, unicode: anvaad.unicode(v.Gurmukhi || ''), header: 0 })).filter((v) => v.unicode));
  const id = 900000000 + row.sequence[0];
  fs.writeFileSync(`banis/${id}.json`, JSON.stringify({ id, shabads: row.sequence, verses }));
  const wav = path.join(CLIPS, row.clip);
  if (!fs.existsSync(`cache/${clip}.emis.f32`)) {
    const r = spawnSync(process.execPath, [path.join(FB, 'emis.js'), wav], { env: { ...process.env, BENCH_THREADS: '3', MODEL_PATH: MODEL }, encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status) { console.log(`${row.name}: emis failed`); continue; }
  }
  const a = spawnSync(process.execPath, [path.join(FB, 'align.js'), clip, String(id)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (a.status) { console.log(`${row.name}: align failed ${(a.stderr || '').slice(-400)}`); continue; }
  const t = JSON.parse(fs.readFileSync(`truth/${clip}.json`, 'utf8'));
  console.log(`${row.name}: ${t.lines.length} lines, ${t.lines.filter((l) => l.check < 0.6).length} low-confidence, ${t.repeats} repeats`);
}
realm.close();
