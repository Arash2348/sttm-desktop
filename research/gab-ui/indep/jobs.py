#!/usr/bin/env python3
"""jobs.py -> out/jobs-full.json   (2026-10-23 full run)

Every GAB recording (HF answer-key copy 701fee8e59c4 manifest) that is NOT in the held-out test split and has a
HUMAN Shabad-level key (shabads.csv rows with source=human) or a broadcast-caption key (Sehaj / Akhand Paath),
with local audio. Order: Paath (Banis read + Sehaj/Akhand Paath), Kirtan, Akhand Kirtan, Sung Bani.
Only shabads.csv is looked at; no lines.csv is read here. Skipped recordings are listed with the reason.
"""
import csv, json, os
H = os.path.expanduser('~')
HERE = os.path.dirname(os.path.abspath(__file__))
HF = f'{H}/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4'
VB = f'{H}/personal/vf-benchmark'
CL = f'{H}/personal/live-darbar-venues/clips'
FORM = {'2': 'paath', '4': 'paath', '1': 'kirtan', '5': 'akhand', '3': 'sungbani'}
ORDER = ['paath', 'kirtan', 'akhand', 'sungbani']

def audio(r):
    c = [f"{CL}/{r['source_file']}"] if r['source_file'] else []
    c += [f"{VB}/{r['audio']}", f"{VB}/{r['content_folder']}/{r['id']}/audio.wav"]
    return next((p for p in c if os.path.isfile(p)), None)

def keydir(r):
    for d in (f"{HF}/{r['content_folder']}/{r['id']}", f"{VB}/{r['content_folder']}/{r['id']}"):
        if os.path.isfile(f'{d}/shabads.csv'):
            return d
    return None

jobs, skipped = [], []
for r in csv.DictReader(open(f'{HF}/manifest.csv', encoding='utf-8')):
    form = FORM[r['content_folder'][0]]
    if r['split'] == 'test':
        continue
    kd = keydir(r)
    src = {x.get('source') for x in csv.DictReader(open(f'{kd}/shabads.csv'))} if kd else set()
    ok = 'human' in src or (r['content_folder'].startswith('4-') and 'broadcast-caption' in src)
    a = audio(r)
    if not ok:
        skipped.append(dict(id=r['id'], form=form, folder=r['content_folder'], why='no human Shabad-level key (shabads.csv)' + ('' if a else '; no local audio')))
        continue
    if kd and any(x.get('shabadId') and not (x.get('start_s') and x.get('end_s')) for x in csv.DictReader(open(f'{kd}/shabads.csv'))):
        skipped.append(dict(id=r['id'], form=form, folder=r['content_folder'], why='human key lists the Shabads (Ang range) without start/end times: no keyed time to label or score'))
        continue
    if not a:
        skipped.append(dict(id=r['id'], form=form, folder=r['content_folder'], why='audio missing on this Mac'))
        continue
    jobs.append(dict(id=r['id'], form=form, folder=r['content_folder'], split=r['split'], lines_source=r['lines_source'],
                     dur=float(r['duration_s'] or 0), audio=a, keydir=kd))
jobs.sort(key=lambda j: ORDER.index(j['form']))
json.dump(dict(jobs=jobs, skipped=skipped), open(f'{HERE}/out/jobs-full.json', 'w'), indent=1)
for f in ORDER:
    js = [j for j in jobs if j['form'] == f]
    print(f, len(js), f"{sum(j['dur'] for j in js)/3600:.2f} h", 'skipped', len([s for s in skipped if s['form'] == f]))
