#!/usr/bin/env node
/* vf-check.js — regression check in minutes: replay every suite from the model-output cache
 * (no model runs), for a BASE and a CANDIDATE app worktree, score both with the suites' own
 * scorers and print one table + an event-for-event diff per clip. See REPLAY.md.
 *
 *   node vf-check.js --base <worktree> --cand <worktree> [--suites l2,paath,aarti,fremont,renton,asa]
 *                    [--only clip05,pt12,...] [--sentinel] [--jobs N] [--fill] [--out <dir>]
 *   node vf-check.js --changed <A>..<B>      suites picked from what A..B touched (vf-scope.json);
 *                                             worktrees for A and B are made on demand
 *   node vf-check.js --changed <A> --cand <worktree>   A vs that worktree (uncommitted edits included)
 *   node vf-check.js --record --roots <wt>[,<wt>] [--suites ...] [--only ...]   build the cache (model, lock)
 *   node vf-check.js --plan ...               print what would run, run nothing
 *
 * Every heavy phase takes the shared bench lock itself (lockf -k /tmp/vf-bench.lock, nice 19):
 * replays as ONE job with N workers (default cores/2), recording one suite at a time with
 * VF_ORT_THREADS=3. A cache miss in replay is a hard error for that clip; --fill records the
 * missing clips (model, under the lock) and replays them again.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { SUITES, TOOLS, DS } = require('./vf-suites');
const { DEFAULT_ROOT, modelSha } = require('./emis-cache');

const LOCK = '/tmp/vf-bench.lock';
const MODEL = process.env.MODEL || '/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx';
const CODEC = process.env.VF_EMIS_CODEC || 'q16';
const MAIN_REPO = '/Users/asingh02/personal/sttm-desktop';
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const CACHE = path.resolve(arg('cache', process.env.VF_EMIS_CACHE || DEFAULT_ROOT));
const TIER = arg('tier', 'full'); // smoke: ~10 clips across all suites, after every edit; full: everything
const JOBS = Number(arg('jobs', Math.max(1, Math.floor(os.cpus().length / 2))));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const now = () => Date.now() / 1000;
const fmtS = (s) => (s >= 90 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(0)} s`);

// ---------------------------------------------------------------- pool (internal) --
// node vf-check.js --pool <plan.json>: run the plan's tasks with plan.jobs workers. Runs INSIDE the lock.
// A task is one runner process over one or more clips of one suite (a shard: the corpus index and
// the compiled component are built once per process). Status is per clip. A clip that hits the
// cache's edge stops its process; the clips after it in the shard are requeued.
async function pool(planFile) {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const queue = [...plan.tasks].sort((a, b) => b.dur - a.dur);
  const status = {};
  const t0 = now();
  let seq = 0;
  const runOne = (task) => new Promise((resolve) => {
    const jobDir = `${task.jobDir}-${seq++}`;
    fs.rmSync(jobDir, { recursive: true, force: true });
    fs.mkdirSync(jobDir, { recursive: true });
    fs.mkdirSync(task.outDir, { recursive: true });
    const started = now();
    const only = task.jobs.map((j) => j.only).filter(Boolean);
    const args = ['-r', './no-shadow-preload.js', ...task.args, ...(only.length ? ['--only', only.join(',')] : []), '--out', jobDir];
    const child = spawn(process.execPath, args, { cwd: TOOLS, env: { ...process.env, ...task.env } });
    let err = '';
    child.stderr.on('data', (d) => { err += d; if (err.length > 400000) err = err.slice(-200000); });
    child.stdout.on('data', () => {});
    child.on('close', (code) => {
      const wall = +(now() - started).toFixed(1);
      const missM = err.match(/EMISSIONS CACHE MISS clip=(\S+)/);
      const stats = {};
      for (const m of err.matchAll(/\[emis-cache\] (\S+) \S+ hits (\d+) recorded (\d+) misses (\d+)/g)) stats[m[1]] = { hits: +m[2], recorded: +m[3] };
      const rest = [];
      for (const j of task.jobs) {
        const k = `${task.side}/${task.suite}/${j.id}`;
        const f = path.join(jobDir, j.outFile);
        if (fs.existsSync(f)) {
          fs.copyFileSync(f, path.join(task.outDir, j.outFile));
          status[k] = { code: 0, wall, ...(stats[j.id] || {}) };
        } else if (missM && missM[1] === j.id) {
          status[k] = { code: code || 1, missed: true, wall };
        } else if (missM) rest.push(j);
        else status[k] = { code: code || 1, wall, err: err.split('\n').filter((l) => l && !l.startsWith('[emis-cache]')).slice(-6).join('\n') };
      }
      if (rest.length) queue.push({ ...task, jobs: rest, dur: rest.reduce((a, j) => a + j.dur, 0) });
      const bad = task.jobs.filter((j) => status[`${task.side}/${task.suite}/${j.id}`]?.code);
      if (plan.verbose || bad.length) {
        process.stderr.write(`  ${bad.length ? 'FAIL' : 'ok  '} ${task.side}/${task.suite} ${task.jobs.length === 1 ? task.jobs[0].id : `${task.jobs.length} clips`} ${wall}s${missM ? ` (cache miss in ${missM[1]}${rest.length ? `, ${rest.length} requeued` : ''})` : ''}\n`);
      }
      resolve();
    });
  });
  const worker = async () => { while (queue.length) await runOne(queue.shift()); };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(plan.jobs, queue.length)) }, worker));
  fs.writeFileSync(`${planFile}.status.json`, JSON.stringify({ wall: +(now() - t0).toFixed(1), status }, null, 1));
}

// Run a plan inside the bench lock (a child process holds it for the whole plan).
function runLocked(plan, file, { threads } = {}) {
  fs.writeFileSync(file, JSON.stringify(plan, null, 1));
  return new Promise((resolve, reject) => {
    const envArgs = threads ? ['env', `VF_ORT_THREADS=${threads}`] : [];
    const waitStart = now();
    process.stderr.write(`  waiting for ${LOCK} ...\n`);
    const child = spawn('lockf', ['-k', LOCK, 'nice', '-n', '19', ...envArgs, process.execPath, __filename, '--pool', file], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('close', (code) => {
      if (code) return reject(new Error(`pool exited ${code}`));
      const st = JSON.parse(fs.readFileSync(`${file}.status.json`, 'utf8'));
      st.lockWait = +(now() - waitStart - st.wall).toFixed(1);
      return resolve(st);
    });
  });
}

// ---------------------------------------------------------------- worktrees ----------
function treeKey(root) {
  // app code under test; a dirty www/ tree is never reused
  try {
    const dirty = sh('git', ['-C', root, 'status', '--porcelain', '--', 'www']);
    if (dirty) return null;
    return sh('git', ['-C', root, 'rev-parse', 'HEAD:www']);
  } catch (_) { return null; }
}
function harnessKey() {
  const files = ['bench-driver.js', 'emis-cache.js', 'bench-runner.js', 'khalis-bench.js', 'renton-bench.js', 'nw-bench.js', 'no-shadow-preload.js'];
  return sha1(files.map((f) => fs.readFileSync(path.join(TOOLS, f), 'utf8')).join('\0'));
}
function ensureWorktree(rev, repo = MAIN_REPO) {
  const sha = sh('git', ['-C', repo, 'rev-parse', '--verify', `${rev}^{commit}`]);
  const dir = path.join(CACHE, 'worktrees', sha.slice(0, 12));
  if (!fs.existsSync(path.join(dir, 'www'))) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    sh('git', ['-C', repo, 'worktree', 'add', '--detach', dir, sha]);
  }
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(process.env.VF_NODE_MODULES || path.join(MAIN_REPO, 'node_modules'), nm);
  return dir;
}

// ---------------------------------------------------------------- scope (--changed) ---
function changedAreas(spec, candRoot) {
  const scope = JSON.parse(fs.readFileSync(path.join(TOOLS, 'vf-scope.json'), 'utf8'));
  const [a, b] = spec.split('..');
  const repo = candRoot || MAIN_REPO;
  const range = b ? [a, b] : [a];
  const files = sh('git', ['-C', repo, 'diff', '--name-only', ...range]).split('\n').filter(Boolean);
  const hits = []; // [file, area, why]
  for (const f of files) {
    const rule = scope.paths.find(([p]) => f.startsWith(p) || (p && f.includes(p)));
    const area = rule ? rule[1] : 'all';
    if (area !== '@functions') { hits.push([f, area, rule ? rule[0] || '(default)' : '(default)']); continue; }
    // map every changed hunk of the component to the definition around it
    const diff = sh('git', ['-C', repo, 'diff', '-U0', ...range, '--', f]);
    const src = b ? sh('git', ['-C', repo, 'show', `${b}:${f}`]) : fs.readFileSync(path.join(repo, f), 'utf8');
    const lines = src.split('\n');
    // enclosing definition: a module-level (column 0) const/function, or a function-valued
    // const of the component body (2 spaces: useCallback / useMemo / arrow / function)
    const compStart = lines.findIndex((l) => /^(?:export )?(?:const|function) VoiceFollow\b/.test(l));
    const defAt = (ln) => {
      for (let i = Math.min(ln, lines.length) - 1; i >= 0; i--) {
        let m = lines[i].match(/^(?:export )?(?:const|let|var|async function|function)\s+([A-Za-z_$][\w$]*)/);
        if (m) return m[1];
        if (compStart >= 0 && i > compStart) {
          m = lines[i].match(/^ {2}const ([A-Za-z_$][\w$]*) = (?:useCallback\(|useMemo\(|async\b|\(|function\b|[A-Za-z_$][\w$]*\s*=>)/);
          if (m) return m[1];
        }
      }
      return '(top)';
    };
    const names = new Set();
    for (const h of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
      const start = Number(h[1]);
      const n = h[2] == null ? 1 : Number(h[2]);
      for (let l = start; l < start + Math.max(1, n); l++) names.add(defAt(Math.max(1, l)));
    }
    for (const name of names) {
      const fr = scope.functions.find(([re]) => new RegExp(re).test(name));
      hits.push([`${f}:${name}`, fr ? fr[1] : 'all', fr ? 'function map' : 'unmapped function']);
    }
  }
  const suites = new Set();
  const sentinels = new Set();
  const live = new Set();
  for (const [, area] of hits) {
    const A = scope.areas[area] || scope.areas.all;
    A.suites.forEach((s) => suites.add(s));
    A.sentinels.forEach((s) => sentinels.add(s));
    if (A.live) live.add(A.live);
  }
  for (const s of suites) sentinels.delete(s);
  return { files, hits, suites: [...suites], sentinels: [...sentinels], live: [...live] };
}

// ---------------------------------------------------------------- event diff ----------
const SCREEN = new Set(['shabad', 'verse', 'seeking', 'pane', 'length', 'component-error']);
function loadTrace(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const evKey = (e) => JSON.stringify(e, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v));
// Edit distance (insert/delete) between two key sequences, Myers O((N+M)D), capped.
function editDistance(a, b, cap = 20000) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length;
  let eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const A = a.slice(s, ea);
  const B = b.slice(s, eb);
  const N = A.length;
  const M = B.length;
  if (!N || !M) return { d: N + M, first: N + M ? s : -1 };
  const max = Math.min(N + M, cap);
  const v = new Int32Array(2 * max + 2);
  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[max + k - 1] < v[max + k + 1]) ? v[max + k + 1] : v[max + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      v[max + k] = x;
      if (x >= N && y >= M) return { d, first: s };
    }
  }
  return { d: max, capped: true, first: s };
}
function diffTraces(fa, fb) {
  const A = loadTrace(fa);
  const B = loadTrace(fb);
  if (!A || !B) return null;
  const sa = A.filter((e) => SCREEN.has(e.type));
  const sb = B.filter((e) => SCREEN.has(e.type));
  const scr = editDistance(sa.map(evKey), sb.map(evKey));
  const all = editDistance(A.map(evKey), B.map(evKey));
  const firstT = (arr, i) => (i >= 0 && i < arr.length ? arr[i].t : null);
  return { screen: { n: sa.length, m: sb.length, diff: scr.d, firstT: scr.d ? firstT(sa, scr.first) ?? firstT(sb, scr.first) : null },
    all: { n: A.length, m: B.length, diff: all.d, capped: !!all.capped, firstT: all.d ? firstT(A, all.first) ?? firstT(B, all.first) : null } };
}

// ---------------------------------------------------------------- main ----------------
function selectJobs(suiteNames, { only, sentinel }) {
  const out = [];
  for (const s of suiteNames) {
    const suite = SUITES[s];
    if (!suite) throw new Error(`unknown suite ${s} (have ${Object.keys(SUITES).join(', ')})`);
    let jobs = suite.jobs();
    if (sentinel === true || (Array.isArray(sentinel) && sentinel.includes(s))) jobs = jobs.filter((j) => suite.sentinel.includes(j.clip) || suite.sentinel.includes(j.id));
    if (TIER === 'smoke') jobs = jobs.filter((j) => (suite.smoke || []).includes(j.clip) || (suite.smoke || []).includes(j.id));
    if (only) jobs = jobs.filter((j) => only.has(j.clip) || only.has(j.id));
    out.push(...jobs.map((j) => ({ ...j, suite: s })));
  }
  return out;
}

// Per side: clips grouped by suite + runner args, split into shards of similar audio length
// (about 3 shards per worker overall, so the longest-first queue balances); 1 clip per task when recording.
function makeTasks(jobs, side, root, outRoot, mode, { perClip = false } = {}) {
  const total = jobs.reduce((a, j) => a + j.dur, 0);
  const target = Math.max(60, total / (JOBS * 3));
  const groups = new Map();
  for (const j of jobs) {
    const g = `${j.suite}|${JSON.stringify(j.args)}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(j);
  }
  const tasks = [];
  for (const list of groups.values()) {
    const { suite } = list[0];
    const outDir = path.join(outRoot, side, suite);
    const base = { side, suite, outDir, args: [...list[0].args, ...(list[0].root ? ['--root', root] : [])],
      env: { VF_DRIVER_ROOT: root, VF_EMIS_CACHE: CACHE, VF_EMIS_MODE: mode, VF_EMIS_CODEC: CODEC, MODEL, VF_EVENT_TRACE: path.join(outDir, 'trace') } };
    const canShard = list.every((j) => j.only);
    const dur = list.reduce((a, j) => a + j.dur, 0);
    const k = perClip || !canShard ? (canShard ? list.length : 1) : Math.max(1, Math.min(list.length, Math.round(dur / target)));
    const shards = Array.from({ length: k }, () => ({ jobs: [], dur: 0 }));
    for (const j of [...list].sort((a, b) => b.dur - a.dur)) {
      const sh0 = shards.reduce((m, x) => (x.dur < m.dur ? x : m), shards[0]);
      sh0.jobs.push(j);
      sh0.dur += j.dur;
    }
    shards.filter((x) => x.jobs.length).forEach((x, i) => tasks.push({ ...base, ...x, key: `${side}/${suite}#${i}`, jobDir: path.join(outRoot, '.jobs', side, suite, String(i)) }));
  }
  return tasks;
}

// Lowest-priority queueing for cache builds: take the lock only when no other job is WAITING
// for it (a lockf with no child yet), one clip at a time, so other agents' runs go first.
function foreignWaiters() {
  let out = '';
  try { out = sh('ps', ['-Ao', 'pid=,ppid=,command=']); } catch (_) { return 0; }
  const procs = out.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map((m) => ({ pid: +m[1], ppid: +m[2], cmd: m[3] }));
  const parents = new Set(procs.map((p) => p.ppid));
  return procs.filter((p) => /^lockf -k \/tmp\/vf-bench\.lock/.test(p.cmd) && p.ppid !== process.pid && !parents.has(p.pid)).length;
}
async function politeTurn() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (;;) {
    while (foreignWaiters()) await sleep(20000);
    await sleep(5000); // a script between two of its jobs starts the next lockf within ms
    if (!foreignWaiters()) return;
  }
}

async function record() {
  const roots = (arg('roots', '') || [arg('base'), arg('cand')].filter(Boolean).join(',')).split(',').filter(Boolean).map((r) => path.resolve(r));
  if (!roots.length) throw new Error('--record needs --roots <worktree>[,<worktree>]');
  const suites = (arg('suites', Object.keys(SUITES).join(','))).split(',');
  const only = arg('only') ? new Set(arg('only').split(',')) : null;
  const outRoot = path.resolve(arg('out', path.join(CACHE, 'record-runs', new Date().toISOString().replace(/[:.]/g, '-'))));
  console.log(`record -> cache ${CACHE} (model ${modelSha(MODEL, CACHE).slice(0, 12)}, codec ${CODEC}); runs in ${outRoot}`);
  // suite by suite (each root in turn), so every suite is complete for all roots as early as possible
  for (const s of suites) {
    for (const [ri, root] of roots.entries()) {
      const jobs = selectJobs([s], { only, sentinel: flag('sentinel') });
      if (!jobs.length) continue;
      const side = ri === 0 ? 'base' : `root${ri}`;
      const tasks = makeTasks(jobs, side, root, outRoot, 'record', { perClip: true });
      const audio = jobs.reduce((a, j) => a + j.dur, 0);
      console.log(`== record ${s} on ${root}: ${jobs.length} clips, ${fmtS(audio)} of audio`);
      const all = { wall: 0, lockWait: 0, status: {} };
      // polite (default): one clip per lock turn, only when nobody else is waiting; --greedy: one turn per suite
      const batches = flag('greedy') ? [tasks] : tasks.map((t) => [t]);
      for (const [bi, batch] of batches.entries()) {
        if (!flag('greedy')) await politeTurn();
        const st = await runLocked({ jobs: 1, tasks: batch, verbose: true }, path.join(outRoot, `record-${side}-${s}-${bi}.plan.json`), { threads: 3 });
        all.wall += st.wall;
        all.lockWait += st.lockWait;
        Object.assign(all.status, st.status);
      }
      const st = all;
      const rec = Object.values(st.status).reduce((a, x) => a + (x.recorded || 0), 0);
      const hit = Object.values(st.status).reduce((a, x) => a + (x.hits || 0), 0);
      const bad = Object.entries(st.status).filter(([, x]) => x.code);
      console.log(`   done: model+replay ${fmtS(st.wall)} (lock wait ${fmtS(st.lockWait)}): ${rec} windows recorded, ${hit} already cached${bad.length ? `, ${bad.length} FAILED: ${bad.map(([k]) => k).join(' ')}` : ''}`);
    }
  }
}

async function check() {
  const t0 = now();
  let base = arg('base');
  let cand = arg('cand');
  let suites = arg('suites') ? arg('suites').split(',') : null;
  let sentinel = flag('sentinel');
  let scope = null;
  if (arg('changed')) {
    const spec = arg('changed');
    const [a, b] = spec.split('..');
    if (!base) base = ensureWorktree(a);
    if (!cand) cand = b ? ensureWorktree(b) : null;
    if (!cand) throw new Error('--changed <A> without ..<B> needs --cand <worktree>');
    scope = changedAreas(spec, b ? null : path.resolve(cand));
    if (!suites) {
      suites = [...scope.suites, ...scope.sentinels];
      sentinel = scope.sentinels;
    }
  }
  if (!base && arg('base-rev')) base = ensureWorktree(arg('base-rev'), cand ? path.resolve(cand) : MAIN_REPO);
  if (!base || !cand) throw new Error('need --base and --cand worktrees (or --base-rev <rev>, or --changed A..B)');
  base = path.resolve(base);
  cand = path.resolve(cand);
  suites = suites || Object.keys(SUITES);
  const only = arg('only') ? new Set(arg('only').split(',')) : null;
  const outRoot = path.resolve(arg('out', path.join(DS, 'results', 'vf-check', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'))));
  fs.mkdirSync(outRoot, { recursive: true });
  const log = [];
  const say = (s = '') => { console.log(s); log.push(s); };
  say(`# vf-check ${new Date().toISOString().slice(0, 16)}`);
  say(`base ${base} (${treeKey(base)?.slice(0, 10) || 'dirty'})  cand ${cand} (${treeKey(cand)?.slice(0, 10) || 'dirty'})`);
  if (scope) {
    say(`changed ${arg('changed')}: ${scope.files.length} files`);
    for (const [what, area, why] of scope.hits) say(`  ${what} -> ${area} (${why})`);
    say(`  full suites: ${scope.suites.join(', ') || '-'} | sentinels: ${scope.sentinels.join(', ') || '-'}`);
    for (const l of scope.live) say(`  NEEDS LIVE-PACED CHECK: ${l}`);
  }
  const jobs = selectJobs(suites, { only, sentinel });
  const audio = jobs.reduce((a, j) => a + j.dur, 0);
  say(`suites ${suites.join(',')}${sentinel === true ? ' (sentinels)' : Array.isArray(sentinel) && sentinel.length ? ` (sentinel subsets: ${sentinel.join(',')})` : ''}: ${jobs.length} clips, ${fmtS(audio)} of audio per side; ${JOBS} workers; out ${outRoot}`);
  if (flag('plan')) return;
  if (!jobs.length) { say('nothing to run'); return; }

  // reuse saved replays of an unchanged, committed app tree (same harness, model, codec)
  const hk = harnessKey();
  const msha = modelSha(MODEL, CACHE);
  const savedDir = (root) => { const tk = treeKey(root); return tk ? path.join(CACHE, 'replays', sha1(`${tk}|${hk}|${msha}|${CODEC}`).slice(0, 16)) : null; };
  const roots = { base, cand };
  const sameTree = treeKey(base) && treeKey(base) === treeKey(cand) && !flag('no-reuse');
  const jkey = (side, j) => `${side}/${j.suite}/${j.id}`;
  const outDirOf = (side, suite) => path.join(outRoot, side, suite);
  const copyRun = (fromDir, toDir, j) => {
    fs.mkdirSync(path.join(toDir, 'trace'), { recursive: true });
    fs.copyFileSync(path.join(fromDir, j.outFile), path.join(toDir, j.outFile));
    const tr = path.join(fromDir, 'trace', `${j.id}.events.jsonl`);
    if (fs.existsSync(tr)) fs.copyFileSync(tr, path.join(toDir, 'trace', `${j.id}.events.jsonl`));
  };
  const todo = { base: [], cand: [] };
  let nReused = 0;
  for (const side of ['base', 'cand']) {
    const sd = savedDir(roots[side]);
    for (const j of jobs) {
      const saved = sd && path.join(sd, j.suite);
      if (saved && !flag('no-reuse') && fs.existsSync(path.join(saved, j.outFile)) && fs.existsSync(path.join(saved, 'trace', `${j.id}.events.jsonl`))) {
        copyRun(saved, outDirOf(side, j.suite), j);
        nReused++;
      } else if (side === 'cand' && sameTree) {
        // identical app tree: the candidate's replay IS the base's (copied below)
      } else todo[side].push(j);
    }
  }
  const tasks = [...makeTasks(todo.base, 'base', base, outRoot, 'replay'), ...makeTasks(todo.cand, 'cand', cand, outRoot, 'replay')];
  const nRuns = todo.base.length + todo.cand.length;
  say(`replaying ${nRuns} clip runs in ${tasks.length} processes (${nReused} reused from earlier replays of the same app tree${sameTree ? '; candidate tree == base tree' : ''})`);
  const t1 = now();
  const st = tasks.length ? await runLocked({ jobs: JOBS, tasks }, path.join(outRoot, 'replay.plan.json')) : { wall: 0, lockWait: 0, status: {} };
  const { status } = st;
  const ran = [...todo.base.map((j) => ['base', j]), ...todo.cand.map((j) => ['cand', j])];
  let missed = ran.filter(([side, j]) => status[jkey(side, j)]?.missed);
  let failed = ran.filter(([side, j]) => !status[jkey(side, j)] || (status[jkey(side, j)].code && !status[jkey(side, j)].missed));
  let fillWall = 0;
  if (missed.length && flag('fill')) {
    say(`${missed.length} clip runs went past the cache (their behaviour diverged); recording them (model, under the lock) ...`);
    const tf = now();
    const bySide = (side) => missed.filter(([s]) => s === side).map(([, j]) => j);
    const rec = [...makeTasks(bySide('base'), 'base', base, outRoot, 'record', { perClip: true }), ...makeTasks(bySide('cand'), 'cand', cand, outRoot, 'record', { perClip: true })];
    await runLocked({ jobs: 1, tasks: rec, verbose: true }, path.join(outRoot, 'fill.plan.json'), { threads: 3 });
    const again = [...makeTasks(bySide('base'), 'base', base, outRoot, 'replay'), ...makeTasks(bySide('cand'), 'cand', cand, outRoot, 'replay')];
    const st2 = await runLocked({ jobs: JOBS, tasks: again }, path.join(outRoot, 'replay2.plan.json'));
    Object.assign(status, st2.status);
    fillWall = now() - tf;
    missed = ran.filter(([side, j]) => status[jkey(side, j)]?.missed);
    failed = ran.filter(([side, j]) => !status[jkey(side, j)] || (status[jkey(side, j)].code && !status[jkey(side, j)].missed));
  }
  if (sameTree) for (const j of jobs) if (fs.existsSync(path.join(outDirOf('base', j.suite), j.outFile))) copyRun(outDirOf('base', j.suite), outDirOf('cand', j.suite), j);
  // save clean replays for reuse
  for (const [side, j] of ran) {
    const sd = savedDir(roots[side]);
    if (!sd || status[jkey(side, j)]?.code !== 0) continue;
    copyRun(outDirOf(side, j.suite), path.join(sd, j.suite), j);
  }
  const replayWall = now() - t1;
  missed = missed.map(([side, j]) => ({ key: jkey(side, j), suite: j.suite }));
  failed = failed.map(([side, j]) => ({ key: jkey(side, j), suite: j.suite, err: status[jkey(side, j)]?.err || 'not run' }));

  // score + diff
  const t2 = now();
  let allPass = !missed.length && !failed.length;
  const report = { base, cand, suites: {}, timings: {} };
  say('');
  say('| suite | metric | base | candidate | pass/fail |');
  say('|---|---|---|---|---|');
  const diffLines = [];
  for (const s of suites) {
    const suite = SUITES[s];
    const sj = jobs.filter((j) => j.suite === s);
    if (!sj.length) continue;
    const dirB = path.join(outRoot, 'base', s);
    const dirC = path.join(outRoot, 'cand', s);
    const bad = [...missed, ...failed].filter((t) => t.suite === s);
    let mb = {};
    let mc = {};
    // Baseline cache: metrics per (app tree, harness, suite, clip set) in <cache>/results/; an app
    // tree scored before returns at once. Only clean committed trees with every clip replayed.
    const resultFile = (root) => {
      const tk = treeKey(root);
      const ok = !bad.length && !flag('no-reuse');
      return tk && ok ? path.join(CACHE, 'results', `${tk.slice(0, 12)}-${hk.slice(0, 8)}`, `${s}-${sha1(sj.map((j) => j.id).sort().join(',')).slice(0, 8)}.json`) : null;
    };
    const scoreSide = (root, dir, label) => {
      const f = resultFile(root);
      if (f && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).metrics;
      try {
        const m = suite.score(dir);
        if (f) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ root, tree: treeKey(root), suite: s, clips: sj.map((j) => j.id), metrics: m, at: new Date().toISOString() }, null, 1)); }
        return m;
      } catch (e) { say(`| ${s} | (scorer failed on ${label}: ${String(e.message).split('\n')[0]}) | | | FAIL |`); allPass = false; return {}; }
    };
    mb = scoreSide(base, dirB, 'base');
    mc = sameTree && !bad.length ? mb : scoreSide(cand, dirC, 'candidate');
    const names = suite.metrics ? suite.metrics.map(([n]) => n) : [...new Set([...Object.keys(mb), ...Object.keys(mc)])];
    const dirOf = (n) => (suite.metrics ? suite.metrics.find(([x]) => x === n)[1] : suite.direction(n));
    let suitePass = !bad.length;
    const rows = [];
    for (const n of names) {
      const b = mb[n];
      const c = mc[n];
      const d = dirOf(n);
      let verdict;
      if (b == null && c == null) verdict = '-';
      else if (b == null || c == null) { verdict = 'FAIL (missing)'; suitePass = false; }
      else if (Math.abs(c - b) < 1e-9) verdict = d ? 'pass (same)' : 'info (same)';
      else if (!d) verdict = 'info';
      else if (d * (c - b) > 0) verdict = 'pass (better)';
      else { verdict = 'FAIL (worse)'; suitePass = false; }
      rows.push({ metric: n, base: b, cand: c, verdict });
      say(`| ${s} | ${n} | ${b ?? '-'} | ${c ?? '-'} | ${verdict} |`);
    }
    if (bad.length) say(`| ${s} | clips not replayed (cache miss / error) | | ${bad.length} | FAIL |`);
    // event-for-event diff per clip
    let same = 0;
    let n = 0;
    let evB = 0;
    let evD = 0;
    const clipDiffs = [];
    for (const j of sj) {
      const d = diffTraces(path.join(dirB, 'trace', `${j.id}.events.jsonl`), path.join(dirC, 'trace', `${j.id}.events.jsonl`));
      if (!d) continue;
      n++;
      evB += d.screen.n;
      evD += d.screen.diff;
      if (!d.screen.diff) same++;
      clipDiffs.push({ clip: j.clip, ...d });
      if (d.screen.diff || d.all.diff) diffLines.push(`  ${s}/${j.clip}: screen events ${d.screen.n} -> ${d.screen.m}, ${d.screen.diff} differ${d.screen.firstT != null ? ` (first at ${d.screen.firstT.toFixed(1)} s)` : ''}; all events ${d.all.diff}${d.all.capped ? '+' : ''} differ of ${d.all.n}${d.all.firstT != null ? ` (first at ${d.all.firstT.toFixed(1)} s)` : ''}`);
    }
    say(`| ${s} | screen events identical (clips) | | ${same}/${n} clips, ${evD} of ${evB} events differ | ${suitePass ? 'PASS' : 'FAIL'} |`);
    if (!suitePass) allPass = false;
    report.suites[s] = { pass: suitePass, metrics: rows, clipDiffs, notReplayed: bad.map((t) => t.key) };
  }
  if (diffLines.length) { say(''); say('Event diff (base vs candidate, per clip):'); diffLines.forEach((l) => say(l)); }
  if (missed.length) { say(''); say(`CACHE MISSES (no model was run; rerun with --fill or vf-check --record): ${missed.map((t) => t.key).join(' ')}`); }
  if (failed.length) { say(''); say('ERRORS:'); for (const t of failed) say(`  ${t.key}: ${t.err}`); }
  const scoreWall = now() - t2;
  report.timings = { total: now() - t0, replay: replayWall, lockWait: st.lockWait, fill: fillWall, score: scoreWall };
  say('');
  say(`RESULT: ${allPass ? 'PASS (no metric worse)' : 'FAIL'} | total ${fmtS(now() - t0)} (lock wait ${fmtS(st.lockWait || 0)}, replay ${fmtS(st.wall || 0)}${fillWall ? `, fill ${fmtS(fillWall)}` : ''}, scoring+diff ${fmtS(scoreWall)})`);
  if (scope && scope.live.length) say(`NOTE: ${scope.live.join('; ')}`);
  fs.writeFileSync(path.join(outRoot, 'report.md'), `${log.join('\n')}\n`);
  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 1));
  process.exitCode = allPass ? 0 : 1;
}

if (require.main === module) {
  (async () => {
    if (arg('pool')) return pool(arg('pool'));
    if (flag('record')) return record();
    return check();
  })().catch((e) => { console.error(e.stack || e); process.exit(2); });
}

module.exports = { editDistance, diffTraces, changedAreas };
