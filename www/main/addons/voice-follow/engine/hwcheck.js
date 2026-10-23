// "Check this computer": a ~10 s test of how well this PC runs Voice Autopilot, so testers (and we) know
// whether a problem could be the hardware. Idea from Karanbir Singh's kirtan-captioning setup screen;
// no adaptive cadence here, just a minimum bar for the experimental build.
//
// It times the real speech model on the two jobs the app does every second (the model's cost does not
// depend on what is sung, so noise is enough), and turns that into "share of one second the model needs":
//   finding a Shabad   one 10 s window every 0.5 s             -> load = pass10 / 500 ms
//   following          4 s windows: follower every 0.25 s and   -> load = pass4 / 250 ms + pass4 / 500 ms
//                      recognizer every 0.5 s
// Kirtan always runs this full schedule (the slower performance tiers apply only to read Banis), so the
// worst of the two loads decides:
//   load <= 0.5   great        (twice as fast as needed)
//   load <= 0.8   meets the minimum
//   load  > 0.8   below the minimum (it will fall behind the singing; the screen lags)
// Less than 4 GB of memory is also below the minimum.
const os = require('os');

const SR = 16000;
const LIMITS = { great: 0.5, ok: 0.8, minRamGb: 4 };

function grade({ pass10Ms, pass4Ms, ramGb }) {
  const findLoad = pass10Ms / 500;
  const followLoad = pass4Ms / 250 + pass4Ms / 500;
  const load = Math.max(findLoad, followLoad);
  let verdict = 'great';
  if (load > LIMITS.ok || (ramGb != null && ramGb < LIMITS.minRamGb)) verdict = 'below';
  else if (load > LIMITS.great) verdict = 'ok';
  return {
    verdict,
    load: Number(load.toFixed(2)),
    findLoad: Number(findLoad.toFixed(2)),
    followLoad: Number(followLoad.toFixed(2)),
    // "2.4x faster than needed" (1 / load), the number people understand
    headroom: load > 0 ? Number((1 / load).toFixed(1)) : null,
  };
}

function specs() {
  const cpus = os.cpus() || [];
  return {
    cpu: (cpus[0] && cpus[0].model ? cpus[0].model : 'unknown').replace(/\s+/g, ' ').trim(),
    cores: cpus.length,
    ramGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    os: `${process.platform} ${os.release()}`,
    arch: os.arch(),
  };
}

function noise(seconds, seed0) {
  let seed = seed0;
  const buf = new Float32Array(seconds * SR);
  for (let i = 0; i < buf.length; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    buf[i] = (seed / 2147483648 - 0.5) * 0.1;
  }
  return buf;
}

async function timePasses(infer, seconds, passes, warm) {
  const ms = [];
  for (let k = 0; k < warm + passes; k += 1) {
    const buf = noise(seconds, 12345 + k); // a different window each time (no memo reuse)
    const t = performance.now();
    // eslint-disable-next-line no-await-in-loop
    await infer.emissions(buf);
    if (k >= warm) ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  return ms[Math.floor(ms.length / 2)];
}

// engine = require('./index'); onStep(text) for the panel. Never throws: returns { error } instead.
async function run(engine, { onStep = () => {}, passes = 4, warm = 1 } = {}) {
  const spec = specs();
  try {
    const t0 = performance.now();
    onStep('loading');
    const infer = await engine.ready();
    const loadMs = performance.now() - t0;
    onStep('timing');
    const pass10Ms = await timePasses(infer, 10, passes, warm);
    const pass4Ms = await timePasses(infer, 4, passes, warm);
    return {
      ...grade({ pass10Ms, pass4Ms, ramGb: spec.ramGb }),
      pass10Ms: Math.round(pass10Ms),
      pass4Ms: Math.round(pass4Ms),
      loadMs: Math.round(loadMs),
      tier: engine.pace && engine.pace.current ? engine.pace.current().name : undefined,
      specs: spec,
      at: new Date().toISOString(),
    };
  } catch (e) {
    return { error: String((e && e.message) || e), specs: spec, at: new Date().toISOString() };
  }
}

// One plain paragraph a tester can paste into Slack.
function summary(r, version) {
  const s = r.specs || {};
  const head = r.error
    ? `Check failed: ${r.error}`
    : {
        great: 'Great: runs Voice Autopilot comfortably',
        ok: 'Meets the minimum for Voice Autopilot',
        below: 'Below the minimum: Voice Autopilot may fall behind',
      }[r.verdict];
  const speed = r.error
    ? ''
    : ` | ${r.headroom}x faster than needed (finding ${r.pass10Ms} ms per 10 s window, following ${r.pass4Ms} ms per 4 s window)`;
  return `${head}${speed} | ${s.cpu}, ${s.cores} cores, ${s.ramGb} GB RAM, ${s.os} ${s.arch}${
    version ? ` | Voice Autopilot ${version}` : ''
  }`;
}

module.exports = { run, grade, specs, summary, LIMITS };
