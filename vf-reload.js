#!/usr/bin/env node
/*
 * ⚠️ DO NOT USE — CDP Page.reload CRASHES this app.
 *
 * A renderer reload re-`require`s the native N-API addon `realm.node`
 * (pulled in by banidb). Native modules cannot be re-initialized in the same
 * renderer process → SIGSEGV in realm::node::napi_init (verified via crash
 * report Electron Helper (Renderer) EXC_BAD_ACCESS at napi_get_named_property).
 * Both renderer processes die and the app goes black.
 *
 * To apply recompiled www/js code you MUST fully restart the app:
 *   quit the running Electron, then re-run ./vf-debug.sh in your own Terminal.
 *
 * Kept only for reference. Reload without a full restart is not possible while
 * the renderer loads realm.
 *
 * ORIGINAL (unsafe): hot-reload renderers over CDP (port 9222) via Page.reload.
 */
const http = require('http');
const WebSocket = require('ws');

const PORT = 9222;

function listTargets() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}/json`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function reload(wsUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { ws.close(); } catch (_) {}
      resolve(ok);
    };
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.reload', params: { ignoreCache: true } }));
      setTimeout(() => finish(true), 400); // don't wait for load event
    });
    ws.on('error', () => finish(false));
    setTimeout(() => finish(false), 3000);
  });
}

(async () => {
  let targets;
  try {
    targets = await listTargets();
  } catch (e) {
    console.error(`Cannot reach DevTools on :${PORT} — is the app running with --remote-debugging-port=9222?`);
    process.exit(1);
  }
  const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pages.length) {
    console.error('No page targets found.');
    process.exit(1);
  }
  for (const p of pages) {
    const ok = await reload(p.webSocketDebuggerUrl);
    console.log(`${ok ? 'reloaded' : 'FAILED  '} : ${(p.url || '').slice(0, 60)}`);
  }
})();
