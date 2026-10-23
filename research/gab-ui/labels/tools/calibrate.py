#!/usr/bin/env python3
"""calibrate.py [calib-gabhard]  (2026-10-23)

Calibrate the 3-checker acceptance rule against HUMAN pangti keys, so that "accepted" means >= 95% right pangti.

Calibration set: candidates/calib-gabhard.json = candidate spans made by make-candidates.py --calib (same saved
two-model alignment as batches 1-6) for the GAB-Hard / Fremont Kirtan recordings with a human pangti key (the
sevadaar's screen, source=human), held-out test split excluded. The checkers voted BLIND: they saw only the Shabad
windows (shabads.csv), never the human lines.csv (votes/calib-gabhard-checker{1,2,3}.json).

Truth per span: the pangti the human screen showed for most of the span, shifted by the screen lag (LAG s, the
sevadaar switches the screen after the ragi starts the pangti), at least half the span covered; otherwise 'unknown'
(not counted). Identity = the same Gurbani text (corpus text, normalised), like the checkers. A span is CORRECT when
the candidate's pangti is the truth pangti. Sensitivity: lag 0 s and lag 3 s, and a lenient truth (the candidate
pangti shown anywhere in [start-1, end+4]).

Rules: every rule requires all 3 checkers to name the candidate pangti (the owner: never accept when the checkers
disagree). Thresholds on min / mean / product of the 3 confidences, the aligner tier, and a leave-one-recording-out
logistic score. Precision with a 95% Wilson lower bound; yield = accepted / all calibration spans.
Writes labels/calibration-results.json (every rule) for CALIBRATION.md and calibrated-rule.json.
"""
import json, os, re, csv, math, sys, collections
import numpy as np

B = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # research/gab-ui
L = f'{B}/labels'
NAME = sys.argv[1] if len(sys.argv) > 1 else 'calib-gabhard'
HUMAN = os.path.expanduser('~/personal/vf-benchmark')  # local copy of the HF dataset (read-only)
LAG = 2.0
corpus = json.load(open(os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')))
DROP = re.compile(r'[\s।॥|0-9੦-੯.,;:!?\-▁ੱੰਂ]+')
vtext = {r['verseId']: DROP.sub('', r['text'] or '') for r in corpus}

cands = json.load(open(f'{L}/candidates/{NAME}.json'))
def key(r): return (r['recording'], int(r.get('cand_verseId', r.get('verseId'))), round(float(r['start_s']), 2), round(float(r['end_s']), 2))
votes = []
for k in (1, 2, 3):
    v = json.load(open(f'{L}/votes/{NAME}-checker{k}.json'))
    d = {key(r): r for r in v}
    assert len(v) == len(cands) == len(d), (k, len(v), len(cands), len(d))
    votes.append(d)

human = {}
def hlines(c):
    r = c['recording']
    if r not in human:
        f = f"{HUMAN}/{c['folder']}/{r}/lines.csv"
        human[r] = [(int(x['verseId']), float(x['start_s']), float(x['end_s'])) for x in csv.DictReader(open(f))
                    if x.get('source', 'human') == 'human']
    return human[r]
def truth(c, lag):
    a, b = c['start_s'] + lag, c['end_s'] + lag
    ov = collections.Counter()
    for v, x, y in hlines(c):
        o = min(b, y) - max(a, x)
        if o > 0: ov[vtext.get(v, v)] += o
    if not ov: return None
    t, o = ov.most_common(1)[0]
    return t if o >= 0.5 * (b - a) else None
def lenient(c):
    a, b = c['start_s'] - 1, c['end_s'] + 4
    shown = {vtext.get(v, v) for v, x, y in hlines(c) if min(b, y) - max(a, x) > 0}
    return None if not shown else (vtext[c['verseId']] in shown)

rows = []
for c in cands:
    vs = [d[key(c)] for d in votes]
    same = all(v.get('my_verseId') is not None and int(v['my_verseId']) == int(c['verseId']) for v in vs)
    conf = [float(v.get('confidence') or 0) for v in vs]
    t = {lag: truth(c, lag) for lag in (0.0, LAG, 3.0)}
    ok = {lag: None if t[lag] is None else (t[lag] == vtext[c['verseId']]) for lag in t}
    dissent = any(v.get('my_verseId') is not None and int(v['my_verseId']) != int(c['verseId']) for v in vs)
    rows.append(dict(dissent=dissent, rec=c['recording'], tier=c['evidence']['tier'], same=same, conf=conf, aconf=c['aligner_conf'],
                     dur=c['end_s'] - c['start_s'], ok=ok[LAG], ok0=ok[0.0], ok3=ok[3.0], okl=lenient(c),
                     agree_n=sum(v.get('my_verseId') is not None and int(v['my_verseId']) == int(c['verseId']) for v in vs)))

def wilson(k, n, z=1.96):
    if n == 0: return (0.0, 0.0)
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); r = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - r) / d, (c + r) / d)

