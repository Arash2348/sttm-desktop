// Voice isolation test: align each recording's sung Shabad (shabads.csv) to the app model's emissions of the
// original and of the voice-only audio, and compare how much of each sung pangti the model plainly heard (align.js
// "check": heard letters vs the pangti's own letters, 0..1).
const fs = require('fs'), path = require('path');
const FB = '/home/user/gab-tools/research/follower-bench';
const APP = '/home/user/sttm-desktop', USERDATA = '/home/user/gab/userdata';
const Realm = require(path.join(APP, 'node_modules/realm')), anvaad = require(path.join(APP, 'node_modules/anvaad-js'));
const sch = JSON.parse(fs.readFileSync(path.join(USERDATA, 'realm-schema-evergreen.json')));
const realm = new Realm({ path: path.join(USERDATA, 'sttmdesktop-evergreen-v2.realm'), schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const textFor = (sid) => { sid = Number(String(sid).split('|')[0]); return { id: 900000000 + sid, verses: [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', sid).sorted('ID')].map((v) => ({ verseId: v.ID, shabadId: sid, unicode: anvaad.unicode(v.Gurmukhi || ''), header: 0 })).filter((v) => v.unicode) }; };
const { align } = require(path.join(FB, 'align.js'));
const readCsv = (f) => { const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return rows.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };
const res = {};
for (const id of process.argv.slice(2)) {
  const truth = readCsv(`/home/user/gab/bench-aligned/1-kirtan-shabad/${id}/shabads.csv`).filter((t) => /^\d/.test(t.shabadId));
  for (const v of ['orig', 'vocals']) {
    const buf = fs.readFileSync(`/root/iso/emis/${v}/${id}.f32`); const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
    const T = all.length / 257, dur = T / 25;
    const work = `/root/iso/work/${v}/${id}`; fs.mkdirSync(`${work}/cache`, { recursive: true }); fs.mkdirSync(`${work}/banis`, { recursive: true });
    const here = process.cwd(); process.chdir(work);
    let segs = [];
    truth.forEach((t, k) => {
      const a = Math.max(0, Number(t.start_s) - 3), b = Math.min(dur, Number(t.end_s) + 3); if (!(b - a > 2)) return;
      const text = textFor(t.shabadId); if (!text.verses.length) return;
      fs.writeFileSync(`banis/${text.id}.json`, JSON.stringify(text));
      const f0 = Math.round(a * 25), f1 = Math.round(b * 25);
      fs.writeFileSync(`cache/seg${k}.emis.f32`, Buffer.from(all.slice(f0 * 257, f1 * 257).buffer));
      segs = segs.concat(align(`seg${k}`, text.id).lines.map((l) => ({ check: l.check, conf: l.conf, s: l.end - l.start })));
    });
    process.chdir(here);
    const sec = segs.reduce((x, y) => x + y.s, 0) || 1;
    res[id] = res[id] || {};
    res[id][v] = { pangtis: segs.length, check: +(segs.reduce((x, y) => x + y.check * y.s, 0) / sec).toFixed(3), clear: +(segs.filter((y) => y.check >= 0.5).reduce((x, y) => x + y.s, 0) / sec).toFixed(3), conf: +(segs.reduce((x, y) => x + y.conf * y.s, 0) / sec).toFixed(3) };
  }
}
console.log('recording | heard-match (time-weighted) orig -> voice-only | pangti time heard clearly (check>=0.5) orig -> voice-only | alignment confidence');
for (const [id, r] of Object.entries(res)) console.log(id.padEnd(9), '|', r.orig.check, '->', r.vocals.check, '|', r.orig.clear, '->', r.vocals.clear, '|', r.orig.conf, '->', r.vocals.conf);
realm.close();
