// Run "Check this computer" outside the app (CI machines): the same engine/hwcheck.js on the same model.
const path = require('path');
const E = path.join(__dirname, '../../www/main/addons/voice-follow/engine');
const { Infer } = require(path.join(E, 'infer'));
const hw = require(path.join(E, 'hwcheck'));
const pace = require(path.join(E, 'pace'));
(async () => {
  const infer = await Infer.create(process.argv[2]);
  const self = await pace.selfTest(infer);
  const r = await hw.run({ ready: async () => infer, pace });
  r.appSelfTestMs = self.passMs;
  console.log(JSON.stringify(r));
  console.log(hw.summary(r, 'ci'));
})();
