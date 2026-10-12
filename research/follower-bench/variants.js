// Follower variants under test. Each is (infer, lines) -> follower with push(pcm).
const { SP } = require('../../www/main/addons/voice-follow/engine/sentencepiece');
const { Follower } = require('../../www/main/addons/voice-follow/engine/follower');
const { FollowerV2 } = require('./follower-v2');
const background = require('./background');

const sp = SP.load();
const { FollowerV2: Paath } = require('../../www/main/addons/voice-follow/engine/follower2');
const NITNEM = require('../../www/main/addons/voice-follow/engine/assets/nitnem-lines');
// Other Gurbani exactly as engine.createPaathFollower builds it.
const appBg = (id) => Object.entries(NITNEM).filter(([b]) => Number(b) !== Number(id)).flatMap(([, l]) => l);

module.exports = {
  // The paath follower as this branch ships it (engine/follower2.js, catch-up on).
  paath: (infer, lines, ctx = {}) => new Paath(infer, lines, { inputSr: 16000, hopS: ctx.hop || 0.25, background: appBg(ctx.baniId), ...JSON.parse(process.env.V2_OPTS || '{}'), ...(ctx.extra || {}) }),
  paathNoCatch: (infer, lines, ctx = {}) => new Paath(infer, lines, { inputSr: 16000, hopS: ctx.hop || 0.25, background: appBg(ctx.baniId), catchHops: 0 }),
  // Cycle 8 follower exactly as the desktop app and the website use it.
  c8: (infer, lines) => new Follower(infer, sp, lines, { inputSr: 16000 }),
  // Position tracker (follower-v2.js).
  v2: (infer, lines, ctx = {}) => new FollowerV2(infer, lines, { inputSr: 16000, hopS: ctx.hop || 0.25, background: background(ctx.baniId, ctx.exclude), ...JSON.parse(process.env.V2_OPTS || '{}'), ...(ctx.extra || {}) }),
  v2nobg: (infer, lines) => new FollowerV2(infer, lines, { inputSr: 16000 }),
};
