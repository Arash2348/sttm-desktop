#!/usr/bin/env node
/*
 * Screenshot a running renderer over CDP without the browser MCP.
 * Usage: node vf-shot.js [urlSubstr] [outPath]
 *   urlSubstr: pick the page whose url contains this (default "index.html")
 *   outPath:   PNG output path (default /tmp/vf-shot.png)
 */
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const PORT = 9222;
const urlSubstr = process.argv[2] || 'index.html';
const outPath = process.argv[3] || '/tmp/vf-shot.png';

function listTargets() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}/json`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      })
      .on('error', reject);
  });
}

function shoot(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const nextId = () => (id += 1);
    let shotId;
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: nextId(), method: 'Page.enable' }));
      shotId = nextId();
      ws.send(JSON.stringify({ id: shotId, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (_) { return; }
      if (msg.id === shotId) {
        try { ws.close(); } catch (_) {}
        if (msg.result && msg.result.data) {
          fs.writeFileSync(outPath, Buffer.from(msg.result.data, 'base64'));
          resolve(outPath);
        } else {
          reject(new Error('no screenshot data'));
        }
      }
    });
    ws.on('error', reject);
    setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('timeout')); }, 8000);
  });
}

(async () => {
  const targets = await listTargets();
  const page = targets.find((t) => t.type === 'page' && (t.url || '').includes(urlSubstr) && t.webSocketDebuggerUrl);
  if (!page) {
    console.error(`No page matching "${urlSubstr}"`);
    process.exit(1);
  }
  const out = await shoot(page.webSocketDebuggerUrl);
  console.log(`saved ${out}  (${page.url.slice(0, 60)})`);
})().catch((e) => { console.error(e.message); process.exit(1); });
