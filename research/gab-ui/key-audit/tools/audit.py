# Per-window hearing vs answer key. For each clip: slide a 10 s window (2 s step) over the decoded speech-model
# output, find which Shabad in the whole Gurbani corpus it matches best (independent of Voice Autopilot), and
# score the keyed Shabad on the same window. Also a pangti-level timing-shift scan for clips with line keys.
import json, os, sys, csv, re, glob
import numpy as np
from rapidfuzz import fuzz

S = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(S, 'win'); os.makedirs(OUT, exist_ok=True)
corpus = json.load(open(os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')))
DROP = re.compile(r'[\s।॥|0-9੦-੯.,;:!?\-▁ੱੰਂ]+')
def norm(s): return DROP.sub('', s or '')

verse = {r['verseId']: r for r in corpus}
sh_verses = {}
for r in corpus:
    for s in (r.get('shabadIds') or [r['shabadId']]):
        sh_verses.setdefault(s, []).append(r['verseId'])
SIDS = sorted(sh_verses)
sidx = {s: i for i, s in enumerate(SIDS)}
sh_text = [''.join(norm(verse[v]['text']) for v in sorted(sh_verses[s])) for s in SIDS]

# trigram postings
tri_id = {}; post = {}
for i, t in enumerate(sh_text):
    for g in {t[j:j + 3] for j in range(len(t) - 2)}:
        post.setdefault(g, []).append(i)
post = {g: np.array(v, dtype=np.int32) for g, v in post.items()}
NS = len(SIDS)
idf = {g: np.log(NS / (1 + len(v))) for g, v in post.items()}

def cands(h, k=40):
    gs = {h[j:j + 3] for j in range(len(h) - 2)} & post.keys()
    if not gs: return []
    ix = np.concatenate([post[g] for g in gs]); w = np.concatenate([np.full(len(post[g]), idf[g]) for g in gs])
    sc = np.bincount(ix, weights=w, minlength=NS)
    top = np.argpartition(-sc, k)[:k]
    return [int(i) for i in top if sc[i] > 0]

def sim(halves, i):
    t = sh_text[i]
    xs = [fuzz.partial_ratio(h, t) for h in halves]
    return sum(xs) / len(xs)

def read_csv(p):
    return list(csv.DictReader(open(p))) if os.path.exists(p) else []

def keys_of(kd):
    sh = [r for r in read_csv(os.path.join(kd, 'shabads.csv')) if r.get('start_s') not in ('', None)]
    ln = [r for r in read_csv(os.path.join(kd, 'lines.csv')) if r.get('start_s') not in ('', None) and r.get('verseId')]
    lines = sorted([(int(r['verseId']), float(r['start_s']), float(r['end_s'])) for r in ln], key=lambda x: x[1])
    line_sh = set()
    for v, a, b in lines:
        if v in verse: line_sh.update(verse[v].get('shabadIds') or [verse[v]['shabadId']])
    segs = []
    for r in sh:
        ids = set(); bani = False
        for x in str(r['shabadId']).split('|'):
            if x.startswith('bani:'): bani = True
            else: ids.add(int(x))
        if bani: ids |= line_sh
        segs.append((float(r['start_s']), float(r['end_s']), ids, r['shabadId']))
    return segs, lines

def key_at(segs, c):
    ids = set(); raw = []
    for a, b, s, r in segs:
        if a <= c <= b: ids |= s; raw.append(r)
    return ids, raw

def run(cid, c):
    tk = json.load(open(os.path.join(S, 'tok', cid + '.json')))
    toks = tk['toks']
    T = np.array([t for t, _ in toks]) if toks else np.zeros(0)
    P = [p for _, p in toks]
    def text(a, b):
        i, j = np.searchsorted(T, a), np.searchsorted(T, b)
        return norm(''.join(P[i:j]))
    segs, lines = keys_of(c['keys'])
    dur = c['dur']
    W = []
    t = 10.0
    while t <= dur + 0.01:
        h1, h2 = text(t - 10, t - 5), text(t - 5, t)
        h = h1 + h2
        kid, kraw = key_at(segs, t - 5)
        rec = {'t': t, 'n': len(h), 'txt': h, 'key': sorted(kid), 'kraw': kraw}
        if len(h) >= 12:
            halves = [x for x in (h1, h2) if len(x) >= 6] or [h]
            cs = cands(h)
            ki = [sidx[s] for s in kid if s in sidx]
            sc = {i: sim(halves, i) for i in set(cs) | set(ki)}
            order = sorted(sc, key=lambda i: -sc[i])
            top = order[0]
            rec['top'] = SIDS[top]; rec['O'] = round(sc[top], 1)
            # best Shabad that is not the key
            oth = [i for i in order if SIDS[i] not in kid]
            if oth: rec['Y'] = SIDS[oth[0]]; rec['Ys'] = round(sc[oth[0]], 1)
            rec['K'] = round(max([sc[i] for i in ki]), 1) if ki else None
            # runner-up distinct Shabad overall (for a no-key margin)
            rec['O2'] = round(sc[order[1]], 1) if len(order) > 1 else 0
        W.append(rec)
        t += 2.0
    # pangti-level timing scan
    tim = None
    if lines:
        shifts = np.arange(-30, 30.5, 0.5)
        L = [(norm(verse[v]['text']), a, b) for v, a, b in lines if v in verse and b - a >= 1.0]
        L = [x for x in L if len(x[0]) >= 6]
        if L:
            curve = []
            for s in shifts:
                xs = []
                for vt, a, b in L:
                    h = text(a + s, b + s)
                    xs.append(fuzz.partial_ratio(vt, h) if len(h) >= 4 else 0.0)
                curve.append(float(np.mean(xs)))
            # null: the same hearing spans scored against the clip's other keyed pangtis (wrong line, same Bani)
            null = []
            if len(set(x[0] for x in L)) > 1:
                for k, (vt, a, b) in enumerate(L):
                    h = text(a, b)
                    others = [o for o, _, _ in L if o != vt]
                    null.append(np.mean([fuzz.partial_ratio(o, h) if len(h) >= 4 else 0 for o in others]))
            per_line = []
            for vt, a, b in L:
                ys = [fuzz.partial_ratio(vt, text(a + s, b + s)) if len(text(a + s, b + s)) >= 4 else 0 for s in shifts]
                per_line.append(float(shifts[int(np.argmax(ys))]) if max(ys) >= 60 else None)
            tim = {'shifts': shifts.tolist(), 'curve': [round(x, 1) for x in curve], 'nlines': len(L),
                   'null': round(float(np.mean(null)), 1) if null else None, 'per_line_best': per_line}
    json.dump({'id': cid, 'tier': c['tier'], 'dur': dur, 'coverage': tk['hit'] / max(1, tk['tried']), 'W': W, 'timing': tim,
               'segs': [(a, b, sorted(s), r) for a, b, s, r in segs], 'lines': lines}, open(os.path.join(OUT, cid + '.json'), 'w'), ensure_ascii=False)

if __name__ == '__main__':
    clips = json.load(open(os.path.join(S, 'clips.json')))
    only = sys.argv[1:]
    for cid, c in clips.items():
        if only and cid not in only: continue
        if not only and os.path.exists(os.path.join(OUT, cid + '.json')): continue
        if not os.path.exists(os.path.join(S, 'tok', cid + '.json')) or not c.get('keys'): print('skip', cid); continue
        run(cid, c); print(cid, flush=True)
