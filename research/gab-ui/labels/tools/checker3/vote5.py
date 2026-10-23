# Checker 3 of 3, label batch 5 (Kirtan, folder 1, 25-40% coverage), lens C (structure). Per recording: hear every
# candidate span from the cached x86 speech-model output (tok5/, decode.py, no model run), identify the pangti myself
# (all pangtis of every keyed Shabad incl. parmaans + corpus competitors + 'none'), then check the recording-level
# picture: Shabad order with plausible kirtan returns, plausible durations, overlaps between candidates, conflicts with
# the existing key, simran / alaap = none. Confidence calibrated on windows cut from the Karanbir v1 human pangti keys
# (calib.py batch 2 + calib4.py short windows), then capped by the structural checks. Only after that: compare with
# the candidate's verseId.
# Batch 5 changes vs vote3.py (batch 2): (1) calibrated floor at 10 heard chars (calib4.json: in-Shabad picks with
# 10-15 heard chars, in-Shabad margin >= 15, explain >= 60, corpus margin >= 0 are right 100%, n=281, 90% lower bound
# 0.994; at >= 16 chars, margin >= 10, explain >= 60: 100%, n=269); (2) a span under 2.5 s is a fragment UNLESS most of
# the pangti's text was heard inside it (brisk kirtan of short pangtis, rn23: 4-word pangtis sung in 2.2 s, in Shabad
# order); (3) two keyed Shabads holding near-identical pangtis (clip40: SGGS 'ਸਿਰੁ ਦੀਜੈ ਕਾਣਿ ਨ ਕੀਜੈ' vs Bhai Gurdas
# 'ਸਿਰੁ ਦੀਜੈ ਕਾਣ ਨ ਕੀਜੈ') tie on hearing: the copy is settled only by confident neighbours of the same Shabad within
# 20 s, capped 0.95, else 0.85 (a person decides).
import json, os, sys, math, csv, collections
os.environ.setdefault('TOKDIR', 'tok5')
from lib3 import *
VAH4 = norm('ਵਾਹਿ')
BATCH = sys.argv[1] if len(sys.argv) > 1 else 'batch5'
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{GAB}/labels/votes/{BATCH}-checker3.json'

def calibrated(L, m_in, s1, m_out):
    """confidence for an in-Shabad pick, reported BELOW the measured rate (strict)."""
    if L >= 16 and m_in >= 15 and s1 >= 70 and m_out >= 5: return 0.97
    if L >= 16 and m_in >= 10 and s1 >= 60 and m_out >= 0: return 0.96
    if L >= 10 and m_in >= 15 and s1 >= 60 and m_out >= 0: return 0.95
    if L >= 10 and m_in >= 5 and s1 >= 50: return 0.9
    return 0.85

def lev(a, b):
    if abs(len(a) - len(b)) > 3: return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]

cands_all = json.load(open(f'{GAB}/labels/candidates/{BATCH}.json'))
by_rec = collections.OrderedDict()
for c in cands_all: by_rec.setdefault(c['recording'], []).append(c)
votes = {}; dbg = []
def is_rahao(v): return 'ਰਹਾਉ' in verse[v]['text']
def is_title(v):
    t = verse[v]['text']
    return len(t.split()) <= 7 and bool(re.search(r'(ਮਹਲਾ|ਮਃ)\s*[੧-੯]|^(ਰਾਗੁ|ਸਲੋਕੁ|ਸਲੋਕ|ਪਉੜੀ|ਛੰਤ|ਅਸਟਪਦੀ|ਸੋਲਹੇ|ਪੜਤਾਲ)\b|^ੴ', t))

