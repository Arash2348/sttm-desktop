#!/usr/bin/env python3
"""report_tables.py: numbers for RUN-REPORT.md from out/export-stats.json and ../timeline-indep/ (2026-10-23)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
TL = f'{os.path.dirname(HERE)}/timeline-indep'
st = json.load(open(f'{HERE}/out/export-stats.json'))
NAME = {'paath': 'Paath', 'kirtan': 'Kirtan (main)', 'akhand': 'Akhand Kirtan', 'sungbani': 'Sung Bani (unproven)'}
print('| Form | Recordings labelled | Audio h | Keyed h | Labelled (sung/read) h | Share of keyed time | Recordings >= 60% | Rows |')
print('|---|---|---|---|---|---|---|---|')
for k in ['paath', 'kirtan', 'akhand', 'sungbani']:
    s = st.get(k)
    if not s:
        continue
    print(f"| {NAME[k]} | {s['recordings']} | {s['audio_s']/3600:.2f} | {s['keyed_s']/3600:.2f} | {s['labelled_s']/3600:.2f} | "
          f"{s['labelled_s']/max(s['keyed_s'],1):.0%} | {s['cover60']} | {s['rows']} |")
print('\nvalidation', st['_validation']['in'], 'in', st['_validation']['kept'], 'kept', st['_validation']['dropped'], 'dropped')
CATS = ['P', 'B', 'A', 'W', 'N', 'V']
def head(files):
    n = {k: 0 for k in CATS}; rec = 0; sec = 0
    for f in files:
        if not os.path.exists(f):
            return None
        d = json.load(open(f))
        for c in d['clips']:
            rec += 1
            for k in CATS:
                n[k] += c['n'].get(k, 0)
    den = sum(n.values())
    return rec, den, (100 * (n['P'] + n['B']) / den if den else None)
B = [('v905-5348d9a0', '9.0.5'), ('v1004-9b1fa814', '10.0.4'), ('c1-6a866c94', '10.0.5'), ('v908-f475fd9a', '9.0.8')]
SETS = [('paath', 'Paath (Banis read)'), ('akhandpaath', 'Sehaj / Akhand Paath'), ('main', 'Kirtan (main)'), ('akhand', 'Akhand Kirtan'),
        ('sungbani', 'Sung Bani (unproven keys)'), ('kbv1', 'Karanbir v1 (human keys, unchanged)')]
print('\n| Set | Recordings scored | Scored pangti h | ' + ' | '.join(f'{b} right pangti %' for _, b in B) + ' |')
print('|---|---|---|' + '---|' * len(B))
for s, name in SETS:
    cells = []; rec = den = None
    for slug, _ in B:
        h = head([f'{TL}/{slug}-{s}.json'])
        if h is None:
            cells.append('n/a'); continue
        rec, den = h[0], h[1]
        cells.append('–' if h[2] is None else f'{h[2]:.1f}')
    print(f"| {name} | {rec} | {(den or 0)/3600:.2f} | " + ' | '.join(cells) + ' |')
rr = json.load(open(f'{TL}/rescore-report.json'))
print('\nkept/of per c1 file:')
for f, v in rr['files'].items():
    if f.startswith('c1-'):
        why = {}
        for d in v['dropped']:
            w = d['why'].split(' (')[0] if 'cover' not in d['why'] else 'coverage < 60%'
            why[w] = why.get(w, 0) + 1
        print(' ', f, v['kept'], '/', v['of'], why)
