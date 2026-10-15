#!/usr/bin/env node
// verifier-test.js — offline test of a "Shabad verifier" for GAB-Akhand: is the right Shabad the best forced-alignment
// fit for the last WIN seconds of audio, against (a) the wrong Shabads 9.0.3 actually showed on that recording and
// (b) random Shabads? If yes (often, with a margin), aligning a few search candidates over a long window is evidence
// the app does not use yet. Practice split only (train + dev).
//
//   node verifier-test.js [--win 30] [--step 15] [--random 20]
// Needs: /home/user/gab/verifier/clips.json, emis/<id>.f32 (emis2.js karanbir), r903/replay/base/l3/trace (gab --keep).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const WIN = arg('win', 30), STEP = arg('step', 15), NRAND = arg('random', 20);
const V = '/home/user/gab/verifier';
const BENCH = '/home/user/gab/bench';
const APP = '/home/user/sttm-desktop';
const { align } = require('/home/user/gab-tools/research/follower-bench/align.js');
const Realm = require(path.join(APP, 'node_modules/realm'));
const anvaad = require(path.join(APP, 'node_modules/anvaad-js'));
const sch = JSON.parse(fs.readFileSync('/home/user/gab/userdata/realm-schema-evergreen.json'));
const realm = new Realm({ path: '/home/user/gab/userdata/sttmdesktop-evergreen-v2.realm', schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const readCsv = (f) => { if (!fs.existsSync(f)) return []; const [h, ...r] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return r.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };

const textMemo = new Map();
function shabadText(sid) {
  if (!textMemo.has(sid)) {
    const verses = [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', sid).sorted('ID')]
      .map((v) => ({ verseId: v.ID, unicode: anvaad.unicode(v.Gurmukhi || ''), header: 0 })).filter((v) => v.unicode);
    textMemo.set(sid, { id: 900000000 + sid, verses });
  }
  return textMemo.get(sid);
}
const allShabads = [...new Set([...realm.objects('Verse').filtered('ID < 70000')].flatMap((v) => [...v.Shabads].map((s) => s.ShabadID)))];
const rng = (seed) => { let x = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16); return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };

const work = path.join(V, 'work');
fs.mkdirSync(path.join(work, 'cache'), { recursive: true });
fs.mkdirSync(path.join(work, 'banis'), { recursive: true });
process.chdir(work);
function score(sid, lp, f0, f1) {
  const t = shabadText(sid);
  if (!t.verses.length) return null;
  fs.writeFileSync(`banis/${t.id}.json`, JSON.stringify(t));
  fs.writeFileSync('cache/w.emis.f32', Buffer.from(lp.slice(f0 * 257, f1 * 257).buffer));
  const r = align('w', t.id);
  const heardLines = r.lines.filter((l) => l.check >= 0.5).length;
  return { score: r.score, heard: heardLines, lines: r.lines.length };
}

const clips = JSON.parse(fs.readFileSync(path.join(V, 'clips.json'))).filter((c) => c.split !== 'test');
const res = [];
for (const c of clips) {
  const ef = path.join(V, 'emis', `${c.id}.f32`);
  if (!fs.existsSync(ef)) { console.log(`${c.id}: no model output yet, skipped`); continue; }
  const b = fs.readFileSync(ef); const lp = new Float32Array(b.buffer, b.byteOffset, b.length / 4); const T = lp.length / 257;
  const truth = readCsv(path.join(BENCH, c.folder, c.id, 'shabads.csv')).filter((t) => t.shabadId);
  const truthIds = new Set(truth.flatMap((t) => String(t.shabadId).split('|').map(Number)));
  // the wrong Shabads 9.0.3 put on screen for this recording
  const tr = path.join(V, 'r903/replay/base/l3/trace', `${c.id}.events.jsonl`);
  const shown = fs.existsSync(tr) ? fs.readFileSync(tr, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.type === 'shabad' && e.shabadId != null).map((e) => Number(e.shabadId)) : [];
  const confusions = [...new Set(shown)].filter((s) => !truthIds.has(s));
  const r = rng(c.id);
  const randoms = Array.from({ length: NRAND }, () => allShabads[Math.floor(r() * allShabads.length)]).filter((s) => !truthIds.has(s));
  for (const t of truth) {
    const sid = Number(String(t.shabadId).split('|')[0]);
    for (let a = Number(t.start_s); a + WIN <= Math.min(Number(t.end_s), T / 25); a += STEP) {
      const f0 = Math.round(a * 25), f1 = Math.round((a + WIN) * 25);
      const me = score(sid, lp, f0, f1);
      if (!me) continue;
      const conf = confusions.map((s) => score(s, lp, f0, f1)).filter(Boolean);
      const rand = randoms.map((s) => score(s, lp, f0, f1)).filter(Boolean);
      const bestConf = conf.length ? Math.max(...conf.map((x) => x.score)) : -Infinity;
      const bestRand = rand.length ? Math.max(...rand.map((x) => x.score)) : -Infinity;
      res.push({ clip: c.id, at: a, truth: me.score, heard: me.heard, bestConf, nConf: conf.length, bestRand, margin: me.score - Math.max(bestConf, bestRand) });
    }
  }
  const mine = res.filter((x) => x.clip === c.id);
  console.log(`${c.id}: ${mine.length} windows, right Shabad best in ${mine.filter((x) => x.margin > 0).length}; ${confusions.length} wrong Shabads 9.0.3 showed`);
}
const pct = (n, d) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;
const withConf = res.filter((x) => x.nConf > 0);
console.log(`\n${WIN} s windows every ${STEP} s, ${clips.length} practice recordings, ${res.length} windows`);
console.log('| test | windows | right Shabad scores best | ... by a clear margin (> 20) |\n|---|---|---|---|');
console.log(`| vs ${NRAND} random Shabads | ${res.length} | ${pct(res.filter((x) => x.truth > x.bestRand).length, res.length)} | ${pct(res.filter((x) => x.truth - x.bestRand > 20).length, res.length)} |`);
console.log(`| vs the wrong Shabads 9.0.3 showed | ${withConf.length} | ${pct(withConf.filter((x) => x.truth > x.bestConf).length, withConf.length)} | ${pct(withConf.filter((x) => x.truth - x.bestConf > 20).length, withConf.length)} |`);
console.log(`| vs both | ${res.length} | ${pct(res.filter((x) => x.margin > 0).length, res.length)} | ${pct(res.filter((x) => x.margin > 20).length, res.length)} |`);
fs.writeFileSync(path.join(V, `result-w${WIN}.json`), JSON.stringify(res, null, 1));
realm.close();
