# Checker 3 of 3, label batch 4 (Paath + Sung Bani), lens C (structure). Per recording: hear every candidate span
# from the cached speech-model output (x86 q16 decode, Mac q16 fills the gaps; no model run), identify the pangti
# myself among every pangti of the keyed Bani / Shabads (bani-verse-cache.json) + corpus competitors + 'none', then
# check the recording-level picture. Paath = reading in Bani order: a pick must sit in sequence with its confident
# neighbours (a repeat or a step back of <= 2 and a skip of <= 3 lines are plausible), durations plausible for the
# text, headers may be read aloud. Sung Bani = kirtan rules from batch 2/3 (returns to the asthai, alaap / simran =
# none, heard density, overlaps, row and key consistency). Confidence calibrated on Karanbir v1 human keys
# (calib4.py: short spans too), capped by the structural checks; the candidate's verseId is compared LAST.
import json, os, sys, collections, re
from lib4 import *
VAH4 = norm('ਵਾਹਿ')
BATCH = sys.argv[1] if len(sys.argv) > 1 else 'batch4'
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{GAB}/labels/votes/{BATCH}-checker3.json'

# calib4.py (kbv1 human keys, in-Shabad picks): L 8-10 & m_in>=5 & s1>=60: 100% (n=207); L 10-13 & m_in>=10 &
# s1>=60: 100% (n=219); L 13-16 & m_in>=5 & s1>=60: 100% (n=143); L>=16 & m_in>=5 & s1>=60: 100% (n=270);
# L 5-8 at best 97% (n=428) -> never above 0.9; picks outside the keyed Shabad were wrong every time (609).
# Reported below the measured rate; the Bani pools here are far larger (Jaap Sahib 808 pangtis, many near-identical)
# so the in-Bani margin matters more than in kbv1: m_in >= 10 required for anything above 0.95.
def calibrated(L, m_in, s1, m_out):
    if L >= 16 and m_in >= 15 and s1 >= 70 and m_out >= 5: return 0.97
    if L >= 13 and m_in >= 10 and s1 >= 60 and m_out >= 0: return 0.96
    if L >= 8 and m_in >= 10 and s1 >= 60 and m_out >= 0: return 0.95
    if L >= 8 and m_in >= 5 and s1 >= 60: return 0.9
    if L >= 8 and m_in >= 3 and s1 >= 50: return 0.85
    return 0.8

cands_all = json.load(open(f'{GAB}/labels/candidates/{BATCH}.json'))
by_rec = collections.OrderedDict()
for c in cands_all: by_rec.setdefault(c['recording'], []).append(c)
votes = {}; dbg = []
HEAD = re.compile(r'(ਮਹਲਾ|ਮਃ)\s*[੧-੯]|^(ਰਾਗੁ|ਸਲੋਕੁ|ਸਲੋਕ|ਪਉੜੀ|ਛੰਤ|ਅਸਟਪਦੀ|ਸੋਲਹੇ|ਪੜਤਾਲ|ਸਵੈਯਾ|ਦੋਹਰਾ|ਚੌਪਈ|ਚਉਪਈ|ਕਬਿੱਤ|ਕਬਿਤ|ਸੋਰਠਾ|ਧੰਨਾ|ਪ੍ਰਭਾਤੀ|ਇਤਿ)\b|^ੴ|ਛੰਦ\s*॥?\s*$|^॥\s*ਜਪੁ')
def is_rahao(v): return 'ਰਹਾਉ' in verse[v]['text']
def is_title(v):
    t = verse[v]['text']
    return len(t.split()) <= 7 and bool(HEAD.search(t))

