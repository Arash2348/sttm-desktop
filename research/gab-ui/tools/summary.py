#!/usr/bin/env python3
"""summary.py <timeline.json>... : per file, the viewer's headline (right on screen %, wrong Shabad s/h, hours),
basis counts, and which clips are public (yt set) vs private."""
import json, sys, collections
for f in sys.argv[1:]:
    d = json.load(open(f))
    w = v = wr = sec = 0
    for c in d['clips']:
        n = collections.Counter(c['n']); t = sum(n.values())
        if not t: continue
        if c['basis'] == 'human':
            den = n['P'] + n['A'] + n['W'] + n['N'] + n['V']; a = 100 * n['P'] / den if den else None
        else:
            a = 100 * (n['P'] + n['A'] + n['S'] + n['B']) / t
        if a is None: continue
        w += t; v += a * t; wr += n['W']; sec += t
    basis = collections.Counter(c['basis'] for c in d['clips'])
    priv = [c['id'] for c in d['clips'] if not (c.get('yt') and c['yt'].get('v'))]
    print(f"{f.split('/')[-1]}: {len(d['clips'])} clips, {sec/3600:.2f} h scored, right {v/w if w else 0:.1f}%, wrong {wr/(sec/3600) if sec else 0:.1f} s/h, basis {dict(basis)}, private {len(priv)}: {' '.join(priv)}")
