// fetch-audio.js <tier list> <split: prac|test|all> [--ids a,b]: download audio.wav of selected manifest rows into VF_CLIPS/<source_file>
const fs = require('fs'); const path = require('path');
const T = '/home/user/gab-tools/research/level2-dataset/tools';
const { parseCsv, canonRows } = require(T + '/vf-manifest'); const G = require(T + '/gab-score');
const [tiers, split] = [process.argv[2].split(','), process.argv[3]];
const ids = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : null;
const rows = canonRows(parseCsv(fs.readFileSync('/home/user/gab/bench/manifest.csv', 'utf8'))); const sets = G.loadSets();
const want = rows.filter((r) => r.suite_jobs && r.audio && tiers.some((t) => G.inTier(r, t, sets)) && (split === 'all' || (split === 'test') === (r.split === 'test')) && (!ids || ids.includes(r.id)));
const DIR = '/home/user/gab/clips';
(async () => {
  let n = 0, bytes = 0; const fail = [];
  const q = [...want];
  await Promise.all([0, 1, 2, 3].map(async () => {
    for (let r; (r = q.shift());) {
      const out = path.join(DIR, r.source_file);
      if (fs.existsSync(out)) continue;
      const u = `https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/main/${r.audio.split('/').map(encodeURIComponent).join('/')}`;
      try {
        const res = await fetch(u, { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const b = Buffer.from(await res.arrayBuffer()); fs.writeFileSync(out + '.part', b); fs.renameSync(out + '.part', out); n++; bytes += b.length;
      } catch (e) { fail.push(`${r.id}: ${e.message}`); }
    }
  }));
  console.log(`selected ${want.length}, downloaded ${n} (${(bytes / 1e6).toFixed(0)} MB), failed ${fail.length}`); fail.forEach((f) => console.log('  FAIL', f));
})();
