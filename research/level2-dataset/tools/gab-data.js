// Where the GAB tools read and write their benchmark data (answer keys, test lists, results/):
// VF_GAB_DATA, else the folder above tools/ (research/level2-dataset in a full checkout). The tools
// themselves need nothing else from that folder.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DS = process.env.VF_GAB_DATA
  ? path.resolve(process.env.VF_GAB_DATA.replace(/^~(?=\/|$)/, os.homedir()))
  : path.join(__dirname, '..');

// The app's user-data folder (STTM's Gurbani database, the downloaded speech model): VF_BANIDB_USER_DATA,
// else the first of Electron's folders for this app on this OS that holds the database (the packaged app's
// "SikhiToTheMax", or "sttm-desktop" when it was run from source), else the packaged app's folder.
const DB_FILE = 'sttmdesktop-evergreen-v2.realm';
function defaultUserData() {
  let base;
  if (process.platform === 'darwin') base = path.join(os.homedir(), 'Library/Application Support');
  else if (process.platform === 'win32') base = process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming');
  else base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const dirs = ['SikhiToTheMax', 'sttm-desktop'].map((n) => path.join(base, n));
  return dirs.find((d) => fs.existsSync(path.join(d, DB_FILE))) || dirs[0];
}
const USER_DATA = process.env.VF_BANIDB_USER_DATA
  ? path.resolve(process.env.VF_BANIDB_USER_DATA.replace(/^~(?=\/|$)/, os.homedir()))
  : defaultUserData();

// Stop early, with what to do, when the Gurbani database is not where the tools look.
function checkDb() {
  if (fs.existsSync(path.join(USER_DATA, DB_FILE))) return;
  throw new Error(
    `STTM's Gurbani database (${DB_FILE}) is not in ${USER_DATA}. Open STTM once on this machine so it downloads it, ` +
      'or copy it (with realm-schema-evergreen.json) there, or set VF_BANIDB_USER_DATA to the folder that has it.',
  );
}

// Command prefix that holds an exclusive file lock while the rest of the command runs: lockf on
// macOS, flock on Linux (both exit 75 when noWait and the lock is taken), nothing on Windows.
function lockArgs(file, { noWait = false } = {}) {
  if (process.platform === 'darwin') return ['lockf', '-k', ...(noWait ? ['-t', '0'] : []), file];
  if (process.platform === 'win32') return [];
  return ['flock', ...(noWait ? ['-n', '-E', '75'] : []), file];
}

module.exports = { DS, USER_DATA, checkDb, lockArgs };
