# Verdicts per recording from the per-window hearing audit (win/*.json) -> audit.json + report tables.
import json, glob, os, sys, re
import numpy as np
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import verse, sh_verses, norm
from rapidfuzz import fuzz

M, T, SPAN, FRAC, MINU = 10, 70, 20, 0.6, 6   # calibrated: 0 flags on kbv1 / Paath / Akhand Paath (see report)
LONG = 60                                      # >= 60 s of another Shabad = suspect wrong key; 20-60 s = parmaan-length
TSHIFT, TGAIN, TLINES = 3.0, 5.0, 4            # timing: |shift| >= 3 s, curve gain >= 5 points, >= 4 keyed pangtis
SIMRAN = re.compile('ਵਾਹਿਗੁਰ')

def mmss(t): t = max(0, int(round(t))); return f'{t // 60}:{t % 60:02d}'
def best_line(s, h):
    return max(sorted(sh_verses[s]), key=lambda v: fuzz.partial_ratio(h, norm(verse[v]['text'])))
def first_line(s):
    return verse[sorted(sh_verses[s])[0]]['text'] if s in sh_verses else str(s)

def spans(W):
    ws = [w for w in W if w['key']]
    out = []
    for w in ws:
        win = [x for x in ws if w['t'] <= x['t'] < w['t'] + SPAN]
        us = [x for x in win if 'O' in x and x.get('K') is not None]
        if len(us) < MINU: continue
        con = [x for x in us if 'Ys' in x and x['Ys'] - x['K'] >= M and x['Ys'] >= T]
        if not con: continue
        y, cnt = Counter(x['Y'] for x in con).most_common(1)[0]
        if cnt >= FRAC * len(win): out.append([w['t'] - 10, w['t'] + SPAN - 2, y])
    m = []
    for a, b, y in out:
        if m and a <= m[-1][1] and m[-1][2] == y: m[-1][1] = max(m[-1][1], b)
        else: m.append([a, b, y])
    return m

def quiet_spans(W, segs):
    """keyed stretches >= 30 s with no Gurbani heard (silence, music, talk/katha), at the start or end of a keyed segment"""
    out = []
    for a, b, ids, raw in segs:
        ws = [w for w in W if a + 10 <= w['t'] <= b]
        if not ws: continue
        bad = [w['cov'] >= 0.7 and (('O' not in w) or w['O'] < 55) for w in ws]
        # leading run
        i = 0
        while i < len(bad) and bad[i]: i += 1
        if i and ws[i - 1]['t'] - a >= 30: out.append(('start', a, ws[i - 1]['t'], ids))
        j = len(bad)
        while j > 0 and bad[j - 1]: j -= 1
        if j < len(bad) and b - (ws[j]['t'] - 10) >= 30 and j > 0: out.append(('end', ws[j]['t'] - 10, b, ids))
    return out

def simran_spans(W):
    ws = [w for w in W if w['key']]
    flag = [len(SIMRAN.findall(w['txt'])) >= 2 for w in ws]
    out = []; i = 0
    while i < len(ws):
        if flag[i]:
            j = i
            while j + 1 < len(ws) and (flag[j + 1] or (j + 2 < len(ws) and flag[j + 2])): j += 1
            if ws[j]['t'] - ws[i]['t'] + 10 >= 20: out.append((ws[i]['t'] - 10, ws[j]['t']))
            i = j + 1
        else: i += 1
    return out

def consistency(d):
    """lines.csv pangtis whose Shabad is not the Shabad keyed in shabads.csv at that time (the two key files disagree)"""
    bad = []
    for v, a, b in d['lines']:
        if v not in verse: continue
        vs = set(verse[v].get('shabadIds') or [verse[v]['shabadId']])
        c = (a + b) / 2
        keyed = set(); any_seg = False
        for sa, sb, ids, raw in d['segs']:
            if sa <= c <= sb: keyed |= set(ids); any_seg = True
        if any_seg and keyed and not (vs & keyed): bad.append((a, b, v))
    return bad

S0 = os.path.dirname(os.path.abspath(__file__))
LINE_PAGE = set()
for _f in glob.glob(os.path.expanduser('~/personal/sttm-ws3/research/gab-ui/site/timeline/v905*.json')):
    for _c in json.load(open(_f))['clips']:
        if _c['basis']: LINE_PAGE.add(_c['id'])
TLK = {k: set(v) for k, v in json.load(open(os.path.join(S0, 'tlkeyed.json'))).items()}

def covfrac(cov, a, b):
    got = 0.0
    for x, y in cov:
        got += max(0.0, min(b, y) - max(a, x))
    return min(1.0, got / (b - a))