# leave-one-recording-out logistic score over the agreeing spans (features: the 3 confidences, tier, aligner conf)
TIERS = 'ABCD'
def feats(r): return [1.0] + r['conf'] + [float(r['tier'] == t) for t in 'ABC'] + [r['aconf']]
def fit(X, y, l2=1.0, it=500):
    w = np.zeros(X.shape[1])
    for _ in range(it):
        p = 1 / (1 + np.exp(-X @ w)); g = X.T @ (p - y) + l2 * np.r_[0, w[1:]]
        H = (X.T * (p * (1 - p))) @ X + l2 * np.diag(np.r_[0, np.ones(len(w) - 1)])
        w -= np.linalg.solve(H + 1e-6 * np.eye(len(w)), g)
    return w
ag = [r for r in rows if r['same'] and r['ok'] is not None]
for r in rows: r['logit_p'] = None
for rec in sorted({r['rec'] for r in ag}):
    tr = [r for r in ag if r['rec'] != rec]
    w = fit(np.array([feats(r) for r in tr]), np.array([float(r['ok']) for r in tr]))
    for r in ag:
        if r['rec'] == rec: r['logit_p'] = float(1 / (1 + np.exp(-np.array(feats(r)) @ w)))
w_all = fit(np.array([feats(r) for r in ag]), np.array([float(r['ok']) for r in ag]))

N = len(rows); NK = sum(r['ok'] is not None for r in rows)
def evaluate(name, pred, family, need_all3=True):
    acc = [r for r in rows if (r['same'] or not need_all3) and pred(r)]
    known = [r for r in acc if r['ok'] is not None]
    k = sum(r['ok'] for r in known); n = len(known)
    lo, hi = wilson(k, n)
    alt = {}
    for f in ('ok0', 'ok3', 'okl'):
        kk = [r for r in acc if r[f] is not None]; alt[f] = round(sum(r[f] for r in kk) / len(kk), 4) if kk else None
    per_rec = collections.Counter(r['rec'] for r in known if not r['ok'])
    return dict(rule=name, family=family, accepted=len(acc), known=n, correct=k, precision=round(k / n, 4) if n else None,
                wilson95_lo=round(lo, 4), wilson95_hi=round(hi, 4), yield_all=round(len(acc) / N, 4),
                recall_of_correct=round(k / max(1, sum(1 for r in rows if r['ok'])), 4),
                minutes=round(sum(r['dur'] for r in acc) / 60, 1), precision_lag0=alt['ok0'], precision_lag3=alt['ok3'],
                precision_lenient=alt['okl'], wrong_by_recording=dict(per_rec.most_common()))
res = []
res.append(evaluate('all 3 name the candidate pangti (no confidence bar)', lambda r: True, 'agree'))
for t in (0.8, 0.85, 0.9, 0.93, 0.95, 0.96, 0.97):
    res.append(evaluate(f'all 3 agree, min confidence >= {t}', lambda r, t=t: min(r['conf']) >= t, 'min'))
for t in (0.85, 0.88, 0.9, 0.92, 0.93, 0.94, 0.95, 0.96):
    res.append(evaluate(f'all 3 agree, mean confidence >= {t}', lambda r, t=t: sum(r['conf']) / 3 >= t, 'mean'))
for t in (0.7, 0.75, 0.8, 0.85, 0.9):
    res.append(evaluate(f'all 3 agree, product of confidences >= {t}', lambda r, t=t: np.prod(r['conf']) >= t, 'product'))
