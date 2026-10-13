#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax, no-continue, no-template-curly-in-string */
/* Kiosk end-to-end check (CI): STTM was started by the kiosk launcher with a recording in
 * place of the microphone (VF_DEMO_WAV) and the DevTools port open. Nobody touches it.
 * Passes when, within --seconds, the presenter window (www/viewer.html) shows a line that
 * matches --expect (a regex over the Gurmukhi), proving: the app opened, the presenter
 * view took the screen, Voice-Follow started itself, heard the kirtan and found the
 * Shabad. Writes timeline.json and viewer.png to --out. Needs Node 22 (global WebSocket).
 *   node kiosk-e2e.js --port 9222 --seconds 240 --expect "ਨਾਮੁ ਤੇਰ" --out out
 */
const fs = require('fs');
const path = require('path');

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', '9222'));
const SECONDS = Number(arg('seconds', '240'));
const EXPECT = new RegExp(arg('expect', '[਀-੿]{3}'));
const OUT = arg('out', 'out');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) =>
  new Promise((r) => {
    setTimeout(r, ms);
  });
const t0 = Date.now();
const secs = () => +((Date.now() - t0) / 1000).toFixed(1);

async function targets() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    return (await res.json()).filter((t) => t.type === 'page');
  } catch (_) {
    return [];
  }
}

// One CDP call over a fresh socket (pages come and go; keep nothing open).
function cdp(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`${method} timed out`));
    }, 45000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    };
    ws.onerror = (e) => {
      clearTimeout(timer);
      reject(new Error(String(e.message || e)));
    };
  });
}

// When a page stops answering, pause its JavaScript through the debugger (which interrupts
// running code) and record where it is: the stack of a stuck renderer.
function stackOf(wsUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
    const timer = setTimeout(() => {
      ws.close();
      resolve(['(no pause within 20 s)']);
    }, 20000);
    ws.onopen = () => {
      send('Debugger.enable');
      send('Debugger.pause');
    };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.method !== 'Debugger.paused') return;
      clearTimeout(timer);
      const frames = msg.params.callFrames
        .slice(0, 25)
        .map(
          (f) =>
            `${f.functionName || '(anon)'} ${f.url.split('/').slice(-3).join('/')}:${f.location.lineNumber + 1}`,
        );
      send('Debugger.resume');
      setTimeout(() => {
        ws.close();
        resolve(frames);
      }, 300);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      resolve(['(debugger connection failed)']);
    };
  });
}
const stacks = [];

// A Chromium performance trace through the browser-level endpoint, which answers even when a
// page's main thread is stuck: shows whether the time goes to script, layout or painting.
async function trace(seconds) {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  return new Promise((resolve) => {
    const ws = new WebSocket(ver.webSocketDebuggerUrl);
    const events = [];
    let id = 0;
    const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
    const done = () => {
      ws.close();
      resolve(events);
    };
    const guard = setTimeout(done, (seconds + 60) * 1000);
    ws.onopen = () => {
      send('Tracing.start', {
        transferMode: 'ReportEvents',
        traceConfig: {
          includedCategories: [
            'devtools.timeline',
            'disabled-by-default-devtools.timeline',
            'v8.execute',
            'disabled-by-default-v8.cpu_profiler',
            'blink',
            'cc',
            'toplevel',
          ],
        },
      });
      setTimeout(() => send('Tracing.end'), seconds * 1000);
    };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value);
      if (msg.method === 'Tracing.tracingComplete') {
        clearTimeout(guard);
        done();
      }
    };
    ws.onerror = () => {
      clearTimeout(guard);
      done();
    };
  });
}
let traced = false;

async function text(t) {
  const r = await cdp(t.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression:
      '(document.body ? document.body.innerText : "") + (window.vfDemoAudio ? `\\n[demo-audio started=${window.vfDemoAudio.startedAt}]` : "")',
    returnByValue: true,
  });
  return (r.result && r.result.value) || '';
}

(async () => {
  const timeline = [];
  let found = null;
  let sawApp = null;
  let sawViewer = null;
  while (secs() < SECONDS) {
    const ts = await targets();
    const viewer = ts.find((t) => /viewer\.html(?!\?paneProjection)/.test(t.url));
    const main = ts.find((t) => /index\.html/.test(t.url));
    if (main && sawApp == null) sawApp = secs();
    if (viewer && sawViewer == null) sawViewer = secs();
    let vText = '';
    let panel = '';
    try {
      if (viewer) vText = await text(viewer);
      if (main) {
        const all = await text(main);
        const i = all.indexOf('Voice Follow');
        panel = i >= 0 ? all.slice(i, i + 160).replace(/\s+/g, ' ') : '';
      }
    } catch (e) {
      timeline.push({ t: secs(), error: e.message });
      if (!traced) {
        traced = true;
        const ev = await trace(15);
        fs.writeFileSync(path.join(OUT, 'trace.json'), JSON.stringify({ traceEvents: ev }));
        console.log(`trace: ${ev.length} events`);
      }
      if (main && stacks.length < 6) {
        const frames = await stackOf(main.webSocketDebuggerUrl);
        stacks.push({ t: secs(), frames });
        console.log(`stuck at ${secs()}s:\n  ${frames.join('\n  ')}`);
      }
    }
    // The presenter may draw Gurbani as Unicode or as ASCII in a Gurmukhi font: keep both.
    const gurmukhi = vText.replace(/\s+/g, ' ').trim();
    timeline.push({
      t: secs(),
      pages: ts.length,
      viewer: !!viewer,
      shown: gurmukhi.slice(0, 80),
      panel,
    });
    console.log(
      `${secs()}s pages=${ts.length} viewer=${!!viewer} shown="${gurmukhi.slice(0, 60)}"`,
    );
    if (!found && EXPECT.test(vText)) {
      found = { t: secs(), line: gurmukhi.slice(0, 120) };
      console.log(`FOUND at ${found.t}s: ${found.line}`);
      // Let it follow a little longer for the screenshots, then stop.
      await sleep(20000);
      break;
    }
    await sleep(5000);
  }
  const ts = await targets();
  const viewer = ts.find((t) => /viewer\.html(?!\?paneProjection)/.test(t.url));
  for (const [name, t] of [
    ['viewer', viewer],
    ['controller', ts.find((x) => /index\.html/.test(x.url))],
  ]) {
    if (!t) continue;
    try {
      const shot = await cdp(t.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
    } catch (e) {
      console.log(`screenshot ${name}: ${e.message}`);
    }
  }
  const result = {
    pass: !!found,
    found,
    appOpenedAt: sawApp,
    viewerOpenedAt: sawViewer,
    stacks,
    timeline,
  };
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(result, null, 1));
  console.log(
    found
      ? `PASS: projector showed the Shabad at ${found.t}s`
      : 'FAIL: no matching Shabad on the projector',
  );
  process.exit(found ? 0 : 1);
})();