for rec, cs in by_rec.items():
    cs = sorted(cs, key=lambda c: (c['start_s'], c['end_s']))
    cat = cs[0]['category']; paath = cat == 'Paath'
    shab, klines = key_rows4(cs[0]['folder'], rec)
    sids = []
    for s in sids_of(shab) + [x for c in cs for x in sid_of(c['shabadId'])]:
        if s not in sids: sids.append(s)
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
        h, raw, cov = heard4(rec, a, b)
        d = decide(h, sids, named) if len(h) else None
        if d:
            ranked, scores = d['ranked'], d['scores']; top = d['my']; s1 = d['s1']; m_in = d['m_in']; m_out = d['m_out']; ins = d['in_shabad']
            sec = next((v for v in ranked if vtext[v] != vtext[top]), None); s2 = scores[sec] if sec else 0.0
        else:
            ranked, scores, top, sec, s1, s2, m_in, m_out, ins = [], {}, None, None, 0.0, 0.0, 0.0, 0.0, False
        pick.append(dict(h=h, raw=raw, cov=cov, ranked=ranked, scores=scores, top=top, sec=sec, s1=s1, s2=s2, m_in=m_in, m_out=m_out, ins=ins))
    def confident(j): return pick[j]['top'] in order and pick[j]['s1'] >= 60 and pick[j]['m_in'] >= 10 and pick[j]['ins'] and len(pick[j]['h']) >= 8 and pick[j]['cov'] >= 0.6
    freq = collections.Counter(pick[j]['top'] for j in range(len(cs)) if confident(j))
    asthai_emp = {v for v, n in freq.most_common(2) if n >= 3}
    # pass 2: structure
    for i, c in enumerate(cs):
        p = pick[i]; a, b = c['start_s'], c['end_s']; dur = b - a
        h, raw, cov, top, sec, s1, s2 = p['h'], p['raw'], p['cov'], p['top'], p['sec'], p['s1'], p['s2']
        vah = (h.count(VAH4) * 8 + h.count(norm('ਗੁਰੂ')) * 4) / max(1, len(h))
        notes = []; my = None; conf = 0.6
        if cov < 0.6: conf = 0.6; notes.append(f'cache covers only {cov:.0%} of the span: cannot hear it')
        elif len(h) < 8: conf = 0.7; notes.append(f'almost nothing heard ({len(h)} chars "{raw[:30]}"): a header, alaap, music, simran, pause or hearing failure, not a pangti I can confirm')
        elif vah >= 0.4: conf = 0.85; notes.append('heard mostly Vaheguru simran: none')
        elif s1 < 50: conf = 0.7; notes.append(f'no pangti explains the hearing (best {s1:.0f})')
        else:
            my = top
            conf = calibrated(len(h), p['m_in'], s1, p['m_out'])
            notes.append(f'heard {len(h)} chars, in-Bani margin {p["m_in"]:.0f}, corpus margin {p["m_out"]:.0f}')
            if cov < 0.9: conf = min(conf, 0.9); notes.append(f'cache covers {cov:.0%}')
            if not p['ins']:
                conf = min(conf, 0.85); notes.append('a pangti outside the keyed Bani / Shabad explains the hearing better (parmaan, another Shabad, or a hearing coincidence); the Shabad-level key does not support it; person decides')
            tl = len(vtext[my])
            # ---- lens C: structure
            if paath:
                rate = tl / max(0.1, dur)
                if dur < 0.5 or dur > 20: conf = min(conf, 0.85); notes.append(f'{dur:.1f} s is not a plausible reading time for one pangti')
                elif rate > 30 or rate < 1.5: conf = min(conf, 0.9); notes.append(f'{tl} text chars over {dur:.1f} s is not a plausible reading rate')
                tail = explain(h, vtext[my][-max(12, tl // 3):]) if len(h) < 0.5 * tl else 0.0
                if len(h) < 0.3 * tl and tail < 60: conf = min(conf, 0.9); notes.append(f'only {len(h)} of ~{tl} chars heard: the span holds a small part of the pangti')
                elif len(h) < 0.3 * tl: conf = min(conf, 0.95); notes.append(f'only {len(h)} of ~{tl} chars heard but it is the end of the pangti (tail explains {tail:.0f}): the reading finishes inside the span, a late start, not an identity doubt')
                elif len(h) < 0.5 * tl: conf = min(conf, 0.95); notes.append(f'only {len(h)} of ~{tl} chars heard: the span does not hold the whole pangti (timing, not identity)')
                # sequence: confident neighbours within 6 s must be Bani neighbours (repeat / step back <= 2 / skip <= 3)
                if my in order:
                    s_my, k_my = order[my]; support = 0; contra = []
                    for j in range(len(cs)):
                        if j == i or not confident(j) or pick[j]['top'] == my: continue
                        gap = max(cs[j]['start_s'] - b, a - cs[j]['end_s'])
                        if gap > 6: continue
                        s_j, k_j = order[pick[j]['top']]
                        if s_j != s_my: contra.append((pick[j]['top'], 'other Shabad')); continue
                        delta = (k_my - k_j) if cs[j]['start_s'] < a else (k_j - k_my)
                        if -2 <= delta <= 3: support += 1
                        elif delta > 3 and (delta - 1) * 0.5 <= gap + 1.0: pass  # several short lines fit the time: neutral
                        else: contra.append((pick[j]['top'], f'{delta:+d} lines in {gap:.1f} s'))
                    if contra:
                        conf = min(conf, 0.85); notes.append('out of Bani order with a confident neighbour: ' + ', '.join(f'{v} ({w})' for v, w in contra[:3]))
                    elif support == 0:
                        conf = min(conf, 0.9); notes.append('no confident neighbouring pangti within 6 s supports the sequence (isolated)')
                    elif support == 1 and conf > 0.95: conf = 0.95
                if is_title(my) and conf > 0.9 and (s1 < 85 or p['m_in'] < 25): conf = 0.9; notes.append('header line: needs strong evidence')
            else:
                if dur < 1.5: conf = min(conf, 0.9); notes.append(f'{dur:.1f} s is too short for a sung pangti (fragment)')
                elif dur < 2.5: conf = min(conf, 0.95); notes.append(f'{dur:.1f} s is brisk for a sung pangti (Aarti is often sung fast; fragment possible)')
                if dur > 60: conf = min(conf, 0.9); notes.append(f'{dur:.0f} s is implausibly long for one pangti')
                if dur > 8 and len(h) / dur < 1.2: conf = min(conf, 0.9); notes.append(f'only {len(h)} chars heard over {dur:.0f} s: most of the span is unheard (alaap / sangat / simran), cannot confirm the pangti is sung throughout')
                if p['m_out'] < 3:
                    near = any(confident(j) and pick[j]['top'] != my and order[pick[j]['top']][0] == order.get(my, (None,))[0]
                               and min(abs(cs[j]['start_s'] - b), abs(a - cs[j]['end_s'])) < 30 for j in range(len(cs)) if j != i)
                    if not near: conf = min(conf, 0.94); notes.append(f'a corpus pangti of different text explains the hearing as well (corpus margin {p["m_out"]:.0f}) and no confident neighbour from the same Shabad within 30 s supports it')
                if is_title(my) and (s1 < 85 or p['m_in'] < 25 or p['m_out'] < 10): conf = min(conf, 0.9); notes.append('title line rarely sung; needs strong evidence')
                strong = s1 >= 75 and p['m_in'] >= 20 and p['m_out'] >= 5
                for j, d in enumerate(cs):
                    if j == i: continue
                    ov = min(b, d['end_s']) - max(a, d['start_s'])
                    if ov > 1.5 and vtext.get(d['verseId']) != vtext[my]:
                        if pick[j]['top'] == my or (pick[j]['top'] is not None and vtext.get(pick[j]['top']) == vtext[my]): continue  # I hear my pangti there too
                        if confident(j) and pick[j]['top'] != my:
                            conf = min(conf, 0.9); notes.append(f'overlaps {ov:.1f} s with a candidate naming {d["verseId"]} where I hear {pick[j]["top"]}: conflicting hearing'); break
                        if not strong:
                            conf = min(conf, 0.95); notes.append(f'overlaps {ov:.1f} s with a candidate naming {d["verseId"]} (the two aligners disagree here; my hearing of that span is weak)'); break
                if my in order:
                    s_my, k_my = order[my]; prev = nxt = None
                    for j in range(i - 1, -1, -1):
                        if confident(j) and pick[j]['top'] != my and a - cs[j]['end_s'] < 40: prev = pick[j]['top']; break
                    for j in range(i + 1, len(cs)):
                        if confident(j) and pick[j]['top'] != my and cs[j]['start_s'] - b < 40: nxt = pick[j]['top']; break
                    vs_my = sh_verses.get(s_my, [])
                    comp_start = k_my >= 1 and is_title(vs_my[k_my - 1])  # first pangti after a header inside the Bani
                    def fits(nb, sign):
                        s_n, k_n = order[nb]
                        return (s_n == s_my and -2 <= sign * (k_my - k_n) <= 3) or my in rahao or my in asthai.get(s_my, ()) or my in asthai_emp \
                               or nb in rahao or nb in asthai.get(s_n, ()) or nb in asthai_emp or is_title(nb) or k_my == 1 or comp_start
                    if prev is not None or nxt is not None:
                        ok = (prev is not None and fits(prev, 1)) or (nxt is not None and fits(nxt, -1))
                        if not ok and not (s1 >= 85 and p['m_in'] >= 25 and p['m_out'] >= 10):
                            conf = min(conf, 0.9); notes.append(f'out of order: neither the previous confident pangti {prev} (#{order[prev][1] if prev else "-"}) nor the next {nxt} (#{order[nxt][1] if nxt else "-"}) makes {my} (#{k_my}) a plausible kirtan move')
            # the key row(s) of the Bani / Shabad my pick belongs to
            my_sids = {s_ for s_ in sids if my in sh_verses.get(s_, [])}
            srow = [(x, y) for s, x, y in shab if any(s_ in sid_of(s) for s_ in my_sids)]
            if not srow: conf = min(conf, 0.85); notes.append('the pangti belongs to no Bani / Shabad in the existing key (key mismatch)')
            elif not any(x - 3 <= a and b <= y + 3 for x, y in srow): conf = min(conf, 0.85); notes.append('span lies outside the keyed row of its Bani / Shabad')
            for v, x, y, cf, src in klines:
                ov = min(b, y) - max(a, x)
                if ov > 0.5 * dur and cf >= 0.9 and vtext[v] != vtext[my]:
                    conf = min(conf, 0.9); notes.append(f'existing key has {v} here at conf {cf}'); break
        conf = round(min(0.98, conf), 2)
        # only now: compare with the candidate
        cv = c['verseId']
        svs = [v for s_ in sids for v in sh_verses.get(s_, [])]
        agrees = my is not None and (my == cv or (vtext.get(my) == vtext.get(cv) and cv in svs))
        if agrees and my != cv: my = cv
        cs_ = p['scores'].get(cv, explain(h, vtext.get(cv, '')) if h else 0.0)
        reason = (f'heard "{raw[:70]}" ({len(h)} chars, cache {cov:.0%}, {dur:.1f} s); ' +
                  (f'my pick {top} "{verse[top]["text"][:36]}" explains {s1:.0f}, runner-up {sec} "{verse[sec]["text"][:24] if sec else ""}" {s2:.0f}; ' if top else '') +
                  f'candidate {cv} "{verse[cv]["text"][:30]}" explains {cs_:.0f}; ' + '; '.join(notes))
        key = (rec, cv, round(a, 2), round(b, 2))
        votes[key] = dict(recording=rec, cand_verseId=cv, start_s=a, end_s=b, my_verseId=my, confidence=conf, agrees=bool(agrees), reason=reason)
        dbg.append(dict(rec=rec, cat=cat, a=a, b=b, tier=c['evidence']['tier'], inkey=c['evidence']['in_current_key'], s1=round(s1), m=round(p['m_in']), mo=round(p['m_out']), L=len(h), conf=conf, agrees=bool(agrees), my=my, cv=cv, raw=raw[:50], notes=notes))
out = [votes[(c['recording'], c['verseId'], round(c['start_s'], 2), round(c['end_s'], 2))] for c in cands_all]
assert len(out) == len(cands_all)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
json.dump(dbg, open(os.path.join(S, f'dbg-{BATCH}.json'), 'w'), ensure_ascii=False, indent=0)
n = len(out); ag = sum(v['agrees'] for v in out); ap = sum(v['agrees'] and v['confidence'] >= 0.95 for v in out)
print('spans', n, 'agree', ag, 'approved (agree & conf>=0.95)', ap, 'rejected', n - ap)
for t in 'ABCD':
    xs = [d for d in dbg if d['tier'] == t]
    print(f'tier {t}: n={len(xs)} agree={sum(d["agrees"] for d in xs)} approved={sum(d["agrees"] and d["conf"] >= 0.95 for d in xs)}')
print('none:', sum(1 for d in dbg if d['my'] is None), 'other pangti:', sum(1 for d in dbg if d['my'] is not None and not d['agrees']))
print('conf hist:', sorted(collections.Counter(d['conf'] for d in dbg).items()))
cnt = collections.Counter(n_.split(':')[0] for d in dbg for n_ in d['notes'] if d['agrees'] and d['conf'] < 0.95)
print('why agree-but-rejected:', cnt.most_common())
for rec in by_rec:
    xs = [d for d in dbg if d['rec'] == rec]
    print(f'  {rec:6s} {xs[0]["cat"]:10s} n={len(xs):3d} approved={sum(d["agrees"] and d["conf"] >= 0.95 for d in xs):3d} none={sum(d["my"] is None for d in xs):3d} other={sum(d["my"] is not None and not d["agrees"] for d in xs):3d}')
