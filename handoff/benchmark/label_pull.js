/* Label the YouTube pull (one shabad per clip) from the video TITLE (the uploader's
 * romanized first line) via the local Realm's FirstLetterEng index, verified by
 * transliteration fuzzy-match. Far more reliable than blind ASR on this voice.
 *
 * An ASR consistency score (partialRatio of the clip's transcript vs the resolved
 * shabad's Unicode text) is recorded so mislabeled / intro-only clips can be filtered.
 *
 * Output: /Users/asingh02/aai/kirtan_bench/pull/labels.json
 *   [{ file, videoId, title, sid, titleScore, asrScore, nLines, lines:[unicode...] }]
 *
 * Run (node 18):
 *   NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules \
 *   MODEL=/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx \
 *   node /Users/asingh02/aai/kirtan_bench/label_pull.js
 */
const fs = require('fs');
const path = require('path');

const DESK = '/Users/asingh02/AAI/sttm-desktop';
const ENG = path.join(DESK, 'www/main/addons/voice-follow/engine');
const { Infer, norm } = require(path.join(ENG, 'infer'));
const { Recognizer } = require(path.join(ENG, 'recognizer'));
const { partialRatio } = require(path.join(ENG, 'fuzz'));
const Realm = require(path.join(DESK, 'node_modules/realm'));
const anvaad = require(path.join(DESK, 'node_modules/anvaad-js'));

const APP = '/Users/asingh02/Library/Application Support/SikhiToTheMax';
const REALM_PATH = path.join(APP, 'sttmdesktop-evergreen-v2.realm');
const SCHEMA = require(path.join(APP, 'realm-schema-evergreen.json'));
const PULL = process.env.PULL_DIR || '/Users/asingh02/aai/kirtan_bench/pull';
const ENTRIES = process.env.ENTRIES || '/Users/asingh02/aai/kirtan_bench/playlist_entries.tsv';
const MODEL = process.env.MODEL;
const SR = 16000;
const ASR_SECONDS = parseFloat(process.env.ASR_SECONDS || '90'); // transcript for consistency check

const STOP = new Set(['the', 'a', 'of']);
const clean = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
function titleParts(t) {
  const first = clean(t.split(/[|/]/)[0]);
  const words = first.split(' ').filter((w) => w && !STOP.has(w));
  return { first, fl: words.map((w) => w[0]).join('') };
}

function readWavFloat32(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = Math.floor(sz / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + sz + (sz & 1);
  }
  throw new Error(`no data chunk in ${file}`);
}

function resolveByTitle(realm, title) {
  const { first, fl } = titleParts(title);
  if (fl.length < 2) return null;
  const tryFl = (f, op) => {
    try {
      return realm.objects('Verse')
        .filtered(`FirstLetterEng ${op}[c] $0 AND Source.SourceID = $1`, f, 'G')
        .slice(0, 80);
    } catch (_) { return []; }
  };
  let rows = tryFl(fl, 'BEGINSWITH');
  if (!rows.length) rows = tryFl(fl, 'CONTAINS');
  // drop the last title letter (uploader sometimes adds an extra word) and retry
  if (!rows.length && fl.length > 3) rows = tryFl(fl.slice(0, -1), 'BEGINSWITH');
  let best = null, bs = -1;
  for (const r of rows) {
    const tr = clean(anvaad.translit(r.Gurmukhi));
    const s = partialRatio(first, tr);
    if (s > bs) { bs = s; best = r; }
  }
  if (!best) return null;
  return { sid: best.Shabads[0].ShabadID, titleScore: +bs.toFixed(1) };
}

async function main() {
  const realm = await Realm.open({ path: REALM_PATH, schema: SCHEMA.schemas, schemaVersion: SCHEMA.schemaVersion, readOnly: true });
  const ent = {};
  for (const l of fs.readFileSync(ENTRIES, 'utf8').split('\n').filter(Boolean)) {
    const i = l.indexOf('\\t');
    if (i > 0) ent[l.slice(0, i)] = l.slice(i + 2);
  }
  const wavs = fs.readdirSync(PULL).filter((f) => f.endsWith('.wav')).sort();
  const infer = await Infer.create(MODEL);
  const out = [];
  for (const f of wavs) {
    // filename: NNN_<videoId>\t<title...>.wav  (playlist tsv used literal backslash-t)
    const afterNum = f.slice(4);
    const vid = afterNum.split('\\t')[0];
    const title = ent[vid] || afterNum.replace(/\.wav$/, '');
    const res = resolveByTitle(realm, title);
    let asrScore = 0, nLines = 0, lines = [];
    if (res) {
      const verses = realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0', res.sid).sorted('ID');
      lines = Array.from(verses, (v) => anvaad.unicode(v.Gurmukhi));
      nLines = lines.length;
      // ASR consistency: transcribe part of the clip, fuzzy-match against shabad text
      let total = readWavFloat32(path.join(PULL, f)).slice(0, Math.floor(ASR_SECONDS * SR));
      const rec = new Recognizer(infer, { inputSr: SR, hopS: 0.5, windowS: 12 });
      let text = '';
      const CH = Math.floor(0.5 * SR);
      for (let p = 0; p < total.length; p += CH) { const r = await rec.push(total.slice(p, p + CH)); if (r && r.text) text += ' ' + r.text; }
      const hyp = norm(text);
      const concat = lines.map((l) => norm(l)).join(' ');
      asrScore = concat ? +(partialRatio(hyp.slice(0, 400), concat)).toFixed(1) : 0;
    }
    const rec2 = { file: f, videoId: vid, title: title.split('|')[0].trim(), sid: res ? res.sid : null, titleScore: res ? res.titleScore : 0, asrScore, nLines, lines };
    console.log(`sid=${String(rec2.sid).padStart(5)} title=${String(rec2.titleScore).padStart(4)} asr=${String(rec2.asrScore).padStart(4)} lines=${String(nLines).padStart(3)}  ${rec2.title.slice(0, 40)}`);
    out.push(rec2);
  }
  fs.writeFileSync(path.join(PULL, 'labels.json'), JSON.stringify(out, null, 1));
  const good = out.filter((o) => o.sid && o.titleScore >= 72 && o.asrScore >= 55);
  console.log(`\nlabeled ${out.length}; ${good.length} pass (titleScore>=72 & asrScore>=55)`);
  realm.close();
}
main().catch((e) => { console.error('ERR', e && e.stack || e); process.exit(1); });
