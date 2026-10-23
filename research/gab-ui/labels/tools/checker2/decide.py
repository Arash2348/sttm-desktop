#!/usr/bin/env python3
"""Turn feats-*.json into votes: identify the pangti, lens-B timing, calibrated confidence."""
import json, glob, os, re, sys
from rapidfuzz import fuzz

SCR = os.environ.get('CHK_WORK') or os.path.dirname(os.path.abspath(__file__))
GAB = '/Users/asingh02/personal/sttm-ws3/research/gab-ui'
BATCH = os.environ.get('BATCH', 'batch1')
cands = json.load(open(f'{GAB}/labels/candidates/{BATCH}.json'))
feats = []
for f in sorted(glob.glob(os.path.join(SCR, 'feats-*.json'))): feats += json.load(open(f))
feats = sorted({x['ci']: x for x in feats}.values(), key=lambda x: x['ci'])
assert [x['ci'] for x in feats] == list(range(len(cands))), 'feature rows must cover every candidate once'

SIMRAN = re.compile(r'(ਵਾਹਿ\s*ਗੁਰ|ਵਾਹਿਗੁਰੂ|ਖਾਲਸਾ|ਫਤਿਹ|ਫਤਹ|ਸਤਿ\s*ਨਾਮ)')
TIME_TOL, END_TOL, OVL_TOL = 1.5, 3.0, 1.0

votes = []; stats = {'approve': 0}
for x in feats:
    c = cands[x['ci']]
    top = x['top']
    heard = x['heard_core'] or ''
    hn = re.sub(r'\s+', '', heard)
    simran_hits = len(SIMRAN.findall(heard))
    # the keyed Shabad is context: its pangtis get a small bonus when choosing (not when measuring the margin)
    best = max(top, key=lambda a: a['tscore'] + ((8 if a['tscore'] >= 80 else 4) if a['in_shabad'] else 0)) if top else None
    # identity: identical texts in several Shabads are one identity; prefer the keyed Shabad's copy
    if best:
        same = [a for a in top if a['ntext'] == best['ntext']]
        ins = [a for a in same if a['in_shabad']]
        # the same text at several places of one Bani (Jaap Sahib): the words alone cannot tell them apart, only the
        # reading order can; take the candidate's place (the aligner's sequence) but never above 0.9
        dup_in_bani = len(ins) > 1
        if ins: best = next((a for a in ins if a['verseId'] == c['verseId']), ins[0])
        # a near-duplicate of a keyed-Shabad pangti (one matra apart) is not evidence for another Shabad
        for a in top:
            if a['in_shabad'] and a is not best and fuzz.ratio(a['ntext'], best['ntext']) >= 88 and best['tscore'] - a['tscore'] <= 8:
                best = a; break
        others = [a for a in top if fuzz.ratio(a['ntext'], best['ntext']) < 88]
        second = max(a['tscore'] for a in others) if others else 0.0
        margin = best['tscore'] - second
        # a competitor outside the keyed Shabad that explains the heard words no better than the keyed Shabad's own
        # pangti (a shared phrase) is resolved by the Shabad context, but never to full confidence
        ctx_tie = best['in_shabad'] and others and not others[0]['in_shabad'] and margin < 12
    reasons = []
    my = None; conf = 0.5
    if best is None: dup_in_bani = False
    if len(hn) < 6 or simran_hits >= 2 or (best and best['tscore'] < 45):
        my = None
        if simran_hits >= 2: reasons.append(f'heard Vaheguru simran / jaikara, not a pangti: "{heard[:60]}"'); conf = 0.9
        elif len(hn) < 6: reasons.append('almost nothing heard in the span (alaap / music / silence)'); conf = 0.7
        else: reasons.append(f'heard text matches no pangti well (best {best["tscore"]:.0f}): "{heard[:60]}"'); conf = 0.6
    else:
        my = best['verseId']
        ts, cov = best['tscore'], min(1.0, len(hn) / max(1, len(best['ntext'])))  # share of the pangti's text heard
        if ts >= 80 and margin >= 20 and cov >= 0.7: conf = 0.97
        elif ts >= 80 and cov >= 0.7 and ctx_tie and margin >= 0 and all(not a['in_shabad'] or a is best or a['tscore'] < best['tscore'] - 12 for a in top): conf = 0.9
        elif ts >= 72 and margin >= 12 and cov >= 0.6: conf = 0.9
        elif ts >= 60 and margin >= 8: conf = 0.8
        elif ts >= 50: conf = 0.65
        else: conf = 0.5
        reasons.append(f'heard "{heard[:50]}" ~ {best["ntext"][:30]} text {ts:.0f} (next other pangti {second:.0f}), {cov:.0%} of the pangti heard')
        if dup_in_bani:
            conf = min(conf, 0.9); reasons.append('the same words stand at several places of this Bani; the place is taken from the reading order only')
    # lens B timing: best-fit boundaries of MY pangti vs the candidate's; neighbour overlap
    timing_ok = True
    if my is not None:
        r = best.get('run')
        if not r:
            timing_ok = False; reasons.append('no heard-token run of this pangti inside the window')
        else:
            ds, de = r['run_start'] - x['start_s'], r['run_end'] - x['end_s']
            x['ds'], x['de'] = ds, de
            # the same pangti continues from / into a touching candidate span of the same pangti: that boundary is a
            # split of one continuous singing, not a timing error
            pc = cands[x['ci'] - 1] if x['ci'] > 0 and cands[x['ci'] - 1]['recording'] == c['recording'] else None
            nc = cands[x['ci'] + 1] if x['ci'] + 1 < len(cands) and cands[x['ci'] + 1]['recording'] == c['recording'] else None
            # the run reaches into a neighbouring candidate span of the SAME pangti with only a short pause between
            # (a repetition split into two spans): that boundary is not a timing error
            pcs = [k for k in cands if k['recording'] == c['recording'] and k['verseId'] == my and 0 <= x['start_s'] - k['end_s'] <= 3.0 and k['end_s'] >= r['run_start'] - 0.5]
            ncs = [k for k in cands if k['recording'] == c['recording'] and k['verseId'] == my and 0 <= k['start_s'] - x['end_s'] <= 3.0 and k['start_s'] <= r['run_end'] + 0.5]
            if ds < -TIME_TOL and pcs: ds = 0.0; reasons.append('the same pangti was already sung in the previous span (repetition split)')
            if de > END_TOL and ncs: de = 0.0; reasons.append('the same pangti goes on in the next span (repetition split)')
            # second opinion on the boundaries: the forced CTC alignment of the same pangti (free boundaries, repeats)
            cs, ce = best['start_s'] - x['start_s'], best['end_s'] - x['end_s']
            ctc_ok = abs(cs) <= TIME_TOL and abs(ce) <= END_TOL
            if abs(ds) > TIME_TOL or abs(de) > END_TOL:
                if ctc_ok:
                    # the forced alignment uses the same model family as the aligner that made the candidate, so it is
                    # not independent evidence: timing stays unsure -> not approvable
                    reasons.append(f'heard-token fit {r["run_start"]}-{r["run_end"]} is off (start {ds:+.1f} s, end {de:+.1f} s); only the forced alignment {best["start_s"]}-{best["end_s"]} (same model as the aligner) agrees with the candidate')
                    conf = min(conf, 0.9)
                else:
                    timing_ok = False; reasons.append(f'heard-token best fit {r["run_start"]}-{r["run_end"]} (forced alignment {best["start_s"]}-{best["end_s"]}) vs candidate {x["start_s"]}-{x["end_s"]} (start {ds:+.1f} s, end {de:+.1f} s)')
    pe, ns = x.get('prev_end'), x.get('next_start')
    if pe is not None and pe - x['start_s'] > OVL_TOL:
        timing_ok = False; reasons.append(f'overlaps the previous candidate span by {pe - x["start_s"]:.1f} s')
    if ns is not None and x['end_s'] - ns > OVL_TOL:
        timing_ok = False; reasons.append(f'overlaps the next candidate span by {x["end_s"] - ns:.1f} s')
    if not timing_ok: conf = min(conf, 0.85)
    agrees = (my == c['verseId'])
    if not agrees and my is not None:
        reasons.append(f'candidate says {c["verseId"]} "{c["text"][:30]}"')
    v = dict(recording=c['recording'], cand_verseId=c['verseId'], start_s=c['start_s'], end_s=c['end_s'],
             my_verseId=my, confidence=conf, agrees=agrees, timing_ok=timing_ok, tier=c['evidence']['tier'],
             reason='; '.join(reasons))
    votes.append(v)
    if agrees and conf >= 0.95: stats['approve'] += 1
