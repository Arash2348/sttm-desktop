#!/usr/bin/env python3
"""Known-answer test for benchmark.py: a hand-built 100 s session whose every number is worked
out by hand below. Run: python3 test_benchmark.py  (exits non-zero on any mismatch)."""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import benchmark as B  # noqa: E402

# Timeline (seconds):
#   0-19   sevadaar shows nothing (idle). System shows shabad 5 from 10-19  -> 10 s FALSE ALARM
#   20     sevadaar opens shabad 1, line 11; singing heard 20-79
#   25     system reaches shabad 1 line 11                                  -> 5 s NONE, match in 5 s
#   35     sevadaar moves to line 12; system follows at 36
#   50     sevadaar switches to shabad 2 line 21; system still on shabad 1:
#          50-54 still AGREE (shabad 1 was shown within +-5 s), 55-59 WRONG
#   60     system reaches shabad 2 line 21                                  -> match in 10 s
#   70     system drifts to line 22 (sevadaar stays on 21)                  -> lines disagree 75-84
#   80-99  silence; sevadaar leaves shabad 2 up. Words-heard window keeps 80-84 as kirtan,
#          85-99 is HELD (15 s), system still on shabad 2                   -> 15 s held agree
EXPECT = {
    'idle': 20, 'false_alarm': 10,
    'kirtan': 65, 'agree': 55, 'none': 5, 'wrong': 5,
    'held': 15, 'held_agree': 15, 'held_wrong': 0, 'held_none': 0,
    'switches': 2, 'matched': 2, 'match_seconds': [5, 10],
    'line_seconds': 55, 'line_agree': 45,
    'paused': 0,
}


def write(d, name, rows):
    with open(os.path.join(d, name), 'w') as f:
        f.writelines(json.dumps(r) + '\n' for r in rows)


def build(root):
    d = os.path.join(root, 'raw', 'testerA', '2026-01-01', '2026-01-01T00-00-00-000Z')
    os.makedirs(d)
    json.dump({'tester': {'name': 'Test Singh', 'gurdwara': 'Test'}}, open(os.path.join(d, 'session.json'), 'w'))
    write(d, 'human.jsonl', [
        {'t': 0, 'shabadId': None, 'verseId': None, 'bani': None, 'slide': None},
        {'t': 20, 'shabadId': 1, 'verseId': 11, 'bani': None, 'slide': None},
        {'t': 35, 'shabadId': 1, 'verseId': 12, 'bani': None, 'slide': None},
        {'t': 50, 'shabadId': 2, 'verseId': 21, 'bani': None, 'slide': None},
    ])
    write(d, 'system.jsonl', [
        {'t': 10, 'shabadId': 5, 'verseId': 51},
        {'t': 20, 'shabadId': None, 'verseId': None},
        {'t': 25, 'shabadId': 1, 'verseId': 11},
        {'t': 36, 'verseId': 12},
        {'t': 60, 'shabadId': 2, 'verseId': 21},
        {'t': 70, 'verseId': 22},
    ])
    write(d, 'activity.jsonl', [
        {'t': t, 'level': 0.05 if 20 <= t <= 79 else 0.0005, 'letters': 10 if 20 <= t <= 79 else 0}
        for t in range(100)
    ])
    write(d, 'events.jsonl', [])


def main():
    root = tempfile.mkdtemp(prefix='vfbench-')
    try:
        build(root)
        index, total, report = B.run(root)
        bad = [(k, v, total.get(k)) for k, v in EXPECT.items() if total.get(k) != v]
        print(report)
        seg = open(os.path.join(root, 'derived', '2026-01-01T00-00-00-000Z', 'segments.jsonl')).read().strip()
        print(seg)
        if bad:
            for k, want, got in bad:
                print(f'MISMATCH {k}: expected {want}, got {got}')
            sys.exit(1)
        print(f'PASS: all {len(EXPECT)} known answers match')
    finally:
        shutil.rmtree(root)


if __name__ == '__main__':
    main()
