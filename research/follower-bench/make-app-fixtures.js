// Fixtures for the Sundar Gutka app's Follow Along tests: real recitations (cached
// window transcripts), their verified truth, and the line sequence the STTM desktop
// engine's follower2 produces on the APP's own lines (from the app database), so the
// app test checks both accuracy and that the app runs the same follower.
//   node make-app-fixtures.js <app repo>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { CachedInfer } = require('./replay');
const app = process.argv[2];
const { FollowerV2 } = require(path.join(process.env.HOME, 'personal/sttm-follower2/www/main/addons/voice-follow/engine/follower2.js'));
const DB = path.join(app, 'ios/www/gutka_v01.db');
const q = (sql) => JSON.parse(execFileSync('sqlite3', ['-json', DB, sql]).toString() || '[]');
const CLIPS = { 'pt60_4PEORBA2KdU_0-55': 2, 'pt31_V0yK9gjb-uA_30-100': 4, 'pt19_KSgSkLjLuA0_10-80': 21, 'pt28_IQkag1vkfAU_10-80': 23 };
const OPTS = { hopS: 0.25, lockDwell: 2, backDwell: 3, jumpDwell: 3, releaseHops: 20, noMatchHops: 12 };
const NITNEM = [2, 4, 9, 10, 21, 23];
const out = {};
(async () => {
  for (const [clip, bani] of Object.entries(CLIPS)) {
    // app lines: same query as src/FollowAlong/lines.js (LONG length so no recited line is missing)
    const rows = q(`SELECT ID, GurmukhiUni, Paragraph FROM mv_Banis_Shabad WHERE Bani=${bani} AND existsTaksal=1 AND (MangalPosition IS NULL OR MangalPosition='current') ORDER BY Seq`);
    const lines = rows.filter((r) => !/^[\s੦-੯0-9॥।]*$/.test(r.GurmukhiUni || '')).map((r) => ({ verseId: r.ID, text: r.GurmukhiUni, words: r.GurmukhiUni.replace(/[॥।]|[0-9੦-੯]+/g, ' ').split(/\s+/).filter(Boolean) }));
    const background = q(`SELECT GurmukhiUni FROM mv_Banis_Shabad WHERE Bani IN (${NITNEM.filter((b) => b !== bani).join(',')}) ORDER BY Bani, Seq`).map((r) => r.GurmukhiUni).filter(Boolean);
    const hyps = JSON.parse(fs.readFileSync(`cache/${clip}.hyps.json`)).hyps;
    const f = new FollowerV2(new CachedInfer(hyps), lines, { inputSr: 16000, background, ...OPTS });
    const shown = [];
    let cur;
    for (let k = 0; k < hyps.length + 3; k++) {
      const o = await f.push(new Float32Array(4000));
      const v = o ? (o.verseIndex === -1 ? null : o.verseId) : undefined;
      if (v !== undefined && v !== cur) { cur = v; shown.push([+((k + 1) * 0.25).toFixed(2), v]); }
    }
    const truth = JSON.parse(fs.readFileSync(`truth/${clip}.json`)).lines.map((l) => [l.start, l.end, l.verseId]);
    out[clip] = { bani, hyps, truth, desktopShown: shown };
    console.log(clip, 'bani', bani, 'lines', lines.length, 'desktop moves', shown.length);
  }
  const dest = path.join(app, '__tests__/fixtures/follow-along-recitations.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify({ _about: 'Real recitations: speech-model transcript of each 4 s window (every 0.25 s), verified line truth [start,end,verseId], and the line sequence the STTM desktop engine (follower2) shows on these lines. From sttm-desktop research/follower-bench/make-app-fixtures.js.', followerOpts: OPTS, clips: out }));
  console.log('wrote', dest, fs.statSync(dest).size, 'bytes');
})();