for rec, cs in by_rec.items():
    cs = sorted(cs, key=lambda c: (c['start_s'], c['end_s']))
    shab, klines = key_rows(cs[0]['folder'], rec)
    sids = []
    for s, _, _ in shab:
        for x in s.split('|'):
            if int(x) not in sids: sids.append(int(x))
    order = {}
    for s in sids:
        for i, v in enumerate(sh_verses.get(s, [])): order.setdefault(v, (s, i))
    rahao = {v for v in order if is_rahao(v)}
    asthai = {}
    for s in sids:
        vs = sh_verses.get(s, []); nt = [v for v in vs if not is_title(v)]
        asthai[s] = set(v for v in vs if is_rahao(v)) or (set(nt[:1]) if nt else set())
    named = [c['verseId'] for c in cs]
    # pass 1: hear + identify
    pick = []
    for c in cs:
        a, b = c['start_s'], c['end_s']
        h, raw, cov = heard(rec, a, b)
        d = decide(h, sids, named) if len(h) else None
        svs = [v for s_ in sids for v in sh_verses.get(s_, [])]
        if d:
            ranked, scores = d['ranked'], d['scores']; top = d['my']; s1 = d['s1']; m_in = d['m_in']; m_out = d['m_out']; ins = d['in_shabad']
            sec = next((v for v in ranked if vtext[v] != vtext[top]), None); s2 = scores[sec] if sec else 0.0
        else:
            ranked, scores, top, sec, s1, s2, m_in, m_out, ins = [], {}, None, None, 0.0, 0.0, 0.0, 0.0, False
        pick.append(dict(h=h, raw=raw, cov=cov, ranked=ranked, scores=scores, svs=svs, top=top, sec=sec, s1=s1, s2=s2, m=m_in, m_in=m_in, m_out=m_out, ins=ins, twin=None))
    # near-identical pangtis held by two different keyed Shabads (a parmaan quoted in a Vaar, the same salok in two
    # places): the hearing cannot separate them (in-Shabad margin ~0). Re-measure the margin against pangtis of
    # genuinely different text; the copy is settled later by neighbours.
    for p in pick:
        if p['top'] is None or not p['ins'] or p['m_in'] >= 5: continue
        top = p['top']; svs_set = set(p['svs'])
        ins_ranked = [v for v in p['ranked'] if v in svs_set and vtext[v] != vtext[top]]
        if not ins_ranked: continue
        r = ins_ranked[0]
        if lev(vtext[top], vtext[r]) <= 2 and order.get(r, (None,))[0] != order.get(top, (None,))[0]:
            others = [p['scores'][v] for v in ins_ranked if lev(vtext[top], vtext[v]) > 2]
            p['twin'] = r; p['m_in'] = p['m'] = p['s1'] - (max(others) if others else 0.0)
    # empirical asthai: kirtan returns again and again to the line(s) the ragi chose as the asthai (not always the
    # rahao line): the two pangtis my confident picks name most often in this recording
    freq = collections.Counter(p['top'] for p in pick if p['top'] in order and p['s1'] >= 60 and p['m_in'] >= 10 and p['twin'] is None)
    asthai_emp = {v for v, n in freq.most_common(2) if n >= 3}
    def confident(j): return pick[j]['top'] in order and pick[j]['s1'] >= 60 and pick[j]['m_in'] >= 10 and pick[j]['twin'] is None
    # pass 2: decide with structure
    for i, c in enumerate(cs):
        p = pick[i]; a, b = c['start_s'], c['end_s']; dur = b - a
        h, raw, cov, top, sec, s1, s2, m, svs = p['h'], p['raw'], p['cov'], p['top'], p['sec'], p['s1'], p['s2'], p['m'], p['svs']
        # Vaheguru simran: the hearing is mostly 'ਵਾਹਿ(ਗੁਰੂ)' pieces (matras often dropped by the model)
        vah = (h.count(VAH4) * 8 + h.count(norm('ਗੁਰੂ')) * 4) / max(1, len(h))
        notes = []; my = None; conf = 0.6
        if cov < 0.6: conf = 0.6; notes.append(f'cache covers only {cov:.0%} of the span: cannot hear it')
        elif len(h) < 8: conf = 0.7; notes.append(f'almost nothing heard ({len(h)} chars "{raw[:30]}"): alaap, music, simran, pause or hearing failure, not a sung pangti I can confirm')
        elif vah >= 0.4: conf = 0.85; notes.append('heard mostly Vaheguru simran: none')
        elif s1 < 50: conf = 0.7; notes.append(f'no pangti explains the hearing (best {s1:.0f})')
        else:
            my = top
            conf = calibrated(len(h), p['m_in'], s1, p['m_out'])
            notes.append(f'in-Shabad margin {p["m_in"]:.0f}, corpus margin {p["m_out"]:.0f}')
            if cov < 0.9: conf = min(conf, 0.9); notes.append(f'cache covers {cov:.0%}')
            if not p['ins']:
                conf = min(conf, 0.85); notes.append('a pangti outside the keyed Shabad(s) explains the hearing better: a parmaan, another Shabad, or a hearing coincidence; person decides')
            # ---- lens C: structure
            tl = len(vtext[top])
            if p['twin'] is not None:
                tw = p['twin']; s_top = order.get(top, (None,))[0]; s_tw = order.get(tw, (None,))[0]
                near = collections.Counter()
                for j in range(len(cs)):
                    if j != i and confident(j) and min(abs(cs[j]['start_s'] - b), abs(a - cs[j]['end_s'])) < 20:
                        near[order[pick[j]['top']][0]] += 1
                if near[s_top] and not near[s_tw]:
                    conf = min(conf, 0.95); notes.append(f'near-identical pangti {tw} in keyed Shabad {s_tw}; the copy in {s_top} is settled by {near[s_top]} confident neighbour(s) of that Shabad within 20 s')
                elif near[s_tw] and not near[s_top]:
                    my = top = tw; conf = min(conf, 0.95); notes.append(f'near-identical pangti in two keyed Shabads; confident neighbours within 20 s belong to Shabad {s_tw}, so the sung copy is {tw}')
                else:
                    conf = min(conf, 0.85); notes.append(f'near-identical pangti {tw} in keyed Shabad {s_tw}: no neighbour settles which copy is sung; person decides')
            if dur < 1.8: conf = min(conf, 0.9); notes.append(f'{dur:.1f} s is too short for a sung pangti (fragment)')
            elif dur < 2.5 and not (len(h) >= 0.6 * tl and s1 >= 80): conf = min(conf, 0.9); notes.append(f'{dur:.1f} s is too short for a sung pangti (fragment: {len(h)} of {tl} chars heard)')
            elif dur < 2.5: notes.append(f'brisk: {len(h)} of {tl} chars of the pangti heard inside {dur:.1f} s')
            if dur > 60: conf = min(conf, 0.9); notes.append(f'{dur:.0f} s is implausibly long for one pangti')
            if dur > 8 and len(h) / dur < 1.2: conf = min(conf, 0.9); notes.append(f'only {len(h)} chars heard over {dur:.0f} s: most of the span is unheard (alaap / sangat / simran), cannot confirm the pangti is sung throughout')
            if p['m_out'] < 3:
                near = any(confident(j) and pick[j]['top'] != my
                           and order[pick[j]['top']][0] == order.get(my, (None,))[0]
                           and min(abs(cs[j]['start_s'] - b), abs(a - cs[j]['end_s'])) < 30 for j in range(len(cs)) if j != i)
                if not near: conf = min(conf, 0.94); notes.append(f'a corpus pangti of different text explains the hearing as well (corpus margin {p["m_out"]:.0f}) and no confident neighbour from the same Shabad within 30 s supports it')
            # the key row(s) of the Shabad my pick belongs to (a recording may hold several keyed Shabads)
            my_sids = {s_ for s_ in sids if my in sh_verses.get(s_, [])}
            srow = [(x, y) for s, x, y in shab if any(str(s_) in s.split('|') for s_ in my_sids)]
            if srow and not any(x - 3 <= a and b <= y + 3 for x, y in srow):
                conf = min(conf, 0.85); notes.append('span lies outside the keyed Shabad row')
            if is_title(my) and (s1 < 85 or p['m_in'] < 25 or p['m_out'] < 10): conf = min(conf, 0.9); notes.append('title line rarely sung; needs strong evidence')
            # existing key conflict
            for v, x, y, cf, src in klines:
                ov = min(b, y) - max(a, x)
                if ov > 0.5 * dur and cf >= 0.9 and vtext[v] != vtext[my]:
                    conf = min(conf, 0.9); notes.append(f'existing key has {v} here at conf {cf}'); break
            # overlap with a neighbouring candidate naming a different pangti (the two models disagree about this time)
            strong = s1 >= 75 and p['m_in'] >= 20 and p['m_out'] >= 5
            for j, d in enumerate(cs):
                if j == i: continue
                ov = min(b, d['end_s']) - max(a, d['start_s'])
                if ov > 1.5 and vtext.get(d['verseId']) != vtext[my] and not strong:
                    conf = min(conf, 0.93); notes.append(f'overlaps {ov:.1f} s with a candidate naming {d["verseId"]}'); break
            # sequence: previous confident pick within 40 s
            if my in order:
                s_my, k_my = order[my]
                prev = None
                for j in range(i - 1, -1, -1):
                    if confident(j) and a - cs[j]['end_s'] < 40: prev = pick[j]['top']; break
                if prev is not None and prev != my:
                    s_p, k_p = order[prev]
                    ok = (s_p == s_my and abs(k_p - k_my) <= 2) or my in rahao or my in asthai.get(s_my, ()) or my in asthai_emp \
                         or prev in rahao or prev in asthai.get(s_p, ()) or prev in asthai_emp or is_title(prev) or k_my == 1
                    if not ok and not (s1 >= 85 and p['m_in'] >= 25 and p['m_out'] >= 10):
                        conf = min(conf, 0.9); notes.append(f'out of Shabad order: previous pangti {prev} (#{k_p}) -> {my} (#{k_my}) is not a plausible kirtan move')
        conf = round(min(0.98, conf), 2)
        # only now: compare with the candidate
        cv = c['verseId']
        agrees = my is not None and (my == cv or (vtext.get(my) == vtext.get(cv) and cv in svs))
        if agrees and my != cv: my = cv
        cs_ = p['scores'].get(cv, explain(h, vtext.get(cv, '')) if h else 0.0)
        reason = (f'heard "{raw[:70]}" ({len(h)} chars, cache {cov:.0%}, {dur:.1f} s); ' +
                  (f'my pick {top} "{verse[top]["text"][:36]}" explains {s1:.0f}, runner-up {sec} "{verse[sec]["text"][:24] if sec else ""}" {s2:.0f}; ' if top else '') +
                  f'candidate {cv} "{verse[cv]["text"][:30]}" explains {cs_:.0f}; ' + '; '.join(notes))
        key = (rec, cv, round(a, 2), round(b, 2))
        votes[key] = dict(recording=rec, cand_verseId=cv, start_s=a, end_s=b, my_verseId=my, confidence=conf, agrees=bool(agrees), reason=reason)
        dbg.append(dict(rec=rec, a=a, tier=c['evidence']['tier'], inkey=c['evidence']['in_current_key'], s1=round(s1), m=round(m), L=len(h), conf=conf, agrees=bool(agrees), my=my, cv=cv, notes=notes))
