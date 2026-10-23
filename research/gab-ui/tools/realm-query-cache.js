/* realm-query-cache.js — preload for gab-quick replays (node --require): remembers the answer of every
 * realm.objects('Verse').filtered(...)[.sorted(...)].slice(a, b) query, as the list of verse IDs, on disk, and serves a
 * repeat of the same query from that list (objectForPrimaryKey). Over half of a replay's CPU is the app's full-table
 * text search (www/main/banidb/realm-search.js); builds replayed over the same saved hearing ask mostly the same
 * queries, so a new build pays for its new queries only.
 *
 * Exact by construction: the key is the query text + arguments + sort + slice bounds + the database file (path, size,
 * modification time); the database is opened read-only by the app and the answer is the same rows in the same order.
 * Only Verse queries read through slice() are cached; every other use of Realm is untouched.
 *
 * Store: $GAB_QUERY_CACHE/<db key>/<pid>-<time>.jsonl (one writer per process; all files are read at start).
 * Off when GAB_QUERY_CACHE is unset.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.GAB_QUERY_CACHE;
if (DIR) {
  const Realm = require('realm');
  const stores = new Map(); // db key -> { map, file }
  const storeOf = (realm) => {
    let st;
    try { st = fs.statSync(realm.path); } catch (_) { return null; }
    const k = crypto.createHash('sha1').update(`${realm.path}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 16);
    if (!stores.has(k)) {
      const d = path.join(DIR, k);
      const map = new Map();
      try {
        for (const f of fs.readdirSync(d)) {
          if (!f.endsWith('.jsonl')) continue;
          for (const l of fs.readFileSync(path.join(d, f), 'utf8').split('\n')) {
            if (!l) continue;
            try { const [q, ids] = JSON.parse(l); map.set(q, ids); } catch (_) { /* torn last line of a killed writer */ }
          }
        }
      } catch (_) { /* first use */ }
      stores.set(k, { map, dir: d, file: path.join(d, `${process.pid}-${Date.now()}.jsonl`), hits: 0, misses: 0 });
    }
    return stores.get(k);
  };
  // Realm 10 Results carry their methods as own properties, so the chain is followed with a Proxy per Verse query
  const wrap = (res, t) => new Proxy(res, {
    get(target, prop) {
      if (prop === 'filtered' || prop === 'sorted') return (...args) => wrap(target[prop](...args), { ...t, chain: [...t.chain, [prop, args]] });
      if (prop === 'slice') return (a, b) => cachedSlice(target, t, a, b);
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  const cachedSlice = (target, t, a, b) => {
    const st = storeOf(t.realm);
    if (!st) return target.slice(a, b);
    const q = JSON.stringify([t.type, t.chain, a ?? null, b ?? null]);
    const ids = st.map.get(q);
    if (ids) {
      const rows = ids.map((id) => t.realm.objectForPrimaryKey(t.type, id));
      if (rows.every(Boolean)) { st.hits++; return rows; }
    }
    st.misses++;
    const rows = target.slice(a, b);
    const got = rows.map((x) => x && x.ID);
    if (got.every((x) => x != null)) {
      st.map.set(q, got);
      try { fs.mkdirSync(st.dir, { recursive: true }); fs.appendFileSync(st.file, `${JSON.stringify([q, got])}\n`); } catch (_) { /* cache is best effort */ }
    }
    return rows;
  };
  const origObjects = Realm.prototype.objects;
  Realm.prototype.objects = function objects(type, ...rest) {
    const r = origObjects.call(this, type, ...rest);
    return type === 'Verse' && r && typeof r === 'object' ? wrap(r, { type, realm: this, chain: [] }) : r;
  };
  process.on('exit', () => { for (const st of stores.values()) if (process.env.GAB_QUERY_CACHE_STATS) process.stderr.write(`[query-cache] hits ${st.hits} misses ${st.misses}\n`); });
}
