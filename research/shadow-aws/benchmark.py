#!/usr/bin/env python3
"""Official Voice-Follow benchmark from sangat shadow sessions.

    python3 benchmark.py            # sync raw/ from S3 (no audio), score, write derived/ index/ reports/
    python3 benchmark.py --local    # score what is already in ./raw
    python3 benchmark.py --publish  # also upload derived/ index/ reports/ back to S3

Layout (S3 and local mirror):
    raw/<tester>/<date>/<session>/   session.json human.jsonl system.jsonl activity.jsonl events.jsonl audio-*.webm
    derived/<session>/               segments.jsonl score.json      (recomputable from raw)
    index/sessions.jsonl             one line per session: who, where, when, minutes per state, score
    reports/<date>.md                the benchmark table

Every second of a session gets exactly one state:
    paused  - Voice-Follow was paused (busy computer) or the mic was down: not scored
    idle    - no Gurbani on the sevadaar's screen (before the service, slides): a Voice-Follow
              shabad here is a FALSE ALARM
    kirtan  - Gurbani on screen AND singing/speech heard (activity within +-ACT_WIN_S):
              the core benchmark
    held    - Gurbani on screen but nothing heard (katha pause, silence): reported separately
Scoring (kirtan seconds): Voice-Follow AGREES when its shabad/Bani is one the sevadaar showed
within +-LAG_S; WRONG when it shows another; NONE when it shows nothing. Line agreement is
counted only while the sevadaar is actively following (changed line within STALE_S).
"""
import json
import os
import subprocess
import sys
from datetime import date

BUCKET = 's3://vf-shadow-sessions-680476617406'
AWS = [os.path.expanduser('~/.local/bin/aws'), '--profile', 'gurbani-prod', '--region', 'us-east-2']
HERE = os.path.dirname(os.path.abspath(__file__))

LAG_S = 5          # the sevadaar clicks late, Voice-Follow sometimes early
ACT_WIN_S = 5      # "something is being heard" looks this far either side
LETTERS_MIN = 6    # letters in a recognised window that count as words being heard
LEVEL_MIN = 0.003  # RMS loudness that counts as sound (quiet room is ~0.001)
STALE_S = 60       # no line change for this long: the sevadaar is not following lines
MATCH_CAP_S = 180  # a human switch never followed within this counts as missed


def read_jsonl(path):
    out = []
    if not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def content_key(label):
    if not label or label.get('slide'):
        return None
    if label.get('bani') is not None:
        return f"bani:{label['bani']}"
    if label.get('ceremony') is not None:
        return f"ceremony:{label['ceremony']}"
    if label.get('shabadId') is not None:
        return f"shabad:{label['shabadId']}"
    return None


def per_second(events, length, merge=False):
    """Step function: the label in force at each whole second."""
    out, cur, j = [], {}, 0
    events = sorted(events, key=lambda e: e.get('t', 0))
    for sec in range(length):
        while j < len(events) and events[j].get('t', 0) <= sec + 0.999:
            e = {k: v for k, v in events[j].items() if k != 't'}
            if merge:
                cur = {**cur, **e}
                if e.get('shabadId') is not None:
                    cur['slide'] = None
            else:
                cur = e
            j += 1
        out.append(dict(cur))
    return out


