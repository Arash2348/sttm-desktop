#!/usr/bin/env node
/* gab-quick.js — pangti-level GAB re-test in minutes after a Voice Autopilot (harness) change, per form of Guru's
 * Bani, from SAVED speech-model output only (the model never runs here).
 *
 *   gab-quick <git ref | app worktree> [--set all|main,paath,sungbani,akhandpaath,akhand,kbv1] [--jobs 4]
 *             [--baseline <ref | worktree | none>] (default 6a866c94 = 10.0.5) [--no-reuse] [--keep-worktree]
 *             [--name <label>] [--no-query-cache] [--keys-cache <dir with manifest.json + keys/>]
 *   gab-quick --pull [--set ...]      fresh machine: fill the local cache from the PRIVATE Hugging Face dataset
 *                                     khalisfoundation/GAB-cache (manifest, pangti keys, model output, audio)
 *   gab-quick --build-cache           maintainer, this Mac: write <cache>/gab-cache/{manifest.json,keys/,README.md}
 *                                     from the local replay data (the recordings the GAB viewer scores at pangti level)
 *   gab-quick --push                  maintainer: upload <cache>/gab-cache + the model-output entries + Karanbir v1
 *                                     audio to khalisfoundation/GAB-cache (refuses if the dataset is not private)
 *
 * What a run does: (a) materialises the app at <ref> in research/gab-ui/gen/app-<sha> (git worktree, removed at the
 * end) and the replay tools (TOOLS_REF, git archive) in research/gab-ui/gen/tools-<sha>; (b) replays every
 * pangti-keyed public recording of the chosen sets over the cached model output (VF_EMIS_MODE=replay: a missing window
 * is a hard CACHE MISS, never re-heard; the run then ends INCOMPLETE, exit 3), N workers under nice -n 19; (c) scores
 * at pangti level with the owner's rule (tools/pangti-timeline.js scoreClip, the same code as the viewer's re-score);
 * (d) prints one table per form of Guru's Bani with the diff against the baseline build; (e) writes viewer timeline
 * JSON to research/gab-ui/quick-out/<slug>/timeline/ (view: python3 -m http.server -d research/gab-ui/quick-out/<slug>).
 * A committed, unchanged app tree that was replayed before (same tools, model, codec) is reused from
 * <cache>/replays/ (the vf-check rule), so a baseline costs seconds.
 *
 * Environment: GAB_CACHE (default ~/personal/live-darbar-venues/cache: model output <model12>-<codec>/<entry>/,
 * replays/, gab-cache/), MODEL (only its sha256 names the cache; --pull writes a stub when the model is absent),
 * GAB_NODE_MODULES (default ~/personal/sttm-desktop/node_modules), HF_TOKEN or ~/.vf-hf-token (pull / push).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const H = os.homedir();
const GUI = path.resolve(__dirname, '..');
const GEN = path.join(GUI, 'gen');
const QOUT = path.join(GUI, 'quick-out');
const REPO = execFileSync('git', ['-C', GUI, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const ROOT = path.resolve(process.env.GAB_CACHE || path.join(H, 'personal/live-darbar-venues/cache'));
const GC = path.join(ROOT, 'gab-cache');
// --keys-cache <dir>: manifest.json + keys/ from another copy (e.g. gen/gab-cache-v2 from tools/quick-keys-v2.js: the
// overnight-label keys); model output, clips and bench still come from GC
const NODE_MODULES = process.env.GAB_NODE_MODULES || path.join(H, 'personal/sttm-desktop/node_modules');
// the replay tools commit the viewer's pangti timelines were made with (branch gab-v1.5-timeline); its replay files
// (bench-driver, emis-cache, runners) are identical in gab-tools-handoff
const TOOLS_REF = process.env.GAB_TOOLS_REF || '109ac5b04a50203c3d9a0a41db2e7f9700e2c22d';
const COMPAT = 'c1'; // gab-quick's compatibility patch level on top of TOOLS_REF (see ensureTools)
const MODEL_ID = '5f9e41d867de'; // karansea IndicConformer CTC int8 (sha256 prefix of the model file)
const HF_CACHE_REPO = 'khalisfoundation/GAB-cache';
const HF_GAB_REPO = 'khalisfoundation/GurbaniAutopilotBench'; // read only (audio of the public recordings)
const CATS = ['main', 'paath', 'sungbani', 'akhandpaath', 'akhand', 'kbv1'];
const CAT_TITLE = { main: 'Kirtan', paath: 'Paath', sungbani: 'Sung Bani', akhandpaath: 'Sehaj / Akhand Paath', akhand: 'Akhand Kirtan', kbv1: 'Karanbir v1 (kirtan)' };
// model-output namespaces: tools codec name (local dir <model12>-<codec>) <-> Hugging Face folder label
const NS = { 'q16-x86': { hf: 'q16-x86', what: 'x86 (linux-x64) model output, the production reference' }, q16: { hf: 'q16-mac', what: 'Apple silicon model output (Karanbir v1 only; x86 not recorded yet)' } };
const KNOWN_MODELS = [process.env.MODEL, path.join(H, 'personal/sttm-usertest-profile/voice-follow/model.int8.onnx'), path.join(H, 'AAI/models/karansea-shabad-ctc/model.int8.onnx'), path.join(H, 'Library/Application Support/SikhiToTheMax/voice-follow/model.int8.onnx'), path.join(GC, 'model-stub', `${MODEL_ID}.onnx`)];

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const JOBS = Math.max(1, Number(arg('jobs', 4)));
const META = path.resolve(arg('keys-cache', GC));
const KEYSFX = META === path.resolve(GC) ? '' : `-${path.basename(META)}`; // runs on other keys never overwrite the default output
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, ...opts }).trim();
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const now = () => Date.now() / 1000;
const fmtS = (s) => (s >= 90 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(0)} s`);
const die = (m, code = 2) => { console.error(`gab-quick: ${m}`); process.exit(code); };
const sets = () => { const s = arg('set', 'all'); const l = s === 'all' ? CATS : s.split(','); for (const c of l) if (!CATS.includes(c)) die(`unknown set ${c} (have ${CATS.join(', ')}, all)`); return l; };
const hfToken = () => process.env.HF_TOKEN || (fs.existsSync(path.join(H, '.vf-hf-token')) ? fs.readFileSync(path.join(H, '.vf-hf-token'), 'utf8').trim() : '');
const fileSha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ---------------------------------------------------------------- materialise tools + app ----
function ensureTools() {
  const sha = sh('git', ['-C', REPO, 'rev-parse', '--verify', `${TOOLS_REF}^{commit}`]);
  const dir = path.join(GEN, `tools-${sha.slice(0, 12)}-${COMPAT}`);
  const tools = path.join(dir, 'research/level2-dataset/tools');
  if (!fs.existsSync(path.join(tools, 'vf-check.js'))) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} research/level2-dataset ':(exclude)research/level2-dataset/results' | tar -x -C "${dir}"`]);
    // compat c1: the test bridge's diagnostic snapshot reads flIndexRef (the 10.x retrieval client); builds without it
    // (upstream 9.0.8) threw ReferenceError on every recording. Read it only when the build declares it.
    const bd = path.join(tools, 'bench-driver.js');
    const src = fs.readFileSync(bd, 'utf8');
    const out = src.replace('indexSize: flIndexRef.current?.size || 0,', "indexSize: (typeof flIndexRef === 'undefined' ? 0 : flIndexRef.current?.size || 0),")
      .replace('retrievalReady: !!flIndexRef.current,', "retrievalReady: typeof flIndexRef !== 'undefined' && !!flIndexRef.current,");
    if (out === src || /flIndexRef\.current\?\.size \|\| 0,\n/.test(out)) throw new Error('bench-driver compat anchors changed: update gab-quick ensureTools');
    fs.writeFileSync(bd, out);
  }
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(NODE_MODULES, nm);
  return { sha, dir, tools };
}
function treeKey(root) {
  try {
    if (sh('git', ['-C', root, 'status', '--porcelain', '--', 'www', ':(exclude)www/assets/videos'])) return null;
    return sh('git', ['-C', root, 'rev-parse', 'HEAD:www']);
  } catch (_) { return null; }
}
// <ref | worktree> -> { root, sha, slug, cleanup() }
function materialiseApp(spec, label) {
  const asDir = path.resolve(spec);
  if (fs.existsSync(path.join(asDir, 'www'))) {
    let sha = 'nogit';
    try { sha = sh('git', ['-C', asDir, 'rev-parse', 'HEAD']); } catch (_) { /* plain copy */ }
    const dirty = !treeKey(asDir);
    const slug = label || `wt-${path.basename(asDir)}-${sha.slice(0, 8)}${dirty ? '-dirty' : ''}${KEYSFX}`;
    return { root: asDir, sha, slug, spec, cleanup: () => {} };
  }
  let sha;
  try { sha = sh('git', ['-C', REPO, 'rev-parse', '--verify', `${spec}^{commit}`]); } catch (_) { die(`not a worktree or a git ref: ${spec}`); }
  const dir = path.join(GEN, `app-${sha.slice(0, 12)}-${process.pid}`);
  fs.mkdirSync(GEN, { recursive: true });
  sh('git', ['-C', REPO, 'worktree', 'add', '--detach', dir, sha]);
  fs.symlinkSync(NODE_MODULES, path.join(dir, 'node_modules'));
  const cleanup = () => {
    if (flag('keep-worktree')) return;
    try { fs.unlinkSync(path.join(dir, 'node_modules')); } catch (_) { /* gone */ }
    try { sh('git', ['-C', REPO, 'worktree', 'remove', '--force', dir]); } catch (e) { console.error(`(could not remove ${dir}: ${e.message})`); }
  };
  return { root: dir, sha, slug: label || `q-${sha.slice(0, 8)}${KEYSFX}`, spec, cleanup };
}
function modelPath() {
  const m = KNOWN_MODELS.filter(Boolean).find((f) => fs.existsSync(f));
  if (!m) die('no model file and no stub: run gab-quick --pull first (or set MODEL)');
  return m;
}

