#!/usr/bin/env node
/* quick-keys-v2.js <timeline dir> <out dir>   e.g. timeline-pangti-v2 gen/gab-cache-v2
 *
 * A gab-quick key set (manifest.json + keys/<cat>/<id>/key.json, the --keys-cache layout) for re-scoring with new
 * answer keys: every recording kept in <timeline dir>/c1-6a866c94-<cat>.json (the pangti re-score with those keys),
 * with its key resolved by pangti-timeline.js truthOf from GAB_HF_DS (gen/keys-final-ds: the HF copy with
 * labels/keys-final overlaid). Recordings already in the default gab-cache manifest keep their entry (audio, cache
 * entry); new ones get one built from the HF manifest row and the tools' suite job. Run with GAB_HF_DS set.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = os.homedir();
const [TL, OUT] = process.argv.slice(2).map((p) => path.resolve(p));
if (!TL || !OUT || !process.env.GAB_HF_DS) { console.error('usage: GAB_HF_DS=<ds> quick-keys-v2.js <timeline dir> <out dir>'); process.exit(2); }
const ROOT = path.resolve(process.env.GAB_CACHE || path.join(H, 'personal/live-darbar-venues/cache'));
const GC = path.join(ROOT, 'gab-cache');
const GUI = path.resolve(__dirname, '..');
const toolsDir = fs.readdirSync(path.join(GUI, 'gen')).find((d) => /^tools-[0-9a-f]{12}-c1$/.test(d));
if (!toolsDir) { console.error('run gab-quick once first (it materialises the replay tools in gen/)'); process.exit(2); }
process.env.GAB_TOOLS = path.join(GUI, 'gen', toolsDir, 'research/level2-dataset/tools');
if (fs.existsSync(path.join(GC, 'clips'))) process.env.VF_CLIPS = path.join(GC, 'clips');
const L = require('./pangti-timeline.js');
const { SUITES } = require(path.join(process.env.GAB_TOOLS, 'vf-suites.js'));
const ds = L.sv.loadDataset(process.env.GAB_HF_DS);
const old = JSON.parse(fs.readFileSync(path.join(GC, 'manifest.json'), 'utf8'));
const man = { ...old, made: new Date().toISOString(), keys: `pangti keys from ${process.env.GAB_HF_DS} (HF copy + labels/keys-final)`, recordings: [] };
const jobsOf = {};
const added = []; const changed = [];
for (const cat of Object.keys(old.categories)) {
  if (cat === 'kbv1') { for (const r of old.recordings.filter((x) => x.category === cat)) { man.recordings.push(r); const d = path.join(OUT, r.key.path); fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(path.join(GC, r.key.path, 'key.json'), path.join(d, 'key.json')); } continue; }
  const tl = JSON.parse(fs.readFileSync(path.join(TL, `c1-6a866c94-${cat}.json`), 'utf8'));
  for (const meta of tl.clips) {
    const row = ds.find(meta.id);
    const { truth, basis } = L.truthOf(ds, row);
    let r = old.recordings.find((x) => x.category === cat && x.id === meta.id);
    if (!r) {
      const [suite, clip] = row.suite_jobs.split(';')[0].split(':');
      if (!jobsOf[suite]) jobsOf[suite] = SUITES[suite].jobs();
      const j = jobsOf[suite].find((x) => x.clip === clip || x.id === clip);
      if (!j) throw new Error(`${meta.id}: no ${suite} job (audio missing?)`);
      r = { id: meta.id, category: cat, suite, job: `${suite}:${clip}`, cache_entry: j.id, namespace: old.categories[cat].namespace,
        audio: { seconds: j.dur, local: `clips/${path.basename(j.wav)}`, from: `khalisfoundation/GurbaniAutopilotBench:${row.audio}` },
        key: { source: basis, path: `keys/${cat}/${meta.id}` }, meta: Object.fromEntries(Object.entries(meta).filter(([k]) => !['runs', 'n', 'basis'].includes(k))) };
      added.push(`${cat}/${meta.id}`);
    }
    const key = { id: meta.id, category: cat, basis, lines_source: row.lines_source, truth_provenance: row.truth_provenance, note: 'resolved answer key as scored, from the HF copy with labels/keys-final overlaid',
      lines: truth.lines.map((l) => ({ text: l.text, norm: l.norm, start: l.start, end: l.end, verseId: l.verseId ?? null, conf: l.conf ?? null, src: l.src ?? null, scored: !!l.scored })),
      shabads: truth.shabads.map((s) => ({ ids: s.ids, start: s.start, end: s.end })) };
    const d = path.join(OUT, r.key.path);
    fs.mkdirSync(d, { recursive: true });
    const prev = path.join(GC, r.key.path, 'key.json');
    if (fs.existsSync(prev)) { const p = JSON.parse(fs.readFileSync(prev, 'utf8')); if (JSON.stringify(p.lines) !== JSON.stringify(key.lines)) changed.push(`${cat}/${meta.id}`); }
    fs.writeFileSync(path.join(d, 'key.json'), JSON.stringify(key));
    man.recordings.push({ ...r, key: { ...r.key, source: basis } });
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(man, null, 1));
console.log(`${OUT}: ${man.recordings.length} recordings (default manifest ${old.recordings.length}); added ${added.join(' ') || 'none'}; key changed ${changed.join(' ') || 'none'}`);
L.close();