for tiers in ('A', 'AB', 'ABC'):
    res.append(evaluate(f'all 3 agree, tier {"/".join(tiers)}', lambda r, tiers=tiers: r['tier'] in tiers, 'tier'))
    for t in (0.85, 0.9, 0.95):
        res.append(evaluate(f'all 3 agree, tier {"/".join(tiers)}, min confidence >= {t}', lambda r, t=t, tiers=tiers: r['tier'] in tiers and min(r['conf']) >= t, 'tier+min'))
for t in (0.85, 0.9):
    res.append(evaluate(f'all 3 agree, two checkers >= 0.95 and the third >= {t}',
                        lambda r, t=t: sorted(r['conf'])[1] >= 0.95 and min(r['conf']) >= t, '2of3'))
for t in (0.9, 0.93, 0.95, 0.97):
    res.append(evaluate(f'all 3 agree, logistic score >= {t} (leave-one-recording-out)', lambda r, t=t: r['logit_p'] is not None and r['logit_p'] >= t, 'logistic'))

# reference only, NOT allowed by the owner's rule (a checker that hears nothing is not agreement): 'no dissent' = no
# checker names a different pangti, the rest name the candidate or hear nothing; and the aligner tier alone
INFO = 'reference only (not allowed: needs all 3 to name the pangti)'
for k in (1, 2):
    res.append(evaluate(f'no checker names a different pangti, >= {k} name the candidate', lambda r, k=k: not r['dissent'] and r['agree_n'] >= k, INFO, False))
    res.append(evaluate(f'no checker names a different pangti, >= {k} name the candidate, tier A/B/C', lambda r, k=k: not r['dissent'] and r['agree_n'] >= k and r['tier'] != 'D', INFO, False))
res.append(evaluate('aligner tier A alone (no checker needed)', lambda r: r['tier'] == 'A', INFO, False))

def eligible(x, strict=True):
    if x['family'] == INFO: return False
    return x['precision'] is not None and x['precision'] >= 0.95 and (not strict or (x['wilson95_lo'] >= 0.93 and x['known'] >= 200))
simple = [x for x in res if x['family'] != 'logistic']
best_strict = max([x for x in simple if eligible(x)], key=lambda x: (x['accepted'], x['precision']), default=None)
best_p95 = max([x for x in simple if eligible(x, False)], key=lambda x: (x['accepted'], x['precision']), default=None)
base = {t: (sum(1 for r in rows if r['tier'] == t and r['ok']), sum(1 for r in rows if r['tier'] == t and r['ok'] is not None)) for t in TIERS}
out = dict(name=NAME, made='2026-10-23', lag_s=LAG, spans=N, spans_with_truth=NK, recordings=len({r['rec'] for r in rows}),
           all3_agree=sum(r['same'] for r in rows), candidate_precision_by_tier={t: [k, n, round(k / n, 3) if n else None] for t, (k, n) in base.items()},
           agree_count_dist=dict(collections.Counter(r['agree_n'] for r in rows)),
           logistic_weights_all=dict(zip(['bias', 'c1', 'c2', 'c3', 'tierA', 'tierB', 'tierC', 'aligner_conf'], [round(float(x), 3) for x in w_all])),
           rules=res, best_strict=best_strict and best_strict['rule'], best_precision95=best_p95 and best_p95['rule'])
json.dump(out, open(f'{L}/calibration-results.json', 'w'), ensure_ascii=False, indent=1)
json.dump([dict(r, conf=r['conf']) for r in rows], open(f'{L}/calibration-spans.json', 'w'), ensure_ascii=False)
print(f"spans {N} with truth {NK}; all 3 agree {out['all3_agree']}; tier precision {out['candidate_precision_by_tier']}")
print('| rule | accepted | precision | 95% lower | yield | lag0 | lag3 | lenient |')
for x in res:
    print(f"| {x['rule']} | {x['accepted']} ({x['known']}) | {x['precision']} | {x['wilson95_lo']} | {x['yield_all']} | {x['precision_lag0']} | {x['precision_lag3']} | {x['precision_lenient']} |")
print('best (p>=0.95, lo>=0.93, n>=200):', out['best_strict']); print('best (p>=0.95):', out['best_precision95'])

