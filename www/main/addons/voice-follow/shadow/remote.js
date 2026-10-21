// Remote kill-switch for the prod collector. A tiny JSON (COLLECTOR_CONFIG_URL) is fetched at
// launch and hourly; while it says {"enabled": false} the collector stays idle (no sessions,
// no listener). Unreachable or malformed = keep the last answer (on, at first), so a
// Gurdwara with no internet is never blocked by the switch itself.
const { COLLECTOR_CONFIG_URL, COLLECTOR_CONFIG_EVERY_MS } = require('./config');
const { guard } = require('./diag');

// The one rule, kept pure for the test: only an explicit false turns the collector off.
const enabledFrom = (cfg) => !(cfg && typeof cfg === 'object' && cfg.enabled === false);

let enabledNow = true;
let timer = null;
let onChange = () => {};
let log = () => {};

async function fetchOnce() {
  const fetchFn = global.fetch;
  if (!fetchFn || !COLLECTOR_CONFIG_URL) return;
  let cfg;
  try {
    const res = await fetchFn(`${COLLECTOR_CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return; // 404 while the file does not exist yet = no switch = on
    cfg = await res.json();
  } catch (_) {
    return; // offline: keep the last answer
  }
  const next = enabledFrom(cfg);
  if (next !== enabledNow) {
    enabledNow = next;
    log(`collector: remote config says ${next ? 'enabled' : 'disabled'}`);
    onChange(next);
  }
}

function start(opts = {}) {
  if (opts.onChange) onChange = opts.onChange;
  if (opts.log) log = opts.log;
  if (timer) return;
  fetchOnce();
  timer = setInterval(guard('remote.tick', fetchOnce), COLLECTOR_CONFIG_EVERY_MS);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

const enabled = () => enabledNow;

module.exports = {
  start: guard('remote.start', start),
  stop: guard('remote.stop', stop),
  enabled,
  enabledFrom,
};
