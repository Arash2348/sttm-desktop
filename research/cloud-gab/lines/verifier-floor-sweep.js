#!/usr/bin/env node
// verifier-floor-sweep.js <replays-dir>... — sweep the Shabad verifier's lead bar (VERIFY_LOCK), absolute floor
// (VERIFY_FLOOR, nats per second short of the unconstrained decode) and checks-in-a-row (VERIFY_CONFIRM) offline, from
// the bench traces of a VERIFY_DRY build (every check traced as a switch-comparison event with verify:true: lead,
// gapS, fits [[shabadId, score, poolCount], ...]; the build never locks on the verifier, so the checks cover the
// whole recording). A replays dir is <cache>/replays/<key> (results-sync.js pull); traces sit in <suite>/trace/.
//
// For each setting: fires = checks where the lead and floor pass on C checks in a row (same Shabad); first = the
// first such check per recording (what the app would lock on); right/wrong by the recording's shabads.csv at that
// moment. Only recordings with Shabad truth count (1-kirtan-shabad, 5-akhand-kirtan).
const fs = require('fs');
const path = require('path');
const BENCH = process.env.BENCH || '/home/user/gab/bench';
const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: verifier-floor-sweep.js <replays-dir>...'); process.exit(2); }
const truthOf = {};
const truthAt = (clip, t) => {
  if (!(clip in truthOf)) {
    const f = ['1-kirtan-shabad', '5-akhand-kirtan'].map((d) => path.join(BENCH, d, clip, 'shabads.csv')).find(fs.existsSync);
    if (!f) truthOf[clip] = null;
    else {
      const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(',');
      truthOf[clip] = rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [k[i], v])));
    }
  }
  const rows = truthOf[clip]; if (!rows) return undefined; // no truth: skip the recording
  const r = rows.find((x) => t >= Number(x.start_s) && t < Number(x.end_s));
  return r ? new Set(String(r.shabadId).split('|').map(Number)) : null; // null: nothing being sung (ceremony etc.)
};
const checks = []; // {clip, t, lead, gapS, id}
let files = 0;
for (const d of dirs) for (const suite of fs.readdirSync(d)) {
  const td = path.join(d, suite, 'trace'); if (!fs.existsSync(td)) continue;
  for (const f of fs.readdirSync(td)) {
    if (!f.endsWith('.events.jsonl')) continue;
    const clip = f.split('_')[0]; if (truthAt(clip, 0) === undefined) continue;
    files++;
    for (const l of fs.readFileSync(path.join(td, f), 'utf8').split('\n')) {
      if (!l.includes('"verify":true')) continue;
      const e = JSON.parse(l); if (!e.fits || e.fits.length < 2) continue;
      checks.push({ clip, t: e.t, lead: e.lead, gapS: e.gapS, id: e.fits[0][0] });
    }
  }
}
console.log(`${files} recordings with Shabad truth, ${checks.length} verifier checks`);
const byClip = {}; for (const c of checks) (byClip[c.clip] = byClip[c.clip] || []).push(c);
const out = [];
for (const C of [1, 2]) for (const LD of [20, 30, 40, 60, 80]) for (const FL of [Infinity, 20, 16, 12, 8, 5, 3]) {
  let fires = 0, right = 0, wrong = 0, idle = 0, first = 0, firstRight = 0, firstWrong = 0;
  for (const clip of Object.keys(byClip)) {
    let run = 0, last = null, fired = false;
    for (const c of byClip[clip].sort((a, b) => a.t - b.t)) {
      const win = c.lead >= LD && c.gapS <= FL;
      run = win ? (last === c.id ? run + 1 : 1) : 0; last = win ? c.id : null;
      if (run >= C) {
        const tr = truthAt(clip, c.t);
        fires++; if (tr === null) idle++; else if (tr.has(c.id)) right++; else wrong++;
        if (!fired) { fired = true; first++; if (tr && tr.has(c.id)) firstRight++; else if (tr !== null) firstWrong++; }
      }
    }
  }
  out.push({ C, LD, FL, fires, right, wrong, idle, first, firstRight, firstWrong });
}
console.log('C = checks in a row, LD = lead bar, FL = floor (nats/s; inf = off) | every check that fires | the first fire per recording');
console.log('C  LD FL  | fires right wrong idle | first right wrong');
for (const o of out) console.log(`${o.C}  ${String(o.LD).padEnd(2)} ${String(o.FL === Infinity ? 'inf' : o.FL).padEnd(3)} | ${String(o.fires).padEnd(5)} ${String(o.right).padEnd(5)} ${String(o.wrong).padEnd(5)} ${String(o.idle).padEnd(4)} | ${String(o.first).padEnd(5)} ${String(o.firstRight).padEnd(5)} ${o.firstWrong}`);
