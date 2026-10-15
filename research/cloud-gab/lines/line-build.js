#!/usr/bin/env node
// line-build.js — pangti-level answer keys for GAB clips that only have Shabad / Bani truth, by forced alignment with
// TWO different speech models (Karanbir's int8, the app's; Surinder's pa-v3-kirtan fp32). Per clip, per truth row of
// shabads.csv (a Shabad, or bani:<id>), the known text is aligned inside that row's time window (+-3 s) with
// research/follower-bench/align.js (in order, repeats allowed up to 10 pangtis back, skips penalised).
//
//   node line-build.js --tiers main,akhand,hard [--folders 1-kirtan-shabad] [--ids clip0,l3] [--split dev|test] [--jobs 2]
//
// Output under $LINES (default /home/user/gab/lines):
//   emis/<model>/<id>.f32           full-clip log-probs (25 fps x 257), kept so a rerun only re-aligns
//   align/<model>/<id>.json         per-model segments [{verseId, start, end, conf, check, text, row}]
//   keys/<folder>/<id>/lines.csv    candidate answer key: the Karanbir segments; `source` = aligned-2model when
//                                   Surinder's segment of the same pangti starts within AGREE_S, else aligned-1model
//   review/items.json               every aligned-1model start + a 5% random audit of aligned-2model starts
//   summary.json                    per clip: segments, agreed, review count
// Human-labels-first: these are aligned (secondary) keys until a person confirms them on the review page.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const TOOLS = '/home/user/gab-tools/research/level2-dataset/tools';
const FB = '/home/user/gab-tools/research/follower-bench';
const APP_ROOT = '/home/user/sttm-desktop';
const LINES = process.env.LINES || '/home/user/gab/lines';
const BENCH = process.env.VF_BENCHMARK_HF || '/root/personal/live-darbar-venues/cache/gab-hf/04ad4e622cb0';
const CLIPS = '/home/user/gab/clips';
const USERDATA = '/home/user/gab/userdata';
const MODELS = ['karanbir', 'surinder'];
const AGREE_S = 1.0, SURE_CHECK = 0.5, AUDIT = 0.05, PADW = 3;
// measured on GAB-Hard's 20 human-keyed clips (line-eval.js, Oct 15 2026): both models agree within 1 s AND the heard
// text matches the pangti (check >= 0.5) -> 97% on the right pangti (n 162); agree but check < 0.5 ~65%; one model 41%

const { parseCsv, canonRows } = require(path.join(TOOLS, 'vf-manifest'));
const G = require(path.join(TOOLS, 'gab-score'));

