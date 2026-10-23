# Checker 3 (lens C) library for label batch 4 (Paath + Sung Bani): lib3's scorer plus Bani membership and keys
# that live in the HF dataset copy (~/personal/vf-benchmark/<folder>/<rec>) rather than hf-keys/.
# Tokens: x86 q16 cache decode first (tok4/), gaps filled from the Mac q16 decode of the same model (tok4mac/).
import json, os, csv
import numpy as np
import lib3
from lib3 import *
HF = os.path.expanduser('~/personal/vf-benchmark')
# Bani membership (pangti order = Bani Seq order, as bani-verses.js dumped it)
_bv = json.load(open(f'{GAB}/labels/bani-verse-cache.json'))
for k, d in _bv.items():
    if k.startswith('bani:'): lib3.sh_verses[k] = [int(v) for v in d]
bani_order = {k: {int(v): i for i, v in enumerate(d)} for k, d in _bv.items() if k.startswith('bani:')}

def key_rows4(folder, rec):
    kd = f'{HF}/{folder}/{rec}'
    rd = lambda f: list(csv.DictReader(open(f'{kd}/{f}', encoding='utf-8', newline='')))
    shab = [(r['shabadId'], float(r['start_s']), float(r['end_s'])) for r in rd('shabads.csv') if r.get('shabadId')]
    lines = [(int(r['verseId']), float(r['start_s']), float(r['end_s']),
              float(r['confidence']) if r.get('confidence') not in (None, '') else 1.0, r.get('source', ''))
             for r in rd('lines.csv')]
    return shab, lines

def _merge(rec, dirs):
    toks, cov, dur = [], [], 0.0
    for d in dirs:
        f = os.path.join(S, d, rec + '.json')
        if not os.path.exists(f): continue
        tk = json.load(open(f)); dur = tk['dur']
        new = [w for w in tk['cov'] if not any(x <= w[0] and w[1] <= y for x, y in cov)]
        def covered(t): return any(x <= t < y for x, y in cov)
        toks += [t for t in tk['toks'] if not covered(t[0]) and any(x <= t[0] < y for x, y in new)]
        cov += new
    toks.sort(key=lambda t: t[0])
    return toks, cov, dur

def load_toks4(rec, dirs=('tok4', 'tok4mac')):
    if rec not in lib3._toks:
        toks, cov, dur = _merge(rec, dirs)
        lib3._toks[rec] = (np.array([t for t, _ in toks]), [p for _, p in toks], cov, dur)
    return lib3._toks[rec]

def heard4_dirs(rec, a, b, dirs):
    key = rec + '@' + '+'.join(dirs)
    if key not in lib3._toks:
        toks, cov, dur = _merge(rec, dirs)
        lib3._toks[key] = (np.array([t for t, _ in toks]), [p for _, p in toks], cov, dur)
    T, P, cov, dur = lib3._toks[key]
    i, j = np.searchsorted(T, a), np.searchsorted(T, b)
    covered = min(1.0, sum(max(0, min(b, y) - max(a, x)) for x, y in cov) / max(0.01, b - a))
    raw = ''.join(P[i:j])
    return norm(raw), raw.replace('▁', ' ').strip(), covered

def heard4(rec, a, b):
    T, P, cov, dur = load_toks4(rec)
    i, j = np.searchsorted(T, a), np.searchsorted(T, b)
    covered = sum(max(0, min(b, y) - max(a, x)) for x, y in cov) / max(0.01, b - a)
    # union coverage (windows overlap): clamp
    covered = min(1.0, covered)
    raw = ''.join(P[i:j])
    return norm(raw), raw.replace('▁', ' ').strip(), covered

def sid_of(s):
    """shabads.csv id -> sh_verses key: int for a Shabad, 'bani:N' string for a Bani (may be a|b)"""
    return [int(x) if x.isdigit() else x for x in str(s).split('|')]
def sids_of(shab): return [x for s, _, _ in shab for x in sid_of(s)]
