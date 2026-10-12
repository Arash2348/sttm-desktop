// Benchmark only: load the shadow config with SHADOW_BUILD off so the headless harness sees
// the real screen actions (in a shadow build they go to the shadow bus instead).
const p = require.resolve('/Users/asingh02/personal/sttm-stop/www/main/addons/voice-follow/shadow/config.js');
const real = require(p);
require.cache[p].exports = { ...real, SHADOW_BUILD: false };