// ---------------------------------------------------------------- manifest -------------------
function loadManifest() {
  const f = path.join(META, 'manifest.json');
  if (!fs.existsSync(f)) die(`no ${f}: run gab-quick --pull (fresh machine) or --build-cache (maintainer)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
// tools env: clips / Akhand Paath bench from the pulled copy when there is one
function toolsEnv() {
  const env = {};
  if (fs.existsSync(path.join(GC, 'clips'))) env.VF_CLIPS = path.join(GC, 'clips');
  if (fs.existsSync(path.join(GC, 'bench', 'manifest.csv'))) env.VF_BENCHMARK = path.join(GC, 'bench');
  return env;
}

// ---------------------------------------------------------------- replay ---------------------
function harnessKey(tools) {
  const files = ['bench-driver.js', 'emis-cache.js', 'bench-runner.js', 'khalis-bench.js', 'renton-bench.js', 'nw-bench.js', 'no-shadow-preload.js'];
  return sha1(files.map((f) => fs.readFileSync(path.join(tools, f), 'utf8')).join('\0'));
}
// the app's full-table text search is over half of a replay's CPU: realm-query-cache.js serves repeated identical
// Verse queries from disk (exact; local only, keyed by the database file). --no-query-cache turns it off.
const queryCacheEnv = () => (flag('no-query-cache') ? {} : { GAB_QUERY_CACHE: path.join(ROOT, 'query-cache'), NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${path.join(__dirname, 'realm-query-cache.js')}`.trim() });
function makeTasks(jobs, root, outRoot, codec, model) {
  const total = jobs.reduce((a, j) => a + j.dur, 0);
  const target = Math.max(60, total / (JOBS * 3));
  const groups = new Map();
  for (const j of jobs) { const g = `${j.suite}|${JSON.stringify(j.args)}`; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(j); }
  const tasks = [];
  for (const list of groups.values()) {
    const { suite } = list[0];
    const outDir = path.join(outRoot, suite);
    const base = { side: 'cand', suite, outDir, args: [...list[0].args, ...(list[0].root ? ['--root', root] : [])],
      env: { ...toolsEnv(), VF_DRIVER_ROOT: root, VF_EMIS_CACHE: ROOT, VF_EMIS_MODE: 'replay', VF_EMIS_CODEC: codec, MODEL: model, VF_NO_EMIS_PULL: '1', VF_EVENT_TRACE: path.join(outDir, 'trace'), ...queryCacheEnv() } };
    const canShard = list.every((j) => j.only);
    const dur = list.reduce((a, j) => a + j.dur, 0);
    const k = !canShard ? 1 : Math.max(1, Math.min(list.length, Math.round(dur / target)));
    const shards = Array.from({ length: k }, () => ({ jobs: [], dur: 0 }));
    for (const j of [...list].sort((a, b) => b.dur - a.dur)) { const s0 = shards.reduce((m, x) => (x.dur < m.dur ? x : m), shards[0]); s0.jobs.push(j); s0.dur += j.dur; }
    shards.filter((x) => x.jobs.length).forEach((x, i) => tasks.push({ ...base, ...x, key: `${suite}#${i}`, jobDir: path.join(outRoot, '.jobs', suite, String(i)) }));
  }
  return tasks;
}
// the tools' own pool (vf-check --pool) under nice 19, in one of the shared replay slots (other agents' replays)
function runPool(tools, plan, file) {
  fs.writeFileSync(file, JSON.stringify(plan, null, 1));
  const poolArgs = ['nice', '-n', '19', process.execPath, path.join(tools, 'vf-check.js'), '--pool', file];
  const slots = Number(process.env.VF_REPLAY_SLOTS || 3);
  return new Promise((resolve, reject) => {
    let said = false;
    const attempt = (k) => {
      if (k >= slots) { if (!said) { console.error(`  all ${slots} replay slots busy, waiting ...`); said = true; } return setTimeout(() => attempt(0), 5000); }
      const child = spawn('lockf', ['-k', '-t', '0', `/tmp/vf-replay-slot-${k}.lock`, ...poolArgs], { cwd: tools, stdio: ['ignore', 'inherit', 'inherit'] });
      child.on('close', (code) => {
        if (code === 75) return attempt(k + 1);
        if (code) return reject(new Error(`pool exited ${code}`));
        resolve(JSON.parse(fs.readFileSync(`${file}.status.json`, 'utf8')));
      });
    };
    attempt(0);
  });
}
const copyRun = (fromDir, toDir, j) => {
  fs.mkdirSync(path.join(toDir, 'trace'), { recursive: true });
  fs.copyFileSync(path.join(fromDir, j.outFile), path.join(toDir, j.outFile));
  const tr = path.join(fromDir, 'trace', `${j.id}.events.jsonl`);
  if (fs.existsSync(tr)) fs.copyFileSync(tr, path.join(toDir, 'trace', `${j.id}.events.jsonl`));
};

