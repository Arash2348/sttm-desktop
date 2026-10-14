#!/usr/bin/env node
/* paath-seq-bench.js — sequential reading (Akhand / Sehaj Paath) benchmark.
 * Runs the real VoiceFollow component over paath recordings whose text is a run of
 * CONSECUTIVE Guru Granth Sahib shabads, with every Bani route switched off
 * (VF_EXP_NO_BANI), so the only way to stay right is to carry over to the next
 * shabad by itself. Truth: paath-seq-tests.json (sequence of shabad ids, no per-shabad
 * times), so the scores are: time on a shabad of the sequence, coverage (how many of
 * the sequence were shown, in order), carry-overs (i -> i+1 transitions), flips.
 *
 * Usage: node paath-seq-bench.js [--only ps01,ps03] [--out results/<name>] [--bani]
 *   --bani keeps the Bani routes on (control: the Rehras / Sohila Bani should open).
 * Harness: the cached-replay bench-driver (branch vf-cached-replay, REPLAY.md), from
 * VF_HARNESS (default ~/personal/sttm-replay/research/level2-dataset/tools). App code under
 * test: VF_DRIVER_ROOT. With VF_EMIS_CACHE set the run is deterministic and keyed per clip
 * (cache id = clip file name without .wav): VF_EMIS_MODE=record runs the model (under
 * `lockf -k /tmp/vf-bench.lock nice -n 19 env VF_ORT_THREADS=3`) only for windows not yet
 * cached; replay (default) never runs it.
 */
const fs = require('fs');
const path = require('path');
if (!process.argv.includes('--bani')) process.env.VF_EXP_NO_BANI = '1';
const HARNESS = process.env.VF_HARNESS || path.join(process.env.HOME, 'personal/sttm-replay/research/level2-dataset/tools');
const { createDriver } = require(path.join(HARNESS, 'bench-driver'));
const DS = path.join(__dirname, '..');
const CLIPS = '/Users/asingh02/personal/live-darbar-venues/clips';
const MODEL = process.env.MODEL || '/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx';
const USERDATA = process.env.VF_BANIDB_USER_DATA || path.join(process.env.HOME, 'Library/Application Support/SikhiToTheMax');
const SR = 16000, CHUNK = 2048, STEP = 0.1;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = arg('only', '') ? new Set(arg('only', '').split(',')) : null;
const FAST = process.argv.includes('--fast');
const OUT = arg('out', path.join(DS, 'results', `paath-seq-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`));
fs.mkdirSync(OUT, { recursive: true });

function readWav(file) {
  const b = fs.readFileSync(file); let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), sz = b.readUInt32LE(off + 4);
    if (id === 'data') { const n = Math.floor(sz / 2), out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2) / 32768; return out; }
    off += 8 + sz + (sz & 1);
  }
  throw new Error('no data chunk');
}

// events: [{t, type:'shabad'|'seeking', shabadId, visible}] from truth start; seq: ids in order.
function score(events, seq, dur) {
  const ok = new Set(seq);
  const ev = events.filter((e) => e.type === 'shabad' || e.type === 'seeking').sort((a, b) => a.t - b.t);
  let sid = null, seeking = false, i = 0, right = 0, wrong = 0, searching = 0, firstCorrect = null, flips = 0, lastShown = null;
  const shownSeq = [];
  for (let t = 0; t < dur; t += STEP) {
    while (i < ev.length && ev[i].t <= t) {
      const e = ev[i++];
      if (e.type === 'shabad') {
        if (lastShown != null && e.shabadId !== lastShown) flips++;
        lastShown = e.shabadId; sid = e.shabadId;
        if (!shownSeq.length || shownSeq[shownSeq.length - 1].id !== sid) shownSeq.push({ id: sid, t: +Math.max(0, e.t).toFixed(1) });
      }
      if (e.type === 'seeking') seeking = e.visible;
    }
    const shown = seeking ? null : sid;
    if (ok.has(shown)) { right += STEP; if (firstCorrect == null) firstCorrect = t; }
    else if (shown == null) searching += STEP;
    else wrong += STEP;
  }
  // Coverage in order: longest run of sequence ids shown in increasing order.
  const idx = (id) => seq.indexOf(id);
  let covered = 0, carry = 0, prev = -1;
  for (const s of shownSeq) {
    const k = idx(s.id); if (k < 0) continue;
    if (k > prev) { covered += 1; if (prev >= 0 && k === prev + 1) carry += 1; prev = k; }
  }
  return { dur: +dur.toFixed(1), right: +(right / dur).toFixed(4), wrong: +(wrong / dur).toFixed(4), searching: +(searching / dur).toFixed(4),
    firstCorrect_s: firstCorrect == null ? null : +firstCorrect.toFixed(1), covered, of: seq.length, carryOvers: carry, flips, shownSeq };
}

