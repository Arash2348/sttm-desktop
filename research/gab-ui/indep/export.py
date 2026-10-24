#!/usr/bin/env python3
"""export.py [--tag full_agree]   (2026-10-23 full run)

Two-model agreement predictions (out/pred/<tag>/<id>.json, label.py combine) -> HF-layout keys:
  keys/<content_folder>/<id>/lines.csv    verseId,start_s,end_s,confidence,source   (source = indep-mms2-agree)
  keys/<content_folder>/<id>/shabads.csv  copied unchanged from the human Shabad-level key (or broadcast-caption key)
  keys/manifest.csv                       the HF manifest rows of these recordings, lines_source = indep-mms2-agree,
                                          plus indep_form / indep_thr / indep_status
A span = consecutive seconds with the same agreed verseId and confidence >= the form's frozen threshold
(FEASIBILITY.md: Paath 0.95; Kirtan / Akhand Kirtan 0.99; Sung Bani 0.99, unproven). Confidence = the lowest second.
Every row then goes through labels/tools/validate-banidb.py (verseId exists in BaniDB / the STTM database and belongs
to the Shabad / Bani keyed over that time); failures are DROPPED, never edited. No Gurbani text is written.
"""
import csv, json, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.dirname(HERE)
HF = os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4')
VB = os.path.expanduser('~/personal/vf-benchmark')
SRC = 'indep-mms2-agree'
THR = {'paath': 0.95, 'kirtan': 0.99, 'akhand': 0.99, 'sungbani': 0.99}
STATUS = {'paath': 'validated (Sehaj Paath, 8 clips)', 'kirtan': 'validated (span 95% LB 96.5% at 0.99)',
          'akhand': 'kirtan method (Akhand Kirtan not measured separately)', 'sungbani': 'unproven (1 recording)'}
opt = lambda k, d: sys.argv[sys.argv.index(f'--{k}') + 1] if f'--{k}' in sys.argv else d
TAG = opt('tag', 'full_agree')
KEYS = f'{HERE}/keys'
TMP = os.environ.get('INDEP_TMP', f'{HERE}/out/tmp')

def spans(pred, conf, thr):
    out, cur = [], None
    for s, (p, c) in enumerate(zip(pred, conf)):
        if p and c >= thr:
            if cur and cur[0] == p and cur[2] == s:
                cur[2] = s + 1; cur[3] = min(cur[3], c)
                continue
            cur = [p, s, s + 1, c]; out.append(cur)
        else:
            cur = None
    return out

def keyed_seconds(kd):
    rows = [(float(r['start_s']), float(r['end_s'])) for r in csv.DictReader(open(f'{kd}/shabads.csv')) if r.get('shabadId')]
    sec = set()
    for a, b in rows:
        sec.update(range(int(a), int(b + 0.999)))
    return len(sec)

def main():
    jobs = json.load(open(f'{HERE}/out/jobs-full.json'))
    hfman = {r['id']: r for r in csv.DictReader(open(f'{HF}/manifest.csv', encoding='utf-8'))}
    fields = list(next(iter(hfman.values())).keys()) + ['indep_form', 'indep_thr', 'indep_status']
    shutil.rmtree(KEYS, ignore_errors=True)
    os.makedirs(TMP, exist_ok=True)
    rows, man, done = [], [], []
    for j in jobs['jobs']:
        pf = f'{HERE}/out/pred/{TAG}/{j["id"]}.json'
        if not os.path.exists(pf):
            continue
        p = json.load(open(pf))
        d = f'{KEYS}/{j["folder"]}/{j["id"]}'
        os.makedirs(d, exist_ok=True)
        shutil.copyfile(f'{j["keydir"]}/shabads.csv', f'{d}/shabads.csv')
        for v, a, b, c in spans(p['pred'], p['conf'], THR[j['form']]):
            rows.append(dict(recording=j['id'], category=j['form'], verseId=int(v), start_s=float(a), end_s=float(b), confidence=round(c, 4)))
        m = dict(hfman[j['id']])
        m.update(lines_source=SRC, indep_form=j['form'], indep_thr=THR[j['form']], indep_status=STATUS[j['form']])
        man.append(m); done.append(j)
    with open(f'{KEYS}/manifest.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(man)
    # database check (drop, never edit)
    tf = f'{TMP}/indep-rows.json'
    json.dump(rows, open(tf, 'w'))
    subprocess.run([sys.executable, f'{G}/labels/tools/validate-banidb.py', '--hf-dir', KEYS, '--in', tf,
                    '--report', f'{HERE}/out/validation-report.json'], check=True, stdout=subprocess.DEVNULL)
    kept = json.load(open(tf))
    os.remove(tf)
    by = {}
    for r in kept:
        by.setdefault(r['recording'], []).append(r)
    stats = {}
    for j, m in zip(done, man):
        rs = sorted(by.get(j['id'], []), key=lambda r: r['start_s'])
        d = f'{KEYS}/{j["folder"]}/{j["id"]}'
        with open(f'{d}/lines.csv', 'w', newline='') as f:
            w = csv.writer(f); w.writerow(['verseId', 'start_s', 'end_s', 'confidence', 'source'])
            for r in rs:
                w.writerow([r['verseId'], f"{r['start_s']:g}", f"{r['end_s']:g}", r['confidence'], SRC])
        m['lines_n'] = len(rs)
        lab = sum(r['end_s'] - r['start_s'] for r in rs)
        ks = keyed_seconds(j['keydir'])
        st = stats.setdefault(j['form'], dict(recordings=0, audio_s=0.0, keyed_s=0, labelled_s=0.0, rows=0, cover60=0, per=[]))
        st['recordings'] += 1; st['audio_s'] += j['dur']; st['keyed_s'] += ks; st['labelled_s'] += lab; st['rows'] += len(rs)
        st['cover60'] += ks > 0 and lab / ks >= 0.6
        st['per'].append(dict(id=j['id'], keyed_s=ks, labelled_s=lab, coverage=round(lab / ks, 3) if ks else 0, rows=len(rs), lines_source_before=j['lines_source']))
    with open(f'{KEYS}/manifest.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(man)
    vr = json.load(open(f'{HERE}/out/validation-report.json'))
    stats['_validation'] = vr['totals']
    json.dump(stats, open(f'{HERE}/out/export-stats.json', 'w'), indent=1)
    for k, s in stats.items():
        if k.startswith('_'):
            continue
        print(f"{k:9s} {s['recordings']:4d} rec  audio {s['audio_s']/3600:5.2f} h  keyed {s['keyed_s']/3600:5.2f} h  labelled {s['labelled_s']/3600:5.2f} h"
              f"  ({s['labelled_s']/max(s['keyed_s'],1):.0%})  rows {s['rows']}  >=60% {s['cover60']}")
    print('validation', vr['totals'])

if __name__ == '__main__':
    main()