// jobs of one category: the tools' suite jobs for the manifest's recordings (fail loudly when one has none)
function categoryJobs(T, man, cat) {
  Object.assign(process.env, toolsEnv());
  const { SUITES } = require(path.join(T.tools, 'vf-suites.js'));
  const recs = man.recordings.filter((r) => r.category === cat);
  const bySuite = {};
  const out = []; const problems = [];
  for (const r of recs) {
    if (!bySuite[r.suite]) bySuite[r.suite] = SUITES[r.suite].jobs();
    const j = bySuite[r.suite].find((x) => x.id === r.cache_entry);
    if (!j) { problems.push(`${r.id}: the ${r.suite} suite has no job for ${r.cache_entry} (audio missing? expected ${r.audio.local})`); continue; }
    if (!fs.existsSync(path.join(ROOT, `${MODEL_ID}-${r.namespace}`, r.cache_entry, 'index.jsonl'))) { problems.push(`${r.id}: no cached model output ${MODEL_ID}-${r.namespace}/${r.cache_entry} (run gab-quick --pull)`); continue; }
    out.push({ ...j, suite: r.suite, rec: r });
  }
  return { jobs: out, problems, n: recs.length };
}

// replay one category for one app; returns { dir (suite/trace layout), wall, reused, missed, failed }
async function replayCategory(T, app, man, cat, outRoot) {
  const t0 = now();
  const { jobs, problems } = categoryJobs(T, man, cat);
  const codec = man.categories[cat].namespace;
  const model = modelPath();
  const { modelSha } = require(path.join(T.tools, 'emis-cache.js'));
  const msha = modelSha(model, ROOT);
  if (msha.slice(0, 12) !== MODEL_ID) die(`model ${model} is ${msha.slice(0, 12)}, the cache is ${MODEL_ID}`);
  const tk = treeKey(app.root);
  const savedDir = tk ? path.join(ROOT, 'replays', sha1(`${tk}|${harnessKey(T.tools)}|${msha}|${codec}`).slice(0, 16)) : null;
  const dir = path.join(outRoot, 'replay', cat);
  fs.rmSync(dir, { recursive: true, force: true });
  const todo = []; let reused = 0;
  for (const j of jobs) {
    const saved = savedDir && path.join(savedDir, j.suite);
    if (saved && !flag('no-reuse') && fs.existsSync(path.join(saved, j.outFile)) && fs.existsSync(path.join(saved, 'trace', `${j.id}.events.jsonl`))) { copyRun(saved, path.join(dir, j.suite), j); reused++; } else todo.push(j);
  }
  let st = { status: {} };
  if (todo.length) st = await runPool(T.tools, { jobs: JOBS, tasks: makeTasks(todo, app.root, dir, codec, model) }, path.join(outRoot, `replay-${cat}.plan.json`));
  const missed = []; const failed = [...problems];
  for (const j of todo) {
    const s = st.status[`cand/${j.suite}/${j.id}`];
    if (!s) failed.push(`${j.rec.id}: not run`);
    else if (s.missed) missed.push(j.rec.id);
    else if (s.code) failed.push(`${j.rec.id}: ${s.err || `exit ${s.code}`}`);
    else if (savedDir) copyRun(path.join(dir, j.suite), path.join(savedDir, j.suite), j);
  }
  return { dir, wall: now() - t0, reused, replayed: todo.length, audio: jobs.reduce((a, j) => a + j.dur, 0), missed, failed, jobs };
}

