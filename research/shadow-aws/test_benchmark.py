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

# Timeline (seconds), 320 s. Singing heard 10-279 (activity), so "heard" covers 5-284.
#   2-5    mic_error .. mic_restarted                                   -> 4 s PAUSED
#   0-39   sevadaar shows nothing (idle)
#          10-19 system on shabad 5 (never opened by the human)         -> 10 s FALSE ALARM
#          25-39 system on shabad 1; human opens 1 at 40                -> 15 s IDLE EARLY
#   40     human opens shabad 1 line 11 (switch 1: system there since 25 -> delay -15)
#   70     human line 12; system line 12 at 72                         (lines within +-10 s)
#   100-101 human flicks to shabad 9 for 2 s                           -> BLIP, ignored
#   130    human switches to shabad 2 line 21; system stays on 1 till 170 (switch 2: +40)
#          130-134 AGREE (lag), 135-169 BEHIND 35 s (still on the shabad just left)
#          -> one LISTEN entry 2:15-2:50, audio-000 @ 2:15
#   200    system moves to shabad 3; human opens 3 at 220 (switch 3: -20)
#          200-214 EARLY 15 s, 215-219 AGREE (lag)
#   240-259 computer asleep (gap event)                                 -> 20 s PAUSED
#   255    system drifts to line 32 (human stays on 31)
#   270-274 system shows shabad 7, nobody's shabad                     -> 5 s WRONG
#          lines disagree 265-269 and 275-280
#   285-299 nothing heard, shabad 3 up, system on 3                    -> 15 s HELD agree
#   300-319 human shows a slide; system still on 3                     -> 20 s LINGER
# States: kirtan 40-239 + 260-284 = 225, held 15, idle 0-1,6-39,300-319 = 56, paused 24.
# Kirtan: agree 40-134, 170-199, 215-239, 260-269, 275-284 = 170; early 15; behind 35; wrong 5.
# Lines (agreed, sevadaar moved a line within 60 s): 40-134 (95), 170-190 (21), 220-239 (20),
# 260-269 + 275-280 (16) = 152; disagree 265-269 + 275-280 (11) -> 141.
EXPECT = {
    'kirtan': 225, 'held': 15, 'idle': 56, 'paused': 24,
    'agree': 170, 'early': 15, 'behind': 35, 'wrong': 5, 'none': 0,
    'heldAgree': 15, 'heldBehind': 0, 'heldWrong': 0, 'heldNone': 0,
    'idleQuiet': 11, 'idleEarly': 15, 'linger': 20, 'falseAlarm': 10,
    'lineSeconds': 152, 'lineAgree': 141,
    'switches': 3, 'matched': 3, 'switchDelays': [-20, -15, 40],
}
EXPECT_LISTEN = [{'from': '2:15', 'to': '2:50', 'seconds': 35, 'kind': 'behind', 'human': 'shabad:2',
                  'system': 'shabad:1', 'audio': {'file': 'audio-000.webm', 'offset': '2:15'}}]


def write(d, name, rows):
    with open(os.path.join(d, name), 'w') as f:
        f.writelines(json.dumps(r) + '\n' for r in rows)


def build(root):
    d = os.path.join(root, 'raw', 'testerA', '2026-01-01', '2026-01-01T00-00-00-000Z')
    os.makedirs(d)
    json.dump({'tester': {'name': 'Test Singh', 'gurdwara': 'Test'}}, open(os.path.join(d, 'session.json'), 'w'))
    h = lambda t, s, v, slide=None: {'t': t, 'shabadId': s, 'verseId': v, 'bani': None, 'slide': slide}
    write(d, 'human.jsonl', [
        h(0, None, ''), h(40, 1, 11), h(70, 1, 12), h(100, 9, 91), h(102, 1, 12),
        h(130, 2, 21), h(220, 3, 31), h(300, 3, 31, 'vwihgurU'),
    ])
    write(d, 'system.jsonl', [
        {'t': 10, 'shabadId': 5, 'verseId': 51}, {'t': 20, 'shabadId': None, 'verseId': None},
        {'t': 25, 'shabadId': 1, 'verseId': 11}, {'t': 72, 'verseId': 12},
        {'t': 170, 'shabadId': 2, 'verseId': 21}, {'t': 200, 'shabadId': 3, 'verseId': 31},
        {'t': 255, 'verseId': 32}, {'t': 270, 'shabadId': 7, 'verseId': 71},
        {'t': 275, 'shabadId': 3, 'verseId': 32},
    ])
    write(d, 'activity.jsonl', [
        {'t': t, 'level': 0.05 if 10 <= t <= 279 and not 240 <= t < 260 else 0.0,
         'letters': 10 if 10 <= t <= 279 and not 240 <= t < 260 else 0}
        for t in range(320)
    ])
    write(d, 'events.jsonl', [
        {'t': 0, 'type': 'audio_segment', 'file': 'audio-000.webm'},
        {'t': 2, 'type': 'mic_error', 'error': 'test'},
        {'t': 6, 'type': 'mic_restarted'},
        {'t': 150, 'type': 'audio_segment', 'file': 'audio-001.webm'},
        {'t': 260, 'type': 'gap', 'from': 240},
    ])


def main():
    root = tempfile.mkdtemp(prefix='vfbench-')
    try:
        build(root)
        index, total, report = B.run(root)
        bad = [(k, v, total.get(k)) for k, v in EXPECT.items() if total.get(k) != v]
        listen = [json.loads(l) for l in open(os.path.join(root, 'derived', '2026-01-01T00-00-00-000Z', 'listen.jsonl'))]
        if listen != EXPECT_LISTEN:
            bad.append(('listen', EXPECT_LISTEN, listen))
        print(report)
        if bad:
            for k, want, got in bad:
                print(f'MISMATCH {k}: expected {want}, got {got}')
            sys.exit(1)
        print(f'PASS: all {len(EXPECT) + 1} known answers match')
    finally:
        shutil.rmtree(root)


if __name__ == '__main__':
    main()
