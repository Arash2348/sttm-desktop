#!/usr/bin/env python3
"""make-candidates.py <gab-lines dir> <out.json> [--folder 1-kirtan-shabad] [--file c1-6a866c94-main.json]
                      [--lo 0.50] [--hi 0.60] [--max 15] [--category Kirtan]
       or, for Banis (batch4): --ids pt01,pt05,... --file c1-6a866c94-paath.json,c1-6a866c94-sungbani.json
                      --hf-dir <HF dataset copy with nested content folders> (category from the content folder;
                      'no pangti key' = coverage 0; Bani verse membership from labels/bani-verse-cache.json,
                      made by tools/bani-verses.js from a copy of the app's Gurbani database)

CANDIDATE pangti timings for GAB recordings whose pangti coverage is in [lo, hi) (closest to the 60% bar first).

Source: the two-model forced alignment that produced the HF 'aligned-2model-audited' lines (labels/tools/line-build.js,
copied from research/cloud-gab/lines; run on the cloud VM 2026-10-15, per-model output in Azure gab-lines/align/
<model>/<id>.json, pulled read-only with research/cloud-gab/results-sync.js pull --prefix gab-lines). That run
force-aligned the KNOWN Shabad text from each recording's shabads.csv (+-3 s) with two different speech models
(Karanbir's int8 = the app's; Surinder's pa-v3-kirtan fp32). No model was re-run: this uses the saved output.

Full coverage: unlike the published key (Karanbir segments, check >= 0.6, audited), EVERY pangti either model
aligned is kept as a candidate, with its confidence flagged:
  tier A  both models, same pangti, starts within 1 s, heard-text check >= 0.5   (measured 97% right pangti, n 162)
  tier B  both models agree on pangti + start, check < 0.5                         (~65%)
  tier C  one model only (no conflict with the other model at that time)          (~41%)
  tier D  one model only, and the other model put a DIFFERENT pangti there        (conflict; other kept in evidence)
(precision figures: line-eval.js on GAB-Hard's 20 human-keyed clips, Oct 15 2026.)
Time inside a keyed Shabad window with no candidate is a GAP (alaap / simran / katha / silence or not aligned):
listed per recording, never a pangti.

Verification rule (owner, 2026-10-23): a candidate becomes a label only when EVERY checker (each Fable / Opus
verifier and the aligner) names the SAME pangti (verseId) for the span and the agreement score >= 0.95; anything
below goes to a person. Each row carries verify = {pangti_must_match, min_agreement, agreement_prior}.
"""
import json, os, re, sys, collections

B = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # research/gab-ui
argv = sys.argv[1:]
def opt(n, d):
    return argv[argv.index(f'--{n}') + 1] if f'--{n}' in argv else d
LINES, OUT = argv[0], argv[1]
FOLDER = opt('folder', '1-kirtan-shabad')
FILE = opt('file', 'c1-6a866c94-main.json')
CATEGORY = opt('category', 'Kirtan')
LO, HI, MAX = float(opt('lo', 0.5)), float(opt('hi', 0.6)), int(opt('max', 15))
IDS = [x for x in opt('ids', '').split(',') if x]
HF_DIR = opt('hf-dir', None)
CAT_OF = {'1-kirtan-shabad': 'Kirtan', '2-bani-recited': 'Paath', '3-bani-sung-like-kirtan': 'Sung Bani',
          '4-akhand-paath': 'Sehaj/Akhand Paath', '5-akhand-kirtan': 'Akhand Kirtan'}
AGREE_S, SURE_CHECK, MIN_CONF, MERGE_GAP_S, MIN_GAP_S = 1.0, 0.5, 0.6, 2.0, 2.0
PREC = {'A': 0.97, 'B': 0.65, 'C': 0.41, 'D': 0.2}  # D: no measurement; a conflict is below one-model

def csv(f):
    if not os.path.exists(f): return []
    import csv as _csv
    return list(_csv.DictReader(open(f, encoding='utf-8', newline='')))

manifest = {r['id']: r for r in csv(f'{LINES}/manifest.csv')}
# held-out test split + already accepted labels are excluded
accepted = set()
acc_dir = f'{B}/labels/accepted'
if os.path.isdir(acc_dir):
    for f in os.listdir(acc_dir):
        if f.endswith('.json'):
            for r in json.load(open(f'{acc_dir}/{f}')):
                accepted.add(r['recording'] if isinstance(r, dict) else r)
rep = json.load(open(f'{B}/timeline-pangti/rescore-report.json'))
covers = []
for FN in FILE.split(','):
    for d in rep['files'][FN]['dropped']:
        m = re.search(r'cover (\d+)%', d['why'])
        if m: c = int(m.group(1)) / 100
        elif IDS and d['why'] == 'no pangti key': c = 0.0
        else: continue
        rid = d['id']
        split = manifest.get(rid, {}).get('split')
        if (rid in IDS if IDS else LO <= c < HI) and split != 'test' and rid not in accepted:
            covers.append((c, rid))