# ---- the chosen rule (see CALIBRATION.md): every checker names the candidate pangti, and the two aligners did not
# put different pangtis at this time (tier D excluded: prior 36% right). No confidence bar: on the human keys the
# checkers' confidences did not separate right from wrong among agreeing spans (the 0.95 bar kept 1 of 64).
CHOSEN = 'all 3 agree, tier A/B/C'
chosen = next(x for x in res if x['rule'] == CHOSEN)
def accept(same, tier, confs): return bool(same) and tier in ('A', 'B', 'C')
# what the chosen rule does on the overnight batches (no file under accepted/ is changed here)
batches = {}
for bn in range(1, 7):
    b = f'batch{bn}'
    if not all(os.path.exists(f'{L}/votes/{b}-checker{k}.json') for k in (1, 2, 3)): continue
    cs = json.load(open(f'{L}/candidates/{b}.json'))
    vv = [json.load(open(f'{L}/votes/{b}-checker{k}.json')) for k in (1, 2, 3)]
    st = collections.Counter()
    for i, c in enumerate(cs):
        vs = [v[i] for v in vv]
        assert all(key(v) == key(c) for v in vs)
        same = all(v.get('my_verseId') is not None and int(v['my_verseId']) == int(c['verseId']) for v in vs)
        confs = [float(v.get('confidence') or 0) for v in vs]
        new = not c['evidence']['in_current_key']
        old_ok = same and min(confs) >= 0.95; new_ok = accept(same, c['evidence']['tier'], confs)
        st['spans'] += 1; st['all3_agree'] += same; st['old_rule'] += old_ok; st['new_rule'] += new_ok
        st['old_rule_new_to_key'] += old_ok and new; st['new_rule_new_to_key'] += new_ok and new
        st['new_rule_min'] += new_ok and (c['end_s'] - c['start_s']) / 60
        st['key_mismatch_blocked'] += new_ok and bool(c['evidence'].get('key_mismatch'))
    st['new_rule_min'] = round(st['new_rule_min'], 1)
    batches[b] = dict(st, category=cs[0]['category'])
rule = dict(name='calibrated-3check-v1', made='2026-10-23', status='proposed; owner signs off before any merge or upload',
            rule=dict(all_checkers_name_candidate_pangti=True, checkers=['checker1', 'checker2', 'checker3'],
                      aligner_tiers=['A', 'B', 'C'], exclude_tier='D', min_each_confidence=None,
                      never_accept_if_any_checker_names_another_pangti=True, never_accept_key_mismatch=True,
                      text_must_equal_database_text_for_verseId=True),
            python='accept = all(v.my_verseId == cand.verseId for v in votes) and cand.evidence.tier in ("A","B","C") and not cand.evidence.get("key_mismatch")',
            measured=dict(set=NAME, basis='human pangti keys (GAB-Hard / Fremont sevadaar screen, non-test), checkers blind',
                          accepted=chosen['accepted'], correct=chosen['correct'], precision=chosen['precision'],
                          wilson95=[chosen['wilson95_lo'], chosen['wilson95_hi']], yield_all=chosen['yield_all'],
                          precision_lag0=chosen['precision_lag0'], precision_lenient=chosen['precision_lenient']),
            meets_target=dict(precision_ge_95=chosen['precision'] >= 0.95, lower_bound_ge_93=chosen['wilson95_lo'] >= 0.93,
                              n_ge_200=chosen['known'] >= 200),
            scope=dict(measured_on=['Kirtan'], apply_to=['Kirtan'],
                       not_measured=['Akhand Kirtan', 'Paath', 'Sung Bani', 'Sehaj / Akhand Paath'],
                       note='keep the strict 0.95 rule (or a person) for the unmeasured forms until they have human pangti keys'),
            caveat='thin data: only 64 calibration spans had all 3 checkers agree; Kirtan (Fremont hall audio) only; '
                   'Akhand Kirtan, Paath, Sung Bani not measured',
            on_overnight_batches=batches)
json.dump(rule, open(f'{L}/calibrated-rule.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(rule['measured']), json.dumps(rule['meets_target']))
for b, st in batches.items(): print(b, st)
