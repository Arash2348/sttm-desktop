#!/usr/bin/env python3
"""Official Voice-Follow benchmark from sangat shadow sessions.

    python3 benchmark.py            # sync raw/ from S3 (no audio), score, write derived/ index/ reports/
    python3 benchmark.py --local    # score what is already in ./raw
    python3 benchmark.py --publish  # also upload derived/ index/ reports/ back to S3

Layout (S3 and local mirror):
    raw/<tester>/<date>/<session>/   session.json human.jsonl system.jsonl activity.jsonl events.jsonl audio-*.webm
    derived/<session>/               score.json segments.jsonl listen.jsonl   (recomputable from raw)
    index/sessions.jsonl             one line per session: who, where, when, minutes per state, score
    reports/<date>.md                the benchmark table and the listen list

Each session is scored by www/main/addons/voice-follow/shadow/score.js, the same file the
tester's app runs live, so live and official numbers are one computation. Its header
documents the states (kirtan / held / idle / paused) and the human-timing rules
(lag, early, linger, blip, steady, lines, listen).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import review  # noqa: E402

BUCKET = 's3://vf-shadow-sessions-680476617406'
AWS = [os.path.expanduser('~/.local/bin/aws'), '--profile', 'gurbani-prod', '--region', 'us-east-2']
HERE = os.path.dirname(os.path.abspath(__file__))

SCORER = os.path.join(HERE, '..', '..', 'www', 'main', 'addons', 'voice-follow', 'shadow', 'score.js')
SUM_KEYS = ['kirtan', 'held', 'idle', 'paused', 'agree', 'early', 'wrong', 'behind', 'none',
            'heldAgree', 'heldBehind', 'heldWrong', 'heldNone', 'idleQuiet',
            'idleEarly', 'linger', 'falseAlarm', 'lineSeconds', 'lineAgree', 'switches', 'matched']


def score_session(d, fixes=None):
    """Score one raw session folder with the shared scorer (and human-checked fixes)."""
    args = [shutil.which('node') or 'node', SCORER, d]
    if fixes:
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
            json.dump(fixes, f)
        args.append(f.name)
    try:
        out = subprocess.run(args, capture_output=True, text=True, check=True)
    finally:
        if fixes:
            os.unlink(f.name)
    return json.loads(out.stdout)


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def summarize(sc):
    k = sc['kirtan']
    dl = sorted(sc['switchDelays'])
    return {
        'kirtan_min': round(k / 60, 1),
        'right_when_shown_pct': pct(sc['agree'] + sc['early'], sc['agree'] + sc['early'] + sc['wrong']),
        'wrong_pct': pct(sc['wrong'], k),
        'on_right_shabad_pct': pct(sc['agree'] + sc['early'], k),
        'behind_pct': pct(sc['behind'], k),
        'searching_pct': pct(sc['none'], k),
        'line_pct': pct(sc['lineAgree'], sc['lineSeconds']),
        'switches': sc['switches'],
        'matched_pct': pct(sc['matched'], sc['switches']),
        'median_delay_s': dl[len(dl) // 2] if dl else None,
        'worst_delay_s': dl[-1] if dl else None,
        'held_min': round(sc['held'] / 60, 1),
        'held_right_pct': pct(sc['heldAgree'], sc['held']),
        'idle_min': round(sc['idle'] / 60, 1),
        'false_alarm_pct': pct(sc['falseAlarm'], sc['idle']),
        'paused_min': round(sc['paused'] / 60, 1),
    }


def add(a, b):
    for key in SUM_KEYS:
        a[key] = a.get(key, 0) + b[key]
    a['switchDelays'] = sorted(a.get('switchDelays', []) + b['switchDelays'])
    return a


def sessions(root):
    raw = os.path.join(root, 'raw')
    if not os.path.isdir(raw):
        return
    for tester in sorted(os.listdir(raw)):
        for day in sorted(os.listdir(os.path.join(raw, tester))):
            for sess in sorted(os.listdir(os.path.join(raw, tester, day))):
                d = os.path.join(raw, tester, day, sess)
                if os.path.isdir(d):
                    yield tester, day, sess, d


VERIFIED_COLS = ['right_when_shown_pct', 'wrong_pct', 'on_right_shabad_pct', 'median_delay_s', 'worst_delay_s']


def table(title, rows, cols):
    out = [f'**{title}**', '', '| who | ' + ' | '.join(cols) + ' |', '|' + '---|' * (len(cols) + 1)]
    out += [f'| {name} | ' + ' | '.join(str(r[c]) for c in cols) + ' |' for name, r in rows]
    return out


def run(root, write=True):
    """Score every session: RAW (trusting the sevadaar), the review queue, and VERIFIED
    (RAW plus the verdicts in review/verdicts.jsonl)."""
    vs = review.verdicts(os.path.join(root, 'review', 'verdicts.jsonl'))
    index, items_all = [], []
    total, total_v, by_tester, by_tester_v = {}, {}, {}, {}
    for tester, day, sess, d in sessions(root):
        res = score_session(d)
        sc = res['raw']
        items = review.build_items(sess, d, res)
        items_all += items
        fixes = review.fixes_for(items, vs)
        res_v = score_session(d, fixes) if fixes else res
        try:
            meta = json.load(open(os.path.join(d, 'session.json')))
        except (OSError, json.JSONDecodeError):
            meta = {}
        t = meta.get('tester') or {}
        who = t.get('name') or tester
        pending = [it for it in items if it['id'] not in vs]
        row = {'tester': tester, 'name': who, 'gurdwara': t.get('gurdwara', ''), 'date': day, 'session': sess,
               'app': meta.get('app'), 'build': meta.get('build'), 'platform': meta.get('platform'),
               **summarize(sc), 'verified': summarize(res_v['raw']), 'fixes': len(fixes),
               'to_review': len(pending)}
        index.append(row)
        add(total, sc)
        add(total_v, res_v['raw'])
        add(by_tester.setdefault(who, {}), sc)
        add(by_tester_v.setdefault(who, {}), res_v['raw'])
        if write:
            out = os.path.join(root, 'derived', sess)
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, 'segments.jsonl'), 'w') as f:
                f.writelines(json.dumps(s) + '\n' for s in res['segments'])
            json.dump({**row, 'raw': sc, 'verified_raw': res_v['raw'], 'fixes_applied': fixes,
                       'switches': res['switches']}, open(os.path.join(out, 'score.json'), 'w'), indent=1)
            with open(os.path.join(out, 'listen.jsonl'), 'w') as f:
                f.writelines(json.dumps(x) + '\n' for x in res['listen'])
    if write:
        os.makedirs(os.path.join(root, 'index'), exist_ok=True)
        with open(os.path.join(root, 'index', 'sessions.jsonl'), 'w') as f:
            f.writelines(json.dumps(r) + '\n' for r in index)
        os.makedirs(os.path.join(root, 'review'), exist_ok=True)
        with open(os.path.join(root, 'review', 'queue.jsonl'), 'w') as f:
            f.writelines(json.dumps(it) + '\n' for it in items_all)
    cols = list(summarize({**{k: 0 for k in SUM_KEYS}, 'switchDelays': []}).keys())
    raw_rows = [(f"{r['name']} {r['session'][:16]}", r) for r in index]
    raw_rows += [(f'**{w} (all)**', summarize(sc)) for w, sc in by_tester.items()]
    ver_rows = [(f"{r['name']} {r['session'][:16]}", {**r['verified'], 'fixes': r['fixes'],
                                                       'to_review': r['to_review']}) for r in index]
    ver_rows += [(f'**{w} (all)**', {**summarize(sc), 'fixes': '', 'to_review': ''}) for w, sc in by_tester_v.items()]
    if total:
        raw_rows.append(('**ALL SANGAT**', summarize(total)))
        ver_rows.append(('**ALL SANGAT**', {**summarize(total_v), 'fixes': sum(r['fixes'] for r in index),
                                            'to_review': sum(r['to_review'] for r in index)}))
    lines = table('RAW (trusting the sevadaar)', raw_rows, cols) + ['']
    lines += table('VERIFIED (with human verdicts on suspicious stretches)', ver_rows,
                   VERIFIED_COLS + ['fixes', 'to_review'])
    pending = [it for it in items_all if it['id'] not in vs]
    if pending:
        mins = sum(min(it['seconds'] + 10, 60) for it in pending) / 60
        lines += ['', f'**To review:** {len(pending)} items, about {mins:.0f} min of listening. '
                      'Run `python3 review.py`.', '',
                  '| session | when | type | why | tester | Voice-Follow |', '|---|---|---|---|---|---|']
        lines += [f"| {it['session'][:16]} | {it['from']}-{it['to']} ({it['seconds']} s) | {it['type']} | "
                  f"{', '.join(it['reasons'])} | {it['human']} | {it['system']} |" for it in pending]
    report = '\n'.join(lines)
    if write:
        os.makedirs(os.path.join(root, 'reports'), exist_ok=True)
        open(os.path.join(root, 'reports', f'{date.today().isoformat()}.md'), 'w').write(report + '\n')
    return index, total, report, total_v


def main():
    root = HERE
    if '--local' not in sys.argv:
        subprocess.run(AWS + ['s3', 'sync', f'{BUCKET}/raw', os.path.join(root, 'raw'), '--exclude', '*.webm',
                              '--only-show-errors'], check=True)
        subprocess.run(AWS + ['s3', 'cp', f'{BUCKET}/review/verdicts.jsonl', os.path.join(root, 'review', 'verdicts.jsonl'),
                              '--only-show-errors'], check=False, capture_output=True)
    _, _, report, _ = run(root)
    print(report)
    if '--publish' in sys.argv:
        for part in ('derived', 'index', 'reports', 'review'):
            subprocess.run(AWS + ['s3', 'sync', os.path.join(root, part), f'{BUCKET}/{part}', '--exclude', 'clips/*',
                                  '--only-show-errors'], check=True)


if __name__ == '__main__':
    main()