// ---------------------------------------------------------------- scoring --------------------
let LIB = null;
function lib(T) {
  if (!LIB) { process.env.GAB_TOOLS = T.tools; LIB = require('./pangti-timeline.js'); }
  return LIB;
}
const keyOf = (r) => JSON.parse(fs.readFileSync(path.join(META, r.key.path, 'key.json'), 'utf8'));
function scoreCategory(T, man, cat, rep, slug, app) {
  const L = lib(T);
  const texts = []; const tIdx = new Map();
  const Tx = (s) => { if (s == null) return -1; if (!tIdx.has(s)) { tIdx.set(s, texts.length); texts.push(s); } return tIdx.get(s); };
  const clips = [];
  const bad = new Set([...rep.missed, ...rep.failed.map((e) => e.split(':')[0])]);
  for (const j of rep.jobs) {
    const r = j.rec;
    if (bad.has(r.id)) continue; // a replay that stopped at a cache miss left a partial trace: never score it
    const tr = path.join(rep.dir, j.suite, 'trace', `${j.id}.events.jsonl`);
    if (!fs.existsSync(tr)) continue;
    const k = keyOf(r);
    const res = L.scoreClip({ meta: r.meta, truth: { lines: k.lines, shabads: k.shabads, corrections: [] }, basis: k.basis, states: L.statesFromTrace(tr), texts: Tx });
    const c = { id: r.id, folder: r.meta.folder, gurdwara: r.meta.gurdwara, dur: r.meta.dur, basis: k.basis, kb: r.meta.kb ?? null, yt: r.meta.yt ?? null, n: res.n, runs: res.runs };
    for (const x of ['bani', 'session', 'basis_note']) if (r.meta[x] != null) c[x] = r.meta[x];
    clips.push(c);
  }
  const v = man.categories[cat].viewer;
  return { gab: v.gab, label: app.label || slug, commit: (app.sha || '').slice(0, 12), set: v.set, split: v.split, scoring: 'pangti', texts, clips };
}
function totals(tl) {
  const n = Object.fromEntries(['P', 'B', 'A', 'W', 'N', 'V', 'G'].map((k) => [k, tl.clips.reduce((a, c) => a + (c.n[k] || 0), 0)]));
  const said = n.P + n.B + n.A + n.W + n.N + n.V;
  const all = said + n.G;
  return { n, right: said ? (100 * (n.P + n.B)) / said : null, wrongSh: all ? (3600 * n.W) / all : null, gShare: all ? (100 * n.G) / all : null, saidH: said / 3600, clips: tl.clips.length };
}

