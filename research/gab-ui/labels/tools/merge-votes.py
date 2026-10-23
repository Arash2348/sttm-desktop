#!/usr/bin/env python3
"""merge-votes.py <batch>   e.g. batch1

Owner rule (2026-10-23): a candidate span is ACCEPTED only when ALL checkers independently named the SAME pangti
as the candidate (my_verseId == cand_verseId for each) AND every checker's confidence >= 0.95.
Accepted rows -> labels/accepted/<batch>.json, basis 'aligned-3check' (machine timing confirmed by 3 independent
checks, NOT human). Prints agreement rate, threshold-only failures, per-category counts and coverage after.
"""
import json, os, re, sys, csv, collections
B = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # research/gab-ui
L = f'{B}/labels'
batch = sys.argv[1] if len(sys.argv) > 1 else 'batch1'
MIN = 0.95
cands = json.load(open(f'{L}/candidates/{batch}.json'))
vfiles = sorted(f for f in os.listdir(f'{L}/votes') if re.match(rf'{batch}-checker\d+\.json$', f))
votes = [json.load(open(f'{L}/votes/{f}')) for f in vfiles]
def key(r): return (r['recording'], int(r.get('cand_verseId', r.get('verseId'))), round(float(r['start_s']), 2), round(float(r['end_s']), 2))
vix = []
for v in votes:
    d = {key(r): r for r in v}
    assert len(d) == len(v) == len(cands), 'votes must cover every candidate exactly once'
    vix.append(d)
acc, stats = [], collections.defaultdict(lambda: collections.Counter())
all_same = thr_only = 0
for c in cands:
    k = key(c)
    vs = [d[k] for d in vix]
    same = all(v.get('my_verseId') is not None and int(v['my_verseId']) == int(c['verseId']) for v in vs)
    confs = [float(v.get('confidence') or 0) for v in vs]
    ok = same and min(confs) >= MIN
    all_same += same; thr_only += same and not ok
    cat = c['category']; st = stats[cat]
    if ok:
        r = {x: c[x] for x in ('recording', 'category', 'folder', 'split', 'verseId', 'shabadId', 'text', 'start_s', 'end_s')}
        r.update({'basis': 'aligned-3check', 'min_confidence': min(confs),
                  'checker_confidences': dict(zip([f[len(batch) + 1:-5] for f in vfiles], confs)),
                  'tier': c['evidence']['tier'], 'aligner_conf': c['aligner_conf'], 'source_batch': batch})
        acc.append(r); st['accepted'] += 1; st['accepted_s'] += c['end_s'] - c['start_s']
    else:
        st['rejected'] += 1
os.makedirs(f'{L}/accepted', exist_ok=True)
json.dump(acc, open(f'{L}/accepted/{batch}.json', 'w'), ensure_ascii=False, indent=1)
n = len(cands)
print(f'checkers {len(vfiles)}  spans {n}  all-same-pangti {all_same} ({all_same / n:.1%})  '
      f'failed only on {MIN} threshold {thr_only}  accepted {len(acc)} ({len(acc) / n:.1%})')
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
    kd = f"{B}/hf-keys/{c0['folder']}/{rid}"
    rd = lambda f: list(csv.DictReader(open(f'{kd}/{f}', encoding='utf-8', newline='')))
    shab = [(r['shabadId'], float(r['start_s']), float(r['end_s'])) for r in rd('shabads.csv') if r.get('shabadId')]
    cur = [(float(r['start_s']), float(r['end_s'])) for r in rd('lines.csv')
           if r.get('confidence') in (None, '') or float(r['confidence']) >= 0.6]
    new = [(r['start_s'], r['end_s']) for r in acc if r['recording'] == rid]
    after = coverage(merged(cur + new), shab, p['duration_s'])
    print(f"  {rid:24s} {c0['category']:8s} before {p['coverage_before_recomputed']:.3f} after {after:.3f} "
          f"(+{len(new)} spans){'  >=60%' if after >= 0.6 else ''}")
    if after >= 0.6: reach[c0['category']].append(rid)
for cat, st in stats.items():
    print(f"{cat}: accepted {st['accepted']} rejected {st['rejected']} accepted sung {st['accepted_s'] / 60:.1f} min  "
          f"recordings >=60%: {len(reach[cat])} {reach[cat]}")
