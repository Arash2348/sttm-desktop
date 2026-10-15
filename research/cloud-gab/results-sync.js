#!/usr/bin/env node
// results-sync.js — share GAB replay results (not model output) between sessions through Azure.
//
//   node results-sync.js pull     # Azure bench-results/replays/** -> <cache>/replays/** (only files missing locally)
//   node results-sync.js push     # local <cache>/replays/** -> Azure (only files missing in Azure)
//   node results-sync.js list     # what Azure holds, per replay key
//
// What is shared: vf-check's saved replays of committed app trees (<cache>/replays/<key>/<suite>/<clip>.json and
// trace/<clip>.events.jsonl), keyed by sha1(app tree | harness files | model | codec), so a build that any session
// replayed once is never replayed again. Screen events and scores only: no audio, no model output, no secrets.
// Writes only under bench-results/ (never bench-cache/), never deletes, never overwrites an existing blob.
// SAS from env VF_AZURE_SAS (whitespace stripped), never printed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const BASE = 'https://banidb.blob.core.windows.net/voice-follow-training-data';
const PREFIX = 'bench-results/replays';
const LOCAL = path.join(process.env.VF_EMIS_CACHE || path.join(os.homedir(), 'personal/live-darbar-venues/cache'), 'replays');
const sas = () => {
  const s = (process.env.VF_AZURE_SAS || '').replace(/\s+/g, '').replace(/^\?/, '');
  if (!s) throw new Error('VF_AZURE_SAS is not set');
  return s;
};
const redact = (s) => String(s).replace(/sig=[^&\s"']+/g, 'sig=REDACTED');
const blobUrl = (key) => `${BASE}/${key.split('/').map(encodeURIComponent).join('/')}?${sas()}`;

async function list() {
  const out = new Set();
  let marker = '';
  for (;;) {
    const res = await fetch(`${BASE}?restype=container&comp=list&prefix=${PREFIX}/${marker ? `&marker=${encodeURIComponent(marker)}` : ''}&${sas()}`);
    if (!res.ok) throw new Error(`list: HTTP ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Name>([^<]+)<\/Name>/g)) out.add(m[1]);
    const nm = xml.match(/<NextMarker>([^<]*)<\/NextMarker>/);
    if (!nm || !nm[1]) return out;
    marker = nm[1];
  }
}
function localFiles() {
  const out = [];
  if (!fs.existsSync(LOCAL)) return out;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(LOCAL, p)); } };
  walk(LOCAL);
  return out;
}
async function pool(items, n, fn) {
  const q = [...items];
  let done = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (let it; (it = q.shift()) !== undefined;) { await fn(it); done++; } }));
  return done;
}

(async () => {
  const cmd = process.argv[2];
  const remote = await list();
  if (cmd === 'list') {
    const by = {};
    for (const k of remote) { const key = k.split('/')[2]; by[key] = (by[key] || 0) + 1; }
    for (const [k, n] of Object.entries(by)) console.log(k, n, 'files');
    console.log(`${remote.size} files in ${PREFIX}`);
  } else if (cmd === 'push') {
    const todo = localFiles().filter((f) => !remote.has(`${PREFIX}/${f}.gz`));
    let bytes = 0;
    await pool(todo, 8, async (f) => {
      const body = zlib.gzipSync(fs.readFileSync(path.join(LOCAL, f)));
      const res = await fetch(blobUrl(`${PREFIX}/${f}.gz`), { method: 'PUT', body, headers: { 'x-ms-blob-type': 'BlockBlob', 'If-None-Match': '*', 'content-type': 'application/gzip' } });
      if (!res.ok && res.status !== 409) throw new Error(`PUT ${f}: HTTP ${res.status} ${redact((await res.text()).slice(0, 120))}`);
      bytes += body.length;
    });
    console.log(`pushed ${todo.length} files (${(bytes / 1e6).toFixed(1)} MB) to ${PREFIX}`);
  } else if (cmd === 'pull') {
    const have = new Set(localFiles());
    const todo = [...remote].map((k) => k.slice(PREFIX.length + 1).replace(/\.gz$/, '')).filter((f) => !have.has(f));
    let bytes = 0;
    await pool(todo, 8, async (f) => {
      const res = await fetch(blobUrl(`${PREFIX}/${f}.gz`));
      if (!res.ok) throw new Error(`GET ${f}: HTTP ${res.status}`);
      const buf = zlib.gunzipSync(Buffer.from(await res.arrayBuffer()));
      const out = path.join(LOCAL, f);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(`${out}.part`, buf);
      fs.renameSync(`${out}.part`, out);
      bytes += buf.length;
    });
    console.log(`pulled ${todo.length} files (${(bytes / 1e6).toFixed(1)} MB) from ${PREFIX}`);
  } else {
    console.log('usage: results-sync.js pull|push|list');
    process.exitCode = 2;
  }
})().catch((e) => { console.error(redact(e.message)); process.exitCode = 1; });
