// Kiosk mode: STTM as a Raspberry Pi appliance wired to the projector, with nobody at a
// keyboard. Turned on by the launcher (packaging/pi/sttm-kiosk), never by the app itself:
//   STTM_KIOSK=1              start Voice-Follow on launch and keep it running
//   STTM_KIOSK_NAME=...       who set the Pi up; with it, the experimental build records
//   STTM_KIOSK_GURDWARA=...   sessions as if the consent card had been answered at install
// Without STTM_KIOSK_NAME nothing is recorded: the consent card is never shown on a kiosk,
// because nobody is there to answer it.
const env = (typeof process !== 'undefined' && process.env) || {};

const KIOSK = env.STTM_KIOSK === '1';
const KIOSK_TESTER =
  KIOSK && (env.STTM_KIOSK_NAME || '').trim()
    ? {
        name: env.STTM_KIOSK_NAME.trim(),
        gurdwara: (env.STTM_KIOSK_GURDWARA || '').trim(),
      }
    : null;
// Wait for the window, database and model to settle before the first start.
const KIOSK_START_DELAY_MS = 8000;
// If Voice-Follow stops on its own (microphone unplugged, model error), try again this often.
const KIOSK_RETRY_MS = 15000;

// The Gurbani database STTM downloads on first run (see www/main/desktop_scripts.js).
function kioskDbReady() {
  try {
    /* eslint-disable global-require */
    const fs = require('fs');
    const path = require('path');
    const remote = require('@electron/remote');
    /* eslint-enable global-require */
    const db = path.join(remote.app.getPath('userData'), 'sttmdesktop-evergreen-v2.realm');
    return fs.existsSync(db) && fs.statSync(db).size > 0;
  } catch (_) {
    return false;
  }
}

module.exports = { KIOSK, KIOSK_TESTER, KIOSK_START_DELAY_MS, KIOSK_RETRY_MS, kioskDbReady };
