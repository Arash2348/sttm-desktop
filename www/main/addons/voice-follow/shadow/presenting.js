// Presenting-only gate (prod collector). The hidden run and the session recording start
// only while this STTM is presenting: the viewer window is open (or single-display mode is
// on) AND the sevadaar changed what is on screen within the last SHADOW_PRESENT_RECENT_MS.
// Otherwise the collector stays idle: no microphone, no hidden Voice-Follow, no session.
// A running session ends (the quiet-stop path) once presenting has been off for
// SHADOW_PRESENT_STOP_MS. Pure functions, so the gate can be unit tested.
const SHADOW_PRESENT_RECENT_MS = 10 * 60 * 1000;
const SHADOW_PRESENT_STOP_MS = 10 * 60 * 1000;
// Scripted tests (VF_TEST_WAV) run with no viewer window: VF_TEST_PRESENTING=1 counts as one.
const testDisplay = () => !!(process.env.VF_TEST_WAV && process.env.VF_TEST_PRESENTING === '1');

// Is a display being driven: the viewer window is open, or the workspace is single display.
const displayOn = ({ viewerOpen, singleDisplay }) =>
  !!viewerOpen || !!singleDisplay || testDisplay();

// The whole gate: a display and a recent screen change.
function isPresenting({ viewerOpen, singleDisplay, lastChangeAt, now = Date.now() }) {
  if (!displayOn({ viewerOpen, singleDisplay })) return false;
  if (lastChangeAt == null) return false;
  return now - lastChangeAt <= SHADOW_PRESENT_RECENT_MS;
}

// Tracks when the gate went off, so the stop rule can ask "off for how long?".
// Returns the updated `offSince` (ms since epoch, or null while presenting).
const trackOff = (presenting, offSince, now = Date.now()) => {
  if (presenting) return null;
  return offSince == null ? now : offSince;
};

// Why a session should stop for this gate, or null.
const stopReason = (offSince, now = Date.now()) =>
  offSince != null && now - offSince >= SHADOW_PRESENT_STOP_MS ? 'not_presenting' : null;

module.exports = {
  SHADOW_PRESENT_RECENT_MS,
  SHADOW_PRESENT_STOP_MS,
  displayOn,
  isPresenting,
  trackOff,
  stopReason,
};
