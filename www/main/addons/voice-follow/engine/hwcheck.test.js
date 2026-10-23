// node --test www/main/addons/voice-follow/engine/hwcheck.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { grade, summary } = require('./hwcheck');

describe('hwcheck.grade', () => {
  it('fast machine is great', () => {
    const g = grade({ pass10Ms: 120, pass4Ms: 40, ramGb: 16 });
    assert.equal(g.verdict, 'great');
    assert.equal(g.followLoad, 0.24);
    assert.equal(g.findLoad, 0.24);
    assert.equal(g.headroom, 4.2);
  });
  it('middle machine meets the minimum', () => {
    assert.equal(grade({ pass10Ms: 300, pass4Ms: 90, ramGb: 8 }).verdict, 'ok');
  });
  it('slow following is below the minimum', () => {
    assert.equal(grade({ pass10Ms: 200, pass4Ms: 150, ramGb: 8 }).verdict, 'below');
  });
  it('slow finding is below the minimum', () => {
    assert.equal(grade({ pass10Ms: 450, pass4Ms: 60, ramGb: 8 }).verdict, 'below');
  });
  it('too little memory is below the minimum', () => {
    assert.equal(grade({ pass10Ms: 100, pass4Ms: 30, ramGb: 3.5 }).verdict, 'below');
  });
  it('summary is one line with specs', () => {
    const r = {
      ...grade({ pass10Ms: 120, pass4Ms: 40 }),
      pass10Ms: 120,
      pass4Ms: 40,
      specs: { cpu: 'Test CPU', cores: 8, ramGb: 16, os: 'win32 10', arch: 'x64' },
    };
    const s = summary(r, '9.0.8');
    assert.ok(s.startsWith('Great'));
    assert.ok(s.includes('Test CPU, 8 cores, 16 GB RAM'));
    assert.ok(!s.includes('\n'));
  });
});
