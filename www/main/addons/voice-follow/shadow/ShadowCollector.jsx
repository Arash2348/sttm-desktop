import React, { useEffect, useRef, useState } from 'react';
import { useStoreState, useStoreActions } from 'easy-peasy';
import { SHADOW_BUILD, SHADOW_AUDIO_BPS, SHADOW_SLICE_MS, SHADOW_SEGMENT_MS } from './config';

const fs = require('fs');
const path = require('path');
const bus = require('./bus');
const uploader = require('./uploader');
const { logDir } = require('../engine/session-log');

const remote = require('@electron/remote');

// One folder per app session under <userData>/voice-follow/shadow/<id>/:
//   audio-000.webm ... - what the microphone heard, one file per SHADOW_SEGMENT_MS
//   timeline.jsonl     - what the sevadaar put on screen (the human label)
//   system.jsonl       - what Voice-Follow would have shown (shadow mode)
//   events.jsonl       - matches, pauses, audio segment boundaries
//   score.json         - live agreement totals, rewritten every 30 s
//   session.json       - tester, app version, microphone, start time
const shadowRoot = () => path.join(logDir(), 'shadow');

// The screen state that names what is being shown.
const labelOf = (nav) => ({
  shabadId: nav.activeShabadId ?? null,
  verseId: nav.activeVerseId ?? null,
  bani: nav.isSundarGutkaBani ? (nav.sundarGutkaBaniId ?? null) : null,
  ceremony: nav.isCeremonyBani ? (nav.ceremonyId ?? null) : null,
  slide: nav.isMiscSlide ? nav.miscSlideText || true : null,
});

const readTester = (raw) => {
  try {
    return JSON.parse(raw || '{}');
  } catch (_) {
    return {};
  }
};

const ShadowCollector = () => {
  const nav = useStoreState((state) => state.navigator);
  const { shadowRecording, shadowTester } = useStoreState((state) => state.userSettings);
  const { setShadowRecording, setShadowTester } = useStoreActions(
    (actions) => actions.userSettings,
  );
  const tester = readTester(shadowTester);
  const [name, setName] = useState(tester.name || '');
  const [gurdwara, setGurdwara] = useState(tester.gurdwara || '');
  const sessionRef = useRef(null);

  const enabled = SHADOW_BUILD && !!tester.name && shadowRecording !== false;

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let segTimer = null;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const id = new Date().toISOString().replace(/[:.]/g, '-');
        const dir = path.join(shadowRoot(), id);
        fs.mkdirSync(dir, { recursive: true });
        const t0 = Date.now();
        const s = { dir, t0, stream, recorder: null, seg: 0 };
        sessionRef.current = s;
        fs.writeFileSync(
          path.join(dir, 'session.json'),
          JSON.stringify(
            {
              id,
              tester: readTester(shadowTester),
              startedAt: new Date(t0).toISOString(),
              app: remote.app.getVersion(),
              build: 'mvp-8.1-shadow',
              platform: process.platform,
              microphone: stream.getAudioTracks()[0]?.label || '',
            },
            null,
            1,
          ),
        );
        bus.begin(dir, t0);
        bus.human(labelOf(nav));
        // Audio in self-contained segments so finished ones can upload during the service.
        const startSegment = () => {
          const file = path.join(dir, `audio-${String(s.seg).padStart(3, '0')}.webm`);
          const rec = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: SHADOW_AUDIO_BPS,
          });
          const at = (Date.now() - t0) / 1000;
          fs.appendFileSync(
            path.join(dir, 'events.jsonl'),
            `${JSON.stringify({ t: at, type: 'audio_segment', file: path.basename(file) })}\n`,
          );
          rec.ondataavailable = async (e) => {
            if (!e.data || !e.data.size) return;
            try {
              fs.appendFileSync(file, Buffer.from(await e.data.arrayBuffer()));
            } catch (_) {
              /* never disturb the sevadaar */
            }
          };
          rec.onstop = () => uploader.enqueue(dir, path.basename(file));
          rec.start(SHADOW_SLICE_MS);
          s.recorder = rec;
          s.seg += 1;
        };
        startSegment();
        segTimer = setInterval(() => {
          try {
            s.recorder.stop();
          } catch (_) {
            /* restart below */
          }
          startSegment();
        }, SHADOW_SEGMENT_MS);
      } catch (e) {
        try {
          fs.mkdirSync(shadowRoot(), { recursive: true });
          fs.appendFileSync(
            path.join(shadowRoot(), 'errors.log'),
            `${new Date().toISOString()} ${e?.message || e}\n`,
          );
        } catch (_) {
          /* ignore */
        }
      }
    };
    start();
    const stop = () => {
      stopped = true;
      clearInterval(segTimer);
      const s = sessionRef.current;
      sessionRef.current = null;
      if (!s) return;
      try {
        if (s.recorder && s.recorder.state !== 'inactive') s.recorder.stop();
      } catch (_) {
        /* already stopped */
      }
      s.stream.getTracks().forEach((t) => t.stop());
      bus.end();
      uploader.enqueueSession(s.dir);
    };
    window.addEventListener('beforeunload', stop);
    uploader.start(shadowRoot());
    return () => {
      window.removeEventListener('beforeunload', stop);
      stop();
    };
    // Start once per enable; the label effect below records every screen change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Every change of what is on screen, timestamped against the audio.
  const label = labelOf(nav);
  const key = JSON.stringify(label);
  useEffect(() => {
    if (sessionRef.current) bus.human(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!SHADOW_BUILD || tester.name) return null;

  // First launch only: who is testing (to group sessions), and the agreement.
  return (
    <div className="shadow-consent">
      <div className="shadow-consent-card">
        <h2>Voice-Follow test build</h2>
        <p>
          Thank you for helping. While you use this app as normal, it records the Gurdwara audio and
          which Shabad and line you show, and quietly checks how Voice-Follow would have done.
          Recordings are uploaded to the Voice-Follow team only. You can stop at any time in
          Settings.
        </p>
        <label htmlFor="shadow-name">
          Your name
          <input id="shadow-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label htmlFor="shadow-gurdwara">
          Gurdwara
          <input
            id="shadow-gurdwara"
            value={gurdwara}
            onChange={(e) => setGurdwara(e.target.value)}
          />
        </label>
        <div className="shadow-consent-actions">
          <button
            type="button"
            className="shadow-consent-yes"
            disabled={!name.trim()}
            onClick={() => {
              setShadowTester(
                JSON.stringify({
                  name: name.trim(),
                  gurdwara: gurdwara.trim(),
                  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                }),
              );
              setShadowRecording(true);
            }}
          >
            I agree, start
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShadowCollector;
