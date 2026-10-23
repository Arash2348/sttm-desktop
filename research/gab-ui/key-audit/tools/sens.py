# Sensitivity: give each recording a deliberately wrong key (another recording's Shabad) and see if the audit catches it.
import json, glob, os, sys, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit as A
import verdict as V
random.seed(7)
ws = {}
rows = {r['id']: r for r in json.load(open('verdicts.json'))}
ids = [i for i, r in rows.items() if r['tier'] in ('main', 'akhand', 'kbv1') and not i.endswith(('_c33', '_c66'))]
keys = {}
for i in ids:
    d = json.load(open(f'win/{i}.json'))
    keys[i] = sorted({s for _, _, ss, _ in d['segs'] for s in ss})
caught = {}; res = []
for i in ids:
    d = json.load(open(f'win/{i}.json'))
    tk = json.load(open(f'tok/{i}.json'))
    T = np.array([t for t, _ in tk['toks']]); P = [p for _, p in tk['toks']]
    def text(a, b):
        x, y = np.searchsorted(T, a), np.searchsorted(T, b); return A.norm(''.join(P[x:y]))
    other = random.choice([j for j in ids if not set(keys[j]) & set(keys[i])])
    fake = keys[other][0]
    W2 = []
    for w in d['W']:
        w = dict(w)
        if w['key'] and 'O' in w:
            h1, h2 = text(w['t'] - 10, w['t'] - 5), text(w['t'] - 5, w['t'])
            halves = [x for x in (h1, h2) if len(x) >= 6] or [h1 + h2]
            K = A.sim(halves, A.sidx[fake])
            w['K'] = round(K, 1); w['key'] = [fake]
            # best non-key: the old best overall (true Shabad usually) unless it is the fake
            if w['top'] != fake: w['Y'], w['Ys'] = w['top'], w['O']
        W2.append(w)
    sp = [s for s in V.spans(W2)]
    keyed = sum(1 for w in W2 if w['key'])
    flagged = sum(b - a for a, b, y in sp)
    res.append((i, rows[i]['tier'], rows[i]['support'], len(sp) > 0, flagged))
    print(i, rows[i]['tier'], rows[i]['support'], 'caught' if sp else 'MISSED', int(flagged), flush=True)
json.dump(res, open('sens.json', 'w'))
for t in ('main', 'akhand', 'kbv1'):
    r = [x for x in res if x[1] == t]
    good = [x for x in r if (x[2] or 0) >= 0.5]
    print(t, 'caught %d/%d overall; %d/%d where hearing supports the real key >= 50%%' % (sum(x[3] for x in r), len(r), sum(x[3] for x in good), len(good)))
