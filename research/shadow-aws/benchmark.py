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
from datetime import date

BUCKET = 's3://vf-shadow-sessions-680476617406'
AWS = [os.path.expanduser('~/.local/bin/aws'), '--profile', 'gurbani-prod', '--region', 'us-east-2']
HERE = os.path.dirname(os.path.abspath(__file__))

SCORER = os.path.join(HERE, '..', '..', 'www', 'main', 'addons', 'voice-follow', 'shadow', 'score.js')
SUM_KEYS = ['kirtan', 'held', 'idle', 'paused', 'agree', 'early', 'wrong', 'behind', 'none',
            'heldAgree', 'heldBehind', 'heldWrong', 'heldNone', 'idleQuiet',
            'idleEarly', 'linger', 'falseAlarm', 'lineSeconds', 'lineAgree', 'switches', 'matched']


def score_session(d):
    """Score one raw session folder with the shared scorer. Returns its result dict."""
    out = subprocess.run([shutil.which('node') or 'node', SCORER, d], capture_output=True, text=True, check=True)
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


def run(root, write=True):
    index, total, by_tester, lines, listen_lines = [], {}, {}, [], []
    for tester, day, sess, d in sessions(root):
        res = score_session(d)
        sc, segments = res['raw'], res['segments']
        try:
            meta = json.load(open(os.path.join(d, 'session.json')))
        except (OSError, json.JSONDecodeError):
            meta = {}
        t = meta.get('tester') or {}
        who = t.get('name') or tester
        row = {'tester': tester, 'name': who, 'gurdwara': t.get('gurdwara', ''), 'date': day, 'session': sess,
               'app': meta.get('app'), 'build': meta.get('build'), 'platform': meta.get('platform'),
               **summarize(sc)}
        index.append(row)
        add(total, sc)
        for x in res['listen']:
            a = x.get('audio') or {}
            listen_lines.append(f"| {who} | {sess[:16]} | {x['from']}-{x['to']} ({x['seconds']} s) | {x['kind']} | "
                                f"{x['human']} | {x['system']} | {a.get('file', '')} @ {a.get('offset', '')} |")
        add(by_tester.setdefault(who, {}), sc)
        if write:
            out = os.path.join(root, 'derived', sess)
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, 'segments.jsonl'), 'w') as f:
                f.writelines(json.dumps(s) + '\n' for s in segments)
            json.dump({**row, 'raw': sc, 'switches': res['switches']}, open(os.path.join(out, 'score.json'), 'w'),
                      indent=1)
            with open(os.path.join(out, 'listen.jsonl'), 'w') as f:
                f.writelines(json.dumps(x) + '\n' for x in res['listen'])
    if write:
        os.makedirs(os.path.join(root, 'index'), exist_ok=True)
        with open(os.path.join(root, 'index', 'sessions.jsonl'), 'w') as f:
            f.writelines(json.dumps(r) + '\n' for r in index)
    cols = list(summarize({**{k: 0 for k in SUM_KEYS}, 'switchDelays': []}).keys())
    lines.append('| who | ' + ' | '.join(cols) + ' |')
    lines.append('|' + '---|' * (len(cols) + 1))
    for r in index:
        lines.append(f"| {r['name']} {r['session'][:16]} | " + ' | '.join(str(r[c]) for c in cols) + ' |')
    for who, sc in by_tester.items():
        s = summarize(sc)
        lines.append(f'| **{who} (all)** | ' + ' | '.join(str(s[c]) for c in cols) + ' |')
    if total:
        s = summarize(total)
        lines.append(f'| **ALL SANGAT** | ' + ' | '.join(str(s[c]) for c in cols) + ' |')
    if listen_lines:
        lines += ['', '**Listen list** (disagreements to settle by ear):', '',
                  '| who | session | when | kind | human | system | audio |', '|---|---|---|---|---|---|---|']
        lines += listen_lines
    report = '\n'.join(lines)
    if write:
        os.makedirs(os.path.join(root, 'reports'), exist_ok=True)
        open(os.path.join(root, 'reports', f'{date.today().isoformat()}.md'), 'w').write(report + '\n')
    return index, total, report


def main():
    root = HERE
    if '--local' not in sys.argv:
        subprocess.run(AWS + ['s3', 'sync', f'{BUCKET}/raw', os.path.join(root, 'raw'), '--exclude', '*.webm',
                              '--only-show-errors'], check=True)
    _, _, report = run(root)
    print(report)
    if '--publish' in sys.argv:
        for part in ('derived', 'index', 'reports'):
            subprocess.run(AWS + ['s3', 'sync', os.path.join(root, part), f'{BUCKET}/{part}', '--only-show-errors'],
                           check=True)


if __name__ == '__main__':
    main()