json.dump(votes, open(os.path.join(SCR, 'votes.json'), 'w'), ensure_ascii=False, indent=1)
OUT = os.environ.get('VOTES_OUT')
if OUT:
    rows = [{k: v[k] for k in ('recording', 'cand_verseId', 'start_s', 'end_s', 'my_verseId', 'confidence', 'agrees', 'reason')} for v in votes]
    json.dump(rows, open(OUT, 'w'), ensure_ascii=False, indent=1)
    print('wrote', OUT, len(rows))
import collections
print(stats, len(votes))
print('by tier approve:', collections.Counter((v['tier'], v['agrees'] and v['confidence'] >= 0.95) for v in votes))
print('agrees:', collections.Counter((v['tier'], v['agrees']) for v in votes))
print('conf:', collections.Counter(v['confidence'] for v in votes))
print('timing fail:', sum(not v['timing_ok'] for v in votes))
gaps=[]
for i,c in enumerate(cands):
    if i+1<len(cands) and cands[i+1]['recording']==c['recording'] and c['evidence']['tier']=='A': gaps.append(cands[i+1]['start_s']-c['end_s'])
import numpy as _np; print('tier A gap to next candidate pct 10/25/50/75:', _np.percentile(gaps,[10,25,50,75]).round(2))
import numpy as np
for tier in 'ABCD':
    ds=[x['ds'] for x in feats if 'ds' in x and cands[x['ci']]['evidence']['tier']==tier]; de=[x['de'] for x in feats if 'de' in x and cands[x['ci']]['evidence']['tier']==tier]
    if ds: print(tier, 'n', len(ds), 'ds pct', np.percentile(np.abs(ds),[50,75,90]).round(2), 'de pct', np.percentile(np.abs(de),[50,75,90]).round(2), 'both ok', np.mean((np.abs(ds)<=1.5)&(np.abs(de)<=3.0)).round(2))