def judge(d):
    tk = json.load(open(os.path.join(S0, 'tok', d['id'] + '.json')))
    cov = tk['cov']
    hf_keyed = sum(sb - sa for sa, sb, _, _ in d['segs'])
    tlk = TLK.get(d['id'], set())
    # what the page shows: keyed only where the published timeline has an answer key (end overrides applied)
    W = [dict(w, key=(w['key'] if int(w['t'] - 5) in tlk else []), cov=covfrac(cov, w['t'] - 10, w['t'])) for w in d['W']]
    segs = []
    for sa, sb, ids, raw in d['segs']:
        ts = [t for t in tlk if sa <= t < sb]
        if ts: segs.append((float(min(ts)), float(max(ts) + 1), ids, raw))
    keyed = [w for w in W if w['key']]
    us = [w for w in keyed if 'O' in w and w.get('K') is not None]
    support = float(np.mean([w['K'] >= w['O'] - 2 for w in us])) if us else None
    strong = float(np.mean([w['K'] >= 70 for w in us])) if us else None
    keyed_sh = {s for _, _, ids, _ in segs for s in ids}
    flags = []
    sim = simran_spans(W)
    for a, b, y in spans(W):
        ws = [w for w in W if a + 10 <= w['t'] <= b and w.get('Y') == y and w.get('K') is not None]
        mid = max(ws, key=lambda w: w['Ys'] - w['K'])
        heard_line = verse[best_line(y, mid['txt'])]['text']
        key_ids = mid['key']
        f = {'from': a, 'to': b, 'dur': b - a, 'heard_shabad': y, 'heard_pangti': heard_line, 'heard_raw': mid['txt'],
             'key_shabad': key_ids, 'key_first_pangti': first_line(key_ids[0]) if key_ids else None,
             'heard_score': round(float(np.mean([w['Ys'] for w in ws])), 1), 'key_score': round(float(np.mean([w['K'] for w in ws])), 1)}
        f['margin'] = round(f['heard_score'] - f['key_score'], 1)
        con = [w for w in ws if w['Ys'] - w['K'] >= M]
        on, off = min(w['t'] for w in con) - 7, max(w['t'] for w in con) - 3   # first / last contradicting window centre
        f['heard_from'], f['heard_to'] = on, off
        seg = next(((sa, sb) for sa, sb, ids, raw in segs if sa - 10 <= (on + off) / 2 <= sb + 10), None)
        is_simran = any(sa <= (a + b) / 2 <= sb for sa, sb in sim) or len(SIMRAN.findall(''.join(w['txt'] for w in ws))) >= len(ws)
        if is_simran:
            f['kind'] = 'simran'
        elif seg and off >= seg[1] - 12 and on > seg[0] + 20:
            f['kind'] = 'end-late'; f['shift_s'] = int(round(seg[1] - on)); f['key_end'] = seg[1]
        elif seg and on <= seg[0] + 12 and off < seg[1] - 20:
            f['kind'] = 'start-early'; f['shift_s'] = int(round(off - seg[0])); f['key_start'] = seg[0]
        elif off - on >= LONG: f['kind'] = 'wrong'
        else: f['kind'] = 'parmaan'
        f['also_keyed_here'] = y in keyed_sh
        flags.append(f)
    for a, b in sim:
        if not any(f['kind'] == 'simran' and f['from'] <= (a + b) / 2 <= f['to'] for f in flags):
            flags.append({'kind': 'simran', 'from': a, 'to': b, 'dur': b - a})
    for where, a, b, ids in quiet_spans(W, segs):
        flags.append({'kind': 'quiet-' + where, 'from': a, 'to': b, 'dur': b - a, 'shift_s': int(b - a), 'key_shabad': ids})
    line_page = d['id'] in LINE_PAGE
    tm = d['timing']; timing = None
    if tm:
        c = np.array(tm['curve']); sh = np.array(tm['shifts']); k = int(np.argmax(c)); z = int(np.where(sh == 0)[0][0])
        timing = {'best_shift_s': float(sh[k]), 'gain': round(float(c[k] - c[z]), 1), 'sim_at_0': round(float(c[z]), 1),
                  'null': tm['null'], 'lines': tm['nlines']}
        if abs(sh[k]) >= TSHIFT and c[k] - c[z] >= TGAIN and tm['nlines'] >= TLINES and (tm['null'] is None or c[k] - tm['null'] >= 15):
            flags.append({'kind': 'timing', 'shift_s': float(sh[k]), 'gain': timing['gain']})
    inc = consistency(d)
    kinds = {f['kind'] for f in flags}
    if 'wrong' in kinds: v = 'suspect wrong Shabad'
    elif kinds & {'end-late', 'start-early'}: v = 'Shabad start/end off (other Shabad heard)'
    elif 'timing' in kinds and line_page: v = 'pangti timing shift'
    elif 'parmaan' in kinds: v = 'unkeyed parmaan (20-60 s)'
    elif kinds & {'quiet-start', 'quiet-end'}: v = 'key covers lead-in / tail with no Gurbani'
    elif 'simran' in kinds: v = 'key covers simran'
    elif support is None or support < 0.25: v = 'weak evidence'
    else: v = 'ok'
    return {'id': d['id'], 'tier': d['tier'], 'dur': d['dur'], 'keyed_s': sum(sb - sa for sa, sb, _, _ in segs), 'hf_keyed_s': hf_keyed,
            'windows': len(keyed), 'usable': len(us), 'support': None if support is None else round(support, 2),
            'strong': None if strong is None else round(strong, 2), 'cache_coverage': round(d['coverage'], 2),
            'verdict': v, 'page_shows_pangtis': line_page, 'flags': flags, 'timing': timing, 'lines_vs_shabads_mismatch': len(inc), 'lines_n': len(d['lines'])}

if __name__ == '__main__':
    S = os.path.dirname(os.path.abspath(__file__))
    rows = [judge(json.load(open(f))) for f in sorted(glob.glob(os.path.join(S, 'win', '*.json')))]
    json.dump(rows, open(os.path.join(S, 'verdicts.json'), 'w'), ensure_ascii=False, indent=1)
    base = [r for r in rows if not r['id'].endswith(('_c33', '_c66'))]
    for t in ['main', 'kbv1', 'akhand', 'sungbani', 'paath', 'akhandpaath']:
        rr = [r for r in base if r['tier'] == t]
        print(t, len(rr), Counter(r['verdict'] for r in rr).most_common())
