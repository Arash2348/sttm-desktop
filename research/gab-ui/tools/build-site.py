#!/usr/bin/env python3
"""Assemble the two GAB timeline data sets from raw timeline JSON.
  inputs : timeline-orig/ (index.json + index-extra.json + per-build JSON), private-snap/timeline/ (private-only sets: hard, real)
  outputs: site/timeline/          public  -> only clips with a YouTube source; tiers left empty are dropped
           private-fixed/timeline/ private -> everything
Every output file is passed through bani-fix (right Bani -> B, Waheguru slide -> V)."""
import json, os, shutil, subprocess, sys, glob
H = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(H)
O = f'{B}/timeline-orig'; PS = f'{B}/private-snap/timeline'
ORDER = ['main', 'paath', 'sungbani', 'akhandpaath', 'akhand', 'kbv1', 'hard', 'real']
VORDER = ['5348d9a0', '9b1fa814', '6a866c94']   # 9.0.5 current experimental, 10.0.4, 10.0.5
idx = json.load(open(f'{O}/index.json')); extra = json.load(open(f'{O}/index-extra.json'))
tiers = {t['key']: t for t in idx['tiers']}
for t in extra['tiers']:
    if t['key'] in tiers:
        have = {b['file'] for b in tiers[t['key']]['builds']}
        tiers[t['key']]['builds'] += [b for b in t['builds'] if b['file'] not in have]
    else:
        tiers[t['key']] = t
# private-only tiers from the private Space snapshot
pidx = json.load(open(f'{PS}/index.json'))
for t in pidx['tiers']:
    if t['key'] not in tiers: tiers[t['key']] = {**t, 'private_only': True}
for t in tiers.values():
    t['builds'].sort(key=lambda b: VORDER.index(b.get('commit')) if b.get('commit') in VORDER else 99)
import re
def tidy(g):  # long YouTube playlist titles -> short, respectful source names
    m = re.search(r"Ang (\d+) Pankti \d+ to Ang (\d+)", g)
    if 'Sri Guru Granth Sahib Ji' in g and m: return f"Sehaj Paath on YouTube, Sri Guru Granth Sahib Ji Ang {m.group(1)} to {m.group(2)}"
    return g.replace('Japji Path Full (Fast)', 'Japji Sahib (fast reading)').replace('Japji Bhai', 'Japji Sahib, Bhai').replace('Aarti (verified bn07/bn08 video)', 'Aarti')
def src(f): return f'{O}/{f}' if os.path.exists(f'{O}/{f}') else f'{PS}/{f}'
def build(out, public):
    tmp = out + '.raw'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    keep = []
    for k in sorted(tiers, key=lambda k: ORDER.index(k) if k in ORDER else 99):
        t = tiers[k]
        if public and t.get('private_only'): continue
        bs = []
        for b in t['builds']:
            d = json.load(open(src(b['file'])))
            if public: d['clips'] = [c for c in d['clips'] if c.get('yt')]
            for c in d['clips']: c['gurdwara'] = tidy(c.get('gurdwara', ''))
            if not d['clips']: continue
            json.dump(d, open(f'{tmp}/{b["file"]}', 'w'), ensure_ascii=False); bs.append(b)
        if bs: keep.append({k2: v for k2, v in t.items() if k2 != 'private_only'} | {'builds': bs})
    json.dump({'tiers': keep}, open(f'{tmp}/index.json', 'w'), ensure_ascii=False)
    shutil.rmtree(out, ignore_errors=True)
    r = subprocess.run([sys.executable, '-I', f'{H}/bani-fix.py', tmp, out], capture_output=True, text=True); shutil.rmtree(tmp)
    if r.returncode: sys.exit(r.stderr)
    return [(t['key'], [(b['file'], len(json.load(open(f'{out}/{b["file"]}'))['clips'])) for b in t['builds']]) for t in keep]
for name, out, pub in [('public', f'{B}/site/timeline', True), ('private', f'{B}/private-fixed/timeline', False)]:
    print(name); [print('  ', k, v) for k, v in build(out, pub)]
