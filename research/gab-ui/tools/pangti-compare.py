#!/usr/bin/env python3
"""pangti-compare.py [<new dir>] : per set and build, today's viewer numbers (private-fixed) vs the pangti re-score.
today right Shabad % = (P+A+S+B)/scored (Shabad-level sets); today right pangti % = P/(P+A+W+N+V) (pangti-keyed);
new right pangti % = (P+B)/(P+B+A+W+N+V), G excluded; G share = G / all scored seconds."""
import json, os, sys, collections
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
new = sys.argv[1] if len(sys.argv) > 1 else f'{B}/timeline-pangti'
old = f'{B}/private-fixed/timeline'
rep = json.load(open(f'{new}/rescore-report.json'))['files']
if os.path.exists(f'{new}/rescore-report-private.json'): rep.update(json.load(open(f'{new}/rescore-report-private.json'))['files'])
def tot(clips, ids=None):
    t = collections.Counter()
    for c in clips:
        if ids is None or c['id'] in ids: t.update(c['n'])
    return t
def pct(a, b): return f'{100*a/b:.1f}' if b else '-'
print('| file | kept / all | dropped (why) | today right Shabad % (all / kept) | today right pangti % (all / kept) | new right pangti % | G share | pangti-said h |')
print('|---|---|---|---|---|---|---|---|')
for f in sorted(rep):
    o = json.load(open(f'{old}/{f}'))['clips']; n = json.load(open(f'{new}/{f}'))['clips']
    ids = {c['id'] for c in n}
    def sh(t): s = sum(t.values()); return pct(t['P'] + t['A'] + t['S'] + t['B'], s)
    def pg(t): return pct(t['P'], t['P'] + t['A'] + t['W'] + t['N'] + t['V'])
    to, tk, tn = tot(o), tot(o, ids), tot(n)
    den = tn['P'] + tn['B'] + tn['A'] + tn['W'] + tn['N'] + tn['V']
    why = collections.Counter('no pangti key' if 'no pangti' in d['why'] else 'coverage < 60%' if 'cover' in d['why'] else d['why'] for d in rep[f]['dropped'])
    print(f"| {f[:-5]} | {len(n)} / {len(o)} | {', '.join(f'{v} {k}' for k, v in why.items()) or '-'} | {sh(to)} / {sh(tk)} | {pg(to)} / {pg(tk)} | {pct(tn['P'] + tn['B'], den)} | {pct(tn['G'], sum(tn.values()))} | {den/3600:.2f} |")
