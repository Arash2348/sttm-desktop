// Simran gate (owner, Oct 16): in kirtan, and in Akhand Kirtan above all, the sangat often chants Waheguru simran in
// the middle of a Shabad, for 10 seconds or 10 minutes, then goes back to a pangti (or on to a new Shabad). Simran is
// not a pangti to follow or a Shabad to search for: the app should hold what is on screen until the singing resumes.
// A decode "is simran" when its letters are mostly the repeated Name (ਵਾਹਿਗੁਰੂ, in any rotation, as the 10 s decode
// window cuts it). The gate opens after `enter` such decodes in a row and closes after `exit` decodes in a row that
// hold `minLetters` letters of something else.
const { norm } = require('./infer');
const { partialRatio } = require('./fuzz');

const NAME = norm('ਵਾਹਿਗੁਰੂ');

function isSimran(hyp, { match = 75, minLetters = 6 } = {}) {
  const h = norm(hyp || '');
  if (h.length < minLetters) return false;
  const rep = NAME.repeat(Math.ceil(h.length / NAME.length) + 2);
  return partialRatio(h, rep) >= match;
}

class SimranGate {
  constructor({ enter = 2, exit = 2, match = 75, minLetters = 6, otherLetters = 8 } = {}) {
    Object.assign(this, { enter, exit, match, minLetters, otherLetters });
    this.on = false;
    this.inRow = 0;
    this.outRow = 0;
  }

  // one decode's text -> is the app in simran now?
  push(hyp) {
    const sim = isSimran(hyp, { match: this.match, minLetters: this.minLetters });
    if (sim) {
      this.inRow += 1;
      this.outRow = 0;
    } else {
      this.inRow = 0;
      if (norm(hyp || '').length >= this.otherLetters) this.outRow += 1;
    }
    if (!this.on && this.inRow >= this.enter) this.on = true;
    else if (this.on && this.outRow >= this.exit) {
      this.on = false;
      this.outRow = 0;
    }
    return this.on;
  }
}

module.exports = { isSimran, SimranGate };
