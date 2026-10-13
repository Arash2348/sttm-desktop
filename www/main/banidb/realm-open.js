// Open the Gurbani database read-only. The Linux arm64 (Raspberry Pi) build uses Realm 11,
// because Realm 10 has no binary for it. Realm 11 must upgrade a file written by Realm 10
// (file format 22) before it can read it, and a read-only open cannot upgrade: upgrade once
// with a writable open, then read. Realm 10 (Mac, Windows) never takes this path.
const Realm = require('realm');

const needsUpgrade = (e) => /requires an upgrade/i.test((e && e.message) || String(e));

async function openReadOnly(config) {
  try {
    return await Realm.open(config);
  } catch (e) {
    if (!needsUpgrade(e)) throw e;
    const { readOnly, ...writable } = config;
    (await Realm.open(writable)).close();
    return Realm.open(config);
  }
}

module.exports = { openReadOnly };
