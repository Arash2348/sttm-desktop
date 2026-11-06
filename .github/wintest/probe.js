// probe.js: for every STTM page target, print its url, text length, first words and element count
const W = require('ws');
const http = require('http');
const expr = `(() => { const t = document.body.innerText.trim();
  return t.length + ' chars | ' + t.slice(0, 60).replace(/\\s+/g, ' ') + ' | elements: ' + document.body.getElementsByTagName('*').length; })()`;
const ask = (url) => new Promise((res) => {
  const w = new W(url);
  const done = (v) => { try { w.close(); } catch (_) {} res(v); };
  w.on('open', () => w.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr } })));
  w.on('message', (d) => { const m = JSON.parse(d); if (m.id === 1) done(m.result.result.value); });
  w.on('error', (e) => done('error ' + e.message));
  setTimeout(() => done('timeout'), 10000);
});
http.get('http://127.0.0.1:9555/json', (r) => {
  let b = ''; r.on('data', (c) => { b += c; });
  r.on('end', async () => {
    const out = [];
    for (const t of JSON.parse(b).filter((x) => x.type === 'page')) {
      out.push(t.url.split('/').pop() + ': ' + (await ask(t.webSocketDebuggerUrl)));
    }
    console.log(out.join(' || '));
    process.exit(0);
  });
}).on('error', (e) => { console.log('no devtools ' + e.message); process.exit(0); });
