// Simran gate (engine/simran.js): hold the screen while the sangat chants Waheguru simran.
const test = require('node:test');
const assert = require('node:assert');
const { isSimran, SimranGate } = require('../engine/simran');

test('simran decodes are recognised in any rotation the 10 s window cuts, a pangti is not', () => {
  assert.ok(isSimran('ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ'));
  assert.ok(isSimran('ਗੁਰੂ ਵਾਹਿਗੁਰੂ ਵਾਹਿ'));
  assert.ok(isSimran('ਵਾਾਹਿਗੁਰੂ ਵਾਹਿ ਗੁਰੂ'));
  assert.ok(!isSimran('ਜੋ ਸਿਰੁ ਸਾਂਈ ਨਾ ਨਿਵੈ ਸੋ ਸਿਰੁ ਕਪਿ ਉਤਾਰਿ'));
  assert.ok(!isSimran('ਵਾਹਿਗੁਰੂ'.slice(0, 3)), 'too few letters to tell');
});

test('the gate opens after two simran decodes and closes after two decodes of singing', () => {
  const g = new SimranGate();
  const pangti = 'ਜੋ ਸਿਰੁ ਸਾਂਈ ਨਾ ਨਿਵੈ ਸੋ ਸਿਰੁ';
  const out = [
    pangti,
    'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ',
    'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ',
    'ਵਾਹਿਗੁਰੂ ਵਾਹਿ',
    'ਆਰਾ',
    pangti,
    pangti,
  ].map((h) => g.push(h));
  assert.deepStrictEqual(out, [false, false, true, true, true, true, false]);
});

test('a pangti that merely contains the Name is not simran', () => {
  assert.ok(!isSimran('ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ ਤੇਰਾ ਸਭੁ ਸਦਕਾ ਨਿਰਭਉ ਨਿਰੰਕਾਰ ਅਕਾਲ ਪੁਰਖ'));
});
