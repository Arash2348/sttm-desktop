#!/usr/bin/env python3
"""check-cards.py <my scorecard.json> <reference scorecard.json> [<timeline.json>]
Per clip: right Shabad/Bani % and wrong s/h of this run vs a reference card; and the timeline's own right %
((P+A+S)/scored) vs the card's right_shabad_pct. Prints differences > 0.5 points."""
import json, sys
a = {c['id']: c for c in json.load(open(sys.argv[1]))['clips']}
b = {c['id']: c for c in json.load(open(sys.argv[2]))['clips']}
tl = {c['id']: c for c in json.load(open(sys.argv[3]))['clips']} if len(sys.argv) > 3 else {}
only_a, only_b = sorted(set(a) - set(b)), sorted(set(b) - set(a))
diff = []
for k in sorted(set(a) & set(b)):
    x, y = a[k].get('right_shabad_pct'), b[k].get('right_shabad_pct')
    if x is None or y is None or abs(x - y) > 0.5 or abs((a[k].get('wrong_s_per_h') or 0) - (b[k].get('wrong_s_per_h') or 0)) > 5:
        diff.append((k, x, y, a[k].get('wrong_s_per_h'), b[k].get('wrong_s_per_h')))
tdiff = []
for k, c in tl.items():
    n = c['n']; t = sum(n.values())
    if not t or k not in a or a[k].get('right_shabad_pct') is None: continue
    r = 100 * (n['P'] + n['A'] + n['S']) / t
    if abs(r - a[k]['right_shabad_pct']) > 1.0: tdiff.append((k, round(r, 1), a[k]['right_shabad_pct']))
print(f'same clips {len(set(a) & set(b))}; only here {only_a}; only in reference {only_b}')
print(f'card-vs-card differences (>0.5 pt right or >5 s/h wrong): {len(diff)}')
for d in diff: print('  ', d)
print(f'timeline-vs-own-card differences (>1 pt): {len(tdiff)}')
for d in tdiff: print('  ', d)
