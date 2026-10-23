#!/usr/bin/env python3
"""merge-votes.py <batch> [--rule=strict|calibrated]   e.g. batch1 --rule=calibrated

--rule=calibrated (2026-10-23, labels/calibrated-rule.json, measured in CALIBRATION.md): for the forms of Guru's Bani
the rule was measured on (scope.apply_to: Kirtan) a span is ACCEPTED when all 3 checkers name the candidate pangti
(my_verseId == cand verseId for every checker; a span where any checker names another pangti or none is never
accepted), the aligner tier is A, B or C (not D) and the candidate has no key_mismatch. No confidence bar. Rows get
basis 'aligned-3check-calibrated' and a per-span 'score' = the measured right-pangti rate of its bucket (all 3 agree,
same tier) on the human-keyed calibration set (tier B had no such span there: pooled A/B/C rate), with n and the 95%
Wilson lower bound. Other forms (Akhand Kirtan, Paath, Sung Bani: not measured) keep the strict rule below.
Default (--rule=strict):

Owner rule (2026-10-23): a candidate span is ACCEPTED only when ALL checkers independently named the SAME pangti
as the candidate (my_verseId == cand_verseId for each) AND every checker's confidence >= 0.95.
Accepted rows -> labels/accepted/<batch>.json, basis 'aligned-3check' (machine timing confirmed by 3 independent
checks, NOT human). Prints agreement rate, threshold-only failures, per-category counts and coverage after.
"""
import json, os, re, sys, csv, collections
B = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # research/gab-ui
L = f'{B}/labels'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
batch = args[0] if args else 'batch1'
# --hf-dir=<dir>: HF answer-key root with <folder>/<rid>/{lines,shabads}.csv (as make-candidates.py --hf-dir)
HF_DIR = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--hf-dir=')), None)
MIN = 0.95
RULE = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--rule=')), 'strict')
assert RULE in ('strict', 'calibrated'), RULE
CR = json.load(open(f'{L}/calibrated-rule.json'))
CAL_SCOPE = set(CR['scope']['apply_to']) if RULE == 'calibrated' else set()
CAL_TIERS = set(CR['rule']['aligner_tiers'])
def wilson(k, n, z=1.96):
    if not n: return None
    p = k / n; d = 1 + z * z / n
    return round((p + z * z / (2 * n) - z * (p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / d, 4)
TIER_SCORE = {}
if RULE == 'calibrated':
    cs = [x for x in json.load(open(f'{L}/calibration-spans.json')) if x['agree_n'] == 3 and x['ok'] is not None]
    pool = [x for x in cs if x['tier'] in CAL_TIERS]
    for t in sorted(CAL_TIERS):
        b = [x for x in cs if x['tier'] == t]
        src, use = (f'all 3 agree, tier {t}', b) if b else (f'all 3 agree, tier A/B/C pooled (no tier {t} span in calibration)', pool)
        k = sum(x['ok'] for x in use)
        TIER_SCORE[t] = {'score': round(k / len(use), 4), 'score_n': len(use), 'score_right': k,
                         'score_wilson95_lo': wilson(k, len(use)), 'score_basis': f'calib-gabhard human pangti keys: {src}'}
cands = json.load(open(f'{L}/candidates/{batch}.json'))
vfiles = sorted(f for f in os.listdir(f'{L}/votes') if re.match(rf'{batch}-checker\d+\.json$', f))
assert len(vfiles) == 3, f'need votes from all 3 checkers, found {vfiles}'
votes = [json.load(open(f'{L}/votes/{f}')) for f in vfiles]
def key(r): return (r['recording'], int(r.get('cand_verseId', r.get('verseId'))), round(float(r['start_s']), 2), round(float(r['end_s']), 2))
# Same span can be a candidate twice (e.g. a Bani pangti keyed under both the Bani and its Shabad id); votes
# carry no shabadId, so then match by position (each vote file must list candidates in candidate order).
vix = []
positional = len({key(c) for c in cands}) < len(cands)
for v in votes:
    assert len(v) == len(cands), 'votes must cover every candidate exactly once'
    if positional:
        assert all(key(a) == key(b) for a, b in zip(cands, v)), 'duplicate candidate keys: votes must be in candidate order'
        vix.append(v)
    else:
        d = {key(r): r for r in v}
        assert len(d) == len(cands), 'votes must cover every candidate exactly once'
        vix.append(d)
seen = {}
acc, stats = [], collections.defaultdict(lambda: collections.Counter())
all_same = thr_only = 0
for i, c in enumerate(cands):
    k = key(c)
    vs = [d[i] if positional else d[k] for d in vix]
    same = all(v.get('my_verseId') is not None and int(v['my_verseId']) == int(c['verseId']) for v in vs)
    confs = [float(v.get('confidence') or 0) for v in vs]
    cat = c['category']; st = stats[cat]
    calibrated = cat in CAL_SCOPE
    if calibrated:
        ok = same and c['evidence']['tier'] in CAL_TIERS and not c['evidence'].get('key_mismatch')
    else:
        ok = same and min(confs) >= MIN
    all_same += same; thr_only += same and not ok
    st['all_same'] += same; st['spans'] += 1
    if ok:
        r = {x: c[x] for x in ('recording', 'category', 'folder', 'split', 'verseId', 'shabadId', 'text', 'start_s', 'end_s')}
        if calibrated:
            r.update({'basis': 'aligned-3check-calibrated', 'rule': CR['name'], **TIER_SCORE[c['evidence']['tier']],
                      'mean_confidence': round(sum(confs) / len(confs), 4)})
        else:
            r.update({'basis': 'aligned-3check', 'rule': 'strict-0.95'})
        r['in_current_key'] = bool(c['evidence'].get('in_current_key'))
        r.update({'min_confidence': min(confs),
                  'checker_confidences': dict(zip([f[len(batch) + 1:-5] for f in vfiles], confs)),
                  'tier': c['evidence']['tier'], 'aligner_conf': c['aligner_conf'], 'source_batch': batch})
        if k in seen:  # same span already accepted under another Shabad/Bani id: keep one row, note the alias
            seen[k].setdefault('also_shabadIds', []).append(c['shabadId']); st['accepted'] += 1; continue
        seen[k] = r
        acc.append(r); st['accepted'] += 1; st['accepted_s'] += c['end_s'] - c['start_s']
        st['accepted_' + r['basis']] += 1
    else:
        st['rejected'] += 1
os.makedirs(f'{L}/accepted', exist_ok=True)
json.dump(acc, open(f'{L}/accepted/{batch}.json', 'w'), ensure_ascii=False, indent=1)
n = len(cands)
os.makedirs(f'{L}/remerge', exist_ok=True)
json.dump({'batch': batch, 'rule': RULE, 'tier_score': TIER_SCORE, 'spans': len(cands), 'all_same': all_same,
           'accepted': len(acc), 'by_category': {k: dict(v) for k, v in stats.items()}},
          open(f'{L}/remerge/{batch}.json', 'w'), ensure_ascii=False, indent=1)
print(f'rule {RULE}  checkers {len(vfiles)}  spans {n}  all-same-pangti {all_same} ({all_same / n:.1%})  '
      f'not accepted although all same {thr_only}  accepted {len(acc)} ({len(acc) / n:.1%})')
# coverage after: same as make-candidates.py coverage() (current key conf>=0.6 + accepted, merged)
cov = json.load(open(f'{L}/candidates/{batch}-coverage.json'))
def merged(sp):
    out = []
    for a, b in sorted(sp):
        if out and a - out[-1][1] < 2.0: out[-1][1] = max(out[-1][1], b)
        else: out.append([a, b])
    return out
def coverage(spans, shab, dur):
    keyed = pang = 0
    for s in range(int(dur)):
        t = s + 0.5
        inp = any(a <= t < b for a, b in spans)
        keyed += inp or any(x <= t < y for _, x, y in shab); pang += inp
    return pang / keyed if keyed else 0.0
reach = collections.defaultdict(list)
for p in cov['recordings']:
    rid = p['recording']
    c0 = next(c for c in cands if c['recording'] == rid)
    kd = f"{HF_DIR or B + '/hf-keys'}/{c0['folder']}/{rid}"
    rd = lambda f: list(csv.DictReader(open(f'{kd}/{f}', encoding='utf-8', newline='')))
    shab = [(r['shabadId'], float(r['start_s']), float(r['end_s'])) for r in rd('shabads.csv') if r.get('shabadId')]
    cur = [(float(r['start_s']), float(r['end_s'])) for r in rd('lines.csv')
           if r.get('confidence') in (None, '') or float(r['confidence']) >= 0.6]
    new = [(r['start_s'], r['end_s']) for r in acc if r['recording'] == rid]
    after = coverage(merged(cur + new), shab, p['duration_s'])
    print(f"  {rid:24s} {c0['category']:8s} before {p['coverage_before_recomputed']:.3f} (check {coverage(merged(cur), shab, p['duration_s']):.3f}) after {after:.3f} "
          f"(+{len(new)} spans){'  >=60%' if after >= 0.6 else ''}")
    if after >= 0.6: reach[c0['category']].append(rid)
for cat, st in stats.items():
    print(f"{cat}: accepted {st['accepted']} rejected {st['rejected']} accepted sung {st['accepted_s'] / 60:.1f} min  "
          f"recordings >=60%: {len(reach[cat])} {reach[cat]}")
