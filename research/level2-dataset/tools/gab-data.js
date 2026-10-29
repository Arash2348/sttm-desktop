// Where the GAB tools read and write their benchmark data (answer keys, test lists, results/):
// VF_GAB_DATA, else the folder above tools/ (research/level2-dataset in a full checkout). The tools
// themselves need nothing else from that folder.
const os = require('os');
const path = require('path');

const DS = process.env.VF_GAB_DATA
  ? path.resolve(process.env.VF_GAB_DATA.replace(/^~(?=\/|$)/, os.homedir()))
  : path.join(__dirname, '..');

// The app's user-data folder (STTM's database, the downloaded speech model): VF_BANIDB_USER_DATA,
// else where Electron puts it for the SikhiToTheMax app on this OS.
function defaultUserData() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library/Application Support/SikhiToTheMax');
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'), 'SikhiToTheMax');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'SikhiToTheMax');
}
const USER_DATA = process.env.VF_BANIDB_USER_DATA || defaultUserData();

// Command prefix that holds an exclusive file lock while the rest of the command runs: lockf on
// macOS, flock on Linux (both exit 75 when noWait and the lock is taken), nothing on Windows.
function lockArgs(file, { noWait = false } = {}) {
  if (process.platform === 'darwin') return ['lockf', '-k', ...(noWait ? ['-t', '0'] : []), file];
  if (process.platform === 'win32') return [];
  return ['flock', ...(noWait ? ['-n', '-E', '75'] : []), file];
}

module.exports = { DS, USER_DATA, lockArgs };
