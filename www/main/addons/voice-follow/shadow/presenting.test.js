// The presenting-only gate: a display driven AND a recent screen change.
// Run with: node --test www/main/addons/voice-follow/shadow/presenting.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const p = require('./presenting');

const MIN = 60 * 1000;

describe('presenting gate', () => {
  const now = 1000000000;
  it('viewer open and a change 2 min ago presents', () => {
    assert.equal(p.isPresenting({ viewerOpen: true, lastChangeAt: now - 2 * MIN, now }), true);
  });
  it('single-display mode counts as a display', () => {
    assert.equal(
      p.isPresenting({ viewerOpen: false, singleDisplay: true, lastChangeAt: now - MIN, now }),
      true,
    );
  });
  it('no display: idle even with a fresh change', () => {
    assert.equal(p.isPresenting({ viewerOpen: false, lastChangeAt: now, now }), false);
  });
  it('display but no change in the last 10 min: idle', () => {
    assert.equal(
      p.isPresenting({ viewerOpen: true, lastChangeAt: now - 10 * MIN - 1, now }),
      false,
    );
    assert.equal(p.isPresenting({ viewerOpen: true, lastChangeAt: null, now }), false);
  });
  it('a session ends after presenting has been off for 10 min', () => {
    let off = p.trackOff(true, null, now);
    assert.equal(off, null);
    off = p.trackOff(false, off, now + MIN); // viewer closed
    assert.equal(off, now + MIN);
    off = p.trackOff(false, off, now + 5 * MIN); // keeps the first off time
    assert.equal(off, now + MIN);
    assert.equal(p.stopReason(off, now + 10 * MIN), null);
    assert.equal(p.stopReason(off, now + 11 * MIN), 'not_presenting');
    assert.equal(p.trackOff(true, off, now + 12 * MIN), null); // viewer back: reset
  });
});
