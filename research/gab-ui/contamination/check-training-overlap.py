#!/usr/bin/env python3
"""Flag GAB recordings whose audio may appear in a training dataset (e.g. gurbani-captioning/punjabi-ctc-data).
Scans every string column of every parquet row for YouTube video ids from gab-youtube-blocklist.csv, and where the
row carries a start/end time on that video, checks time overlap with the GAB clip. Output: overlap-report.json + .md.
Usage: check-training-overlap.py <hf dataset id or local dir of parquets>"""
import csv, glob, json, os, re, sys
import pyarrow.parquet as pq
H = os.path.dirname(os.path.abspath(__file__))
block = list(csv.DictReader(open(f'{H}/gab-youtube-blocklist.csv')))
byvid = {}
for b in block: byvid.setdefault(b['youtube_id'], []).append(b)
src = sys.argv[1]
if os.path.isdir(src): files = glob.glob(f'{src}/**/*.parquet', recursive=True)
else:
    from huggingface_hub import snapshot_download
    tok = open(os.path.expanduser('~/.vf-hf-token')).read().strip()
    d = snapshot_download(src, repo_type='dataset', token=tok, allow_patterns=['**/*.parquet', '*.json', '*.md'], local_dir=f'{H}/ds-cache')
    files = glob.glob(f'{d}/**/*.parquet', recursive=True)
NUM = re.compile(r'(?:start|offset|begin|from)', re.I)
hits = {}
for f in files:
    t = pq.read_table(f, columns=[c for c in pq.read_schema(f).names if pq.read_schema(f).field(c).type in ('string', 'large_string') or 'int' in str(pq.read_schema(f).field(c).type) or 'float' in str(pq.read_schema(f).field(c).type) or 'double' in str(pq.read_schema(f).field(c).type)])
    cols = t.to_pydict(); n = t.num_rows
    strcols = [c for c, v in cols.items() if v and isinstance(v[0], str)]
    for i in range(n):
        text = ' '.join(str(cols[c][i]) for c in strcols)
        for vid in set(re.findall(r'[A-Za-z0-9_-]{11}', text)) & byvid.keys():
            st = next((cols[c][i] for c in cols if NUM.search(c) and isinstance(cols[c][i], (int, float))), None)
            for b in byvid[vid]:
                ov = None if st is None or not b['start_s'] else (b['start_s'] and float(b['start_s']) - 60 <= st <= float(b['end_s']) + 60)
                if ov is not False: hits.setdefault(b['gab_id'], []).append({'file': os.path.basename(f), 'row': i, 'youtube_id': vid, 'row_start': st, 'time_overlap': ov})
rep = {'dataset': src, 'parquets': len(files), 'gab_youtube_recordings': len(block), 'gab_recordings_with_possible_overlap': len(hits), 'hits': hits}
json.dump(rep, open(f'{H}/overlap-report.json', 'w'), indent=1)
print(json.dumps({k: v for k, v in rep.items() if k != 'hits'}), '; same-video ids:', sorted({h["youtube_id"] for v in hits.values() for h in v})[:30])