def score_session(d):
    """Score one raw session folder. Returns (segments, score)."""
    human_ev = read_jsonl(os.path.join(d, 'human.jsonl')) or read_jsonl(os.path.join(d, 'timeline.jsonl'))
    system_ev = read_jsonl(os.path.join(d, 'system.jsonl'))
    act_ev = read_jsonl(os.path.join(d, 'activity.jsonl'))
    events = read_jsonl(os.path.join(d, 'events.jsonl'))
    ends = [e.get('t', 0) for e in human_ev + system_ev + act_ev + events]
    length = int(max(ends)) + 1 if ends else 0
    human = per_second(human_ev, length)
    system = per_second(system_ev, length, merge=True)
    level = [0.0] * length
    letters = [0] * length
    for a in act_ev:
        t = int(a.get('t', 0))
        if 0 <= t < length:
            level[t] = max(level[t], a.get('level', 0) or 0)
            letters[t] = max(letters[t], a.get('letters', 0) or 0)
    have_activity = bool(act_ev)
    paused = [False] * length
    state_on = False
    last = 0
    for e in sorted(events, key=lambda x: x.get('t', 0)):
        if e.get('type') in ('paused', 'resumed'):
            t = min(length, int(e['t']))
            for k in range(last, t):
                paused[k] = state_on
            state_on = e['type'] == 'paused'
            last = t
    for k in range(last, length):
        paused[k] = state_on

    hkey = [content_key(h) for h in human]
    skey = [content_key(s) for s in system]
    hverse = [h.get('verseId') if hkey[i] else None for i, h in enumerate(human)]
    sverse = [s.get('verseId') if skey[i] else None for i, s in enumerate(system)]
    # Last second the sevadaar changed line (for "actively following").
    last_line_change = [-10 ** 9] * length
    prev = None
    lc = -10 ** 9
    for i in range(length):
        if (hkey[i], hverse[i]) != prev:
            lc = i
            prev = (hkey[i], hverse[i])
        last_line_change[i] = lc

    def heard(i):
        if not have_activity:
            return True
        lo, hi = max(0, i - ACT_WIN_S), min(length, i + ACT_WIN_S + 1)
        return any(letters[k] >= LETTERS_MIN and level[k] >= LEVEL_MIN for k in range(lo, hi))

    states = []
    for i in range(length):
        if paused[i]:
            states.append('paused')
        elif not hkey[i]:
            states.append('idle')
        elif heard(i):
            states.append('kirtan')
        else:
            states.append('held')

    sc = {k: 0 for k in ['kirtan', 'held', 'idle', 'paused', 'agree', 'wrong', 'none', 'held_agree',
                         'held_wrong', 'held_none', 'false_alarm', 'line_seconds', 'line_agree',
                         'switches', 'matched']}
    match_secs = []
    for i in range(length):
        st = states[i]
        sc[st] += 1
        lo, hi = max(0, i - LAG_S), min(length, i + LAG_S + 1)
        hset = {hkey[k] for k in range(lo, hi) if hkey[k]}
        if st == 'idle':
            if skey[i] and skey[i] not in hset:
                sc['false_alarm'] += 1
            continue
        if st not in ('kirtan', 'held'):
            continue
        pre = '' if st == 'kirtan' else 'held_'
        if not skey[i]:
            sc[pre + 'none'] += 1
        elif skey[i] in hset:
            sc[pre + 'agree'] += 1
            if st == 'kirtan' and hverse[i] is not None and i - last_line_change[i] <= STALE_S:
                sc['line_seconds'] += 1
                hv = {hverse[k] for k in range(lo, hi) if hkey[k] == skey[i] and hverse[k] is not None}
                if sverse[i] in hv or any(sverse[k] in hv for k in range(lo, hi) if skey[k] == skey[i]):
                    sc['line_agree'] += 1
        else:
            sc[pre + 'wrong'] += 1
    # Time to match: each sevadaar change to new Gurbani during kirtan.
    for i in range(1, length):
        if hkey[i] and hkey[i] != hkey[i - 1] and states[i] == 'kirtan':
            sc['switches'] += 1
            lo = max(0, i - LAG_S)
            for k in range(lo, min(length, i + MATCH_CAP_S)):
                if skey[k] == hkey[i]:
                    sc['matched'] += 1
                    match_secs.append(max(0, k - i))
                    break
    segments, start = [], 0
    for i in range(1, length + 1):
        if i == length or states[i] != states[start]:
            segments.append({'from': start, 'to': i, 'state': states[start]})
            start = i
    sc['match_seconds'] = sorted(match_secs)
    return segments, sc


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def summarize(sc):
    k = sc['kirtan']
    ms = sc['match_seconds']
    return {
        'kirtan_min': round(k / 60, 1),
        'agree_pct': pct(sc['agree'], k),
        'wrong_pct': pct(sc['wrong'], k),
        'none_pct': pct(sc['none'], k),
        'line_agree_pct': pct(sc['line_agree'], sc['line_seconds']),
        'switches': sc['switches'],
        'matched_pct': pct(sc['matched'], sc['switches']),
        'median_s_to_match': ms[len(ms) // 2] if ms else None,
        'held_min': round(sc['held'] / 60, 1),
        'held_wrong_pct': pct(sc['held_wrong'], sc['held']),
        'idle_min': round(sc['idle'] / 60, 1),
        'false_alarm_pct': pct(sc['false_alarm'], sc['idle']),
        'paused_min': round(sc['paused'] / 60, 1),
    }


def add(a, b):
    for key, v in b.items():
        if isinstance(v, list):
            a[key] = sorted(a.get(key, []) + v)
        else:
            a[key] = a.get(key, 0) + v
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
    index, total, by_tester, lines = [], {}, {}, []
    for tester, day, sess, d in sessions(root):
        segments, sc = score_session(d)
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
        add(by_tester.setdefault(who, {}), sc)
        if write:
            out = os.path.join(root, 'derived', sess)
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, 'segments.jsonl'), 'w') as f:
                f.writelines(json.dumps(s) + '\n' for s in segments)
            json.dump({**row, 'raw': sc}, open(os.path.join(out, 'score.json'), 'w'), indent=1)
    if write:
        os.makedirs(os.path.join(root, 'index'), exist_ok=True)
        with open(os.path.join(root, 'index', 'sessions.jsonl'), 'w') as f:
            f.writelines(json.dumps(r) + '\n' for r in index)
    cols = ['kirtan_min', 'agree_pct', 'wrong_pct', 'none_pct', 'line_agree_pct', 'switches', 'matched_pct',
            'median_s_to_match', 'held_min', 'held_wrong_pct', 'idle_min', 'false_alarm_pct', 'paused_min']
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
