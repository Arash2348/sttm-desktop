// probe.js <ws url>: print what the STTM main window shows (text length, first words, element count)
const W = require('ws');
const w = new W(process.argv[2]);
const expr = `(() => { const t = document.body.innerText.trim();
  return t.length + ' | ' + t.slice(0, 80).replace(/\\s+/g, ' ') + ' | elements: ' + document.body.getElementsByTagName('*').length; })()`;
w.on('open', () => w.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr } })));
w.on('message', (d) => { const m = JSON.parse(d); if (m.id === 1) { console.log(m.result.result.value); process.exit(0); } });
w.on('error', (e) => { console.log('probe error ' + e.message); process.exit(0); });
setTimeout(() => { console.log('timeout'); process.exit(0); }, 15000);