// ---------------------------------------------------------------- one build ------------------
async function runBuild(spec, { label, isBaseline } = {}) {
  const T = ensureTools();
  const man = loadManifest();
  const app = materialiseApp(spec, label);
  app.label = arg('name') && !isBaseline ? arg('name') : app.label;
  const outRoot = path.join(QOUT, app.slug);
  const res = { slug: app.slug, spec, sha: app.sha, tools: `${T.sha} + compat ${COMPAT}`, cats: {}, started: new Date().toISOString() };
  const t0 = now();
  try {
    fs.mkdirSync(path.join(outRoot, 'timeline'), { recursive: true });
    for (const cat of sets()) {
      console.error(`${isBaseline ? 'baseline' : 'build'} ${app.slug}: ${cat} ...`);
      const rep = await replayCategory(T, app, man, cat, outRoot);
      const ts = now();
      const tl = scoreCategory(T, man, cat, rep, app.slug, app);
      fs.writeFileSync(path.join(outRoot, 'timeline', `${app.slug}-${cat}.json`), JSON.stringify(tl));
      res.cats[cat] = { ...totals(tl), recordings: man.recordings.filter((r) => r.category === cat).length, audioMin: rep.audio / 60, wall: rep.wall + (now() - ts), replayWall: rep.wall, scoreWall: now() - ts, reused: rep.reused, replayed: rep.replayed, missed: rep.missed, failed: rep.failed };
      const c = res.cats[cat];
      console.error(`  ${cat}: ${c.clips}/${c.recordings} recordings, ${c.replayed} replayed + ${c.reused} reused, ${fmtS(c.wall)}${c.missed.length ? `, CACHE MISS ${c.missed.join(' ')}` : ''}${c.failed.length ? `, ERRORS ${c.failed.length}` : ''}`);
    }
  } finally { app.cleanup(); }
  res.wall = now() - t0;
  fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(res, null, 1));
  return res;
}

// viewer: index.json for this build + the baseline, the viewer page next to it
function writeViewer(res, base, man) {
  const out = path.join(QOUT, res.slug);
  const tiers = [];
  for (const cat of Object.keys(res.cats)) {
    const builds = [];
    if (base && base.cats[cat]) {
      const f = `${base.slug}-${cat}.json`;
      fs.copyFileSync(path.join(QOUT, base.slug, 'timeline', f), path.join(out, 'timeline', f));
      builds.push({ slug: base.slug, file: f, label: `${base.slug} (baseline)`, commit: (base.sha || '').slice(0, 8), note: 'baseline' });
    }
    builds.push({ slug: res.slug, file: `${res.slug}-${cat}.json`, label: arg('name') || res.slug, commit: (res.sha || '').slice(0, 8), note: 'candidate' });
    tiers.push({ key: cat, title: man.categories[cat].viewer.title, builds });
  }
  fs.writeFileSync(path.join(out, 'timeline', 'index.json'), JSON.stringify({ tiers }, null, 1));
  for (const f of ['index.html', 'style.css']) if (fs.existsSync(path.join(GUI, 'site', f))) fs.copyFileSync(path.join(GUI, 'site', f), path.join(out, f));
  const audio = path.join(out, 'audio');
  if (!fs.existsSync(audio) && fs.existsSync(path.join(GUI, 'site', 'audio'))) fs.symlinkSync(path.join(GUI, 'site', 'audio'), audio);
}

function report(res, base) {
  const f1 = (x) => (x == null ? '-' : x.toFixed(1));
  const d = (a, b) => (a == null || b == null ? '' : ` (${a - b >= 0 ? '+' : ''}${(a - b).toFixed(1)})`);
  const lines = [];
  lines.push(`GAB quick (pangti level, owner rule), ${res.slug} (${res.spec}) vs ${base ? `${base.slug} (${base.spec})` : 'no baseline'}`);
  lines.push('right pangti % = (P+B)/(P+B+A+W+N+V) while a pangti is sung/read; wrong s/h = seconds of a different Shabad/Bani per hour of scored time; G share = no-pangti seconds (neutral) / scored seconds');
  lines.push('');
  lines.push('| form of Guru\'s Bani | recordings | right pangti % | wrong s/h | G share % | recordings changed | wall |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const [cat, c] of Object.entries(res.cats)) {
    let b = base && base.cats[cat];
    let changed = '-';
    if (b) {
      const A = JSON.parse(fs.readFileSync(path.join(QOUT, res.slug, 'timeline', `${res.slug}-${cat}.json`), 'utf8'));
      const B = JSON.parse(fs.readFileSync(path.join(QOUT, base.slug, 'timeline', `${base.slug}-${cat}.json`), 'utf8'));
      // the diff is over the recordings both sides scored (an INCOMPLETE side never shifts the other's number)
      const ids = new Set(A.clips.map((x) => x.id).filter((id) => B.clips.some((y) => y.id === id)));
      if (ids.size !== A.clips.length || ids.size !== B.clips.length) {
        b = totals({ clips: B.clips.filter((x) => ids.has(x.id)) });
        const a = totals({ clips: A.clips.filter((x) => ids.has(x.id)) });
        c.note = `diff over the ${ids.size} recordings both scored: ${a.right?.toFixed(1)} vs ${b.right?.toFixed(1)}`;
        b = { ...b, right: b.right - (a.right - c.right), wrongSh: b.wrongSh - (a.wrongSh - c.wrongSh) }; // so c - b = a - b(common)
      }
      const sig = (tl, c0) => JSON.stringify(c0.runs.map((r) => [r[0], r[1], r[2], tl.texts[r[3]] ?? null, tl.texts[r[4]] ?? null]));
      const bm = new Map(B.clips.map((x) => [x.id, sig(B, x)]));
      changed = String(A.clips.filter((x) => bm.get(x.id) !== sig(A, x)).length);
    }
    const inc = c.missed.length || c.failed.length ? ' INCOMPLETE' : '';
    lines.push(`| ${CAT_TITLE[cat]} | ${c.clips}/${c.recordings}${inc}${c.note ? '*' : ''} | ${f1(c.right)}${b ? d(c.right, b.right) : ''} | ${f1(c.wrongSh)}${b ? d(c.wrongSh, b.wrongSh) : ''} | ${f1(c.gShare)} | ${changed} | ${fmtS(c.wall)} (${c.replayed} replayed, ${c.reused} reused) |`);
  }
  for (const [cat, c] of Object.entries(res.cats)) if (c.note) lines.push(`* ${CAT_TITLE[cat]}: ${c.note}`);
  lines.push('');
  lines.push(`total wall ${fmtS(res.wall)}${base ? ` (+ baseline ${fmtS(base.wall)})` : ''}; timelines: ${path.join(QOUT, res.slug, 'timeline')} (view: python3 -m http.server -d ${path.join(QOUT, res.slug)})`);
  const bad = Object.entries(res.cats).filter(([, c]) => c.missed.length || c.failed.length);
  if (bad.length) {
    lines.push('');
    lines.push('INCOMPLETE: these recordings were NOT scored (no model was run; a cache miss means this build asks the model for windows never heard):');
    for (const [cat, c] of bad) { if (c.missed.length) lines.push(`  ${cat}: CACHE MISS ${c.missed.join(' ')}`); for (const e of c.failed) lines.push(`  ${cat}: ${e.split('\n')[0]}`); }
  }
  const txt = lines.join('\n');
  console.log(txt);
  fs.writeFileSync(path.join(QOUT, res.slug, 'report.md'), `${txt}\n`);
  return bad.length ? 3 : 0;
}

