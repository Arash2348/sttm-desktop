// The benchmark scores the shipped engine file itself (single source of truth):
// sttm-follower2 www/main/addons/voice-follow/engine/follower2.js. Set FOLLOWER2 to
// point elsewhere.
const path = require('path');
module.exports = require(process.env.FOLLOWER2 || path.join(process.env.HOME, 'personal/sttm-follower2/www/main/addons/voice-follow/engine/follower2.js'));
