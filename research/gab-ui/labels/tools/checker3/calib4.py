# Checker 3, batch 4: calibrate the pangti rule for short spans (Paath pangtis are 1-3 s, 8-15 heard chars) on
# (a) windows cut from the Karanbir v1 human pangti keys (kirtan, 4 recordings, Mac q16 decode in tok4cal/) and
# (b) the human-confirmed rows of rt11_sohila (Paath, bani:23). Reports accuracy by heard length / margins.
import csv, json, math, sys
from lib4 import *
rows = []
K = os.path.expanduser('~/personal/gab-builds/kbv1-bench/1-kirtan-shabad')
for rec in ['kbv1_IZOsmkdmmcg', 'kbv1_kchMJPK9Axs', 'kbv1_kZhIA8P6xWI', 'kbv1_zOtIpxMT9hU']:
    sh = [int(r['shabadId']) for r in csv.DictReader(open(f'{K}/{rec}/shabads.csv')) if r.get('shabadId')]
    lines = [(int(r['verseId']), float(r['start_s']), float(r['end_s'])) for r in csv.DictReader(open(f'{K}/{rec}/lines.csv'))]
    for v, a, b in lines:
        for W in (1.5, 2.5, 4.5, 6.0, 10.0):
            t = a + 0.3
            while t + W <= b + 0.3:
                h, raw, cov = heard4(rec, t, t + W, ) if False else heard4_dirs(rec, t, t + W, ('tok4cal',))
                if cov >= 0.9 and len(h) >= 5:
                    d = decide(h, sh)
                    if d: rows.append(dict(src='kbv1', rec=rec, L=len(h), s1=round(d['s1'], 1), m_in=round(d['m_in'], 1), m_out=round(d['m_out'], 1), ins=d['in_shabad'], ok=vtext[d['my']] == vtext[v], W=W))
                t += W / 2
# Paath: rt11_sohila human-confirmed rows, exact span
sh, lines = key_rows4('2-bani-recited/sohila', 'rt11_sohila')
sids = [s for s, _, _ in sh]
for v, a, b, cf, src in lines:
    if 'human-confirmed' not in src: continue
    h, raw, cov = heard4_dirs('rt11_sohila', a, b, ('tok4cal',))
    d = decide(h, sids) if len(h) >= 5 else None
    rows.append(dict(src='sohila', rec='rt11_sohila', L=len(h), s1=round(d['s1'], 1) if d else 0, m_in=round(d['m_in'], 1) if d else 0, m_out=round(d['m_out'], 1) if d else 0,
                     ins=d['in_shabad'] if d else False, ok=bool(d) and vtext[d['my']] == vtext[v], W=round(b - a, 1), v=v, my=d['my'] if d else None, raw=raw[:40]))
json.dump(rows, open(os.path.join(S, 'calib4.json'), 'w'), ensure_ascii=False)
def wl(k, n, z=1.2816):
    p = k / n; d = 1 + z * z / n; return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
kb = [r for r in rows if r['src'] == 'kbv1']
print('kbv1 windows', len(kb), 'acc', round(sum(r['ok'] for r in kb) / len(kb), 3))
ci = [r for r in kb if r['ins']]
print('in-shabad picks', len(ci), 'acc', round(sum(r['ok'] for r in ci) / len(ci), 3), '; out picks', len(kb) - len(ci), 'acc', round(sum(r['ok'] for r in kb if not r['ins']) / max(1, len(kb) - len(ci)), 3))
for lo, hi in ((5, 8), (8, 10), (10, 13), (13, 16), (16, 24), (24, 999)):
    for mb in (3, 5, 10, 15):
        for sb in (50, 60, 70):
            xs = [r['ok'] for r in ci if lo <= r['L'] < hi and r['m_in'] >= mb and r['s1'] >= sb]
            if len(xs) >= 20: print(f'L[{lo},{hi}) m_in>={mb} s1>={sb}: n={len(xs)} acc={sum(xs)/len(xs):.3f} wl={wl(sum(xs),len(xs)):.3f}')
for mo in (-10, 0, 3, 5):
    xs = [r['ok'] for r in ci if r['m_out'] >= mo and 8 <= r['L'] < 16 and r['m_in'] >= 5 and r['s1'] >= 60]
    if xs: print(f'short L 8-16, m_out>={mo} (m_in>=5,s1>=60): n={len(xs)} acc={sum(xs)/len(xs):.3f}')
so = [r for r in rows if r['src'] == 'sohila']
print('sohila human-confirmed', len(so), 'right', sum(r['ok'] for r in so))
for r in so: print(' ', r['v'], r['my'], r['ok'], 'L', r['L'], 's1', r['s1'], 'm_in', r['m_in'], 'm_out', r['m_out'], r['raw'])
