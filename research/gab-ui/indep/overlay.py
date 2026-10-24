#!/usr/bin/env python3
"""overlay.py [--out ../gen/indep-ds]   (2026-10-23 full run)

Scoring copy of the HF answer-key dataset (701fee8e59c4) for GAB_HF_DS that holds ONLY human / broadcast-caption
pangti keys and the independent keys (keys/, indep-mms2-agree). Nothing from the app's speech model:
  - lines_source human or broadcast-caption: the HF recording dir as is (symlink); these keys win over indep keys;
  - an indep key exists: keys/<folder>/<id>/ (lines.csv indep-mms2-agree + the human shabads.csv), lines_source
    indep-mms2-agree (not 'human', so the 60% pangti-coverage rule applies to it, like any aligner key);
  - anything else (aligned-2model-audited, aligned-3check, none): shabads.csv only, NO lines.csv, lines_source none
    (so the recording is dropped as 'no pangti key');
  - the replay tools replace the key of a few ids with a saved app-model alignment (sangat-score.js ALIGN_OVERRIDE):
    those rows are left out of the manifest entirely;
  - human-verdicts (ear checks of aligned rows) are not linked: they belong to the aligned rows this copy drops.
"""
import csv, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.dirname(HERE)
HF = os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4')
opt = lambda k, d: sys.argv[sys.argv.index(f'--{k}') + 1] if f'--{k}' in sys.argv else d
OUT = os.path.abspath(opt('out', f'{G}/gen/indep-ds'))
KEYS = f'{HERE}/keys'
ALIGN_OVERRIDE = {'rt11_rehras', 'rt11_aarti', 'rt11_sohila', 'ytasa1_4IXk2t_Irqo_900-1620'}

indep = {r['id']: r for r in csv.DictReader(open(f'{KEYS}/manifest.csv', encoding='utf-8'))}
rows = list(csv.DictReader(open(f'{HF}/manifest.csv', encoding='utf-8')))
fields = list(rows[0].keys())
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)
out, n = [], dict(human=0, caption=0, indep=0, none=0, left_out=[])
for r in rows:
    if r['id'] in ALIGN_OVERRIDE:
        n['left_out'].append(r['id']); continue
    rel = f"{r['content_folder']}/{r['id']}"
    src, dst = f'{HF}/{rel}', f'{OUT}/{rel}'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = dict(r)
    if r['lines_source'] in ('human', 'broadcast-caption'):
        if os.path.isdir(src):
            os.symlink(src, dst)
        n['human' if r['lines_source'] == 'human' else 'caption'] += 1
    elif r['id'] in indep:
        shutil.copytree(f'{KEYS}/{rel}', dst)
        r['lines_source'] = 'indep-mms2-agree'; r['lines_n'] = indep[r['id']]['lines_n']
        n['indep'] += 1
    else:
        os.makedirs(dst)
        if os.path.exists(f'{src}/shabads.csv'):
            shutil.copyfile(f'{src}/shabads.csv', f'{dst}/shabads.csv')
        r['lines_source'] = 'none'; r['lines_n'] = '0'
        n['none'] += 1
    out.append(r)
os.makedirs(f'{OUT}/human-verdicts')
with open(f'{OUT}/manifest.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(out)
print(OUT, n)