if IDS: covers.sort(key=lambda x: IDS.index(x[1]))
else: covers.sort(key=lambda x: (-x[0], x[1]))
covers = covers[:MAX]
verse_cache = json.load(open(f'{B}/verse-cache.json'))
if os.path.exists(f'{B}/labels/bani-verse-cache.json'):
    for k, v in json.load(open(f'{B}/labels/bani-verse-cache.json')).items(): verse_cache.setdefault(k, v)

def segs_of(model, rid):
    f = f'{LINES}/align/{model}/{rid}.json'
    return json.load(open(f))['segs'] if os.path.exists(f) else []

def overlap(a, b):
    return max(0.0, min(a['end'], b['end']) - max(a['start'], b['start']))

def coverage(spans, shabads, dur):
    """same as pangti-timeline.js: seconds inside pangti spans (merged like segments()) / seconds inside any key."""
    keyed = pang = 0
    for s in range(int(dur)):
        t = s + 0.5
        inp = any(a <= t < b for a, b in spans)
        ink = inp or any(r[1] <= t < r[2] for r in shabads)
        keyed += ink; pang += inp
    return pang / keyed if keyed else 0.0

rows, per = [], []
for cov_before, rid in covers:
    m = manifest[rid]
    folder = m['content_folder'] if HF_DIR else FOLDER
    category = CAT_OF.get(folder.split('/')[0], CATEGORY) if HF_DIR else CATEGORY
    key_dir = f'{HF_DIR}/{folder}/{rid}' if HF_DIR else f'{B}/hf-keys/{FOLDER}/{rid}'
    shab = [(r['shabadId'], float(r['start_s']), float(r['end_s'])) for r in csv(f'{key_dir}/shabads.csv') if r.get('shabadId')]
    cur = csv(f'{key_dir}/lines.csv')
    dur = float(m['duration_s'])
    K, S = segs_of('karanbir', rid), segs_of('surinder', rid)
    def shabad_for(seg):
        # the truth row the aligner used (row k of shabads.csv); confirm the verse belongs to that Shabad
        sid = shab[seg['row']][0] if seg['row'] < len(shab) else None
        for cand in [sid] + [x[0] for x in shab]:
            for one in str(cand).split('|'):
                if str(seg['verseId']) in verse_cache.get(one, {}): return one, True
        return sid, False
    usedS = set()
    cands = []
    for k in K:
        best = None
        for j, s in enumerate(S):
            if j in usedS or s['verseId'] != k['verseId'] or abs(s['start'] - k['start']) > AGREE_S: continue
            if best is None or abs(s['start'] - k['start']) < abs(S[best]['start'] - k['start']): best = j
        if best is not None:
            usedS.add(best); s = S[best]
            chk = min(k['check'], s['check'])
            tier = 'A' if k['check'] >= SURE_CHECK else 'B'  # line-build.js rule: Karanbir's check decides "sure"
            cands.append({'seg': k, 'tier': tier, 'k': k, 's': s})
        else:
            cands.append({'seg': k, 'tier': 'C', 'k': k, 's': None})
    for j, s in enumerate(S):
        if j not in usedS: cands.append({'seg': s, 'tier': 'C', 'k': None, 's': s})
    # one-model candidates that overlap a candidate of a DIFFERENT pangti from the other model -> conflict
    ones = [c for c in cands if c['tier'] == 'C']
    for c in ones:
        mine = 'karanbir' if c['k'] else 'surinder'
        others = [o for o in cands if o is not c and (o['s'] if mine == 'karanbir' else o['k']) is not None
                  and o['seg']['verseId'] != c['seg']['verseId'] and overlap(o['seg'], c['seg']) > 0.5 * (c['seg']['end'] - c['seg']['start'])]
        if others: c['others'] = others
    for c in ones:
        if c.get('others'): c['tier'] = 'D'
    for c in ones:
        if c.get('others'):
            c['conflict'] = [{'verseId': o['seg']['verseId'], 'start_s': o['seg']['start'], 'end_s': o['seg']['end'], 'tier': o['tier']} for o in c.pop('others')]
    cands.sort(key=lambda c: (c['seg']['start'], c['tier']))
    curset = [(int(r['verseId']), float(r['start_s'])) for r in cur]
    out_rows = []
    for c in cands:
        g = c['seg']
        sid, ok = shabad_for(g)
        in_key = any(v == g['verseId'] and abs(st - g['start']) <= 0.5 for v, st in curset)
        k, s = c['k'], c['s']
        chk = (min(k['check'], s['check']) if k and s else g['check'])
        ev = {'tier': c['tier'], 'est_right_pangti': PREC[c['tier']],
              'karanbir': k and {'start_s': k['start'], 'end_s': k['end'], 'check': k['check'], 'conf': k['conf']},
              'surinder': s and {'start_s': s['start'], 'end_s': s['end'], 'check': s['check'], 'conf': s['conf']},
              'start_diff_s': round(abs(k['start'] - s['start']), 2) if k and s else None,
              'in_current_key': in_key, 'verse_in_keyed_shabad': ok,
              'shabad_row': [shab[g['row']][1], shab[g['row']][2]] if g['row'] < len(shab) else None,
              'aligner': 'line-build.js two-model forced alignment, cloud run 2026-10-15 (Azure gab-lines/align)'}
        if c.get('conflict'): ev['other_model_pangti_here'] = c['conflict']
        if not ok:  # the aligned pangti is not in any keyed Shabad / Bani: the key changed after the 2026-10-15 run
            ev['verse_found_in'] = [k for k, v in verse_cache.items() if str(g['verseId']) in v][:3]
            ev['key_mismatch'] = 'aligned text is not in the current key for this window; a person decides the key'
        agree_prior = PREC[c['tier']]
        out_rows.append({'recording': rid, 'category': category, 'folder': folder, 'split': m['split'],
                         'verseId': g['verseId'], 'shabadId': int(sid) if sid and str(sid).isdigit() else sid,
                         'text': g['text'], 'start_s': g['start'], 'end_s': g['end'],
                         'aligner_conf': round(chk, 3), 'confidence_flag': 'high' if (c['tier'] == 'A' and chk >= MIN_CONF) or in_key else 'low',
                         'verify': {'pangti_must_match': True, 'min_agreement': 0.95, 'each_checker_min_conf': 0.95, 'agreement_prior': agree_prior,
                                    'auto_accept_eligible': c['tier'] == 'A' and chk >= MIN_CONF and ok},
                         'evidence': ev})
    rows += out_rows
    # gaps: keyed time no candidate covers (>= 2 s): alaap / simran / katha / silence, or not aligned
    def merged(rs):
        sp = sorted((r['start_s'], r['end_s']) for r in rs)
        out = []
        for a, b in sp:
            if out and a - out[-1][1] < MERGE_GAP_S: out[-1][1] = max(out[-1][1], b)
            else: out.append([a, b])
        return out
    all_sp = merged(out_rows)
    hi_sp = merged([r for r in out_rows if r['confidence_flag'] == 'high'])
    gaps = []
    for _, a, b in shab:
        t = a
        for x, y in all_sp:
            if y <= a or x >= b: continue
            if x - t >= MIN_GAP_S: gaps.append([round(t, 2), round(x, 2)])
            t = max(t, y)
        if b - t >= MIN_GAP_S: gaps.append([round(t, 2), round(min(b, dur), 2)])
    cur_sp = merged([{'start_s': float(r['start_s']), 'end_s': float(r['end_s'])} for r in cur
                     if r.get('confidence') in (None, '') or float(r['confidence']) >= MIN_CONF])
    per.append({'recording': rid, 'category': category, 'folder': folder, 'split': m['split'], 'duration_s': dur, 'gurdwara': m.get('gurdwara', ''),
                'coverage_before': cov_before, 'coverage_before_recomputed': round(coverage(cur_sp, shab, dur), 3),
                'coverage_after_all_candidates': round(coverage(all_sp, shab, dur), 3),
                'coverage_after_high_only (current key + new tier A)': round(coverage(hi_sp, shab, dur), 3),
                'candidates': len(out_rows), 'by_tier': dict(collections.Counter(r['evidence']['tier'] for r in out_rows)),
                'new_vs_current_key': sum(not r['evidence']['in_current_key'] for r in out_rows),
                'gaps': [{'start_s': a, 'end_s': b, 'kind': 'gap (alaap / simran / katha / silence, or not aligned): not a pangti'} for a, b in gaps]})

