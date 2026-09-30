// Shadow bus: the two timelines of a shadow session and their live score.
//   human  - what the sevadaar put on screen (the label), from ShadowCollector
//   system - what Voice-Follow would have shown, from VoiceFollow in shadow mode
// Every second both are sampled; a second is scored once LAG_S more seconds have
// arrived, against the human labels within +-LAG_S (sevadaars click a little late,
// Voice-Follow sometimes a little early). Totals are written to score.json every
// SAVE_S seconds and when the session ends. Nothing here touches the screen.
const fs = require('fs');
const path = require('path');

const LAG_S = 5; // tolerance each side for "the same thing was on screen"
const SAVE_S = 30;
const MATCH_CAP_S = 180; // a human switch the system never followed counts as this long

const blankLabel = () => ({ key: null, verseId: null });
let S = null; // current session

const now = () => (S ? (Date.now() - S.t0) / 1000 : 0);
const writeLine = (file, obj) => {
  if (!S) return;
  try {
    fs.appendFileSync(path.join(S.dir, file), `${JSON.stringify(obj)}\n`);
  } catch (_) {
    /* never disturb the sevadaar */
  }
};

// Content key: what is on screen, at the level scoring compares (shabad or Bani).
function contentKey(l) {
  if (!l) return null;
  if (l.slide) return null; // a slide (Waheguru, blank, announcement) shows no Gurbani line
  if (l.bani != null) return `bani:${l.bani}`;
  if (l.ceremony != null) return `ceremony:${l.ceremony}`;
  if (l.shabadId != null) return `shabad:${l.shabadId}`;
  return null;
}

function emptyScore() {
  return {
    seconds: 0, // seconds the sevadaar had Gurbani on screen (the scored time)
    agree: 0, // ...and Voice-Follow showed the same shabad/Bani
    wrong: 0, // ...and Voice-Follow showed a different one
    none: 0, // ...and Voice-Follow showed nothing yet
    lineSeconds: 0, // agreed seconds where the sevadaar had a line selected
    lineAgree: 0, // ...and Voice-Follow was on that line (within +-LAG_S)
    switches: 0, // human changes to a new shabad/Bani
    matched: 0, // ...that Voice-Follow reached within MATCH_CAP_S
    matchSeconds: [], // time from each human change to Voice-Follow showing it
    idleSeconds: 0, // nothing (or a slide) on screen for the sevadaar: not scored
    pausedSeconds: 0, // Voice-Follow paused to spare a busy computer: not scored
  };
}

function summary(sc) {
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const ms = [...sc.matchSeconds].sort((a, b) => a - b);
  return {
    scoredMinutes: Math.round((sc.seconds / 60) * 10) / 10,
    agreePct: pct(sc.agree, sc.seconds),
    wrongPct: pct(sc.wrong, sc.seconds),
    nonePct: pct(sc.none, sc.seconds),
    lineAgreePct: pct(sc.lineAgree, sc.lineSeconds),
    switches: sc.switches,
    matchedPct: pct(sc.matched, sc.switches),
    medianSecondsToMatch: ms.length ? ms[Math.floor(ms.length / 2)] : null,
    idleMinutes: Math.round((sc.idleSeconds / 60) * 10) / 10,
    pausedMinutes: Math.round((sc.pausedSeconds / 60) * 10) / 10,
  };
}

function save() {
  if (!S) return;
  try {
    fs.writeFileSync(
      path.join(S.dir, 'score.json'),
      JSON.stringify(
        { updatedAt: new Date().toISOString(), ...summary(S.score), raw: S.score },
        null,
        1,
      ),
    );
  } catch (_) {
    /* best effort */
  }
}

// One second of the timeline becomes final once LAG_S seconds after it are known.
function scoreSecond(i) {
  const cur = S.samples[i];
  if (!cur) return;
  const sc = S.score;
  if (cur.paused) {
    sc.pausedSeconds += 1;
    return;
  }
  const hKey = contentKey(cur.human);
  if (!hKey) {
    sc.idleSeconds += 1;
    return;
  }
  sc.seconds += 1;
  const win = S.samples.slice(Math.max(0, i - LAG_S), i + LAG_S + 1).filter(Boolean);
  const hKeys = new Set(win.map((x) => contentKey(x.human)).filter(Boolean));
  const sKey = contentKey(cur.system);
  if (!sKey) sc.none += 1;
  else if (hKeys.has(sKey)) {
    sc.agree += 1;
    const hVerses = new Set(
      win
        .filter((x) => contentKey(x.human) === sKey)
        .map((x) => x.human.verseId)
        .filter((v) => v != null),
    );
    if (hVerses.size) {
      sc.lineSeconds += 1;
      const sVerses = new Set(
        win
          .filter((x) => contentKey(x.system) === sKey)
          .map((x) => x.system.verseId)
          .filter((v) => v != null),
      );
      if ([...sVerses].some((v) => hVerses.has(v))) sc.lineAgree += 1;
    }
  } else sc.wrong += 1;
}

