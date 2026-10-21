import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useStoreState, useStoreActions } from 'easy-peasy';

// What the tester build records, said once on first launch (ShadowCollector.jsx) and again
// whenever the sevadaar clicks the "Recording audio" chip in the workspace bar. One text
// for both, so they can never drift apart. Keep it true to ShadowCollector.jsx (what is
// saved: session.json, machineFacts) and uploader.js / hf.js (what turning it off stops).
export const SETTING_PATH = 'Settings › Other Options › Help improve Voice Autopilot';

export const NoticeText = ({ audio = true }) => (
  <div className="shadow-notice-text">
    <p>To make Voice Autopilot better, STTM shares with Khalis Foundation:</p>
    <ul>
      {audio && (
        <li>
          sound from the microphone while a program is going on (from when there is kirtan in the
          room or you change what is on screen), <b>even when Voice Autopilot is not in use</b>
        </li>
      )}
      <li>what is shown on screen (which Shabad or Bani, and which pangti)</li>
      <li>what Voice Autopilot heard, and what it would have shown</li>
    </ul>
    <p>
      It also saves the Gurdwara (and name, if you enter one), a random id for this install, the
      computer&apos;s operating system, processor, time zone and language, the microphone&apos;s
      name, and a log of app errors. No computer name, login name or internet address.
    </p>
    <p>
      While STTM is open, the microphone stays on to notice when a program starts; the last 2
      minutes are kept in memory
      {audio ? ' and saved only if a recording starts' : ' and never saved'}.
    </p>
    <p>Sessions are sent during the program to Khalis Foundation&apos;s secure storage.</p>
    <p>
      To turn it off: <b>{SETTING_PATH}</b>. Turning it off stops recording and sending at once
      (anything already being sent finishes). Anything recorded but not yet sent stays on this
      computer and is sent only if you turn recording back on.
    </p>
  </div>
);

// The short version for the first-launch card; the chip's popover keeps the full text.
export const ShortNotice = ({ audio = true }) => (
  <div className="shadow-notice-text">
    <p>To make Voice Autopilot better, STTM shares:</p>
    <ul>
      {audio && <li>the microphone during a program, even with Voice Autopilot off</li>}
      <li>what is on screen (Shabad or Bani, pangti) and what Voice Autopilot heard</li>
      <li>your Gurdwara, a random install id and basic computer details (no name or address)</li>
    </ul>
    <p>Sent to Khalis Foundation&apos;s secure storage.</p>
    <p>
      Turn off any time: <b>{SETTING_PATH}</b>
    </p>
  </div>
);

// The chip at the left of the workspace bar (controller window only, never the viewer):
// "Recording audio" while a session records, "Mic on" while only the listener is open.
// Clicking it shows the notice and the way to turn it off.
export const RecordingChip = ({ onOpenSettings }) => {
  const micState = useStoreState((state) => state.app.shadowMicState);
  const audio = useStoreState((state) => state.userSettings.collectorLevel) === 'audio';
  const { setCollectorLevel } = useStoreActions((actions) => actions.userSettings);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (micState !== 'recording' && micState !== 'listening') return null;
  const recording = micState === 'recording';
  let chipText = 'Mic On';
  if (recording) chipText = audio ? 'Recording Audio' : 'Sharing labels';

  return (
    <div className="shadow-rec" ref={ref}>
      <button
        type="button"
        className={`shadow-rec-chip ${recording ? 'is-recording' : 'is-listening'}`}
        title="What is recorded, and how to turn it off"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="shadow-rec-dot" />
        {chipText}
      </button>
      {open && (
        <div className="shadow-rec-pop" role="dialog" aria-label="Voice Autopilot recording">
          <h4>{recording ? chipText : 'Mic On, waiting for a program'}</h4>
          <ShortNotice audio={audio} />
          <button
            type="button"
            className="shadow-rec-more"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            {more ? 'Hide details' : 'More details'}
          </button>
          {more && <NoticeText audio={audio} />}
          <div className="shadow-rec-actions">
            <button
              type="button"
              className="shadow-rec-link"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              Open Settings
            </button>
            <button
              type="button"
              className="shadow-rec-off"
              onClick={() => {
                setOpen(false);
                setCollectorLevel('off');
              }}
            >
              Stop sharing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

RecordingChip.propTypes = {
  onOpenSettings: PropTypes.func.isRequired,
};
NoticeText.propTypes = { audio: PropTypes.bool };
ShortNotice.propTypes = { audio: PropTypes.bool };
