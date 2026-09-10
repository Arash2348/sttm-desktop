import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreState, useStoreActions } from 'easy-peasy';

import { Overlay } from '../../../common/sttm-ui';
import { filterRequiredVerseItems } from '../../../navigator/shabad/utils/filter-verse-items';

const anvaad = require('anvaad-js');
const banidb = require('../../../banidb');

// Local forced-alignment sidecar (voice-align-server, `python server.py`).
const FA_URL = 'ws://127.0.0.1:8000/ws';

// Two modes carried over from the web lab: Path (spoken paatth, 4s window) and
// Kirtan (sung, 8s window). Both map to the karansea CTC + line decoder.
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

// Split a Unicode Gurmukhi line into word tokens for the aligner. The server
// normalizes further (strips punctuation/matras irrelevant to matching); this
// only needs to break on whitespace and drop dandas/line numbers.
const tokenize = (uni) =>
  (uni || '')
    .replace(/[॥।]|\d+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const VoiceFollow = ({ isOpen, onScreenClose }) => {
  // Select the primitive directly rather than holding the whole navigator slice
  // object across renders — a slice reference can be an immer proxy that gets
  // revoked between selection and render.
  const activeShabadId = useStoreState((state) => state.navigator.activeShabadId);
  // Bani/ceremony are a different content path (separate ids); voice-follow only
  // knows how to load a regular shabad by activeShabadId.
  const isSundarGutkaBani = useStoreState((state) => state.navigator.isSundarGutkaBani);
  const isCeremonyBani = useStoreState((state) => state.navigator.isCeremonyBani);
  const { setActiveVerseId, setLineNumber } = useStoreActions((actions) => actions.navigator);
  const setOverlayScreen = useStoreActions((actions) => actions.app.setOverlayScreen);

  const [status, setStatus] = useState('idle'); // idle|connecting|listening|error|stopped
  const [mode, setMode] = useState('kirtan');
  const [detail, setDetail] = useState('');
  const [pos, setPos] = useState(null); // { lineIndex, wordIndex, confidence }

  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const nodeRef = useRef(null);
  const srcRef = useRef(null);
  const linesRef = useRef([]); // [{ verseId }] indexed by aligner lineIndex
  const lastVerseRef = useRef(null);
  const followingShabadRef = useRef(null); // shabad id the current session was built for

  const cleanup = useCallback(() => {
    try { nodeRef.current?.disconnect(); } catch (_) {}
    try { srcRef.current?.disconnect(); } catch (_) {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { ctxRef.current?.close(); } catch (_) {}
    // Detach handlers first so a torn-down socket's onclose can't flip status
    // back to 'stopped' after we've already re-attached to a new shabad.
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
    }
    try { wsRef.current?.close(); } catch (_) {}
    wsRef.current = null; ctxRef.current = null; streamRef.current = null;
    nodeRef.current = null; srcRef.current = null;
  }, []);

  const stop = useCallback(() => {
    try { wsRef.current?.send(JSON.stringify({ type: 'stop' })); } catch (_) {}
    cleanup();
    setStatus('stopped');
    setDetail('');
  }, [cleanup]);

  const start = useCallback(async () => {
    if (isSundarGutkaBani || isCeremonyBani) {
      setStatus('error');
      setDetail('voice-follow supports shabads for now, not banis/ceremonies.');
      return;
    }
    if (!activeShabadId) {
      setStatus('error');
      setDetail('Open a shabad first, then start voice-follow.');
      return;
    }
    // Tear down any prior session so switching shabads mid-listen re-attaches
    // cleanly instead of leaking a socket/mic bound to the old shabad.
    cleanup();
    setStatus('connecting');
    setDetail('loading shabad lines…');
    lastVerseRef.current = null;
    followingShabadRef.current = activeShabadId;
    setPos(null);

    // Resolve the currently displayed shabad's lines -> {verseId, unicode words}.
    let verses;
    try {
      const rows = await banidb.loadShabad(activeShabadId);
      const filtered = filterRequiredVerseItems(rows)
        .filter((it) => it && it.verseId != null && it.verse);
      linesRef.current = filtered.map((it) => ({ verseId: it.verseId }));
      verses = filtered.map((it) => ({
        verseId: it.verseId,
        words: tokenize(anvaad.unicode(it.verse)),
      }));
    } catch (e) {
      setStatus('error');
      setDetail(`could not load shabad: ${e?.message || e}`);
      return;
    }
    if (!verses.length) {
      setStatus('error');
      setDetail('shabad has no lines to follow.');
      return;
    }

    const ws = new WebSocket(FA_URL);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false },
        });
      } catch (_) {
        setStatus('error');
        setDetail('microphone permission denied.');
        cleanup();
        return;
      }
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;

      ws.send(JSON.stringify({
        type: 'init',
        sampleRate: ctx.sampleRate,
        engine: 'karansea',
        profile: MODES[mode].profile,
        verses,
      }));

      try {
        const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        const node = new AudioWorkletNode(ctx, 'voice-follow-pcm');
        node.port.onmessage = (ev) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(ev.data);
          }
        };
        const src = ctx.createMediaStreamSource(stream);
        src.connect(node);
        // Deliberately not connected to destination — no playback.
        nodeRef.current = node;
        srcRef.current = src;
        setStatus('listening');
        setDetail(`${verses.length} lines · ${MODES[mode].label}`);
      } catch (e) {
        setStatus('error');
        setDetail(`audio setup failed: ${e?.message || e}`);
        cleanup();
      }
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (msg.type === 'position') {
        setPos({ lineIndex: msg.lineIndex, wordIndex: msg.wordIndex, confidence: msg.confidence });
        if (typeof msg.lineIndex === 'number') {
          const line = linesRef.current[msg.lineIndex];
          if (line && line.verseId != null && line.verseId !== lastVerseRef.current) {
            lastVerseRef.current = line.verseId;
            setActiveVerseId(line.verseId);
            setLineNumber(msg.lineIndex + 1);
          }
        }
      } else if (msg.type === 'error') {
        setStatus('error');
        setDetail(msg.message || 'server error');
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setDetail('cannot reach alignment server on :8000 — is it running?');
    };
    ws.onclose = () => {
      if (status === 'listening' || status === 'connecting') setStatus('stopped');
    };
  }, [activeShabadId, isSundarGutkaBani, isCeremonyBani, mode, cleanup, setActiveVerseId, setLineNumber, status]);

  // While listening, if the presenter switches to a different shabad (via any
  // menu — search, history, favorites, arrows), re-attach to the new shabad so
  // we stop matching against the previous one's lines.
  useEffect(() => {
    const active = status === 'listening' || status === 'connecting';
    if (!active) return;
    if (isSundarGutkaBani || isCeremonyBani) {
      // Switched to an unsupported content type — stop cleanly.
      stop();
      setStatus('error');
      setDetail('voice-follow supports shabads for now, not banis/ceremonies.');
      return;
    }
    if (activeShabadId && activeShabadId !== followingShabadRef.current) {
      start();
    }
  }, [activeShabadId, isSundarGutkaBani, isCeremonyBani, status, start, stop]);

  const listening = status === 'listening' || status === 'connecting';

  const dot = <span style={{ ...styles.dot, background: DOT[status] || '#888' }} />;
  const posLine = pos && typeof pos.lineIndex === 'number' ? pos.lineIndex + 1 : null;

  return (
    <>
      {/* Setup / control modal — opened from the toolbar mic button. */}
      <Overlay onScreenClose={onScreenClose} className={isOpen ? '' : 'd-none'}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            {dot}
            Voice-Follow <span style={styles.tag}>beta</span>
          </div>

          <div style={styles.row}>
            {Object.keys(MODES).map((k) => (
              <button
                key={k}
                type="button"
                disabled={listening}
                onClick={() => setMode(k)}
                style={{ ...styles.modeBtn, ...(mode === k ? styles.modeBtnActive : {}) }}
              >
                {MODES[k].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={listening ? stop : start}
            style={{ ...styles.mainBtn, background: listening ? '#c0392b' : '#27ae60' }}
          >
            {listening ? 'Stop listening' : 'Start listening'}
          </button>

          <div style={styles.status}>
            {status}
            {detail ? ` — ${detail}` : ''}
          </div>
          {pos && (
            <div style={styles.pos}>
              line {posLine == null ? '—' : posLine}
              {' · word '}
              {pos.wordIndex}
              {' · conf '}
              {typeof pos.confidence === 'number' ? pos.confidence.toFixed(2) : '—'}
            </div>
          )}
        </div>
      </Overlay>

      {/* Compact status pill — stays visible while listening even with the modal
          closed, so the presenter can monitor at a glance. Click reopens the
          modal (to Stop or switch mode). */}
      {listening && !isOpen && (
        <button
          type="button"
          style={styles.pill}
          title="Voice-Follow — click to open"
          onClick={() => setOverlayScreen('voice-follow')}
        >
          {dot}
          {status === 'connecting' ? 'connecting…' : `line ${posLine == null ? '—' : posLine}`}
        </button>
      )}
    </>
  );
};

VoiceFollow.propTypes = {
  isOpen: PropTypes.bool,
  onScreenClose: PropTypes.func,
};

const DOT = { idle: '#888', connecting: '#f39c12', listening: '#27ae60', error: '#c0392b', stopped: '#888' };

const styles = {
  modal: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    zIndex: 100000, width: 280, padding: 18, borderRadius: 12,
    background: 'rgba(20,20,24,0.97)', color: '#eee',
    font: '13px/1.45 -apple-system,Segoe UI,sans-serif', boxShadow: '0 8px 30px rgba(0,0,0,0.55)',
  },
  pill: {
    position: 'fixed', bottom: 16, right: 16, zIndex: 99999,
    display: 'flex', alignItems: 'center', gap: 2, padding: '6px 12px', borderRadius: 999,
    border: 'none', cursor: 'pointer', background: 'rgba(20,20,24,0.92)', color: '#eee',
    font: '12px/1 -apple-system,Segoe UI,sans-serif', fontVariantNumeric: 'tabular-nums',
    boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
  },
  header: { display: 'flex', alignItems: 'center', fontWeight: 600, marginBottom: 10, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: '50%', marginRight: 6, display: 'inline-block' },
  tag: { marginLeft: 6, fontSize: 9, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { display: 'flex', gap: 6, marginBottom: 8 },
  modeBtn: {
    flex: 1, padding: '5px 4px', fontSize: 10, borderRadius: 6, cursor: 'pointer',
    border: '1px solid #444', background: '#2a2a30', color: '#ccc',
  },
  modeBtnActive: { background: '#3d5afe', borderColor: '#3d5afe', color: '#fff' },
  mainBtn: {
    width: '100%', padding: '8px', border: 'none', borderRadius: 6, color: '#fff',
    fontWeight: 600, cursor: 'pointer', fontSize: 12,
  },
  status: { marginTop: 8, opacity: 0.85, wordBreak: 'break-word' },
  pos: { marginTop: 4, opacity: 0.7, fontVariantNumeric: 'tabular-nums' },
};

export default VoiceFollow;