function flushActivity(upTo) {
  // One line per finished second: loudest level (RMS 0-1) and most letters heard.
  while (S.act.sec < upTo) {
    writeLine('activity.jsonl', {
      t: S.act.sec,
      level: Math.round(S.act.level * 1000) / 1000,
      letters: S.act.letters,
    });
    S.act = { sec: S.act.sec + 1, level: 0, letters: 0 };
  }
}

function tick() {
  if (!S) return;
  const i = Math.floor(now());
  flushActivity(i);
  while (S.samples.length <= i) {
    S.samples.push({ human: { ...S.human }, system: { ...S.system }, paused: S.paused });
  }
  // Time-to-match for the human's latest switch.
  if (S.pending && contentKey(S.system) === S.pending.key) {
    const secs = Math.round((now() - S.pending.at) * 10) / 10;
    S.score.matched += 1;
    S.score.matchSeconds.push(secs);
    writeLine('events.jsonl', { t: now(), type: 'matched', key: S.pending.key, seconds: secs });
    S.pending = null;
  } else if (S.pending && now() - S.pending.at > MATCH_CAP_S) {
    writeLine('events.jsonl', { t: now(), type: 'never_matched', key: S.pending.key });
    S.pending = null;
  }
  while (S.scored < i - LAG_S) {
    scoreSecond(S.scored);
    S.scored += 1;
  }
  if (now() - S.lastSave >= SAVE_S) {
    S.lastSave = now();
    save();
  }
}

// ---- API ------------------------------------------------------------------
function begin(dir, t0) {
  // eslint-disable-next-line no-use-before-define
  end();
  S = {
    dir,
    t0,
    human: blankLabel(),
    system: blankLabel(),
    samples: [],
    scored: 0,
    score: emptyScore(),
    pending: null,
    paused: false,
    lastSave: 0,
    act: { sec: 0, level: 0, letters: 0 },
    timer: setInterval(tick, 1000),
  };
}

function end() {
  if (!S) return;
  clearInterval(S.timer);
  tick();
  while (S.scored < S.samples.length) {
    scoreSecond(S.scored);
    S.scored += 1;
  }
  save();
  S = null;
}

// The sevadaar's screen changed (full label: shabadId, verseId, bani, ceremony, slide).
function human(label) {
  if (!S) return;
  const prevKey = contentKey(S.human);
  S.human = { ...label, key: contentKey(label) };
  writeLine('human.jsonl', { t: now(), ...label });
  const key = contentKey(label);
  if (key && key !== prevKey) {
    S.score.switches += 1;
    S.pending = contentKey(S.system) === key ? null : { key, at: now() };
    if (!S.pending) S.score.matched += 1;
  }
}

// What Voice-Follow would show changed (partial update: shabadId / verseId / slide).
function system(update) {
  if (!S) return;
  const next = { ...S.system, ...update };
  if (update.shabadId != null) {
    next.slide = null;
    next.bani = null;
  }
  S.system = next;
  writeLine('system.jsonl', { t: now(), ...update });
}

// Microphone loudness (RMS 0-1), sampled several times a second by the collector.
function level(rms) {
  if (S && rms > S.act.level) S.act.level = rms;
}

// Letters in the latest recognised window (0 = nothing recognisable was heard).
function heard(letters) {
  if (S && letters > S.act.letters) S.act.letters = letters;
}

function setPaused(paused) {
  if (!S || S.paused === paused) return;
  S.paused = paused;
  writeLine('events.jsonl', { t: now(), type: paused ? 'paused' : 'resumed' });
}

const active = () => !!S;
const sessionDir = () => (S ? S.dir : null);

module.exports = {
  begin,
  end,
  human,
  system,
  level,
  heard,
  setPaused,
  active,
  sessionDir,
  contentKey,
  summary,
};
