# Checker 1 of 3, label batch 1, lens A (text match). For every candidate span: decode the cached x86
# speech-model output for exactly that range, rank every pangti of the keyed Shabad plus the best competing
# pangtis of the whole Gurbani corpus by how much of the heard text they explain, pick my own answer and a
# calibrated confidence (Karanbir v1 human pangti keys, cumulative bins, 90% Wilson lower bound), and only
# then compare with the candidate's verseId.
import json, os, sys, csv, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib; lib.JUMP = 2.0
from lib import heard, judge, vtext, verse, sh_verses, VAHEGURU
S = os.path.dirname(os.path.abspath(__file__))

# calibration windows (same scorer) from the Karanbir v1 human keys
K = os.path.expanduser('~/personal/sttm-replay/research/level2-dataset/kbv1-bench/1-kirtan-shabad')
cal = []
for rec in ['kbv1_IZOsmkdmmcg', 'kbv1_kchMJPK9Axs', 'kbv1_kZhIA8P6xWI', 'kbv1_zOtIpxMT9hU']:
    sh = [int(r['shabadId']) for r in csv.DictReader(open(f'{K}/{rec}/shabads.csv'))]
    for r in csv.DictReader(open(f'{K}/{rec}/lines.csv')):
        v, a, b = int(r['verseId']), float(r['start_s']), float(r['end_s'])
        for W in (6.0, 10.0, 14.0):
            t = a + 1.0
            while t + W <= b - 1.0 + 0.01:
                h, raw, cov = heard(rec, t, t + W)
                if len(h) >= 10:
                    ranked, scores, svs = judge(h, sh)
                    if scores[ranked[0]] >= 50:
                        cal.append((len(h), scores[ranked[0]] - scores[ranked[1]], vtext[ranked[0]] == vtext[v]))
                t += W / 2
def wilson_lo(k, n, z=1.2816):
    if n == 0: return 0.0
    p = k / n; d = 1 + z * z / n
    return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
LB = [10, 16, 24]; MB = [0, 5, 8, 10, 12, 15, 20]
def calibrated(L, m):
    lb = max([x for x in LB if x <= L] or [10]); mb = max([x for x in MB if x <= m] or [0])
    xs = [ok for l, mm, ok in cal if l >= lb and mm >= mb]
    return wilson_lo(sum(xs), len(xs)), len(xs)

cands_in = json.load(open(os.path.expanduser('~/personal/sttm-ws3/research/gab-ui/labels/candidates/batch1.json')))
votes = []; dbg = []
for c in cands_in:
    rec, a, b = c['recording'], c['start_s'], c['end_s']
    h, raw, cov = heard(rec, a, b)
    ranked, scores, svs = judge(h, [c['shabadId']]) if len(h) else ([], {}, sh_verses.get(c['shabadId'], []))
    top = ranked[0] if ranked else None; sec = ranked[1] if len(ranked) > 1 else None
    s1 = scores[top] if top else 0.0; s2 = scores[sec] if sec else 0.0; m = s1 - s2
    vah = h.count(VAHEGURU) * len(VAHEGURU) / max(1, len(h))
    my = top; note = ''
    if cov < 0.5: my, conf, note = None, 0.6, f'cache covers only {cov:.0%} of the span, cannot hear it'
    elif len(h) < 10: my, conf, note = None, 0.6, f'almost nothing heard ({len(h)} chars): alaap, music, simran or hearing failure'
    elif vah >= 0.5: my, conf, note = None, 0.85, 'heard mostly Vaheguru simran'
    elif s1 < 50: my, conf, note = None, 0.7, f'no pangti explains the hearing (best {s1:.0f})'
    else:
        conf, n = calibrated(len(h), m)
        if len(h) < 16: conf = min(conf, 0.94)
        if cov < 0.9: conf = min(conf, 0.9)
        if top not in svs: note = 'best match is outside the keyed Shabad'
    conf = round(min(0.99, conf), 2)
    # only now: compare with the candidate
    cv = c['verseId']
    agrees = my is not None and (my == cv or (vtext.get(my) == vtext.get(cv) and cv in svs))
    if agrees and my != cv: my = cv  # same Gurbani text, the keyed Shabad's copy
    cs = scores.get(cv, lib.explain(h, vtext.get(cv, '')) if h else 0.0)
    reason = (f'heard "{raw[:70]}" ({len(h)} chars, cache {cov:.0%}); ' +
              (f'best {top} "{verse[top]["text"][:36]}" explains {s1:.0f}, runner-up {sec} "{verse[sec]["text"][:24] if sec else ""}" {s2:.0f}, margin {m:.0f}; ' if top else '') +
              f'candidate {cv} explains {cs:.0f}' + (f'; {note}' if note else ''))
    votes.append(dict(recording=rec, cand_verseId=cv, start_s=a, end_s=b, my_verseId=my, confidence=conf, agrees=bool(agrees), reason=reason))
    dbg.append(dict(rec=rec, a=a, tier=c['evidence']['tier'], s1=round(s1), m=round(m), L=len(h), conf=conf, agrees=bool(agrees), my=my, cv=cv, in_sh=top in svs if top else None))
out = os.path.expanduser('~/personal/sttm-ws3/research/gab-ui/labels/votes/batch1-checker1.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(votes, open(out, 'w'), ensure_ascii=False, indent=1)
json.dump(dbg, open(os.path.join(S, 'dbg.json'), 'w'))
from collections import Counter
n = len(votes); ag = sum(v['agrees'] for v in votes); ap = sum(v['agrees'] and v['confidence'] >= 0.95 for v in votes)
print('calibration windows', len(cal))
print('spans', n, 'agree', ag, 'approved (agree & conf>=0.95)', ap, 'rejected', n - ap)
print('by tier (agree, approved):', {t: (sum(1 for d in dbg if d['tier'] == t), sum(d['agrees'] for d in dbg if d['tier'] == t), sum(d['agrees'] and d['conf'] >= 0.95 for d in dbg if d['tier'] == t)) for t in 'ABCD'})
print('my answer none:', sum(1 for d in dbg if d['my'] is None), '; outside keyed Shabad:', sum(1 for d in dbg if d['in_sh'] is False), '; same-Shabad other pangti:', sum(1 for d in dbg if d['in_sh'] and not d['agrees']))
print('conf hist:', sorted(Counter(d['conf'] for d in dbg).items()))