// ---------------------------------------------------------------- --build-cache (maintainer) --
function buildCache() {
  const T = ensureTools();
  process.env.GAB_TOOLS = T.tools;
  const L = lib(T);
  const { SUITES } = require(path.join(T.tools, 'vf-suites.js'));
  const HF_DS = path.join(ROOT, 'gab-hf/701fee8e59c4');
  const KBV1_DS = path.join(H, 'personal/gab-builds/kbv1-bench');
  const hf = L.sv.loadDataset(HF_DS);
  const kb = L.sv.loadDataset(KBV1_DS);
  const TP = path.join(GUI, 'timeline-pangti');
  const idx = [...JSON.parse(fs.readFileSync(path.join(TP, 'index.json'), 'utf8')).tiers, ...JSON.parse(fs.readFileSync(path.join(TP, 'index-extra.json'), 'utf8')).tiers];
  const man = { version: 1, made: new Date().toISOString(), model: { id: MODEL_ID, name: 'karansea IndicConformer CTC, int8 export used by STTM Desktop', sha256: '5f9e41d867dee2883796e290eef85abc11cbd32fe0f10c1f763a638d824634f9' },
    tools: { ref: T.sha, branch: 'gab-v1.5-timeline (sttm-desktop repo)' }, rule: 'owner pangti rule 2026-10-22 (research/gab-ui/tools/pangti-timeline.js)',
    namespaces: Object.fromEntries(Object.entries(NS).map(([k, v]) => [k, { hf: `hearing/${MODEL_ID}-${v.hf}`, local: `${MODEL_ID}-${k}`, what: v.what }])), categories: {}, recordings: [] };
  const jobsOf = {};
  for (const cat of CATS) {
    const src = JSON.parse(fs.readFileSync(path.join(TP, `c1-6a866c94-${cat}.json`), 'utf8'));
    const tier = idx.find((t) => t.key === cat);
    const ns = cat === 'kbv1' ? 'q16' : 'q16-x86';
    man.categories[cat] = { title: CAT_TITLE[cat], namespace: ns, viewer: { gab: src.gab, set: src.set, split: src.split, title: tier ? tier.title : CAT_TITLE[cat] } };
    for (const meta of src.clips) {
      const ds = cat === 'kbv1' ? kb : hf;
      const row = ds.find(meta.id);
      const suite = row.suite_jobs.split(';')[0].split(':')[0];
      if (!jobsOf[suite]) jobsOf[suite] = SUITES[suite].jobs();
      const clip = row.suite_jobs.split(';')[0].split(':')[1];
      const j = jobsOf[suite].find((x) => x.clip === clip || x.id === clip);
      if (!j) throw new Error(`${meta.id}: no ${suite} job`);
      const { truth, basis } = L.truthOf(ds, row);
      const kdir = path.join(GC, 'keys', cat, meta.id);
      fs.mkdirSync(kdir, { recursive: true });
      for (const f of ['lines.csv', 'shabads.csv']) { const s = path.join(ds.root, row.content_folder, row.id, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(kdir, f)); }
      const key = { id: meta.id, category: cat, basis, lines_source: row.lines_source, truth_provenance: row.truth_provenance, note: 'resolved answer key as scored (dataset csv + clip-notes corrections + aligner check >= 0.6 / ear-check rejections applied); scored=false spans are not scored',
        lines: truth.lines.map((l) => ({ text: l.text, norm: l.norm, start: l.start, end: l.end, verseId: l.verseId ?? null, conf: l.conf ?? null, src: l.src ?? null, scored: !!l.scored })),
        shabads: truth.shabads.map((s) => ({ ids: s.ids, start: s.start, end: s.end })) };
      fs.writeFileSync(path.join(kdir, 'key.json'), JSON.stringify(key));
      const entry = path.join(ROOT, `${MODEL_ID}-${ns}`, j.id);
      const sha = fileSha256(j.wav);
      const audioRel = cat === 'akhandpaath' ? `bench/${row.audio}` : `clips/${path.basename(j.wav)}`;
      man.recordings.push({ id: meta.id, category: cat, suite, job: `${suite}:${clip}`, cache_entry: j.id, namespace: ns,
        hearing: `${man.namespaces[ns].hf}/${sha.slice(0, 16)}`, hearing_bytes: fs.readdirSync(entry).reduce((a, f) => a + fs.statSync(path.join(entry, f)).size, 0),
        audio: { sha256: sha, seconds: j.dur, local: audioRel, from: cat === 'kbv1' ? `${HF_CACHE_REPO}:audio/${sha.slice(0, 16)}.wav` : `${HF_GAB_REPO}:${row.audio}` },
        key: { source: basis, path: `keys/${cat}/${meta.id}` }, meta: { ...Object.fromEntries(Object.entries(meta).filter(([k]) => !['runs', 'n', 'basis'].includes(k))) } });
    }
  }
  const hashes = new Set();
  for (const r of man.recordings) { if (hashes.has(r.hearing)) throw new Error(`two recordings share audio ${r.hearing}`); hashes.add(r.hearing); }
  // Akhand Paath runner reads its rows from a benchmark manifest: keep that manifest's apaath rows for --pull
  const bm = fs.readFileSync(path.join(process.env.VF_BENCHMARK || path.join(H, 'personal/vf-benchmark'), 'manifest.csv'), 'utf8').split('\n');
  fs.writeFileSync(path.join(GC, 'bench-manifest.csv'), `${[bm[0], ...bm.slice(1).filter((l) => /apaath:/.test(l))].join('\n')}\n`);
  fs.writeFileSync(path.join(GC, 'manifest.json'), JSON.stringify(man, null, 1));
  fs.copyFileSync(path.join(__dirname, 'gab-cache-README.md'), path.join(GC, 'README.md'));
  const by = {};
  for (const r of man.recordings) { const b = (by[r.category] = by[r.category] || { n: 0, s: 0, bytes: 0 }); b.n++; b.s += r.audio.seconds; b.bytes += r.hearing_bytes; }
  for (const [c, b] of Object.entries(by)) console.log(`${c}: ${b.n} recordings, ${(b.s / 60).toFixed(1)} min audio, model output ${(b.bytes / 1e6).toFixed(0)} MB`);
  console.log(`wrote ${path.join(GC, 'manifest.json')} (${man.recordings.length} recordings) and keys/`);
  L.close();
}

