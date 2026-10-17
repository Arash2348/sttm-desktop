// Surinder's model vs Karanbir's (the app's) as the Shabad CONFIRMER, on GAB-Akhand practice recordings.
// (A) the app's own verifier checks (vsweep.jsonl from the never-locking debug build: clip, t, the pool the search
//     proposed): re-score each pool Shabad's fit over the same 30 s on each model's emissions; how often the sung
//     Shabad fits best, and what a lock rule (lead >= LD on C checks in a row) would put on screen.
// (B) every 10 s inside the keyed Shabad: how far the sung Shabad's fit is from the unconstrained decode (nats/s),
//     i.e. how well each model hears the Shabad it is told about.
const fs = require('fs'), path = require('path');
const ENG = '/root/personal/stack2/www/main/addons/voice-follow/engine';
const { shabadFit, freeFit, pangtiTokens } = require(path.join(ENG, 'shabadVerify'));
const { SP } = require(path.join(ENG, 'sentencepiece'));
const APP = '/home/user/sttm-desktop', U = '/home/user/gab/userdata';
const Realm = require(path.join(APP, 'node_modules/realm')), anvaad = require(path.join(APP, 'node_modules/anvaad-js'));
const sch = JSON.parse(fs.readFileSync(U + '/realm-schema-evergreen.json'));
const realm = new Realm({ path: U + '/sttmdesktop-evergreen-v2.realm', schema: sch.schemas, schemaVersion: sch.schemaVersion, readOnly: true });
const sp = SP.load();
const tokCache = new Map();
const tokensOf = (sid) => {
  if (!tokCache.has(sid)) tokCache.set(sid, [...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', Number(sid)).sorted('ID')].map((v) => pangtiTokens(sp, anvaad.unicode(v.Gurmukhi || ''))).filter((t) => t.length));
  return tokCache.get(sid);
};
const C = 257, FPS = 25;
const load = (f) => { const b = fs.readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const E = { karanbir: (id) => `/home/user/gab/verifier/emis/${id}.f32`, surinder: (id) => `/home/user/gab/verifier/emis-surinder/${id}.f32` };
const cache = {};
const slice = (m, id, t0, t1) => {
  const k = m + id; if (!cache[k]) cache[k] = load(E[m](id));
  const all = cache[k], T = all.length / C, f0 = Math.max(0, Math.round(t0 * FPS)), f1 = Math.min(T, Math.round(t1 * FPS));
  return f1 - f0 < 2 * FPS ? null : { data: all.subarray(f0 * C, f1 * C), frames: f1 - f0, C, seconds: (f1 - f0) / FPS };
};
const truthOf = (id) => {
  const f = ['/home/user/gab/bench-aligned/1-kirtan-shabad', '/home/user/gab/bench/5-akhand-kirtan'].map((d) => `${d}/${id}/shabads.csv`).find(fs.existsSync);
  const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [k[i], v])));
};
const sungAt = (id, t) => { const r = truthOf(id).find((x) => t >= +x.start_s && t < +x.end_s); return r ? new Set(String(r.shabadId).split('|').map(Number)) : null; };
const models = ['karanbir', 'surinder'];
// (A)
const checks = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const A = {};
for (const m of models) {
  let n = 0, top = 0; const leads = []; const byClip = {};
  for (const x of checks) {
    const id = x.clip.split('_')[0], tr = sungAt(id, x.t); if (!tr || !fs.existsSync(E[m](id))) continue;
    const pool = x.fits.filter((e) => e[3] < 6).map((e) => e[0]); if (pool.length < 2) continue;
    const em = slice(m, id, x.t - x.sec, x.t); if (!em) continue;
    const fits = pool.map((s) => [s, shabadFit(em, tokensOf(s))]).sort((a, b) => b[1] - a[1]);
    n++; if (tr.has(fits[0][0])) top++;
    (byClip[id] = byClip[id] || []).push({ t: x.t, best: fits[0][0], lead: fits[0][1] - fits[1][1], right: tr.has(fits[0][0]) });
  }
  const rules = {};
  for (const LD of [20, 40, 60]) for (const CC of [1, 2]) {
    let right = 0, wrong = 0;
    for (const arr of Object.values(byClip)) { let run = 0, last = null, fired = false; for (const c of arr.sort((a, b) => a.t - b.t)) { const w = c.lead >= LD; run = w && last === c.best ? run + 1 : +w; last = w ? c.best : null; if (run >= CC && !fired) { fired = true; c.right ? right++ : wrong++; } } }
    rules[`lead>=${LD} x${CC}`] = `${right} right / ${wrong} wrong first locks`;
  }
  A[m] = { checks: n, sungFitsBest: `${(100 * top / Math.max(1, n)).toFixed(0)}%`, ...rules };
}
console.log('(A) the app\'s own verifier checks (pool = the search\'s top 6):'); console.table(A);
// (B)
const clips = JSON.parse(fs.readFileSync('/home/user/gab/verifier/clips.json', 'utf8')).filter((c) => c.split !== 'test');
const B = {};
for (const m of models) {
  const gaps = [];
  for (const c of clips) {
    if (!fs.existsSync(E[m](c.id))) continue;
    for (const r of truthOf(c.id)) { const sid = String(r.shabadId).split('|')[0]; if (!/^\d+$/.test(sid)) continue;
      for (let t = +r.start_s + 30; t <= +r.end_s; t += 10) { const em = slice(m, c.id, t - 30, t); if (!em) continue; gaps.push({ id: c.id, g: (freeFit(em) - shabadFit(em, tokensOf(sid))) / em.seconds }); } }
  }
  const s = gaps.map((x) => x.g).sort((a, b) => a - b);
  B[m] = { windows: s.length, medianGap: s[s.length >> 1]?.toFixed(1), p90Gap: s[Math.floor(s.length * 0.9)]?.toFixed(1), weakRecordings: (() => { const w = gaps.filter((x) => ['l3clip16', 'l3clip21', 'l3clip34', 'l3clip35', 'l3clip36', 'l3clip37', 'l3clip38', 'l3clip39'].includes(x.id)).map((x) => x.g).sort((a, b) => a - b); return w.length ? w[w.length >> 1].toFixed(1) : '-'; })() };
}
console.log('(B) how far the sung Shabad is from the unconstrained decode, nats per second (lower = the model hears the Shabad it is told better):'); console.table(B);
realm.close();
