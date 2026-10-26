// node --test www/main/addons/voice-follow/engine/infer.test.js
// The native speech runtime loads on first use: a computer where it cannot load must still be
// able to import the engine (the whole STTM window imports it), and Voice Autopilot must get an
// error it can recognise. VF_SIMULATE_ORT_FAIL stands in for a missing Visual C++ runtime.
const { describe, it } = require('node:test');
const assert = require('node:assert');

process.env.VF_SIMULATE_ORT_FAIL = '1';
const infer = require('./infer');

describe('infer: native runtime that cannot load', () => {
  it('importing the module does not load or throw', () => {
    assert.equal(typeof infer.Infer, 'function');
    assert.equal(typeof infer.norm('ਵਾਹਿਗੁਰੂ ॥੧॥'), 'string');
  });
  it('creating a session rejects with the runtime-unavailable error and the real cause', async () => {
    await assert.rejects(infer.Infer.create('/nonexistent/model.onnx'), (e) => {
      assert.ok(infer.isRuntimeUnavailable(e));
      assert.equal(e.code, infer.RUNTIME_UNAVAILABLE);
      assert.match(String(e.cause && e.cause.message), /simulated load failure/);
      return true;
    });
  });
  it('the failure is remembered: later calls fail the same way without retrying', () => {
    let first;
    let second;
    try {
      infer.loadOrt();
    } catch (e) {
      first = e;
    }
    try {
      infer.loadOrt();
    } catch (e) {
      second = e;
    }
    assert.ok(first && first === second);
  });
  it('other errors are not mistaken for it', () => {
    assert.equal(infer.isRuntimeUnavailable(new Error('model file missing')), false);
    assert.equal(infer.isRuntimeUnavailable(null), false);
  });
});
