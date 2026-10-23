#!/usr/bin/env python3
"""Re-label two kinds of seconds in GAB timeline JSON so the viewer tells the truth:
  W -> B  when the screen showed a Bani (Aarti, Japji Sahib, Rehras Sahib, Asa di Vaar ...) that CONTAINS the
          Shabad being sung (checked against the Bani's own verses from the public BaniDB API).
  N -> V  when "nothing shown" was really the Waheguru slide (searching), which is not an error.
Counts in clip.n are updated to match. Usage: bani-fix.py <in_dir> <out_dir>"""
import json, os, re, sys, urllib.request, glob, unicodedata

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'gab-ui'}), timeout=60) as r:
        return json.load(r)

def norm(s):
    s = unicodedata.normalize('NFC', s or '')
    s = re.sub(r'[॥।੦-੯0-9]+', ' ', s)          # drop dandas and verse numbers
    return re.sub(r'\s+', ' ', s).strip()

banis = get('https://api.banidb.com/v2/banis')
byname = {norm(b['gurmukhiUni']): b['ID'] for b in banis}
cache = {}
def bani_lines(name):
    key = norm(re.sub(r'\(.*?\)', '', name))
    bid = byname.get(key)
    if bid is None:
        cand = [v for k, v in byname.items() if k.startswith(key) or key.startswith(k)]
        bid = cand[0] if cand else None
    if bid is None:
        return None
    if bid not in cache:
        d = get(f'https://api.banidb.com/v2/banis/{bid}')
        cache[bid] = {norm(v['verse']['verse']['unicode']) for v in d['verses']}
    return cache[bid]

def truth_lines(t):
    return [norm(x.replace('Shabad:', '')) for x in re.split(r'\s+/\s+', t or '') if x.strip()]

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
report = {}
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    name = os.path.basename(f)
    d = json.load(open(f))
    if name == 'index.json':
        json.dump(d, open(os.path.join(dst, name), 'w'), ensure_ascii=False); continue
    T = d['texts']; moved = {'B': 0, 'V': 0, 'W_kept_bani': 0}; unknown = set()
    for c in d['clips']:
        for r in c['runs']:
            s, e, cat, ti, si = r
            shown = T[si] if si >= 0 else ''
            if cat == 'W' and shown.startswith('Bani:'):
                lines = bani_lines(shown[5:].strip())
                if lines is None:
                    unknown.add(shown); continue
                if any(tl and tl in lines for tl in truth_lines(T[ti] if ti >= 0 else '')):
                    r[2] = 'B'; c['n']['W'] -= e - s; c['n']['B'] = c['n'].get('B', 0) + e - s; moved['B'] += e - s
                else:
                    moved['W_kept_bani'] += e - s
            elif cat == 'N' and 'ਵਾਹਿਗੁਰੂ slide' in shown:
                r[2] = 'V'; c['n']['N'] -= e - s; c['n']['V'] = c['n'].get('V', 0) + e - s; moved['V'] += e - s
    report[name] = {**moved, 'unknown_banis': sorted(unknown)}
    json.dump(d, open(os.path.join(dst, name), 'w'), ensure_ascii=False)
print(json.dumps(report, ensure_ascii=False, indent=1))
