#!/usr/bin/env python3
"""merge-keys.py [--hf-dir <HF answer-key copy>] [--out labels/keys-final]

Merge every labels/accepted/*.json row (machine timing; all 3 checkers named the SAME pangti as the candidate; basis
'aligned-3check-calibrated' for Kirtan under labels/calibrated-rule.json with a per-span measured score, or
'aligned-3check' = each checker's confidence >= 0.95; every row passed labels/tools/validate-banidb.py) into the existing pangti answer keys,
in the Hugging Face dataset layout:  <out>/<content_folder>/<id>/lines.csv  (verseId,start_s,end_s,confidence,source)
plus shabads.csv copied unchanged, <out>/confirmed-3check.csv (accepted rows that confirm a pangti row the key
already scores: same pangti, overlapping; the key row is left as it is), <out>/manifest.csv (the HF manifest with lines_n / lines_source updated for the
touched recordings) and <out>/merge-report.json.

Existing keys are never changed: every existing row is written back byte-for-byte in value. A new row that overlaps
(> 0.5 s) an existing row:
  - human row (source human / human-confirmed / -corrected, or an ear-check verdict) of any pangti  -> not added
    (conflict when the pangti differs, 'human-same' when it is the same pangti)
  - ear-check REJECTED row                                                                       -> not added (conflict)
  - scored machine row (confidence >= 0.6) of the same pangti                                    -> not added (already keyed)
  - any machine row of a DIFFERENT pangti                                                         -> not added (conflict)
  - unscored machine row (confidence < 0.6) of the same pangti                                    -> added (the old row stays)
Only recordings with at least one accepted row are written.
"""
import collections, csv, io, json, os, sys

B = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # research/gab-ui
L = f'{B}/labels'
opt = lambda k, d: sys.argv[sys.argv.index(f'--{k}') + 1] if f'--{k}' in sys.argv else d
HF = opt('hf-dir', os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4'))
OUT = os.path.abspath(opt('out', f'{L}/keys-final'))
OVERLAP_S, MIN_CHECK = 0.5, 0.6

rows = []
for f in sorted(os.listdir(f'{L}/accepted')):
    if f.endswith('.json'):
        rows += json.load(open(f'{L}/accepted/{f}'))
# the rules, re-checked here (merge-votes.py already required all 3 checkers to name the same pangti):
#   aligned-3check             strict: 3 checkers, every one >= 0.95
#   aligned-3check-calibrated  labels/calibrated-rule.json: 3 checkers, tier A/B/C, a per-span measured score, Kirtan only
CR = json.load(open(f'{L}/calibrated-rule.json'))
bad = [r for r in rows if len(r['checker_confidences']) < 3 or not (
    (r['basis'] == 'aligned-3check' and min(r['checker_confidences'].values()) >= 0.95) or
    (r['basis'] == 'aligned-3check-calibrated' and r['tier'] in CR['rule']['aligner_tiers'] and r['category'] in CR['scope']['apply_to']
     and isinstance(r.get('score'), float)))]
assert not bad, f'{len(bad)} accepted rows break their acceptance rule'
# validate-banidb.py must have run: every row carries its database check (verseId exists, belongs, text equal)
assert all('db_check' in r for r in rows), 'run labels/tools/validate-banidb.py first'

man_text = open(f'{HF}/manifest.csv', encoding='utf-8', newline='').read()
man = list(csv.DictReader(io.StringIO(man_text)))
fields = list(csv.DictReader(io.StringIO(man_text)).fieldnames)
by_id = {m['id']: m for m in man}
verd = collections.defaultdict(list)
vf = f'{HF}/human-verdicts/line-start-check/verdicts.csv'
if os.path.exists(vf):
    for v in csv.DictReader(open(vf, encoding='utf-8', newline='')):
        verd[v['recording']].append(v)

def kind(rec, l):
    src = l.get('source') or by_id[rec].get('lines_source') or ''
    ids = {int(l['verseId'])}
    v = next((x for x in verd[rec] if abs(float(x['claimed_start_s']) - float(l['start_s'])) < 0.15
              and ids & {int(y) for y in (x['verseId'], x['appVerseId']) if y}), None)
    if 'REJECTED' in src.upper() or (v and v['verdict'] == 'no'):
        return 'rejected'
    if src == 'human' or 'human-confirmed' in src or 'human-corrected' in src or (v and v['verdict'] == 'yes'):
        return 'human'
    c = l.get('confidence')
    return 'scored' if c in (None, '') or float(c) >= MIN_CHECK else 'unscored'

report = {'made_from': sorted(f for f in os.listdir(f'{L}/accepted') if f.endswith('.json')), 'hf_dir': HF,
          'rule': 'accepted = all 3 checkers named the same pangti as the candidate; Kirtan: calibrated rule (tier A/B/C, '
                  'source aligned-3check-calibrated, confidence column = per-span measured score); other forms: each '
                  'confidence >= 0.95 (source aligned-3check, confidence column = min checker confidence); '
                  'existing key rows are never changed; overlap > 0.5 s with an existing row of another pangti or '
                  'any human row = keep existing, report',
          'recordings': {}, 'conflicts': [], 'totals': collections.Counter()}
by_rec = collections.defaultdict(list)
confirms = []
for r in rows:
    by_rec[r['recording']].append(r)
for rid, new in sorted(by_rec.items()):
    m = by_id[rid]
    folder = m['content_folder']
    src_dir = f'{HF}/{folder}/{rid}'
    lines_csv = f'{src_dir}/lines.csv'
    old = list(csv.DictReader(open(lines_csv, encoding='utf-8', newline=''))) if os.path.exists(lines_csv) else []
    for l in old:
        l['_kind'] = kind(rid, l)
    add, st = [], collections.Counter()
    for r in sorted(new, key=lambda x: x['start_s']):
        a, b, vid = float(r['start_s']), float(r['end_s']), int(r['verseId'])
        hits = [l for l in old if min(b, float(l['end_s'])) - max(a, float(l['start_s'])) > OVERLAP_S]
        why = None
        for l in hits:
            same = int(l['verseId']) == vid
            if l['_kind'] in ('human', 'rejected'):
                why = ('human-same' if same and l['_kind'] == 'human' else f"conflict-{l['_kind']}")
            elif not same:
                why = why or f"conflict-{l['_kind']}"
            elif l['_kind'] == 'scored':
                why = why or 'already-keyed'
            if why and why.startswith('conflict-human'):
                break
        # accepted rows of the same recording overlapping each other (should not happen): keep the first
        if not why and any(min(b, x['end_s']) - max(a, x['start_s']) > OVERLAP_S for x in add):
            why = 'overlaps-another-accepted-row'
        if why:
            st[why] += 1
            if why == 'already-keyed':
                l0 = next(l for l in hits if int(l['verseId']) == vid and l['_kind'] == 'scored')
                confirms.append({'recording': rid, 'folder': folder, 'verseId': vid, 'start_s': l0['start_s'], 'end_s': l0['end_s'],
                                 'key_confidence': l0.get('confidence', ''), 'key_source': l0.get('source', ''),
                                 'check_start_s': a, 'check_end_s': b, 'checker_min_confidence': r['min_confidence'],
                                 'basis': r['basis'], 'score': r.get('score', ''), 'batch': r['source_batch']})
            if why.startswith('conflict') or why.startswith('overlaps'):
                ex = [{k: l[k] for k in ('verseId', 'start_s', 'end_s', 'confidence', 'source') if k in l} | {'kind': l['_kind']} for l in hits]
                report['conflicts'].append({'recording': rid, 'why': why, 'new': {k: r.get(k) for k in ('verseId', 'start_s', 'end_s', 'basis', 'score', 'min_confidence', 'source_batch')}, 'existing': ex})
            continue
        st['added'] += 1
        st['added_s'] += b - a
        st['added_' + r['basis']] += 1
        conf = r['score'] if r['basis'] == 'aligned-3check-calibrated' else r['min_confidence']
        add.append({'verseId': vid, 'start_s': a, 'end_s': b, 'confidence': conf, 'source': r['basis']})
    report['recordings'][rid] = {'folder': folder, 'category': new[0]['category'], 'split': new[0]['split'],
                                 'accepted': len(new), 'existing_rows': len(old), **st}
    for k, v in st.items():
        report['totals'][k] += v
    report['totals']['accepted'] += len(new)
    if not add:
        continue
    d = f'{OUT}/{folder}/{rid}'
    os.makedirs(d, exist_ok=True)
    out_rows = [{k: l.get(k, '') for k in ('verseId', 'start_s', 'end_s', 'confidence', 'source')} for l in old]
    out_rows += [{k: (f'{v:g}' if isinstance(v, float) else v) for k, v in x.items()} for x in add]
    out_rows.sort(key=lambda x: float(x['start_s']))  # stable: existing rows keep their order and values
    with open(f'{d}/lines.csv', 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['verseId', 'start_s', 'end_s', 'confidence', 'source'], lineterminator='\n')
        w.writeheader()
        w.writerows(out_rows)
    sh = f'{src_dir}/shabads.csv'
    if os.path.exists(sh):
        open(f'{d}/shabads.csv', 'wb').write(open(sh, 'rb').read())
    ls = m.get('lines_source') or 'none'
    for bas in sorted({x['source'] for x in add}):
        ls = bas if ls in ('none', '', 'no') else (ls if bas in ls.split('+') else f'{ls}+{bas}')
    m['lines_source'] = ls
    m['lines_n'] = str(len(out_rows))
    report['recordings'][rid]['written'] = f'{folder}/{rid}/lines.csv'
os.makedirs(OUT, exist_ok=True)
with open(f'{OUT}/manifest.csv', 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=fields, lineterminator='\n')
    w.writeheader()
    w.writerows(man)
with open(f'{OUT}/confirmed-3check.csv', 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(confirms[0]) if confirms else ['recording'], lineterminator='\n')
    w.writeheader()
    w.writerows(confirms)
report['totals'] = dict(report['totals'])
json.dump(report, open(f'{OUT}/merge-report.json', 'w'), ensure_ascii=False, indent=1)
t = report['totals']
print(f"accepted {t['accepted']}  added {t.get('added', 0)} ({t.get('added_s', 0) / 60:.1f} min)  already keyed {t.get('already-keyed', 0)}  "
      f"human-same {t.get('human-same', 0)}  conflicts {len(report['conflicts'])}  recordings written "
      f"{sum(1 for r in report['recordings'].values() if 'written' in r)}")
for k, v in sorted(t.items()):
    print(f'  {k}: {v}')