out = [votes[(c['recording'], c['verseId'], round(c['start_s'], 2), round(c['end_s'], 2))] for c in cands_all]
assert len(out) == len(cands_all)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
json.dump(dbg, open(os.path.join(S, f'dbg-{BATCH}.json'), 'w'), ensure_ascii=False)
n = len(out); ag = sum(v['agrees'] for v in out); ap = sum(v['agrees'] and v['confidence'] >= 0.95 for v in out)
print('spans', n, 'agree', ag, 'approved (agree & conf>=0.95)', ap, 'rejected', n - ap)
for t in 'ABCD':
    xs = [d for d in dbg if d['tier'] == t]
    print(f'tier {t}: n={len(xs)} agree={sum(d["agrees"] for d in xs)} approved={sum(d["agrees"] and d["conf"] >= 0.95 for d in xs)}')
print('in current key:', sum(1 for d in dbg if d['inkey']), 'approved of those', sum(1 for d in dbg if d['inkey'] and d['agrees'] and d['conf'] >= 0.95))
print('none:', sum(1 for d in dbg if d['my'] is None), 'other pangti:', sum(1 for d in dbg if d['my'] is not None and not d['agrees']))
print('conf hist:', sorted(collections.Counter(d['conf'] for d in dbg).items()))
cnt = collections.Counter(n_.split(':')[0].split(' (')[0] for d in dbg for n_ in d['notes'][1:] if d['agrees'] and d['conf'] < 0.95)
print('why agree-but-rejected (structural notes):', cnt.most_common(12))
print('agree-but-rejected on calibration alone:', sum(1 for d in dbg if d['agrees'] and d['conf'] < 0.95 and len(d['notes']) == 1))
for rec in by_rec:
    xs = [d for d in dbg if d['rec'] == rec]
    print(f'  {rec:8s} n={len(xs):3d} approved={sum(d["agrees"] and d["conf"] >= 0.95 for d in xs):3d} agree={sum(d["agrees"] for d in xs):3d} none={sum(d["my"] is None for d in xs):3d} other={sum(d["my"] is not None and not d["agrees"] for d in xs):3d}')
