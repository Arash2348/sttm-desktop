#!/usr/bin/env python3
"""Validate the 'Check this computer' bar against every computer that has uploaded a Voice Autopilot session.
Reads only session.json + events.jsonl (perf_tier / perf / audio_backlog) from Azure raw/, read-only.
Per computer: model ms per 4 s window (selfTestMs / passMs), predicted verdict, and what really happened
(audio_backlog = the app fell more than its bound behind the room)."""
import json, os, re, subprocess, sys, collections, statistics
sys.path.insert(0, os.path.dirname(__file__))
SAS = open(os.path.expanduser('~/.vf-azure-sas')).read().strip()
B = 'https://banidb.blob.core.windows.net/voice-follow-training-data'
def get(url):
    return subprocess.run(['curl', '-s', '--max-time', '120', url], capture_output=True, text=True).stdout
# list sessions
names, marker = [], ''
while True:
    x = get(f"{B}?restype=container&comp=list&prefix=raw/&maxresults=5000&{SAS}" + (f"&marker={marker}" if marker else ''))
    names += re.findall(r'<Name>(.*?)</Name>', x)
    m = re.search(r'<NextMarker>(.*?)</NextMarker>', x); marker = m.group(1) if m else ''
    if not marker: break
sess = sorted({n.rsplit('/', 1)[0] for n in names if n.endswith('/events.jsonl')})
def grade(p4):  # same rule as engine/hwcheck.js: follow load = p4/250 + p4/500; find load ~ (2.5*p4)/500
    load = max(p4 / 250 + p4 / 500, 2.5 * p4 / 500)
    return ('great' if load <= 0.5 else 'ok' if load <= 0.8 else 'below'), round(load, 2)
rows = collections.defaultdict(lambda: {'sessions': 0, 'minutes': 0.0, 'backlog': 0, 'peak': 0.0, 'p4': []})
for s in sess:
    ev = get(f"{B}/{s}/events.jsonl?{SAS}")
    p4s, back, peak, tmax = [], 0, 0.0, 0.0
    for line in ev.splitlines():
        if '"perf' not in line and 'audio_backlog' not in line and '"t"' not in line[:12]:
            continue
        try: e = json.loads(line)
        except Exception: continue
        tmax = max(tmax, float(e.get('t') or 0))
        if e.get('type') in ('perf_tier', 'perf'):
            v = e.get('selfTestMs') or e.get('passMs')
            if v: p4s.append(float(v))
        elif e.get('type') == 'audio_backlog':
            back += 1; peak = max(peak, float(e.get('peak') or e.get('seconds') or 0))
    if not p4s: continue
    sj = get(f"{B}/{s}/session.json?{SAS}")
    try: m = json.loads(sj).get('machine', {})
    except Exception: m = {}
    key = (re.sub(r'\s+', ' ', (m.get('cpuModel') or '?')).strip(), m.get('cpus'), m.get('os', '?'), m.get('host', '?'))
    r = rows[key]; r['sessions'] += 1; r['minutes'] += tmax / 60; r['backlog'] += back; r['peak'] = max(r['peak'], peak); r['p4'] += p4s
out = []
for (cpu, cores, osn, host), r in rows.items():
    p4 = statistics.median(r['p4']); v, load = grade(p4)
    perh = r['backlog'] / max(r['minutes'] / 60, 0.01)
    out.append({'cpu': cpu, 'cores': cores, 'os': osn, 'host': host, 'sessions': r['sessions'], 'hours': round(r['minutes'] / 60, 1),
                'ms4s': round(p4), 'load': load, 'verdict': v, 'fellBehindPerHour': round(perh, 1), 'worstBehindS': round(r['peak'], 1)})
out.sort(key=lambda x: -x['ms4s'])
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'fleet-validate.json'), 'w'), indent=1)
print(f"{'computer':46} {'cores':>5} {'os':10} {'sess':>4} {'hours':>5} {'ms/4s':>5} {'load':>5} {'verdict':8} {'fell behind/h':>13} {'worst s':>7}")
for x in out:
    print(f"{x['cpu'][:46]:46} {str(x['cores']):>5} {x['os'][:10]:10} {x['sessions']:4d} {x['hours']:5.1f} {x['ms4s']:5d} {x['load']:5.2f} {x['verdict']:8} {x['fellBehindPerHour']:13.1f} {x['worstBehindS']:7.1f}")