doc = {'batch': os.path.basename(re.sub(r'\.json$', '', OUT)), 'made': '2026-10-23', 'status': 'CANDIDATES - not labels; human / verifier sign-off required',
       'selection': f'named recordings {",".join(IDS)} (dropped from {FILE}: below the 60% bar or no pangti key); held-out test split and labels/accepted/ excluded' if IDS else f'{FOLDER} recordings with pangti coverage in [{LO:.0%}, {HI:.0%}) in timeline-pangti/rescore-report.json '
                    f'({FILE}), closest to the 60% bar first, max {MAX}; held-out test split and labels/accepted/ excluded',
       'verify_rule': 'every checker (each Fable / Opus verifier, plus the aligner) must name the same verseId for the span, '
                      'each with confidence >= 0.95; accept only then, else send to a person',
       'tiers': {'A': 'both models, same pangti, start within 1 s, check >= 0.5 (~97% right pangti)',
                 'B': 'both models agree, check < 0.5 (~65%)', 'C': 'one model only (~41%)',
                 'D': 'one model only, other model put a different pangti here (conflict)'},
       'recordings': per, 'candidates': rows}
# OUT = the candidate rows (a list, one per pangti span); OUT-coverage.json = per-recording coverage before/after + gaps
json.dump(rows, open(OUT, 'w'), ensure_ascii=False, indent=1)
doc.pop('candidates')
json.dump(doc, open(re.sub(r'\.json$', '', OUT) + '-coverage.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(per)} recordings, {len(rows)} candidates')
for p in per:
    print(p['recording'], p['coverage_before'], p['coverage_before_recomputed'], p['coverage_after_high_only (current key + new tier A)'], p['coverage_after_all_candidates'], p['by_tier'], p['new_vs_current_key'], len(p['gaps']))
