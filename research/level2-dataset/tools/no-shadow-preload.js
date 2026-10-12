// Benchmark only: load the shadow config with SHADOW_BUILD off so the headless harness sees
// the real screen actions (in a shadow build they go to the shadow bus instead).
// Resolved relative to this worktree, so every worktree patches its own config.
const path = require('path');
const p = require.resolve(path.resolve(__dirname, '../../../www/main/addons/voice-follow/shadow/config.js'));
const real = require(p);
require.cache[p].exports = { ...real, SHADOW_BUILD: false };