(async () => {
  const rows = JSON.parse(fs.readFileSync(path.join(DS, arg('truth', 'paath-seq-tests.json'))));
  const results = [];
  for (const row of rows) {
    if (ONLY && !ONLY.has(row.name)) continue;
    const wav = path.join(CLIPS, row.clip);
    if (!fs.existsSync(wav)) { console.error(`${row.name}: no audio ${row.clip}`); continue; }
    const m = row.clip.match(/_(\d+)-(\d+)\.wav$/); const clipStart = Number(m[1]);
    const lead = row.start_s - clipStart;
    const pcm = readWav(wav);
    const events = []; const t0 = Date.now();
    const TRACE_ALL = process.argv.includes('--trace-all');
    const driver = await createDriver({ model: MODEL, userData: USERDATA, cacheId: row.clip.replace(/\.wav$/, ''), onEvent: (ev) => {
      if (TRACE_ALL) { const { t, ...rest } = ev; events.push({ t: t - lead, ...rest }); return; }
      if (ev.type === 'shabad' || ev.type === 'seeking' || ev.type === 'component-error') events.push({ t: ev.t - lead, type: ev.type, shabadId: ev.shabadId, visible: ev.visible, message: ev.message });
    } });
    await driver.start();
    const wall0 = Date.now();
    for (let p = 0; p < pcm.length; p += CHUNK) {
      const chunk = pcm.subarray(p, Math.min(p + CHUNK, pcm.length));
      const audioT = (p + chunk.length) / SR;
      await driver.push(chunk, audioT);
      if (!FAST) { const ahead = audioT * 1000 - (Date.now() - wall0); if (ahead > 2) await new Promise((r) => setTimeout(r, ahead)); }
    }
    await driver.stop();
    const dur = row.end_s - row.start_s;
    const sc = score(events.map((x) => ({ ...x, t: Math.max(0, x.t) })), row.sequence, dur);
    const rec = { clip: row.name, gurdwara: row.gurdwara.split(',')[0], video_id: row.video_id, sequence: row.sequence, ...sc, errors: events.filter((x) => x.type === 'component-error').length, wall_s: +((Date.now() - t0) / 1000).toFixed(0) };
    results.push(rec);
    fs.writeFileSync(path.join(OUT, `${row.name}.json`), JSON.stringify({ row, events, metrics: sc }, null, 1));
    console.log(`${row.name} ${rec.gurdwara.padEnd(28)} | first ${sc.firstCorrect_s == null ? 'NEVER' : sc.firstCorrect_s + 's'} | in-seq ${(sc.right * 100).toFixed(0)}% wrong ${(sc.wrong * 100).toFixed(0)}% search ${(sc.searching * 100).toFixed(0)}% | covered ${sc.covered}/${sc.of} carry ${sc.carryOvers} | flips ${sc.flips} | shown ${sc.shownSeq.map((s) => `${s.id}@${s.t}`).join(' ')}`);
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  }
  const lines = ['# Sequential reading (Akhand / Sehaj Paath proxy) benchmark', '', `Clips: ${results.length}. Bani routes ${process.env.VF_EXP_NO_BANI ? 'OFF' : 'ON'}. Truth: consecutive SGGS shabad ids read in order (no per-shabad times).`, '',
    '| clip | reader | first correct | in-sequence | wrong | searching | covered | carry-overs | flips |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of results) lines.push(`| ${r.clip} | ${r.gurdwara} | ${r.firstCorrect_s == null ? 'never' : r.firstCorrect_s + 's'} | ${(r.right * 100).toFixed(1)}% | ${(r.wrong * 100).toFixed(1)}% | ${(r.searching * 100).toFixed(1)}% | ${r.covered}/${r.of} | ${r.carryOvers} | ${r.flips} |`);
  fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), lines.join('\n') + '\n');
  console.log('\n' + lines.join('\n'));
})().catch((e) => { console.error(e.stack); process.exit(1); });
