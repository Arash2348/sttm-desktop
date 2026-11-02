#!/usr/bin/env python3
"""summary.py results/<name> - the short table bench.sh ends with: hit@5 per behaviour for Karanbir's model vs yours at
10 s and 4 s windows, and edge-tolerant letter error, each marked ✅ clearly better / ➖ within noise / ❌ clearly worse
(clear = the 95% interval from resampling whole clips excludes 0). Writes results/<name>/summary.md and prints it."""
import json, os, sys

R = sys.argv[1].rstrip('/')
name = os.path.basename(R)
tiers = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample.json')))['tiers']
hit = json.load(open(os.path.join(R, 'hit5.json')))['agg']
row = {(a['tier'], a['model']): a for a in hit}


def mark(v, higher_better=True):
    if not v or not v.get('clear'):
        return '➖'
    return '✅' if (v['diff'] > 0) == higher_better else '❌'


L = [f'## {name} vs Karanbir (same machine)', '',
     'hit@5 = how often the right Shabad is in the top 5 search results from what the model heard.', '',
     '| Behaviour | 10 s: Karanbir | 10 s: yours | 4 s: Karanbir | 4 s: yours |', '|---|---|---|---|---|']
for t, label in tiers.items():
    cells = []
    for w in (10, 4):
        b, m = row.get((t, f'karanbir-w{w}')), row.get((t, f'{name}-w{w}'))
        cells += [f"{b['hit5']}" if b else '-', f"{m['hit5']} {mark(m.get('vsBaseline'))}" if m else '-']
    L.append(f'| {label} | ' + ' | '.join(cells) + ' |')
cp = os.path.join(R, 'cer.json')
if os.path.exists(cp):
    cer = {(a['tier'], a['model']): a for a in json.load(open(cp))['agg']}
    L += ['', 'Edge-tolerant letter error % (lower is better; behaviours with person- or caption-timed pangtis only).', '',
          '| Behaviour | Karanbir | yours |', '|---|---|---|']
    for t, label in tiers.items():
        b, m = cer.get((t, 'karanbir')), cer.get((t, name))
        if b and m:
            v = m.get('edge_vs_baseline')
            L.append(f"| {label} | {b['cer_edge_tolerant']} | {m['cer_edge_tolerant']} {mark(v, higher_better=False) if v else '(too few clips)'} |")
lp = os.path.join(R, 'latency.json')
if os.path.exists(lp):
    lat = json.load(open(lp))
    L += ['', f"Speed, ms per 10 s window at 2 threads on {lat['machine']} (median): " +
          ', '.join(f"{n} {v['10s']['median_ms']}" for n, v in lat['models'].items())]
L += ['', '✅ clearly better · ➖ within noise · ❌ clearly worse. Hearing only: not how the app follows a diwan with this model.']
md = '\n'.join(L) + '\n'
open(os.path.join(R, 'summary.md'), 'w', encoding='utf8').write(md)
print(md)
