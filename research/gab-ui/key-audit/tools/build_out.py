import json, os, sys, numpy as np
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import verdict as V
OUT = os.path.expanduser('~/personal/sttm-ws3/research/gab-ui/key-audit')
R = [r for r in json.load(open('verdicts.json')) if not r['id'].endswith(('_c33', '_c66'))]
sens = json.load(open('sens.json'))
TIER = {'main': 'Kirtan', 'kbv1': 'Kirtan (Karanbir v1, human keys)', 'akhand': 'Akhand Kirtan', 'sungbani': 'Sung Bani', 'paath': 'Paath', 'akhandpaath': 'Sehaj / Akhand Paath'}
mm = V.mmss
def flag_text(f):
    k = f['kind']
    if k == 'end-late': return f"key runs {f['shift_s']} s past the Shabad's end: from {mm(f['heard_from'])} the hearing is another Shabad until the key ends at {mm(f['key_end'])}"
    if k == 'start-early': return f"key starts ~{f['shift_s']} s early: another Shabad heard {mm(f['heard_from'])}-{mm(f['heard_to'])}"
    if k == 'wrong': return f"other Shabad heard {mm(f['heard_from'])}-{mm(f['heard_to'])}"
    if k == 'parmaan': return f"other Shabad heard {mm(f['heard_from'])}-{mm(f['heard_to'])} ({int(f['heard_to'] - f['heard_from'])} s, parmaan length), not keyed"
    if k == 'simran': return f"Vaheguru simran {mm(f['from'])}-{mm(f['to'])} inside the keyed Shabad"
    if k == 'quiet-end': return f"last {f['shift_s']} s of the key ({mm(f['from'])}-{mm(f['to'])}): no Gurbani heard (Ardas, talk, silence or music)"
    if k == 'quiet-start': return f"first {f['shift_s']} s of the key ({mm(f['from'])}-{mm(f['to'])}): no Gurbani heard (lead-in)"
    if k == 'timing': return f"pangti keys best match the hearing shifted {f['shift_s']:+.1f} s (gain {f['gain']} points)"
    return k
rows = []
for r in R:
    shown = [f for f in r['flags'] if f['kind'] != 'timing' or r['page_shows_pangtis']]
    hidden = [f for f in r['flags'] if f['kind'] == 'timing' and not r['page_shows_pangtis']]
    rows.append({'id': r['id'], 'category': TIER[r['tier']], 'duration_s': r['dur'], 'keyed_on_page_s': r['keyed_s'],
                 'keyed_in_hf_shabads_csv_s': r['hf_keyed_s'], 'page_shows_pangti_keys': r['page_shows_pangtis'],
                 'verdict': r['verdict'], 'hearing_supports_key': r['support'], 'cache_coverage': r['cache_coverage'],
                 'findings': [dict(f, text=flag_text(f)) for f in shown],
                 'hidden_line_key_timing': [dict(f, text=flag_text(f)) for f in hidden], 'timing_scan': r['timing']})
# HF key file vs what the page shows
hf_over = [x for x in rows if x['keyed_in_hf_shabads_csv_s'] - x['keyed_on_page_s'] > 15]
# severity for worst list: seconds the page shows a key that the hearing contradicts
W = {'end-late': 2, 'start-early': 2, 'wrong': 2, 'parmaan': 2, 'simran': 1, 'quiet-end': 1, 'quiet-start': 1}
for x in rows:
    x['_sev'] = sum(W.get(f['kind'], 0) * ((f.get('shift_s') if f['kind'] in ('end-late', 'start-early') else f.get('dur')) or 0) for f in x['findings'])
worst = sorted([x for x in rows if x['_sev'] > 0], key=lambda x: -x['_sev'])[:10]
cnt = defaultdict(Counter)
for x in rows: cnt[x['category']][x['verdict']] += 1
timing = defaultdict(list)
for r in R:
    if r['timing']: timing[(TIER[r['tier']], r['page_shows_pangtis'])].append(r['timing']['best_shift_s'])
summary = {
    'recordings': len(rows), 'keyed_hours_on_page': round(sum(x['keyed_on_page_s'] for x in rows) / 3600, 2),
    'verdicts': Counter(x['verdict'] for x in rows), 'by_category': {k: dict(v) for k, v in cnt.items()},
    'affected_keyed_seconds': sum((f.get('shift_s') if f['kind'] in ('end-late', 'start-early', 'quiet-end', 'quiet-start') else f.get('dur')) or 0 for x in rows for f in x['findings'] if f['kind'] != 'timing'),
    'pangti_timing': {f'{k[0]} ({"shown on page" if k[1] else "line keys not shown on page"})': {'clips': len(v), 'median_best_shift_s': float(np.median(v)), 'within_2s': round(float(np.mean(np.abs(np.array(v)) <= 2)), 2)} for k, v in timing.items()},
    'hf_files_longer_than_page': [{'id': x['id'], 'hf_keyed_s': x['keyed_in_hf_shabads_csv_s'], 'page_keyed_s': x['keyed_on_page_s']} for x in hf_over],
    'calibration': {'margin_points': V.M, 'min_heard_score': V.T, 'sustained_s': V.SPAN, 'share_of_windows': V.FRAC,
                    'false_flags_on_trusted_sets': 'kbv1 0/4, Paath 0/45, Sung Bani 0/12, Sehaj Paath 0/4'},
    'sensitivity_wrong_key_injected': {t: {'caught': sum(s[3] for s in sens if s[1] == t), 'of': sum(1 for s in sens if s[1] == t),
                                           'caught_where_hearing_works': sum(s[3] for s in sens if s[1] == t and (s[2] or 0) >= 0.5),
                                           'of_where_hearing_works': sum(1 for s in sens if s[1] == t and (s[2] or 0) >= 0.5)} for t in ('main', 'akhand', 'kbv1')},
}
summary['affected_pct_of_keyed_time'] = round(100 * summary['affected_keyed_seconds'] / (summary['keyed_hours_on_page'] * 3600), 2)
for x in rows: x.pop('_sev', None)
os.makedirs(OUT, exist_ok=True)
json.dump({'summary': summary, 'worst10': [x['id'] for x in worst], 'recordings': rows}, open(os.path.join(OUT, 'audit.json'), 'w'), ensure_ascii=False, indent=1, default=str)
json.dump({'worst': worst, 'summary': summary, 'rows': rows}, open('out_for_report.json', 'w'), ensure_ascii=False, indent=1, default=str)
print(json.dumps(summary, indent=1, default=str, ensure_ascii=False))
for x in worst:
    print(x['id'], x['category'], x['verdict'], [f['text'] for f in x['findings']], [f.get('heard_pangti') for f in x['findings']])
