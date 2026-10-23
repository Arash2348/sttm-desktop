import csv, json, math
from lib3 import *
K = os.path.expanduser('~/personal/sttm-replay/research/level2-dataset/kbv1-bench/1-kirtan-shabad')
rows = []
for rec in ['kbv1_IZOsmkdmmcg', 'kbv1_kchMJPK9Axs', 'kbv1_kZhIA8P6xWI', 'kbv1_zOtIpxMT9hU']:
    sh = [int(r['shabadId']) for r in csv.DictReader(open(f'{K}/{rec}/shabads.csv')) if r.get('shabadId')]
    lines = [(int(r['verseId']), float(r['start_s']), float(r['end_s'])) for r in csv.DictReader(open(f'{K}/{rec}/lines.csv'))]
    for v, a, b in lines:
        for W in (4.5, 6.0, 10.0, 14.0):
            t = a + 0.5
            while t + W <= b + 0.5:
                h, raw, cov = heard(rec, t, t + W)
                if cov >= 0.9 and len(h) >= 6:
                    d = decide(h, sh)
                    if d: rows.append(dict(rec=rec, L=len(h), s1=round(d['s1'], 1), m_in=round(d['m_in'], 1), m_out=round(d['m_out'], 1), ins=d['in_shabad'], ok=vtext[d['my']] == vtext[v], top=d['my'], v=v, W=W, tl=len(vtext[d['my']])))
                t += W / 2
json.dump(rows, open('calib.json', 'w'))
print(len(rows), 'windows; accuracy', sum(r['ok'] for r in rows) / len(rows))
def wl(k,n,z=1.2816):
    p=k/n; d=1+z*z/n; return (p+z*z/(2*n)-z*math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/d
ci=[r for r in rows if r['ins']]
print('in-shabad picks', len(ci), 'acc', sum(r['ok'] for r in ci)/len(ci), '; out picks', len(rows)-len(ci), 'acc', sum(r['ok'] for r in rows if not r['ins'])/max(1,len(rows)-len(ci)))
for lb in (10,16,24):
  for mb in (5,10,15,20):
    for sb in (50,60,70,80):
      xs=[r['ok'] for r in ci if r['L']>=lb and r['m_in']>=mb and r['s1']>=sb]
      if xs: print(f'L>={lb} m_in>={mb} s1>={sb}: n={len(xs)} acc={sum(xs)/len(xs):.3f} wl={wl(sum(xs),len(xs)):.3f}')
for mo in (-10,0,5,10):
    xs=[r['ok'] for r in ci if r['m_out']>=mo and r['L']>=10 and r['m_in']>=10 and r['s1']>=60]
    print(f'm_out>={mo} (L>=10,m_in>=10,s1>=60): n={len(xs)} acc={sum(xs)/len(xs):.3f}')
bad=[r for r in ci if not r['ok'] and r['s1']>=60 and r['m_in']>=10]
print('errors with strong in-Shabad evidence', len(bad)); [print(b) for b in bad[:20]]
