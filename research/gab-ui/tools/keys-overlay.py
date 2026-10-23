#!/usr/bin/env python3
"""keys-overlay.py [--keys labels/keys-final] [--hf-dir <HF copy>] [--out gen/keys-final-ds]

Builds a scoring copy of the HF answer-key dataset with labels/keys-final overlaid (manifest.csv from keys-final,
lines.csv / shabads.csv of the merged recordings; every other recording dir is a symlink to the HF copy), for
GAB_HF_DS=<out> node tools/pangti-timeline.js --out timeline-pangti-v2.
"""
import os, shutil, sys
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
opt = lambda k, d: sys.argv[sys.argv.index(f'--{k}') + 1] if f'--{k}' in sys.argv else d
KEYS = os.path.abspath(opt('keys', f'{G}/labels/keys-final'))
HF = opt('hf-dir', os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4'))
OUT = os.path.abspath(opt('out', f'{G}/gen/keys-final-ds'))
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)
shutil.copy(f'{KEYS}/manifest.csv', f'{OUT}/manifest.csv')
os.symlink(f'{HF}/human-verdicts', f'{OUT}/human-verdicts')
n = 0
for root, dirs, files in os.walk(HF):
    if 'lines.csv' in files or 'shabads.csv' in files:
        rel = os.path.relpath(root, HF)
        dst = f'{OUT}/{rel}'
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.isdir(f'{KEYS}/{rel}'):
            shutil.copytree(f'{KEYS}/{rel}', dst); n += 1
        else:
            os.symlink(root, dst)
        dirs[:] = []
print(f'{OUT}: {n} recordings from {KEYS}, the rest linked to {HF}')
