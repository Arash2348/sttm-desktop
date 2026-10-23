#!/usr/bin/env python3
"""gold-provenance.py <session dir> [...]: are a shadow session's screen changes the sevadaar's own clicks?

A shadow-collector session folder (human.jsonl = the screen, system.jsonl = what Voice Autopilot did) is only a
model-independent "gold" source if the screen was NOT driven by Voice Autopilot. score.json raw.visible == 0 is not
enough: when Autopilot drives the screen, every write goes through mirror() -> system.jsonl first and the screen
(human.jsonl) changes a few ms later. This counts, per session, the screen line changes that an app write to the same
verse led by <= 0.1 s, and the Waheguru slides on screen led by the app's seeking slide. A sevadaar cannot click the
same pangti within 0.1 s after the model on thousands of changes: a high share means the labels are the app's own.
Reads only local copies; prints no names."""
import bisect, json, os, statistics, sys

def jl(p):
    return [json.loads(l) for l in open(p) if l.strip()] if os.path.exists(p) else []

def check(d):
    h, s, ev = jl(f'{d}/human.jsonl'), jl(f'{d}/system.jsonl'), jl(f'{d}/events.jsonl')
    sv = [x for x in s if x.get('verseId') is not None]; svt = [x['t'] for x in sv]
    ss = [x['t'] for x in s if x.get('slide') is True]
    n = led = own = sl = sll = 0; gaps = []; prev = None
    for r in h:
        v = r.get('verseId')
        if r.get('slide'):
            if prev is None or not prev.get('slide'):
                sl += 1; i = bisect.bisect_right(ss, r['t']) - 1
                sll += i >= 0 and r['t'] - ss[i] <= 0.1
        elif v and (prev is None or prev.get('verseId') != v or prev.get('slide')):
            n += 1; i = bisect.bisect_right(svt, r['t']) - 1
            if i >= 0 and sv[i]['verseId'] == v and r['t'] - sv[i]['t'] <= 0.1: led += 1; gaps.append(1000 * (r['t'] - sv[i]['t']))
            else: own += 1
        prev = r
    vis = sum(e.get('type') in ('vf_visible', 'vf_hidden') for e in ev)
    return dict(session=os.path.basename(d.rstrip('/')), line_changes=n, app_led=led, app_led_pct=round(100 * led / max(n, 1), 1),
                median_gap_ms=round(statistics.median(gaps)) if gaps else None, slides_app_led=f'{sll}/{sl}', own_clicks=own,
                visible_events=vis, verdict='MODEL-DRIVEN (not gold)' if n and led / n > 0.2 else 'human-driven')

if __name__ == '__main__':
    for d in sys.argv[1:]: print(json.dumps(check(d)))
