import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreState, useStoreActions } from 'easy-peasy';

import { filterRequiredVerseItems } from '../../../navigator/shabad/utils/filter-verse-items';
import { loadBani as loadBaniRows } from '../../../navigator/utils/load-bani';
import { useNewShabad } from '../../../navigator/search/hooks/use-new-shabad';

const anvaad = require('anvaad-js');
const banidb = require('../../../banidb');
// In-process native engine (onnxruntime-node): no Python sidecar, no websocket.
const engine = require('../engine');

// "First letter anywhere" search — the primitive used to identify a shabad from
// the Gurmukhi first-letters of what's being sung (matches banidb's FirstLetterStr).
const FIRST_LETTERS_ANYWHERE = banidb.CONSTS.SEARCH_TYPES.FIRST_LETTERS_ANYWHERE;
const FIRST_LETTERS_START = banidb.CONSTS.SEARCH_TYPES.FIRST_LETTERS; // BEGINSWITH

// Blind auto-detect tuning. We build a first-letter query from the trailing part
// of the running transcript, preferring the most specific window that still hits,
// then vote across windows so one misheard letter doesn't decide the lock.
const DETECT_MIN_LETTERS = 4; // need at least this many first-letters to search
// The recognizer mishears the odd letter, and FirstLetterStr search is an exact
// contiguous CONTAINS — so one wrong letter kills a long window. Instead we slide
// several shorter n-grams across what we've heard and vote: clean fragments still
// hit the right shabad even when a neighbour letter is wrong. Longer grams are
// more specific, so they carry more weight.
const GRAM_SIZES = [8, 6, 5, 4]; // contiguous first-letter windows to slide (down to 4)
const DETECT_MAX_GRAMS = 16; // cap queries per decode (realm search is cheap, but bound it)
const DETECT_VOTE_DECAY = 0.8; // fade old evidence so a new shabad can overtake
const DETECT_STABLE = 2; // leader must hold this many decodes before auto-select
// Confidence = the leader's SEPARATION from the runner-up: best / (best + second).
// (Share-of-all-candidates looks tiny because short first-letters are ambiguous —
// dozens of shabads collect a few votes each, diluting the leader's slice.)
// 0.65 ≈ leader roughly 2x the runner-up.
const AUTO_LOCK_CONF = 0.65; // separation needed to auto-select
const DETECT_MIN_EVIDENCE = 8; // leader must have this much absolute vote weight too
const DETECT_TOP_N = 3; // how many candidates to surface in the UI
// A shabad that BEGINS with what's being sung is a much stronger signal than one
// that merely contains it, so start-anchored hits carry extra weight.
const START_MATCH_WEIGHT = 12;

// Autopilot gates (separate from the manual one-shot detect above, so unattended
// behavior can be tuned without touching manual mode). Autopilot runs detection
// continuously in BOTH phases: it locks the first shabad, and while following it
// keeps listening so it can SWITCH the instant a different shabad clearly takes
// over — it does not wait for the follower to release (which can stall when the
// new shabad's audio keeps grazing the old lines).
const AP_LOCK_MIN_LETTERS = 6; // need a real phrase before the FIRST lock (kills quick wrong picks)
const AP_LOCK_STABLE = 3; // leader must hold this many decodes before the first lock
const AP_SWITCH_CONF = 0.7; // separation the new shabad needs to trigger a switch
const AP_SWITCH_STABLE = 4; // a switch needs more confirmation than the first lock
const AP_SWITCH_EVIDENCE = 10; // absolute vote weight the new leader must reach
const AP_SWITCH_MARGIN = 1.2; // new leader must beat the shabad we're on by this factor
const VOTE_CAP = 60; // clamp votes so a long shabad can't become impossible to switch away from
// While following we run the recognizer AND the follower on every chunk; a slightly
// larger recognizer hop keeps combined inference comfortably under real-time.
const AP_REC_HOP_S = 0.9;

// Two modes carried over from the web lab: Path (spoken paatth) and Kirtan
// (sung). Both map to the karansea CTC + line decoder with the same tuned
// params (the JS engine DEFAULTS), so the label is the only difference for now.
const MODES = {
  kirtan: { label: 'Kirtan (sung)', profile: 'kirtan' },
  path: { label: 'Path (recitation)', profile: 'karansea' },
};

// Raw Float32 PCM worklet, inlined as a Blob so there is no file:// path to
// resolve inside the packaged app. Mirrors public/voice-follow-pcm-worklet.js.
const WORKLET_SRC = `
class VoiceFollowPcm extends AudioWorkletProcessor {
  constructor() { super(); this._chunk = new Float32Array(2048); this._filled = 0; }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch = input[0];
      for (let i = 0; i < ch.length; i++) {
        this._chunk[this._filled++] = ch[i];
        if (this._filled === this._chunk.length) {
          const out = this._chunk.slice(0);
          this.port.postMessage(out.buffer, [out.buffer]);
          this._filled = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('voice-follow-pcm', VoiceFollowPcm);
`;

// Sundar-gutka banis (Japji, Rehras, …) are stored with a per-length flag column;
// this maps the user's chosen baniLength to the DB column loadBani() filters on.
const BANI_LENGTH_COLS = {
  short: 'existsSGPC',
  medium: 'existsMedium',
  long: 'existsTaksal',
  extralong: 'existsBuddhaDal',
};