// ---------------------------------------------------------------- push / pull (Hugging Face) --
function py(script, env = {}) {
  const f = path.join(GEN, `hf-${process.pid}.py`);
  fs.mkdirSync(GEN, { recursive: true });
  fs.writeFileSync(f, script);
  try {
    execFileSync('uv', ['run', '-q', '--with', 'huggingface_hub>=0.30', 'python3', '-I', f], { stdio: 'inherit', env: { ...process.env, HF_TOKEN: hfToken(), ...env } });
  } finally { fs.rmSync(f, { force: true }); }
}
function push() {
  const man = loadManifest();
  // staging folder of symlinks (no copy of the 4 GB of model output): HF layout
  const stage = path.join(GEN, 'gab-cache-stage');
  fs.rmSync(stage, { recursive: true, force: true });
  const link = (src, rel) => { const d = path.join(stage, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.symlinkSync(src, d); };
  for (const f of ['manifest.json', 'README.md', 'bench-manifest.csv']) link(path.join(GC, f), f);
  for (const r of man.recordings) {
    for (const f of fs.readdirSync(path.join(GC, r.key.path))) link(path.join(GC, r.key.path, f), `${r.key.path}/${f}`);
    const entry = path.join(ROOT, `${MODEL_ID}-${r.namespace}`, r.cache_entry);
    for (const f of fs.readdirSync(entry)) link(path.join(entry, f), `${r.hearing}/${f}`);
    if (r.audio.from.startsWith(`${HF_CACHE_REPO}:`)) {
      const wav = path.join(process.env.VF_CLIPS || path.join(H, 'personal/live-darbar-venues/clips'), path.basename(r.audio.local));
      if (fileSha256(wav) !== r.audio.sha256) die(`${r.id}: audio changed since --build-cache`);
      link(wav, r.audio.from.split(':')[1]);
    }
  }
  py(`
import os
from huggingface_hub import HfApi
api = HfApi(token=os.environ['HF_TOKEN'])
repo = '${HF_CACHE_REPO}'
api.create_repo(repo, repo_type='dataset', private=True, exist_ok=True)
assert api.dataset_info(repo).private, 'GAB-cache is not private: refusing to upload'
stage = '${stage}'
# commits of modest size (LFS files already on the Hub are not sent again, so a re-run resumes)
api.upload_folder(repo_id=repo, repo_type='dataset', folder_path=stage, ignore_patterns=['hearing/**'], commit_message='GAB-cache: manifest, pangti keys, Karanbir v1 audio, README')
for ns in sorted(os.listdir(os.path.join(stage, 'hearing'))):
    ents = sorted(os.listdir(os.path.join(stage, 'hearing', ns)))
    for i in range(0, len(ents), 12):
        part = ents[i:i + 12]
        api.upload_folder(repo_id=repo, repo_type='dataset', folder_path=stage, allow_patterns=[f'hearing/{ns}/{e}/*' for e in part], commit_message=f'GAB-cache: model output {ns} ({i + len(part)}/{len(ents)})')
        print('uploaded', ns, i + len(part), '/', len(ents), flush=True)
print('uploaded to', repo, '| private:', api.dataset_info(repo).private)
`);
}
function pull() {
  const want = sets();
  fs.mkdirSync(GC, { recursive: true });
  const dl = path.join(GEN, 'gab-cache-dl');
  // 1) manifest + keys + bench manifest, 2) model output of the chosen sets, 3) audio (GAB-cache for Karanbir v1,
  // the GAB dataset for the rest); then move into the tools' local layout and check every audio sha256
  py(`
import os, json
from huggingface_hub import snapshot_download, hf_hub_download
tok = os.environ['HF_TOKEN']; dl = '${dl}'; want = ${JSON.stringify(want)}
snapshot_download('${HF_CACHE_REPO}', repo_type='dataset', local_dir=dl, token=tok, allow_patterns=['manifest.json', 'README.md', 'bench-manifest.csv', 'keys/**'])
man = json.load(open(os.path.join(dl, 'manifest.json')))
recs = [r for r in man['recordings'] if r['category'] in want]
snapshot_download('${HF_CACHE_REPO}', repo_type='dataset', local_dir=dl, token=tok, allow_patterns=[r['hearing'] + '/*' for r in recs] + [r['audio']['from'].split(':', 1)[1] for r in recs if r['audio']['from'].startswith('${HF_CACHE_REPO}:')])
for r in recs:
    repo, p = r['audio']['from'].split(':', 1)
    if repo != '${HF_CACHE_REPO}': hf_hub_download(repo, p, repo_type='dataset', token=tok, local_dir=os.path.join(dl, 'gab'))
print('downloaded', len(recs), 'recordings')
`);
  fs.copyFileSync(path.join(dl, 'manifest.json'), path.join(GC, 'manifest.json'));
  for (const f of ['README.md', 'bench-manifest.csv']) if (fs.existsSync(path.join(dl, f))) fs.copyFileSync(path.join(dl, f), path.join(GC, f));
  fs.cpSync(path.join(dl, 'keys'), path.join(GC, 'keys'), { recursive: true });
  const man = loadManifest();
  for (const r of man.recordings.filter((x) => want.includes(x.category))) {
    const entry = path.join(ROOT, `${MODEL_ID}-${r.namespace}`, r.cache_entry);
    if (!fs.existsSync(path.join(entry, 'index.jsonl'))) { fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.cpSync(path.join(dl, r.hearing), entry, { recursive: true }); }
    const [repo, p] = r.audio.from.split(/:(.*)/s);
    const src = repo === HF_CACHE_REPO ? path.join(dl, p) : path.join(dl, 'gab', p);
    const dst = path.join(GC, r.audio.local);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    if (fileSha256(dst) !== r.audio.sha256) die(`${r.id}: audio sha256 differs from the manifest (${dst})`);
  }
  fs.mkdirSync(path.join(GC, 'bench'), { recursive: true });
  fs.copyFileSync(path.join(GC, 'bench-manifest.csv'), path.join(GC, 'bench', 'manifest.csv'));
  // the model file only names the cache (sha256): without it, a stub + memo entry stands in (replay never runs it)
  if (!KNOWN_MODELS.slice(0, -1).filter(Boolean).some((f) => fs.existsSync(f))) {
    const stub = path.join(GC, 'model-stub', `${MODEL_ID}.onnx`);
    fs.mkdirSync(path.dirname(stub), { recursive: true });
    fs.writeFileSync(stub, 'stub: gab-quick replay only; the model is never run\n');
    const memo = path.join(ROOT, 'model-sha.json');
    let m = {}; try { m = JSON.parse(fs.readFileSync(memo, 'utf8')); } catch (_) { /* new */ }
    const st = fs.statSync(stub);
    m[`${fs.realpathSync(stub)}|${st.size}|${st.mtimeMs}`] = man.model.sha256;
    fs.writeFileSync(memo, JSON.stringify(m, null, 1));
  }
  fs.rmSync(dl, { recursive: true, force: true });
  console.log(`pulled ${want.join(',')} into ${ROOT} (model output ${MODEL_ID}-<codec>/, gab-cache/{keys,clips,bench})`);
}

// ---------------------------------------------------------------- main -----------------------
async function main() {
  if (flag('build-cache')) return buildCache();
  if (flag('push')) return push();
  if (flag('pull')) return pull();
  const spec = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--no-reuse', '--keep-worktree', '--no-query-cache'].includes(argv[i - 1])));
  if (!spec) die('usage: gab-quick <git ref | app worktree> [--set all|main,...] [--jobs 4] [--baseline <ref|none>] [--no-reuse] | --pull | --build-cache | --push');
  const man = loadManifest();
  const baseSpec = arg('baseline', '6a866c94');
  let base = null;
  if (baseSpec !== 'none') base = await runBuild(baseSpec, { isBaseline: true });
  const res = await runBuild(spec, {});
  writeViewer(res, base, man);
  if (LIB) LIB.close();
  process.exitCode = report(res, base);
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
