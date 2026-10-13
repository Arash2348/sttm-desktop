// bench-driver.js — Fable's benchmark driver, derived from test/voice-follow/component-driver.js
// with a FIDELITY FIX (recognizer/follower objects exposed as in production).
// Headless diagnostic driver for the actual VoiceFollow component. The component,
// full Realm search, ONNX recognizer, follower and decision policy run unchanged.
// Only React rendering, Electron path lookup, and microphone hardware are mocked.
// A test-only bridge is inserted in memory; nothing is added to the shipped UI.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const babel = require('@babel/core');
const DRIVER_SHA256 = require('crypto')
  .createHash('sha256')
  .update(fs.readFileSync(__filename))
  .digest('hex');

const ROOT = process.env.VF_DRIVER_ROOT ? path.resolve(process.env.VF_DRIVER_ROOT) : path.resolve(__dirname, '../../..');
const COMPONENT = path.join(ROOT, 'www/main/addons/voice-follow/components/VoiceFollow.jsx');

async function createDriver({
  model,
  userData,
  sampleRate = 16000,
  onEvent = () => {},
  source,
  engineOverride,
  initialNavigator = {},
  onState = () => {},
  audioHooks = {},
  databaseHooks = {},
  retrievalHooks = {},
  eventClock,
  traceRecognizerInputs = false,
} = {}) {
  const { Infer, norm } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/infer'));
  const { Recognizer } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/recognizer'));
  const { Follower } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/follower'));
  const { SP } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/sentencepiece'));
  const { partialRatio } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/fuzz'));
  // Thread cap: ORT defaults intraOp threads to all cores; several benchmark
  // processes then oversubscribe the machine. VF_ORT_THREADS (default 4) caps it.
  const infer = engineOverride
    ? null
    : await (async () => {
        const ort = require(path.join(ROOT, 'node_modules/onnxruntime-node'));
        const VOCAB = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/assets/vocab'));
        const n = parseInt(process.env.VF_ORT_THREADS || '4', 10);
        const sess = await ort.InferenceSession.create(model, { intraOpNumThreads: n, interOpNumThreads: 1 });
        return new Infer(sess, VOCAB);
      })();
  const sp = SP.load();
  const modules = new Map();
  const realmHandles = new Set();
  const pending = new Set();
  let bridge;
  let port;
  let now = 0;
  const errors = [];
  const emit = (type, fields = {}) =>
    onEvent({ t: eventClock ? eventClock() : now, type, ...fields });
  const track = (p) => {
    pending.add(p);
    p.then(
      () => pending.delete(p),
      (e) => {
        pending.delete(p);
        errors.push(e);
        emit('component-error', { message: String(e), stack: e.stack });
      },
    );
    return p;
  };
  const actions = {
    userSettings: { setBaniLength: (length) => emit('length', { length }) },
    navigator: {
      setActiveVerseId: (verseId) => emit('verse', { verseId }),
      setLineNumber: () => {},
      setIsMiscSlide: (visible) => {
        if (bridge) bridge.isMiscSlideRef.current = visible;
        emit('seeking', { visible });
      },
      setMiscSlideText: () => {},
      // Bani follow opens a Bani the way Sundar Gutka does; record it as content
      // 'bani:<id>' so every scoring tool treats it like any shown shabad.
      setIsSundarGutkaBani: () => {},
      setIsCeremonyBani: () => {},
      setSingleDisplayActiveTab: () => {},
      setSundarGutkaBaniId: (baniId) => emit('shabad', { shabadId: `bani:${baniId}` }),
    },
    app: { setOverlayScreen: () => {} },
  };
  const state = { navigator: initialNavigator, userSettings: { baniLength: process.env.VF_TEST_BANI_LENGTH || 'short' } };
  const react = {
    useState: (value) => [value, onState],
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    useEffect: () => {},
    createElement: () => null,
  };
  let recognizerGeneration = 0;
  const nativeEngine = {
    norm,
    partialRatio,
    ready: async () => infer,
    isReady: () => true,
    createRecognizer: async (opts) => {
      const generation = ++recognizerGeneration;
      const recInfer = traceRecognizerInputs ? Object.create(infer) : infer;
      if (traceRecognizerInputs) {
        recInfer.emissions = (pcm) => {
          emit('recognizer-window', {
            generation,
            samples: pcm.length,
            floatPcmSha256: require('crypto')
              .createHash('sha256')
              .update(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))
              .digest('hex'),
          });
          return infer.emissions(pcm);
        };
        emit('recognizer-created', { generation, ...opts });
      }
      const rec = new Recognizer(recInfer, opts);
      const wrapped = Object.create(rec); // fidelity: expose rec.buf / rec.infer like production
      wrapped.push = async (pcm) => {
        const before = performance.now();
        const out = await rec.push(pcm);
        if (out) emit('transcript', { ...out, inferenceMs: performance.now() - before });
        return out;
      };
      return wrapped;
    },
    createFollower: async (lines, opts) => {
      const fol = new Follower(infer, sp, lines, { ...opts, ...JSON.parse(process.env.VF_FOLLOWER_OPTS || '{}'), ...(process.env.VF_FTRACE ? { onTrace: (x) => emit('ftrace', x) } : {}) });
      const wrappedFol = Object.create(fol); // fidelity: keep Follower fields visible
      wrappedFol.push = async (pcm) => {
        const out = await fol.push(pcm);
        if (out) emit('follower', out);
        return out;
      };
      return wrappedFol;
    },
  };
  // Paath follower (Banis), when this build's engine has one: same construction as
  // engine.createPaathFollower.
  try {
    const { FollowerV2 } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/follower2'));
    const NITNEM = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/assets/nitnem-lines'));
    nativeEngine.createPaathFollower = async (lines, opts = {}) => {
      const background = Object.entries(NITNEM)
        .filter(([id]) => Number(id) !== Number(opts.baniId))
        .flatMap(([, l]) => l);
      const fol = new FollowerV2(infer, lines, { background, ...opts });
      emit('paath-follower', { baniId: opts.baniId, lines: lines.length });
      const wrappedFol = Object.create(fol);
      wrappedFol.push = async (pcm) => {
        const out = await fol.push(pcm);
        if (out) emit('follower', out);
        return out;
      };
      return wrappedFol;
    };
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
  }
  const engine = engineOverride ? { norm, partialRatio, ...engineOverride } : nativeEngine;
  class AudioContext {
    constructor() {
      this.sampleRate = sampleRate;
      this.audioWorklet = { addModule: audioHooks.addModule || (async () => {}) };
    }
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    close() {
      audioHooks.onContextClosed?.();
    }
  }
  class AudioWorkletNode {
    constructor() {
      this.port = {};
      port = this.port;
      audioHooks.onNodeCreated?.();
    }
    disconnect() {}
  }
  const context = vm.createContext({
    console,
    Buffer,
    Float32Array,
    Float64Array,
    Int32Array,
    BigInt64Array,
    Map,
    Set,
    Promise,
    performance,
    setTimeout,
    clearTimeout,
    AbortController,
    window: { AudioContext },
    AudioWorkletNode,
    navigator: {
      mediaDevices: {
        getUserMedia: audioHooks.getUserMedia || (async () => ({ getTracks: () => [] })),
      },
    },
    Blob: class {},
    URL: { createObjectURL: () => 'test-worklet', revokeObjectURL() {} },
    __capture: (value) => {
      bridge = value;
    },
    __recordSwitch: (value) => emit('switch-comparison', value),
    __recordBackstop: (value) => emit('backstop-diagnostic', value),
    __trackDecision: (promise) => track(promise),
  });
  function load(file, componentSource) {
    if (modules.has(file)) return modules.get(file).exports;
    const mod = { exports: {} };
    modules.set(file, mod);
    const localRequire = createRequire(file);
    function requireForTest(id) {
      if (id === 'realm') {
        const Realm = localRequire(id);
        return {
          open: async (config) => {
            const realm = await Realm.open(config);
            realmHandles.add(realm);
            return realm;
          },
        };
      }
      if (id === 'react') return react;
      if (id === 'easy-peasy')
        return { useStoreState: (f) => f(state), useStoreActions: (f) => f(actions) };
      if (id === 'electron') return { app: { getPath: () => userData } };
      if (id.endsWith('/hooks/use-new-shabad'))
        return { useNewShabad: () => (shabadId, verseId) => emit('shabad', { shabadId, verseId }) };
      if (id.endsWith('/utils/update-multipane'))
        return () => (baniType, id2, verseId) => emit('pane', { baniType, paneShabad: id2, verseId });
      if (id.endsWith('/utils/load-bani')) {
        // Real Bani rows, mapped exactly as navigator/utils/load-bani.js does.
        return {
          loadBani: async (baniId, baniLength) => {
            const db = load(path.join(ROOT, 'www/main/banidb/index.js'));
            const rows = await db.loadBani(baniId, baniLength);
            return Array.from(rows)
              .filter((r) => r.MangalPosition !== 'above')
              .map((r) => r.Custom || r.Verse || r)
              .filter(Boolean);
          },
        };
      }
      if (id.endsWith('/constants/slidedb')) return { slideStrings: { waheguru: '' } };
      if (id === '../engine') return engine;
      if (id === '../engine/retrieval/renderer-client') {
        // Headless behavior replay uses the exact index through an asynchronous
        // adapter. Real Electron IPC/helper transport is verified separately;
        // this adapter must not be described as a paced runtime/capture test.
        return {
          createRendererRetrieval: () => {
            if (retrievalHooks.createClient) return retrievalHooks.createClient();
            if (engineOverride) {
              // Existing lifecycle tests inject acoustic engines and never score
              // retrieval. Decision tests supply an explicit controllable client.
              return {
                state: 'ready',
                ready: Promise.resolve({ rows: 0 }),
                search: async () => [],
                dispose: async () => {},
              };
            }
            const { readCorpus } = require(path.join(ROOT, 'test/voice-follow/canonical-corpus'));
            const {
              TextIndex,
            } = require(path.join(ROOT, 'www/main/addons/voice-follow/engine/retrieval/text-index'));
            let index;
            const client = { state: 'starting', size: 0 };
            client.ready = readCorpus(userData, {
              retainRealm: (realm) => realmHandles.add(realm),
            }).then((rows) => {
              if (client.state === 'closed') throw new Error('Retrieval closed');
              index = new TextIndex(rows);
              client.state = 'ready';
              client.size = new Set(rows.map((row) => row.shabadId)).size;
              return { rows: rows.length };
            });
            track(client.ready.catch(() => {}));
            client.search = (text, cap, { signal } = {}) => {
              const job = (async () => {
                await client.ready;
                if (retrievalHooks.beforeSearch) await retrievalHooks.beforeSearch(text, cap);
                if (client.state === 'closed' || signal?.aborted) {
                  const error = new Error('Retrieval cancelled');
                  error.name = 'AbortError';
                  throw error;
                }
                const candidates = index.search(text, cap);
                emit('text-retrieval', { candidates });
                return candidates;
              })();
              track(job.catch(() => {}));
              return job;
            };
            client.dispose = async () => {
              client.state = 'closed';
            };
            return client;
          },
        };
      }
      if (id === '../../../banidb') {
        const db = load(path.join(ROOT, 'www/main/banidb/index.js'));
        const wrapped = { ...db };
        for (const key of ['query', 'loadShabad', 'loadFirstLetterIndex', 'getVerse']) {
          wrapped[key] = (...args) =>
            track(
              db[key](...args).then((result) => {
                const finish = () => {
                  if (key === 'query')
                    emit('retrieval', {
                      query: args[0],
                      searchType: args[1],
                      ids: Array.from(result, (r) => r.Shabads[0]?.ShabadID),
                    });
                  return result;
                };
                return databaseHooks.beforeResult
                  ? Promise.resolve(databaseHooks.beforeResult(key, args)).then(finish)
                  : finish();
              }),
            );
        }
        return wrapped;
      }
      if (id.startsWith('.') && file.includes('/banidb/')) return load(localRequire.resolve(id));
      if (id.endsWith('/filter-verse-items')) return load(localRequire.resolve(id));
      return localRequire(id);
    }
    let code = componentSource || fs.readFileSync(file, 'utf8');
    if (file === COMPONENT) {
      if (eventClock) {
        // Tracking only affects final draining; live delivery never awaits it.
        code = code.replace(
          /handleTranscript\((r?out\.text)\)/g,
          '__trackDecision(handleTranscript($1))',
        );
      }
      const comparisonMarker = '        setSwitchView({';
      if (code.split(comparisonMarker).length !== 2)
        throw new Error('Switch-comparison marker changed');
      code = code.replace(
        comparisonMarker,
        `        __recordSwitch({ current: curId, currentScore: sCurFull,
          candidate: leadSlot.shabadId, candidateScore: leadSlot.lastScore,
          wins: leadSlot.wins, hypLen: hypFull.length });
${comparisonMarker}`,
      );
      // Optional: trace the shared/single-line hold (cycle 5) when present.
      const holdMarker = "          const cap = shared ? SHARED_LINE_HOLD_DECODES : SINGLE_LINE_HOLD_DECODES;";
      if (code.includes(holdMarker)) {
        code = code.replace(holdMarker, `${holdMarker}
          __recordSwitch({ hold: true, candidate: slot.shabadId, shared, heldDecodes: nowD - bank.first, wins: slot.wins });`);
      }
      // Trace the return slot. The call's 4th argument differs between cycles
      // (acousticCfg vs an object literal), so anchor on the call head only and
      // FAIL LOUDLY if it is gone — a silently skipped hook reads as "the return
      // slot never ran", which is a false finding, not a measurement.
      const retRe = /( *)const step = nextSwitchWins\(rs\.wins, m\.s, sCurFull,/;
      if (!retRe.test(code)) throw new Error('Return-slot trace anchor changed; update bench-driver.');
      code = code.replace(retRe, (full, indent) =>
        `${indent}__recordSwitch({ ret: true, prev: prev.id, prevScore: m.s, current: curId, currentScore: sCurFull, wins: rs.wins, hypLen: hypFull.length });\n${full}`);
      // Bench-only knob: VF_MIN_LETTERS lowers the first-letter gate that skips
      // the whole judge (return slot + acoustic backstop included).
      if (process.env.VF_MIN_LETTERS) {
        const ml = Number(process.env.VF_MIN_LETTERS);
        code = code.replace(/const DETECT_MIN_LETTERS = \d+;/, `const DETECT_MIN_LETTERS = ${ml};`);
      }
      // Trace the SEARCHING-phase first-lock gate: every value the lock rule looks at,
      // per decode, and the canonical-text check. Loud failure if the anchors move.
      const lockRe = /( *)if \(phaseRef\.current === 'searching'\) \{\n/;
      if (!lockRe.test(code)) throw new Error('Lock-gate anchor changed; update bench-driver.');
      code = code.replace(lockRe, (full, indent) =>
        `${full}${indent}  __recordSwitch({ lockGate: true, fl: fl.length, lead, best, count: st.count, cand: cand.shabadId });\n`);
      const lockTextRe = /( *)(?:const|let) leaders = await searchCanonicalText\(text, 2[^;\n]*, abort\.signal\);\n/;
      if (!lockTextRe.test(code)) throw new Error('Lock-text anchor changed; update bench-driver.');
      code = code.replace(lockTextRe, (full, indent) =>
        `${full}${indent}__recordSwitch({ lockText: true, cand: cand.shabadId, l0: leaders && leaders[0] && leaders[0].shabadId, s0: leaders && leaders[0] && leaders[0].score, l1: leaders && leaders[1] && leaders[1].shabadId, s1: leaders && leaders[1] && leaders[1].score });\n`);
      // Trace EVERY candidate the switch judge scores per decode (vote + backstop),
      // so alternative judge rules can be simulated offline from saved traces.
      const stepRe = /( *)const step = nextSwitchWins\(slot\.wins, sCand, sCurFull, acousticCfg\);\n/;
      if (!stepRe.test(code)) throw new Error('stepSlot anchor changed; update bench-driver.');
      code = code.replace(stepRe, (full, indent) =>
        `${full}${indent}__recordSwitch({ judge: true, cand: slot.shabadId, sCand, sCur: sCurFull, wins: step.wins, held: !!step.held, hypLen: hypFull.length });\n`);
      // ---- Overnight experiments (bench-only, env-gated; shipped code untouched) ----
      // A1  VF_EXP_STALE=<decodes>: while FOLLOWING, if the recogniser keeps producing
      //     speech-length fragments but none has matched the current shabad (>=0.5) for
      //     that many decodes (~0.5 s each), put up the Waheguru seeking slide; take it
      //     down as soon as the current shabad matches again. Decode-counted, so replay
      //     speed does not matter.
      if (process.env.VF_EXP_STALE) {
        const N = Number(process.env.VF_EXP_STALE);
        const staleRe = /( *)const sCurFull = Math\.max\(sCurWindow, sCurAll\);\n/;
        if (!staleRe.test(code)) throw new Error('A1 anchor changed');
        code = code.replace(staleRe, (full, indent) => `${full}${indent}{
${indent}  const W = globalThis.__vfStale || (globalThis.__vfStale = { decodes: 0, lastGood: 0, shown: false });
${indent}  W.decodes += 1;
${indent}  if (sCurFull >= 0.5) {
${indent}    W.lastGood = W.decodes;
${indent}    if (W.shown) { W.shown = false; seekingRef.current = false; try { setIsMiscSlide(false); } catch (_) {} __recordSwitch({ stale: 'down' }); }
${indent}  } else if (hypFull.length >= SWITCH_HYP_MIN && W.decodes - W.lastGood > ${N} && !W.shown && !seekingRef.current && !isMiscSlideRef.current) {
${indent}    W.shown = true; seekingRef.current = true;
${indent}    try { setMiscSlideText(slideStrings.waheguru); setIsMiscSlide(true); __recordSwitch({ stale: 'up', sinceGood: W.decodes - W.lastGood }); } catch (_) { seekingRef.current = false; W.shown = false; }
${indent}  }
${indent}}
`);
        const staleResetRe = /( *)switchCandRef\.current = null; \/\/ clear any in-flight switch evaluation\n/;
        if (!staleResetRe.test(code)) throw new Error('A1 reset anchor changed');
        code = code.replace(staleResetRe, (full, indent) => `${full}${indent}if (globalThis.__vfStale) { globalThis.__vfStale.lastGood = globalThis.__vfStale.decodes; globalThis.__vfStale.shown = false; }\n`);
      }
      // A2  VF_EXP_RETURN_EVERY=1: judge the RETURN slot on every decode, before the
      //     database search that a newer transcript may cancel. Same scores, same bars,
      //     same commit; the original post-search return block is skipped for the decode.
      if (process.env.VF_EXP_RETURN_EVERY) {
        const preRe = /( *)const textCandidates = await searchCanonicalText\(text, BACKSTOP_TOP_N \+ 1, abort\.signal\);\n/;
        if (!preRe.test(code)) throw new Error('A2 anchor changed');
        code = code.replace(preRe, (full, indent) => `${indent}{
${indent}  const prev = prevShabadRef.current;
${indent}  const curId0 = currentShabadIdRef.current;
${indent}  if (prev && prev.id !== curId0 && prev.profile && prev.profile.linesNorm) {
${indent}    const hypFull0 = vfNorm(text).slice(-SWITCH_HYP_SLICE);
${indent}    const sCurW0 = cursorLineScore(hypFull0, curLinesNormRef.current, curCursorRef.current, CUR_SCORE_BACK, CUR_SCORE_AHEAD);
${indent}    const hypW0 = tokenize(text).map(vfNorm).filter(Boolean);
${indent}    const sCurA0 = Math.max(maxLineScore(hypFull0, curLinesNormRef.current, SWITCH_CAND_MIN_LINE_CHARS), orderFreeLineScore(hypW0, curWordsNormRef.current, SWITCH_CAND_MIN_LINE_CHARS));
${indent}    const sCur0 = Math.max(sCurW0, sCurA0);
${indent}    const cfg0 = { min: SWITCH_ACOUSTIC_MIN, margin: SWITCH_ACOUSTIC_MARGIN, strongMin: SWITCH_STRONG_MIN, strongMargin: SWITCH_STRONG_MARGIN, hypLen: hypFull0.length, hypMin: SWITCH_HYP_MIN };
${indent}    prev.decodesSince += 1;
${indent}    if (prev.decodesSince > RETURN_WINDOW_DECODES) { prevShabadRef.current = null; returnSlotRef.current = null; }
${indent}    else {
${indent}      let rs = returnSlotRef.current;
${indent}      if (!rs || rs.shabadId !== prev.id) { rs = { shabadId: prev.id, wins: 0, index: -1, lastScore: null }; returnSlotRef.current = rs; }
${indent}      const m = bestLineMatch(hypFull0, prev.profile.linesNorm, SWITCH_CAND_MIN_LINE_CHARS);
${indent}      if (m.index >= 0) { const step = nextSwitchWins(rs.wins, m.s, sCur0, cfg0); rs.wins = step.wins; if (!step.held) { rs.lastScore = m.s; rs.index = m.index; } __recordSwitch({ ret: true, pre: true, prev: prev.id, prevScore: m.s, current: curId0, currentScore: sCur0, wins: rs.wins, hypLen: hypFull0.length }); }
${indent}      else rs.wins = Math.max(0, rs.wins - 1);
${indent}      if (rs.wins >= RETURN_CONFIRM && rs.index >= 0 && !lockingRef.current) {
${indent}        const v = prev.profile.verses[rs.index] || {};
${indent}        let verse = null;
${indent}        try { verse = v.verseId ? await banidb.getVerse(prev.id, v.verseId) : null; } catch (_) { verse = null; }
${indent}        if (!isCurrentTranscript() || lockingRef.current || returnSlotRef.current !== rs) return;
${indent}        if (verse) { returnSlotRef.current = null; autopilotLock({ shabadId: prev.id, verseId: v.verseId, verse }); return; }
${indent}      }
${indent}    }
${indent}  }
${indent}}
${full}`);
        const origRe = /( *)\/\/ --- Return slot: the shabad we just left, judged in its own slot\. ---\n( *)\{\n/;
        if (!origRe.test(code)) throw new Error('A2 original-block anchor changed');
        code = code.replace(origRe, (full, i1, i2) => `${i1}// --- Return slot (A2: already judged before the search this decode) ---\n${i2}if (false) {\n`);
      }
      // Control for Bani follow: VF_EXP_NO_BANI=1 never switches up to a Bani.
      if (process.env.VF_EXP_NO_BANI) {
        const baniRe = /= findBaniSequence\(/g;
        if (!baniRe.test(code)) throw new Error('Bani-follow anchor changed; update bench-driver.');
        code = code.replace(baniRe, '= null && findBaniSequence(');
        const paathRe = /const paathBani = lines && lines\.get\(/;
        if (!paathRe.test(code)) throw new Error('Paath-Bani anchor changed; update bench-driver.');
        code = code.replace(paathRe, 'const paathBani = null && lines.get(');
        // Straight-through reading opens no Bani either (so a paath recording of
        // consecutive Guru Granth Sahib shabads exercises sequence following).
        const readRe = /const PAATH_READ_BANIS = \[[^\]]*\];/;
        if (!readRe.test(code)) throw new Error('PAATH_READ_BANIS anchor changed; update bench-driver.');
        code = code.replace(readRe, 'const PAATH_READ_BANIS = [];');
      }
      // Trace the two early returns that skip the WHOLE judge (return slot and
      // acoustic backstop included), so their cost can be measured.
      const letterRe = /( *)if \(fl\.length < DETECT_MIN_LETTERS\) return;/;
      if (!letterRe.test(code)) throw new Error('Letter-gate anchor changed; update bench-driver.');
      code = code.replace(letterRe, (full, indent) =>
        `${indent}if (fl.length < DETECT_MIN_LETTERS) { __recordSwitch({ gate: 'letters', flLen: fl.length }); return; }`);
      const votesRe = /( *)\}\n( *)return;\n( *)\}\n( *)emptyStreakRef\.current = 0;/;
      if (!votesRe.test(code)) throw new Error('Votes-gate anchor changed; update bench-driver.');
      code = code.replace(votesRe, (full, i1, i2, i3, i4) =>
        `${i1}}\n${i2}__recordSwitch({ gate: 'votes' });\n${i2}return;\n${i3}}\n${i4}emptyStreakRef.current = 0;`);
      const marker = "  const listening = status === 'listening' || status === 'connecting';";
      if (!code.includes(marker))
        throw new Error('Component test bridge marker changed; update driver explicitly.');
      code = code.replace(
        marker,
        `
        __capture({ start, startDetect, startAutopilot, stop, autopilotLock, handleTranscript, chainRef, isMiscSlideRef,
          snapshot: () => ({ phase: phaseRef.current, current: currentShabadIdRef.current,
            locking: lockingRef.current, votes: [...detectVotesRef.current.entries()],
            vote: switchCandRef.current && { id: switchCandRef.current.shabadId, wins: switchCandRef.current.wins, score: switchCandRef.current.lastScore },
            backstop: backstopRef.current && { id: backstopRef.current.shabadId, wins: backstopRef.current.wins, score: backstopRef.current.lastScore },
            cacheSize: lineCacheRef.current.size, indexSize: flIndexRef.current?.size || 0,
            retrievalReady: !!flIndexRef.current,
            seeking: seekingRef.current, cursor: curCursorRef.current }) });
        ${marker}`,
      );
    }
    if (file.endsWith('.jsx') || code.includes('export const')) {
      // Bench-only knob: VF_RETURN_CFG='{"min":0.5,"margin":0}' rewrites the return-slot bar.
      if (process.env.VF_RETURN_CFG) {
        const rc = JSON.parse(process.env.VF_RETURN_CFG);
        if (rc.min != null) code = code.replace(/const RETURN_MIN = [0-9.]+;/, `const RETURN_MIN = ${rc.min};`);
        if (rc.margin != null) code = code.replace(/const RETURN_MARGIN = [0-9.]+;/, `const RETURN_MARGIN = ${rc.margin};`);
      }
      code = babel.transformSync(code, {
        filename: file,
        configFile: false,
        babelrc: false,
        presets: [
          [require.resolve('@babel/preset-env'), { targets: { node: '18' } }],
          require.resolve('@babel/preset-react'),
        ],
      }).code;
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: file })(
      requireForTest,
      mod,
      mod.exports,
    );
    return mod.exports;
  }
  const exported = load(COMPONENT, source);
  exported.default({ isOpen: true, onScreenClose() {} });
  async function settle() {
    for (let i = 0; i < 100; i += 1) {
      await new Promise(setImmediate);
      if (pending.size) await Promise.allSettled([...pending]);
      if (errors.length) throw errors.shift();
      if (!pending.size && !bridge.snapshot().locking) return;
    }
    throw new Error('Component did not settle');
  }
  return {
    // Raw startup entry points allow cancellation tests to complete without
    // requiring an audio handler that a cancelled start must never install.
    begin: (mode = 'autopilot') =>
      ({ autopilot: bridge.startAutopilot, detect: bridge.startDetect, manual: bridge.start })[
        mode
      ](),
    start: async () => {
      await bridge.startAutopilot();
      await settle();
      if (!port?.onmessage) throw new Error('No audio handler');
    },
    startManual: async () => {
      await bridge.start();
      await settle();
      if (!port?.onmessage) throw new Error('No manual audio handler');
    },
    push: async (pcm, t) => {
      now = t;
      port.onmessage({ data: pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) });
      await bridge.chainRef.current;
      await settle();
      return bridge.snapshot();
    },
    // Wall-paced producers must deliver without waiting for either inference or
    // decisions. This preserves the component's own queue/backlog behavior.
    enqueue: (pcm, t) => {
      now = t;
      if (!port?.onmessage) throw new Error('No audio handler');
      port.onmessage({ data: pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) });
      return bridge.chainRef.current;
    },
    drain: async () => {
      await bridge.chainRef.current;
      await settle();
    },
    transcript: async (text, t) => {
      now = t;
      await bridge.handleTranscript(text);
      await settle();
      return bridge.snapshot();
    },
    lock: async (candidate, opts) => {
      await bridge.autopilotLock(candidate, opts);
      await settle();
    },
    stopSession: async () => {
      bridge.stop();
      await settle();
    },
    cancelSession: () => bridge.stop(),
    snapshot: () => bridge.snapshot(),
    stop: async () => {
      bridge.stop();
      try {
        await settle();
      } finally {
        // settle awaits tracked work before surfacing its error. Native resources
        // still need releasing when a completed decision failed.
        try {
          if (infer) await infer.sess.release();
        } finally {
          for (const realm of realmHandles) if (!realm.isClosed) realm.close();
          realmHandles.clear();
        }
      }
    },
  };
}

module.exports = { createDriver, COMPONENT, DRIVER_SHA256 };
