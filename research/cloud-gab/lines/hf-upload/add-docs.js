const fs = require('fs');
const P = __dirname;
const files = JSON.parse(fs.readFileSync(`${P}/files.json`));
const items = JSON.parse(fs.readFileSync(`${__dirname}/spot20-items.json`));
// all 20 answered "yes" on the spot-check page (read back 2026-10-15, 22:13-22:16 UTC)
const csv = ['recording,verseId,claimed_start_s,verdict,source,checked_at',
  ...items.map((it) => `${it.clip},${it.verseId},${it.start},confirmed,aligned-2model-audited,2026-10-15`)].join('\n') + '\n';
files.push({ path: 'human-verdicts/pangti-spot-check/verdicts.csv', content: csv });
files.push({ path: 'human-verdicts/pangti-spot-check/README.md', content: `# Pangti spot check (Oct 15 2026)

A person listened to 20 pangti starts drawn at random (seeded draw "owner-random-20-2026-10-15") from the 5,687
auto-accepted aligned starts outside GAB-Hard, and answered for each: does the pangti start at the marked time?

Result: **20 of 20 confirmed** (no tap needed, no wrong pangti). With 20 of 20, the true rate is at least ~86% (95% confidence).

How the aligned starts are made (\`lines.csv\` rows with source \`aligned-2model-audited\`): the known Shabad or Bani of
each truth row is force-aligned pangti by pangti with two speech models (karansea int8, the one the app uses; and
surindersinghssj pa-v3-kirtan fp32). A start is kept only when both models put the same pangti within 1 s of each other
and the heard words match the pangti (check >= 0.5). Measured against GAB-Hard's human line keys (29 recordings, the
sevadaar screen): 97% of such starts are on the right pangti; the screen lags them by about 0-3 s.

These keys are an audited computer guess: GAB reports pangti numbers on them as information, never as a headline.
Starts that were not kept (the models disagree, or the words match weakly) wait in the review queue; a person's yes or
tapped start makes them human.
` });
const lines = fs.readFileSync(`${P}/README.main.md`, 'utf8').split('\n');
const i = lines.findIndex((l) => /A computer guess/.test(l));
lines.splice(i + 1, 0, "   Since Oct 15 2026, every recording without human pangti times carries an **audited** computer guess: two speech models must agree within 1 s and hear the pangti's words (97% on the right pangti against GAB-Hard's human keys; a person confirmed 20 of 20 random ones). Marked `aligned-2model-audited` in `lines.csv`; shown as information, never as the headline. See `human-verdicts/pangti-spot-check`.");
files.push({ path: 'README.md', content: lines.join('\n') });
fs.writeFileSync(`${P}/files.json`, JSON.stringify(files));
console.log('files', files.length, 'card line inserted after line', i + 1);