// Split a Unicode Gurmukhi line into word tokens for the aligner. The server
// normalizes further (strips punctuation/matras irrelevant to matching); this
// only needs to break on whitespace and drop dandas/line numbers.
const tokenize = (uni) =>
  (uni || '')
    .replace(/[॥।]|\d+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

// The DB's FirstLetterStr is keyed on ASCII-FONT first-letter char codes (e.g.
// s=115, k=107, A=65), NOT Unicode codepoints. The recognizer emits Unicode, so a
// Unicode first-letter query never matches. Build a Unicode-base -> ASCII-font
// first-letter map once from anvaad (so it always tracks the installed font), then
// convert the recognizer's transcript into the ASCII-font first-letters the search
// actually expects.
const UNI_TO_ASCII_FL = (() => {
  const m = {};
  for (let code = 33; code < 127; code += 1) {
    const c = String.fromCharCode(code);
    let base = '';
    try {
      base = anvaad.firstLetters(anvaad.unicode(c)) || '';
    } catch (_) {
      base = '';
    }
    if (base.length === 1 && !(base in m)) m[base] = c;
  }
  return m;
})();

// Unicode Gurmukhi text -> ASCII-font first-letters string (the DB search format).
const toAsciiFirstLetters = (uniText) => {
  const fl = anvaad.firstLetters(uniText || '') || '';
  let out = '';
  for (const ch of fl) if (UNI_TO_ASCII_FL[ch]) out += UNI_TO_ASCII_FL[ch];
  return out;
};

const VoiceFollow = ({ isOpen, onScreenClose }) => {
  // Select the primitive directly rather than holding the whole navigator slice
  // object across renders — a slice reference can be an immer proxy that gets
  // revoked between selection and render.
  const activeShabadId = useStoreState((state) => state.navigator.activeShabadId);
  // Banis (Japji/Rehras/…) load via a separate content path: sundarGutkaBaniId +
  // the chosen baniLength, NOT activeShabadId. Ceremonies stay unsupported.
  const isSundarGutkaBani = useStoreState((state) => state.navigator.isSundarGutkaBani);
  const isCeremonyBani = useStoreState((state) => state.navigator.isCeremonyBani);
  const sundarGutkaBaniId = useStoreState((state) => state.navigator.sundarGutkaBaniId);
  const baniLength = useStoreState((state) => state.userSettings.baniLength);
  const { setActiveVerseId, setLineNumber } = useStoreActions((actions) => actions.navigator);
  const setOverlayScreen = useStoreActions((actions) => actions.app.setOverlayScreen);
  // Proper "open this shabad" action (drives viewer/projector/history/socket).
  // Kept in a ref so the async detect->lock path always calls the latest one.
  const changeActiveShabad = useNewShabad();
  const openShabadRef = useRef(changeActiveShabad);
  openShabadRef.current = changeActiveShabad;

  const [status, setStatus] = useState('idle'); // idle|connecting|listening|detecting|error|stopped
  const [autopilot, setAutopilot] = useState(true); // hands-free: detect + follow + auto-switch, one press
  const [autoDetect, setAutoDetect] = useState(false); // blind: identify the shabad from audio, then follow (one-shot)
  const [heard, setHeard] = useState(''); // gurmukhi first-letters heard (for visibility)
  const [rawHeard, setRawHeard] = useState(''); // raw recognizer transcript (diagnostic)
  const [cands, setCands] = useState([]); // [{shabadId, verseId, verse, display, share}] shortlist
  const [mode, setMode] = useState('kirtan');
  const [detail, setDetail] = useState('');
  const [pos, setPos] = useState(null); // { lineIndex, wordIndex, confidence }
  const [dlProgress, setDlProgress] = useState(null); // 0..1 during first-run model download, else null
  // Zoom-style floating widget: collapse the panel down to just the pill, and
  // drag either one anywhere on screen. `widgetPos` is null until first dragged
  // (then it overrides the default anchored position).
  const [collapsed, setCollapsed] = useState(false);
  const [widgetPos, setWidgetPos] = useState(null); // { top, left } | null
  const movedRef = useRef(false); // set during a drag so the pill click doesn't also expand

  const followerRef = useRef(null); // Follower (track a known shabad/bani)
  const recognizerRef = useRef(null); // Recognizer (blind auto-detect)
  const chainRef = useRef(Promise.resolve()); // serialize async inference per chunk
  // Autopilot: one continuous session that detects, follows, and auto-switches
  // shabads hands-free. phaseRef gates which engine each audio chunk feeds.
  const autopilotRef = useRef(false);
  const phaseRef = useRef('searching'); // 'searching' (detect) | 'following' (track)
  const lockingRef = useRef(false); // a lock/switch is mid-commit — don't double-fire
  const sampleRateRef = useRef(null); // mic sample rate, for building engine sessions
  const currentShabadIdRef = useRef(null); // shabad currently projected (avoid re-open)
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const nodeRef = useRef(null);
  const srcRef = useRef(null);
  const linesRef = useRef([]); // [{ verseId }] indexed by aligner lineIndex
  const lastVerseRef = useRef(null);
  const followingKeyRef = useRef(null); // session key: `shabad:<id>` or `bani:<id>`
  const panelRef = useRef(null); // flyout panel, for click-outside dismissal
  // Blind-detect session state (mutable, avoids re-render churn per decode).
  const recognizingRef = useRef(false); // true while blindly identifying a shabad
  const detectVotesRef = useRef(new Map()); // shabadId -> accumulated vote weight
  const detectRowsRef = useRef(new Map()); // shabadId -> best {verseId, verse, shabadId, rank}
  const detectStableRef = useRef({ id: null, count: 0 }); // leader-stability counter

  const cleanup = useCallback(() => {
    // Detach the worklet handler first so no in-flight chunk pushes into a
    // torn-down engine session.
    if (nodeRef.current) { try { nodeRef.current.port.onmessage = null; } catch (_) {} }
    try { nodeRef.current?.disconnect(); } catch (_) {}
    try { srcRef.current?.disconnect(); } catch (_) {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { ctxRef.current?.close(); } catch (_) {}
    ctxRef.current = null; streamRef.current = null;
    nodeRef.current = null; srcRef.current = null;
    followerRef.current = null; recognizerRef.current = null;
    chainRef.current = Promise.resolve();
  }, []);

  // Shared mic + worklet pipeline. Resolves the AudioContext sample rate, then
  // streams raw Float32 PCM chunks to `onChunk` (awaited serially so we never run
  // two inferences on the same ONNX session concurrently). Returns the sample
  // rate so callers can build the engine session at the right input rate.
  const startAudio = useCallback(async (onChunk) => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false },
      });
    } catch (_) {
      throw new Error('microphone permission denied.');
    }
    streamRef.current = stream;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;
    const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, 'voice-follow-pcm');
    chainRef.current = Promise.resolve();
    node.port.onmessage = (ev) => {
      const pcm = new Float32Array(ev.data);
      chainRef.current = chainRef.current.then(() => onChunk(pcm)).catch(() => {});
    };
    const src = ctx.createMediaStreamSource(stream);
    src.connect(node);
    // Deliberately not connected to destination — no playback.
    nodeRef.current = node;
    srcRef.current = src;
    return ctx.sampleRate;
  }, []);

  const stop = useCallback(() => {
    recognizingRef.current = false;
    autopilotRef.current = false;
    phaseRef.current = 'searching';
    lockingRef.current = false;
    currentShabadIdRef.current = null;
    cleanup();
    setStatus('stopped');
    setDetail('');
    setDlProgress(null);
    setCands([]);
    setHeard('');
    setRawHeard('');
  }, [cleanup]);

  const start = useCallback(async () => {
    // Ceremonies (Anand Karaj, Antam Sanskar, …) are free-form and not supported.
    if (isCeremonyBani) {
      setStatus('error');
      setDetail('Voice-Follow supports shabads and banis, not ceremonies yet.');
      return;
    }
    const isBani = isSundarGutkaBani && !!sundarGutkaBaniId;
    if (!isBani && !activeShabadId) {
      setStatus('error');
      setDetail('Open a shabad or bani first, then start Voice-Follow.');
      return;
    }
    // Tear down any prior session so switching content mid-listen re-attaches
    // cleanly instead of leaking a socket/mic bound to the old shabad/bani.
    cleanup();
    setStatus('connecting');
    setDetail(isBani ? 'loading bani lines…' : 'loading shabad lines…');
    lastVerseRef.current = null;
    followingKeyRef.current = isBani ? `bani:${sundarGutkaBaniId}` : `shabad:${activeShabadId}`;
    setPos(null);

    // Resolve the displayed content's lines -> {verseId, unicode words}. Banis
    // return verse rows directly (each with .ID/.Gurmukhi); shabads come through
    // filterRequiredVerseItems. Both must be anvaad.unicode()'d before matching.
    let verses;
    try {
      if (isBani) {
        const col = BANI_LENGTH_COLS[baniLength] || BANI_LENGTH_COLS.short;
        const rows = await loadBaniRows(sundarGutkaBaniId, col);
        const filtered = (rows || []).filter((r) => r && r.ID != null && r.Gurmukhi);
        linesRef.current = filtered.map((r) => ({ verseId: r.ID }));
        verses = filtered.map((r) => ({
          verseId: r.ID,
          words: tokenize(anvaad.unicode(r.Gurmukhi)),
        }));
      } else {
        const rows = await banidb.loadShabad(activeShabadId);
        const filtered = filterRequiredVerseItems(rows)
          .filter((it) => it && it.verseId != null && it.verse);
        linesRef.current = filtered.map((it) => ({ verseId: it.verseId }));
        verses = filtered.map((it) => ({
          verseId: it.verseId,
          words: tokenize(anvaad.unicode(it.verse)),
        }));
      }
    } catch (e) {
      setStatus('error');
      setDetail(`could not load ${isBani ? 'bani' : 'shabad'}: ${e?.message || e}`);
      return;
    }
    if (!verses.length) {
      setStatus('error');
      setDetail(`${isBani ? 'bani' : 'shabad'} has no lines to follow.`);
      return;
    }

    // First run only: fetch the ~184 MB int8 model and load the ONNX session.
    // Subsequent starts are instant (cached in userData + session kept warm).
    if (!engine.isReady()) {
      setDetail('downloading recognition model (~184 MB, one time)…');
      setDlProgress(0);
    }
    try {
      await engine.ready((p) => {
        setDlProgress(p);
        setDetail(`downloading recognition model… ${Math.round(p * 100)}% (one time)`);
      });
    } catch (e) {
      setStatus('error');
      setDetail(`could not prepare the recognition model: ${e?.message || e}`);
      setDlProgress(null);
      return;
    }
    setDlProgress(null);

    // Wire the mic; each PCM chunk is pushed into the follower (serialized).
    let sampleRate;
    try {
      sampleRate = await startAudio(async (pcm) => {
        const f = followerRef.current;
        if (!f) return;
        const out = await f.push(pcm);
        if (!out) return;
        setPos({ lineIndex: out.lineIndex, wordIndex: out.wordIndex, confidence: out.confidence });
        if (typeof out.lineIndex === 'number') {
          const line = linesRef.current[out.lineIndex];
          if (line && line.verseId != null && line.verseId !== lastVerseRef.current) {
            lastVerseRef.current = line.verseId;
            setActiveVerseId(line.verseId);
            setLineNumber(out.lineIndex + 1);
          }
        }
      });
    } catch (e) {
      setStatus('error');
      setDetail(e?.message || 'audio setup failed');
      cleanup();
      return;
    }

    try {
      followerRef.current = await engine.createFollower(verses, { inputSr: sampleRate });
    } catch (e) {
      setStatus('error');
      setDetail(`engine init failed: ${e?.message || e}`);
      cleanup();
      return;
    }
    setStatus('listening');
    setDetail(`${verses.length} lines · ${MODES[mode].label}`);
  }, [
    activeShabadId,
    isSundarGutkaBani,
    isCeremonyBani,
    sundarGutkaBaniId,
    baniLength,
    mode,
    cleanup,
    startAudio,
    setActiveVerseId,
    setLineNumber,
  ]);

  // -- Blind auto-detect: identify the shabad from audio, then follow it --------

  // A confident, stable candidate emerged. Open that shabad in the app and hand
  // off to the normal follower (the re-attach effect below starts it once
  // activeShabadId updates).
  const lockOnto = useCallback(
    (cand) => {
      recognizingRef.current = false;
      cleanup();
      followingKeyRef.current = null;
      lastVerseRef.current = null;
      setPos(null);
      setCands([]);
      setHeard('');
      setRawHeard('');
      setStatus('connecting');
      setDetail('found it — projecting & following…');
      openShabadRef.current(cand.shabadId, cand.verseId, cand.verse);
    },
    [cleanup],
  );

  // -- Autopilot: hands-free detect -> follow -> auto-switch, one session -------

  // Drop back to detecting (the current shabad stopped matching, or we're just
  // starting). Keeps whatever is on screen; spins up a FRESH recognizer so the
  // previous shabad's audio tail can't bias the next identification.
  const enterSearching = useCallback(async () => {
    phaseRef.current = 'searching';
    followerRef.current = null;
    detectVotesRef.current = new Map();
    detectRowsRef.current = new Map();
    detectStableRef.current = { id: null, count: 0 };
    setCands([]);
    setPos(null);
    setStatus('detecting');
    setDetail('listening for the next shabad…');
    try {
      if (sampleRateRef.current) {
        recognizerRef.current = await engine.createRecognizer({
          inputSr: sampleRateRef.current,
          hopS: AP_REC_HOP_S,
        });
      }
    } catch (_) {
      /* keep the existing recognizer if a fresh one can't be built */
    }
  }, []);

  // A confident, stable shabad emerged — either the FIRST one (initial lock) or a
  // DIFFERENT one that has taken over while we were following (switch). Build a
  // follower for it, project it (unless it's the one already up), and (keep)
  // following — all without tearing down the single continuous mic session.
  // Re-entrancy-guarded so overlapping detections can't double-commit.
  const autopilotLock = useCallback(
    async (cand) => {
      if (!cand || !cand.verse) return;
      if (lockingRef.current) return; // a lock/switch is already committing
      lockingRef.current = true;
      // On a switch we already have a working follower; a transient failure below
      // must NOT drop it, so remember whether this is the first lock or a switch.
      const isSwitch = !!followerRef.current;
      try {
        setStatus('connecting');
        setDetail(isSwitch ? 'switching to the new shabad…' : 'found it — projecting & following…');

        let verses;
        try {
          const rows = await banidb.loadShabad(cand.shabadId);
          const filtered = filterRequiredVerseItems(rows).filter(
            (it) => it && it.verseId != null && it.verse,
          );
          verses = filtered.map((it) => ({
            verseId: it.verseId,
            words: tokenize(anvaad.unicode(it.verse)),
          }));
        } catch (e) {
          setDetail(`could not load shabad: ${e?.message || e}`);
          if (!isSwitch) await enterSearching();
          return;
        }
        if (!verses.length) {
          if (!isSwitch) await enterSearching();
          return;
        }

        let follower;
        try {
          follower = await engine.createFollower(verses, { inputSr: sampleRateRef.current });
        } catch (e) {
          setDetail(`engine init failed: ${e?.message || e}`);
          if (!isSwitch) await enterSearching();
          return;
        }
        // A stop may have happened during the awaits.
        if (!autopilotRef.current) return;

        // Commit the new shabad.
        phaseRef.current = 'following';
        lastVerseRef.current = null;
        followerRef.current = follower;
        if (cand.shabadId !== currentShabadIdRef.current) {
          currentShabadIdRef.current = cand.shabadId;
          openShabadRef.current(cand.shabadId, cand.verseId, cand.verse);
        }
        // Fresh vote slate so the shabad we just committed to can't immediately
        // re-trigger a switch, and so evidence for the next one starts clean.
        detectVotesRef.current = new Map();
        detectRowsRef.current = new Map();
        detectStableRef.current = { id: null, count: 0 };
        // Also give the recognizer a clean buffer: its window still holds up to
        // ~10s of the PREVIOUS shabad's audio, which would otherwise keep voting
        // for the old shabad and could flip us straight back. A fresh session
        // starts identification of the new shabad from now. (Cheap — shares the
        // already-loaded model session.)
        try {
          if (sampleRateRef.current) {
            recognizerRef.current = await engine.createRecognizer({
              inputSr: sampleRateRef.current,
              hopS: AP_REC_HOP_S,
            });
          }
        } catch (_) {
          /* keep the existing recognizer if a fresh one can't be built */
        }
        setCands([]);
        setStatus('listening');
        setDetail('following — sing on');
      } finally {
        lockingRef.current = false;
      }
    },
    [enterSearching],
  );

  // Each decode from the recognizer: turn it into Gurmukhi first-letters, slide
  // several n-grams across them, search banidb for each, and vote. Surface the
  // running shortlist, and auto-select once one shabad is confidently ahead.
  const handleTranscript = useCallback(
    async (text) => {
      if (!recognizingRef.current) return;
      setRawHeard((text || '').trim().slice(-60));
      // Unicode first-letters are for the readable on-screen chip; the search needs
      // ASCII-font first-letters (the DB's FirstLetterStr encoding). They're 1:1.
      const flUni = (anvaad.firstLetters(text || '') || '').replace(/\s+/g, '').trim();
      const fl = toAsciiFirstLetters(text);
      if (fl.length < DETECT_MIN_LETTERS) {
        setHeard(flUni);
        return;
      }
      setHeard(flUni.slice(-28)); // show a readable tail of what's been heard

      // Fade prior evidence a touch each decode so the tally tracks what's being
      // sung now, not a false start from a few seconds ago.
      const votes = detectVotesRef.current;
      votes.forEach((v, k) => {
        const nv = v * DETECT_VOTE_DECAY;
        if (nv < 0.4) votes.delete(k);
        else votes.set(k, nv);
      });

      // Build the query set: contiguous n-grams (CONTAINS — tolerant of errors in
      // the surrounding letters), a couple of leave-one-out variants of the recent
      // window (tolerates ONE spurious inserted letter), and a start-anchored query
      // (BEGINSWITH — a shabad that begins with what's sung is a strong match).
      const queries = [];
      const seenQ = new Set();
      const addQ = (q, w, type) => {
        if (!q || q.length < 4 || queries.length >= DETECT_MAX_GRAMS) return;
        const key = `${type}:${q}`;
        if (seenQ.has(key)) return;
        seenQ.add(key);
        queries.push({ q, w, type });
      };
      // Start-anchored first (strongest signal), then sliding windows most-recent
      // and longest first, then one-letter-drop variants of the recent window.
      addQ(fl.slice(0, Math.min(fl.length, 8)), START_MATCH_WEIGHT, FIRST_LETTERS_START);
      for (let gi = 0; gi < GRAM_SIZES.length; gi += 1) {
        const k = GRAM_SIZES[gi];
        if (fl.length < k) continue; // eslint-disable-line no-continue
        for (let s = fl.length - k; s >= 0; s -= 1) addQ(fl.slice(s, s + k), k, FIRST_LETTERS_ANYWHERE);
      }
      const tail = fl.slice(-8);
      for (let d = 1; d < tail.length - 1; d += 1) {
        addQ(tail.slice(0, d) + tail.slice(d + 1), tail.length - 1, FIRST_LETTERS_ANYWHERE);
      }
      if (!queries.length) return;

      const results = await Promise.all(
        queries.map((g) =>
          banidb
            .query(g.q, g.type, 'all', 8)
            .then((r) => ({ g, r }))
            .catch(() => ({ g, r: [] })),
        ),
      );
      if (!recognizingRef.current) return; // locked/stopped during the awaits

      const rowByShabad = detectRowsRef.current;
      results.forEach(({ g, r }) => {
        if (!r || !r.length) return;
        r.forEach((row, i) => {
          let sid = null;
          try {
            sid = row.Shabads[0].ShabadID;
          } catch (_) {
            sid = null;
          }
          if (sid == null) return;
          // Longer gram + higher rank in its result set => stronger evidence.
          const weight = g.w * ((r.length - i) / r.length);
          // Cap the tally so a long-running shabad can't build a lead so large it
          // becomes impossible to ever switch away from it.
          votes.set(sid, Math.min(VOTE_CAP, (votes.get(sid) || 0) + weight));
          if (!rowByShabad.has(sid)) {
            rowByShabad.set(sid, { verseId: row.ID, verse: row.Gurmukhi, shabadId: sid });
          }
        });
      });

      if (!votes.size) {
        if (!(autopilotRef.current && phaseRef.current === 'following')) {
          setCands([]);
          setDetail(`heard ${fl.length} letters — no match yet…`);
        }
        return;
      }

      // Rank by accumulated votes. Confidence is the leader's SEPARATION from the
      // runner-up (best / (best + second)) — meaningful and reachable, unlike a
      // share of the whole ambiguous field. Candidate bars are shown relative to
      // the leader so the top guess reads as a full bar.
      const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
      const best = ranked[0][1];
      const second = ranked[1] ? ranked[1][1] : 0;
      const leaderId = ranked[0][0];
      const lead = best / (best + second || best);

      const shortlist = ranked.slice(0, DETECT_TOP_N).map(([sid, v]) => {
        const row = rowByShabad.get(sid) || {};
        return {
          shabadId: sid,
          verseId: row.verseId,
          verse: row.verse,
          display: row.verse ? anvaad.unicode(row.verse) : '',
          share: v / best,
        };
      });
      // Don't surface the detect shortlist while following — it's background
      // switch-detection, not something the presenter should see or tap.
      if (!(autopilotRef.current && phaseRef.current === 'following')) setCands(shortlist);

      const st = detectStableRef.current;
      if (leaderId === st.id) st.count += 1;
      else {
        st.id = leaderId;
        st.count = 1;
      }
      // Nudge: with only a few letters the match is ambiguous — more sung words
      // narrow it down, and the shortlist is tappable in the meantime. While
      // already following (autopilot), stay quiet so detection running in the
      // background doesn't churn the "following — sing on" status.
      if (!(autopilotRef.current && phaseRef.current === 'following')) {
        if (lead >= AUTO_LOCK_CONF && best >= DETECT_MIN_EVIDENCE) {
          setDetail(`${Math.round(lead * 100)}% confident · confirming ${Math.min(st.count, DETECT_STABLE)}/${DETECT_STABLE}`);
        } else {
          setDetail('keep singing to narrow it down — or tap a match below');
        }
      }

      // Auto-select when the leader is clearly ahead of the runner-up, has held
      // the lead a few decodes, and has enough absolute evidence.
      const cand = shortlist[0];
      if (!cand || !cand.verse) return;

      if (autopilotRef.current) {
        // A lock/switch already committing? Let it finish before deciding again.
        if (lockingRef.current) return;
        if (phaseRef.current === 'searching') {
          // FIRST lock: stricter than manual (more sung letters + more stable
          // decodes) so a couple of ambiguous first-letters can't pick the wrong
          // shabad the instant listening starts.
          if (
            fl.length >= AP_LOCK_MIN_LETTERS &&
            lead >= AUTO_LOCK_CONF &&
            best >= DETECT_MIN_EVIDENCE &&
            st.count >= AP_LOCK_STABLE
          ) {
            autopilotLock(cand);
          }
        } else {
          // FOLLOWING: detection runs continuously so we can catch the singer
          // moving to a new shabad even when the follower keeps grazing the old
          // lines (shared Gurbani words) and never releases. Switch ONLY to a
          // DIFFERENT shabad that both clears the (stricter) switch gates and
          // clearly dominates the one we're currently on.
          const curVotes = votes.get(currentShabadIdRef.current) || 0;
          if (
            leaderId !== currentShabadIdRef.current &&
            lead >= AP_SWITCH_CONF &&
            best >= AP_SWITCH_EVIDENCE &&
            st.count >= AP_SWITCH_STABLE &&
            best >= curVotes * AP_SWITCH_MARGIN
          ) {
            autopilotLock(cand);
          }
        }
      } else if (
        lead >= AUTO_LOCK_CONF &&
        best >= DETECT_MIN_EVIDENCE &&
        st.count >= DETECT_STABLE
      ) {
        lockOnto(cand);
      }
    },
    [lockOnto, autopilotLock],
  );

  // Start a blind-detect session: same mic pipeline as start(), but we run the
  // free-decode recognizer in-process and identify + open the shabad ourselves.
  const startDetect = useCallback(async () => {
    cleanup();
    recognizingRef.current = true;
    detectVotesRef.current = new Map();
    detectRowsRef.current = new Map();
    detectStableRef.current = { id: null, count: 0 };
    lastVerseRef.current = null;
    setPos(null);
    setCands([]);
    setHeard('');
    setRawHeard('');
    setStatus('detecting');
    setDetail('listening for a shabad…');

    // First run only: ensure the model is present + the ONNX session is loaded.
    if (!engine.isReady()) {
      setDetail('downloading recognition model (~184 MB, one time)…');
      setDlProgress(0);
    }
    try {
      await engine.ready((p) => {
        setDlProgress(p);
        setDetail(`downloading recognition model… ${Math.round(p * 100)}% (one time)`);
      });
    } catch (e) {
      setStatus('error');
      setDetail(`could not prepare the recognition model: ${e?.message || e}`);
      setDlProgress(null);
      recognizingRef.current = false;
      return;
    }
    setDlProgress(null);
    if (!recognizingRef.current) return; // stopped during the download

    let sampleRate;
    try {
      sampleRate = await startAudio(async (pcm) => {
        const r = recognizerRef.current;
        if (!r || !recognizingRef.current) return;
        const out = await r.push(pcm);
        if (out && out.text) handleTranscript(out.text);
      });
    } catch (e) {
      setStatus('error');
      setDetail(e?.message || 'audio setup failed');
      recognizingRef.current = false;
      cleanup();
      return;
    }

    try {
      recognizerRef.current = await engine.createRecognizer({ inputSr: sampleRate });
    } catch (e) {
      setStatus('error');
      setDetail(`engine init failed: ${e?.message || e}`);
      recognizingRef.current = false;
      cleanup();
      return;
    }
    setDetail('listening… sing or recite a few words');
  }, [cleanup, startAudio, handleTranscript]);

  // One-press hands-free mode. A single continuous mic session: detect a shabad,
  // follow it, and when the singer moves to a different shabad (the follower
  // releases), automatically find and project the next one — no clicks, no
  // confirmations, no person needed at the computer.
  const startAutopilot = useCallback(async () => {
    cleanup();
    autopilotRef.current = true;
    recognizingRef.current = true;
    phaseRef.current = 'searching';
    lockingRef.current = false;
    currentShabadIdRef.current = null;
    detectVotesRef.current = new Map();
    detectRowsRef.current = new Map();
    detectStableRef.current = { id: null, count: 0 };
    lastVerseRef.current = null;
    setPos(null);
    setCands([]);
    setHeard('');
    setRawHeard('');
    setStatus('detecting');
    setDetail('starting…');

    if (!engine.isReady()) {
      setDetail('downloading recognition model (~184 MB, one time)…');
      setDlProgress(0);
    }
    try {
      await engine.ready((p) => {
        setDlProgress(p);
        setDetail(`downloading recognition model… ${Math.round(p * 100)}% (one time)`);
      });
    } catch (e) {
      setStatus('error');
      setDetail(`could not prepare the recognition model: ${e?.message || e}`);
      setDlProgress(null);
      autopilotRef.current = false;
      recognizingRef.current = false;
      return;
    }
    setDlProgress(null);
    if (!autopilotRef.current) return; // stopped during the download

    let sampleRate;
    try {
      sampleRate = await startAudio(async (pcm) => {
        if (!autopilotRef.current) return;
        // Detection runs on EVERY chunk, in both phases. This is what makes
        // autopilot un-stuck: the moment a different shabad clearly takes over,
        // handleTranscript switches us — we no longer depend on the follower
        // releasing (it often won't, because Gurbani lines share words).
        const r = recognizerRef.current;
        if (r) {
          const rout = await r.push(pcm);
          if (rout && rout.text) handleTranscript(rout.text);
        }
        // While following, also advance the follower for the live line/word cursor.
        if (phaseRef.current === 'following') {
          const f = followerRef.current;
          if (!f) return; // still building the follower after a lock/switch
          const out = await f.push(pcm);
          if (!out) return;
          // Follower released (singer paused, or moved on): just hold the current
          // shabad on screen — detection above handles any real switch.
          if (out.lineIndex == null || out.verseIndex === -1) return;
          setPos({ lineIndex: out.lineIndex, wordIndex: out.wordIndex, confidence: out.confidence });
          if (out.verseId != null && out.verseId !== lastVerseRef.current) {
            lastVerseRef.current = out.verseId;
            setActiveVerseId(out.verseId);
            setLineNumber(out.lineIndex + 1);
          }
        }
      });
    } catch (e) {
      setStatus('error');
      setDetail(e?.message || 'audio setup failed');
      autopilotRef.current = false;
      recognizingRef.current = false;
      cleanup();
      return;
    }
    sampleRateRef.current = sampleRate;

    try {
      recognizerRef.current = await engine.createRecognizer({
        inputSr: sampleRate,
        hopS: AP_REC_HOP_S,
      });
    } catch (e) {
      setStatus('error');
      setDetail(`engine init failed: ${e?.message || e}`);
      autopilotRef.current = false;
      recognizingRef.current = false;
      cleanup();
      return;
    }
    setDetail('listening… start singing any shabad');
  }, [cleanup, startAudio, handleTranscript, enterSearching, setActiveVerseId, setLineNumber]);

  // While listening, if the presenter switches to a different shabad or bani (via
  // any menu — search, history, favorites, arrows, bani picker), re-attach to the
  // new content so we stop matching against the previous one's lines.
  useEffect(() => {
    // Autopilot owns its own content switching within one continuous session —
    // never let the manual re-attach path tear it down.
    if (autopilotRef.current) return;
    const active = status === 'listening' || status === 'connecting';
    if (!active) return;
    if (isCeremonyBani) {
      // Switched to an unsupported content type — stop cleanly.
      stop();
      setStatus('error');
      setDetail('Voice-Follow supports shabads and banis, not ceremonies yet.');
      return;
    }
    let key = null;
    if (isSundarGutkaBani && sundarGutkaBaniId) key = `bani:${sundarGutkaBaniId}`;
    else if (activeShabadId) key = `shabad:${activeShabadId}`;
    if (key && key !== followingKeyRef.current) {
      start();
    }
  }, [activeShabadId, sundarGutkaBaniId, isSundarGutkaBani, isCeremonyBani, status, start, stop]);

  const listening = status === 'listening' || status === 'connecting';
  const detecting = status === 'detecting';
  const active = listening || detecting; // a session (follow or detect) is running
  // The floating widget is present whenever the tool is opened OR a session is
  // running (like Zoom's share bar, which persists independently of any menu).
  const present = isOpen || active;
  const panelVisible = present && !collapsed;

  // Opening from the toolbar mic (or the pill) always expands the panel.
  useEffect(() => {
    if (isOpen) setCollapsed(false);
  }, [isOpen]);

  // Dismiss the panel the easy ways: Esc or a click outside it. While a session
  // is running we collapse to the pill (never kill the live session); otherwise
  // we close the tool. Toolbar mic + pill are excluded so their own toggles
  // aren't double-fired.
  useEffect(() => {
    if (!panelVisible) return undefined;
    const dismiss = () => (active ? setCollapsed(true) : onScreenClose());
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const onDown = (e) => {
      const t = e.target;
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (t && t.closest && t.closest('#toolbar, #toolbar-nav, #tool-voice-follow, #vf-pill')) return;
      dismiss();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [panelVisible, active, onScreenClose]);

  // Drag handle: mousedown on a widget's grip moves the whole widget. Records a
  // moved flag so a drag on the pill doesn't also fire its expand-on-click.
  const startDrag = useCallback((e) => {
    if (e.button !== 0) return;
    const el = e.currentTarget.closest('[data-vf-widget]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    movedRef.current = false;
    // Coalesce moves to one state update per animation frame. Native mousemove
    // listeners don't batch, so an unthrottled setState-per-event is janky;
    // rAF caps it to ~60fps while keeping React the source of truth (so live
    // position re-renders during a session can't clobber the drag position).
    let pending = null;
    let raf = 0;
    const apply = () => {
      raf = 0;
      if (pending) setWidgetPos(pending);
    };
    const onMove = (m) => {
      movedRef.current = true;
      const maxLeft = window.innerWidth - w;
      const maxTop = window.innerHeight - h;
      pending = {
        left: Math.min(Math.max(0, m.clientX - offX), Math.max(0, maxLeft)),
        top: Math.min(Math.max(0, m.clientY - offY), Math.max(0, maxTop)),
      };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onUp = () => {
      if (raf) cancelAnimationFrame(raf);
      if (pending) setWidgetPos(pending);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, []);

  // Once dragged, both widgets use the free position (and the caret that points
  // back at the mic no longer makes sense, so it's hidden).
  const posOverride = widgetPos
    ? { top: widgetPos.top, left: widgetPos.left, right: 'auto', bottom: 'auto' }
    : null;

  const posLine = pos && typeof pos.lineIndex === 'number' ? pos.lineIndex + 1 : null;
  const dot = (
    <span
      className={`vf-dot${active ? ' is-live' : ''}`}
      style={{ background: DOT[status] || '#888' }}
    />
  );

  // Human-readable status line (avoids surfacing internal states like "idle").
  const statusText =
    status === 'idle'
      ? 'Ready — pick a mode and press Start'
      : `${STATUS_LABEL[status] || status}${detail ? ` — ${detail}` : ''}`;
  // Short label for the collapsed pill.
  let pillText = STATUS_LABEL[status] || 'Voice-Follow';
  if (status === 'listening') pillText = `Line ${posLine == null ? '—' : posLine}`;

  // Live stats (shown while listening). Word is 1-based like the line; confidence
  // reads as a friendly percentage.
  const wordNum = pos && typeof pos.wordIndex === 'number' ? pos.wordIndex + 1 : null;
  const confPct =
    pos && typeof pos.confidence === 'number' ? `${Math.round(pos.confidence * 100)}%` : null;

  // Main button: Stop while a session runs, else Start. Autopilot is the default
  // hands-free experience; manual follow / one-shot detect are the fallbacks.
  let onMainClick = start;
  if (active) onMainClick = stop;
  else if (autopilot) onMainClick = startAutopilot;
  else if (autoDetect) onMainClick = startDetect;
  let mainLabel = '●  Start listening';
  if (active) mainLabel = '■  Stop';
  else if (autopilot) mainLabel = '●  Start autopilot';
  else if (autoDetect) mainLabel = '●  Start auto-detect';

  return (
    <>
      {/* Non-modal, draggable floating panel. No backdrop, so the Gurbani stays
          fully visible while you set up and sing. Drag it by the header. */}
      {panelVisible && (
        <div ref={panelRef} data-vf-widget className="vf-panel" style={posOverride || undefined}>
          {!widgetPos && <span className="vf-caret" />}
          <div className="vf-header" onMouseDown={startDrag} title="Drag to move">
            <span className="vf-title">
              <span className="vf-grip">⠿</span>
              {dot}
              Voice&#8288;-&#8288;Follow <span className="vf-tag">beta</span>
            </span>
            <span className="vf-hdr-btns">
              <button
                type="button"
                className="vf-hdr-btn"
                title="Collapse to pill"
                aria-label="Collapse"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setCollapsed(true)}
              >
                –
              </button>
              <button
                type="button"
                className="vf-hdr-btn"
                title="Close (Esc)"
                aria-label="Close"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => (active ? setCollapsed(true) : onScreenClose())}
              >
                ×
              </button>
            </span>
          </div>

          <label
            className="vf-toggle vf-toggle-primary"
            title="Hands-free: detect, follow, and switch shabads automatically — press once and walk away"
          >
            <input
              type="checkbox"
              checked={autopilot}
              disabled={active}
              onChange={(e) => setAutopilot(e.target.checked)}
            />
            <span>Autopilot — follow &amp; switch shabads hands&#8288;-free</span>
          </label>

          {!autopilot && (
            <>
              <div className="vf-modes">
                {Object.keys(MODES).map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={active}
                    onClick={() => setMode(k)}
                    className={`vf-mode${mode === k ? ' is-active' : ''}`}
                  >
                    {MODES[k].label}
                  </button>
                ))}
              </div>

              <label className="vf-toggle" title="Identify the shabad from your voice, then follow it">
                <input
                  type="checkbox"
                  checked={autoDetect}
                  disabled={active}
                  onChange={(e) => setAutoDetect(e.target.checked)}
                />
                <span>Auto&#8288;-detect the shabad from my voice</span>
              </label>
            </>
          )}

          <button
            type="button"
            onClick={onMainClick}
            className={`vf-main ${active ? 'is-stop' : 'is-start'}`}
          >
            {mainLabel}
          </button>

          {dlProgress != null && (
            <div className="vf-dl" title="Downloading the recognition model (one time)">
              <span className="vf-dl-bar" style={{ width: `${Math.round(dlProgress * 100)}%` }} />
            </div>
          )}

          {status === 'listening' && (
            <div className="vf-stats">
              <div className="vf-stat">
                <span className="vf-stat-val">{posLine == null ? '—' : posLine}</span>
                <span className="vf-stat-label">Line</span>
              </div>
              <div className="vf-stat">
                <span className="vf-stat-val">{wordNum == null ? '—' : wordNum}</span>
                <span className="vf-stat-label">Word</span>
              </div>
              <div className="vf-stat">
                <span className="vf-stat-val">{confPct == null ? '—' : confPct}</span>
                <span className="vf-stat-label">Confidence</span>
              </div>
            </div>
          )}
          {detecting && (
            <div className="vf-detect">
              <div className="vf-detect-head">
                <span className="vf-detect-spin" />
                <span className="vf-detect-text">{detail || 'listening for a shabad…'}</span>
              </div>
              {rawHeard && (
                <div className="vf-raw" title="What the recognizer transcribed" lang="pa">
                  {rawHeard}
                </div>
              )}
              {heard && (
                <div className="vf-heard" title="Gurmukhi first-letters heard">
                  {heard}
                </div>
              )}
              {cands.length > 0 && (
                <div className="vf-cands">
                  {cands.map((c, i) => (
                    <button
                      key={c.shabadId}
                      type="button"
                      className={`vf-cand${i === 0 ? ' is-leader' : ''}`}
                      title="Select and project this shabad"
                      onClick={() => c.verse && lockOnto(c)}
                    >
                      <span
                        className="vf-cand-bar"
                        style={{ width: `${Math.round(c.share * 100)}%` }}
                      />
                      <span className="vf-cand-line" lang="pa">
                        {c.display || '…'}
                      </span>
                      <span className="vf-cand-pct">{Math.round(c.share * 100)}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {status !== 'listening' && !detecting && <div className="vf-status">{statusText}</div>}
        </div>
      )}

      {/* Collapsed state: a compact, draggable status pill. Click expands back
          to the panel; drag to reposition (a drag doesn't trigger the expand). */}
      {present && collapsed && (
        <button
          id="vf-pill"
          data-vf-widget
          type="button"
          className="vf-pill"
          style={posOverride || undefined}
          title="Voice-Follow — click to expand, drag to move"
          onMouseDown={startDrag}
          onClick={() => {
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            setCollapsed(false);
            if (!isOpen) setOverlayScreen('voice-follow');
          }}
        >
          {dot}
          {pillText}
        </button>
      )}
    </>
  );
};

VoiceFollow.propTypes = {
  isOpen: PropTypes.bool,
  onScreenClose: PropTypes.func,
};

const DOT = {
  idle: '#888',
  connecting: '#f39c12',
  detecting: '#5b73ff',
  listening: '#27ae60',
  error: '#c0392b',
  stopped: '#888',
};
const STATUS_LABEL = {
  idle: 'Ready',
  connecting: 'Starting…',
  detecting: 'Detecting…',
  listening: 'Listening',
  error: 'Problem',
  stopped: 'Stopped',
};

export default VoiceFollow;
