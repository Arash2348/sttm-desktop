import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreState, useStoreActions } from 'easy-peasy';

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
  // Zoom-style floating widget: collapse the panel down to just the pill, and
  // drag either one anywhere on screen. `widgetPos` is null until first dragged
  // (then it overrides the default anchored position).
  const [collapsed, setCollapsed] = useState(false);
  const [widgetPos, setWidgetPos] = useState(null); // { top, left } | null
  const movedRef = useRef(false); // set during a drag so the pill click doesn't also expand

  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const nodeRef = useRef(null);
  const srcRef = useRef(null);
  const linesRef = useRef([]); // [{ verseId }] indexed by aligner lineIndex
  const lastVerseRef = useRef(null);
  const followingShabadRef = useRef(null); // shabad id the current session was built for
  const panelRef = useRef(null); // flyout panel, for click-outside dismissal

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
  // The floating widget is present whenever the tool is opened OR a session is
  // running (like Zoom's share bar, which persists independently of any menu).
  const present = isOpen || listening;
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
    const dismiss = () => (listening ? setCollapsed(true) : onScreenClose());
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
  }, [panelVisible, listening, onScreenClose]);

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
      className={`vf-dot${listening ? ' is-live' : ''}`}
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
                onClick={() => (listening ? setCollapsed(true) : onScreenClose())}
              >
                ×
              </button>
            </span>
          </div>

          <div className="vf-modes">
            {Object.keys(MODES).map((k) => (
              <button
                key={k}
                type="button"
                disabled={listening}
                onClick={() => setMode(k)}
                className={`vf-mode${mode === k ? ' is-active' : ''}`}
              >
                {MODES[k].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={listening ? stop : start}
            className={`vf-main ${listening ? 'is-stop' : 'is-start'}`}
          >
            {listening ? '■  Stop' : '●  Start listening'}
          </button>

          {status === 'listening' ? (
            <div className="vf-live">
              <span className="vf-live-num">{posLine == null ? '—' : posLine}</span>
              <span className="vf-live-label">
                current line
                <br />
                {MODES[mode].label}
              </span>
            </div>
          ) : (
            <div className="vf-status">{statusText}</div>
          )}
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

const DOT = { idle: '#888', connecting: '#f39c12', listening: '#27ae60', error: '#c0392b', stopped: '#888' };
const STATUS_LABEL = {
  idle: 'Ready',
  connecting: 'Starting…',
  listening: 'Listening',
  error: 'Problem',
  stopped: 'Stopped',
};

export default VoiceFollow;
