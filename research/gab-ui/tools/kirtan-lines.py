#!/usr/bin/env python3
"""Build a display-only 'pangti being sung' track for Shabad-keyed sets (Kirtan, Akhand Kirtan) from the HF line keys
(verseId, start_s, end_s; two-model aligned, audited). Scoring is NOT changed; the viewer uses it to show which pangti
is sung. Output: kirtan-lines.json = {clip_id: [[start, end, verseText], ...]} (verse text from BaniDB)."""
import csv, glob, json, os, urllib.request
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cache_p = f'{B}/verse-cache.json'; cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
def shabad(sid):
    if str(sid) in cache: return cache[str(sid)]
    try:
        with urllib.request.urlopen(urllib.request.Request(f'https://api.banidb.com/v2/shabads/{sid}', headers={'User-Agent': 'gab-ui'}), timeout=60) as r:
            d = json.load(r)
    except Exception as e:
        print('skip shabad', sid, e); cache[str(sid)] = {}; return {}
    m = {str(v['verseId']): v['verse']['unicode'] for v in d['verses']}
    cache[str(sid)] = m; return m
out = {}
for f in sorted(glob.glob(f'{B}/hf-keys/*/*/lines.csv')):
    cid = os.path.basename(os.path.dirname(f))
    rows = list(csv.DictReader(open(f)))
    if not rows: continue
    sids = [x for r in csv.DictReader(open(os.path.join(os.path.dirname(f), 'shabads.csv'))) for x in r['shabadId'].split('|') if x.isdigit()]
    verses = {}
    for s in sids: verses.update(shabad(s))
    track = [[round(float(r['start_s']), 1), round(float(r['end_s']), 1), verses.get(r['verseId'], '')] for r in rows]
    out[cid] = [t for t in track if t[2]]
json.dump(cache, open(cache_p, 'w'), ensure_ascii=False)
json.dump(out, open(f'{B}/kirtan-lines.json', 'w'), ensure_ascii=False)
print(len(out), 'recordings with a pangti track;', sum(len(v) for v in out.values()), 'pangti spans')