// ---- text from the public BaniDB Realm (same rules as tools/line-truth.js)
let realm = null;
function textFor(spec) {
  const Realm = require(path.join(APP_ROOT, 'node_modules/realm'));
  const anvaad = require(path.join(APP_ROOT, 'node_modules/anvaad-js'));
  if (!realm) {
    const sch = JSON.parse(fs.readFileSync(path.join(USERDATA, 'realm-schema-evergreen.json')));
    realm = new Realm({ path: path.join(USERDATA, 'sttmdesktop-evergreen-v2.realm'), schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
  }
  if (String(spec).startsWith('bani:')) {
    const id = Number(String(spec).slice(5));
    const verses = [...realm.objects('Banis_Shabad').filtered('Bani.ID == $0', id).sorted('Seq')]
      .filter((r) => r.MangalPosition !== 'above')
      .map((r) => { const v = r.Custom || r.Verse; return v && { verseId: v.ID, unicode: anvaad.unicode(v.Gurmukhi || ''), header: r.header || 0 }; })
      .filter((v) => v && v.unicode);
    return { id, verses };
  }
  const sid = Number(spec);
  const verses = [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', sid).sorted('ID')]
    .map((v) => ({ verseId: v.ID, shabadId: sid, unicode: anvaad.unicode(v.Gurmukhi || ''), header: 0 })).filter((v) => v.unicode);
  return { id: 900000000 + sid, verses };
}

const run = (args, env = {}) => new Promise((resolve) => {
  const p = spawn('nice', ['-n', '10', process.execPath, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => resolve({ code, err }));
});
const readCsv = (f) => { if (!fs.existsSync(f)) return []; const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return rows.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };

async function emisFor(model, row) {
  const out = path.join(LINES, 'emis', model, `${row.id}.f32`);
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await run([path.join(__dirname, 'emis2.js'), model, path.join(CLIPS, row.source_file), `${out}.part`], { THREADS: process.env.THREADS || '2' });
  if (r.code) throw new Error(`${model} emis ${row.id}: ${r.err.slice(-300)}`);
  fs.renameSync(`${out}.part`, out);
  return out;
}

// align every truth row of one clip with one model's emissions
function alignClip(model, row, emisFile, truth) {
  const { align } = require(path.join(FB, 'align.js'));
  const work = path.join(LINES, 'work', model, row.id);
  fs.mkdirSync(path.join(work, 'cache'), { recursive: true });
  fs.mkdirSync(path.join(work, 'banis'), { recursive: true });
  const buf = fs.readFileSync(emisFile);
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const T = all.length / 257, dur = T / 25;
  const segs = [];
  const here = process.cwd();
  try {
    process.chdir(work);
    truth.forEach((t, k) => {
      const a = Math.max(0, Number(t.start_s) - PADW), b = Math.min(dur, Number(t.end_s) + PADW);
      if (!(b - a > 2)) return;
      const text = textFor(t.shabadId);
      if (!text.verses.length) return;
      fs.writeFileSync(path.join('banis', `${text.id}.json`), JSON.stringify(text));
      const f0 = Math.round(a * 25), f1 = Math.round(b * 25);
      fs.writeFileSync(path.join('cache', `seg${k}.emis.f32`), Buffer.from(all.slice(f0 * 257, f1 * 257).buffer));
      const r = align(`seg${k}`, text.id);
      for (const l of r.lines) segs.push({ row: k, verseId: l.verseId, text: l.text, start: +(l.start + a).toFixed(2), end: +(l.end + a).toFixed(2), conf: l.conf, check: l.check });
    });
  } finally { process.chdir(here); }
  segs.sort((x, y) => x.start - y.start);
  const out = path.join(LINES, 'align', model, `${row.id}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ id: row.id, model, segs }, null, 1));
  return segs;
}

function combine(row, A, B) {
  // a Karanbir segment is "agreed" when Surinder has the same pangti starting within AGREE_S
  const agreed = A.map((s) => B.some((o) => o.verseId === s.verseId && Math.abs(o.start - s.start) <= AGREE_S));
  const sure = A.map((s, i) => agreed[i] && s.check >= SURE_CHECK);
  const src = (i) => (sure[i] ? 'aligned-2model-sure' : agreed[i] ? 'aligned-2model' : 'aligned-1model');
  const dir = path.join(LINES, 'keys', row.content_folder, row.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lines.csv'), ['verseId,start_s,end_s,confidence,source',
    ...A.map((s, i) => `${s.verseId},${s.start},${s.end},${s.check},${src(i)}`)].join('\n') + '\n');
  const items = [];
  A.forEach((s, i) => {
    const audit = parseInt(crypto.createHash('sha1').update(`${row.id}|${i}`).digest('hex').slice(0, 8), 16) / 0xffffffff < AUDIT;
    if (sure[i] && !audit) return;
    const other = B.filter((o) => o.verseId === s.verseId).sort((x, y) => Math.abs(x.start - s.start) - Math.abs(y.start - s.start))[0];
    items.push({ id: `${row.id}#${i}`, clip: row.id, folder: row.content_folder, verseId: s.verseId, line: s.text, start: s.start,
      other: other ? other.start : null, otherLabel: 'second model', prev: i > 0 ? A[i - 1].text : '', next: i + 1 < A.length ? A[i + 1].text : '',
      kind: src(i), why: sure[i] ? 'spot check of an auto-accepted start' : agreed[i] ? 'models agree, but the heard words match weakly' : other ? `models ${Math.abs(other.start - s.start).toFixed(1)} s apart` : 'second model did not find this pangti here',
      source: row.gurdwara || '' });
  });
  return { segments: A.length, agreed: agreed.filter(Boolean).length, sure: sure.filter(Boolean).length, review: items.length, items };
}

(async () => {
  const tiers = arg('tiers', 'main,akhand').split(',');
  const folders = arg('folders') ? arg('folders').split(',') : null;
  const ids = arg('ids') ? arg('ids').split(',') : null;
  const split = arg('split', 'dev');
  const sets = G.loadSets();
  const rows = canonRows(parseCsv(fs.readFileSync(path.join(BENCH, 'manifest.csv'), 'utf8')))
    .filter((r) => r.suite_jobs && fs.existsSync(path.join(CLIPS, r.source_file || '-')))
    .filter((r) => tiers.some((t) => G.inTier(r, t, sets)))
    .filter((r) => (split === 'test' ? r.split === 'test' : r.split !== 'test'))
    .filter((r) => !folders || folders.some((f) => r.content_folder.startsWith(f)))
    .filter((r) => !ids || ids.some((p) => r.id.startsWith(p)));
  const sumFile = path.join(LINES, 'summary.json');
  const summary = fs.existsSync(sumFile) ? JSON.parse(fs.readFileSync(sumFile, 'utf8')) : {};
  const q = [...rows];
  let done = 0;
  const t0 = Date.now();
  console.log(`${rows.length} clips, ${(rows.reduce((s, r) => s + Number(r.duration_s), 0) / 3600).toFixed(2)} h`);
  await Promise.all(Array.from({ length: Number(arg('jobs', 2)) }, async () => {
    for (let row; (row = q.shift());) {
      try {
        const truth = readCsv(path.join(BENCH, row.content_folder, row.id, 'shabads.csv')).filter((t) => t.shabadId);
        if (!truth.length) { console.log(`${row.id}: no Shabad/Bani truth, skipped`); continue; }
        const segs = {};
        for (const m of MODELS) {
          const prev = path.join(LINES, 'align', m, `${row.id}.json`);
          segs[m] = fs.existsSync(prev) && !argv.includes('--realign') ? JSON.parse(fs.readFileSync(prev, 'utf8')).segs : alignClip(m, row, await emisFor(m, row), truth);
        }
        const c = combine(row, segs.karanbir, segs.surinder);
        summary[row.id] = { folder: row.content_folder, tier: tiers.find((t) => G.inTier(row, t, sets)), segments: c.segments, agreed: c.agreed, sure: c.sure, review: c.review, at: new Date().toISOString() };
        fs.mkdirSync(path.join(LINES, 'review'), { recursive: true });
        fs.writeFileSync(path.join(LINES, 'review', `${row.id}.items.json`), JSON.stringify(c.items));
        fs.writeFileSync(sumFile, JSON.stringify(summary, null, 1));
        done++;
        console.log(`[${done}/${rows.length} ${((Date.now() - t0) / 60000).toFixed(1)} min] ${row.id}: ${c.segments} pangti starts, ${c.agreed} agreed (${c.sure} sure), ${c.review} to review`);
      } catch (e) { console.log(`${row.id}: FAILED ${String(e.message).slice(0, 300)}`); }
    }
  }));
  if (realm) realm.close();
})();
