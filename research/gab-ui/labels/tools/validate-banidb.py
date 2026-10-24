#!/usr/bin/env python3
"""validate-banidb.py [--hf-dir <HF answer-key copy>] [--in <rows json glob>] [--report <json>]   (2026-10-23)

--in / --report (indep full run): check another set of label rows (same row fields) and write the report elsewhere;
the defaults are unchanged (labels/accepted/*.json, labels/remerge/validation-report.json).

Database check of every labels/accepted/*.json row BEFORE merge-keys.py. A label only maps audio to an existing
pangti (verseId) of the Gurbani database; Gurbani text is never written, altered or taken from model output.
A row is KEPT only when all of these hold, otherwise it is DROPPED (never edited) and listed in
labels/remerge/validation-report.json:
  1. exists     its verseId exists in BaniDB (api.banidb.com, responses cached in research/gab-ui/verse-cache.json:
                '<shabadId>' -> {verseId: unicode} from /v2/shabads/<id>, 'bani:<id>' from /v2/banis/<id>) or in the
                STTM Desktop Gurbani database (corpus dump ~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json
                and labels/bani-verse-cache.json, made by tools/bani-verses.js from a copy of the app's database);
  2. belongs    the verseId is a pangti of a Shabad / Bani that the recording's shabads.csv keys over the span's time
                (window +-3 s; a 'a|b' row allows either). shabads.csv has no parmaan marking, so a parmaan Shabad
                counts only when it is keyed as its own row;
  3. text       the row's stored 'text' equals, character for character, the database text for that verseId (BaniDB
                unicode, or the STTM database text). No normalising, no spelling fixes.
"""
import csv, glob, json, os, sys, time, urllib.request

B = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # research/gab-ui
L = f'{B}/labels'
opt = lambda k, d: sys.argv[sys.argv.index(f'--{k}') + 1] if f'--{k}' in sys.argv else d
HF = opt('hf-dir', os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4'))
WIN = 3.0
CACHE_P = f'{B}/verse-cache.json'
cache = json.load(open(CACHE_P))
fetched = []

def banidb(spec):
    """{verseId(str): unicode} for '<shabadId>' or 'bani:<id>' from BaniDB, cached in verse-cache.json."""
    if cache.get(spec):
        return cache[spec]
    url = f'https://api.banidb.com/v2/banis/{spec[5:]}' if spec.startswith('bani:') else f'https://api.banidb.com/v2/shabads/{spec}'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'gab-ui'}), timeout=60) as r:
        d = json.load(r)
    m = {}
    for v in d['verses']:
        vv = v['verse'] if 'verseId' in v.get('verse', {}) else v  # banis: {verse: {verseId, verse: {unicode}}}; shabads: {verseId, verse: {unicode}}
        m[str(vv['verseId'])] = vv['verse']['unicode']
    cache[spec] = m
    fetched.append(spec)
    time.sleep(0.3)
    return m

corpus = json.load(open(os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')))
sttm_text = {str(r['verseId']): r['text'] for r in corpus}
sttm_shabads = {str(r['verseId']): {str(s) for s in (r.get('shabadIds') or [r['shabadId']])} for r in corpus}
sttm_bani = json.load(open(f'{L}/bani-verse-cache.json'))  # STTM database (app copy): '<id>' / 'bani:<id>' -> {verseId: text}

man = {m['id']: m for m in csv.DictReader(open(f'{HF}/manifest.csv', encoding='utf-8', newline=''))}
keyrows = {}
def windows(rid):
    if rid not in keyrows:
        f = f"{HF}/{man[rid]['content_folder']}/{rid}/shabads.csv"
        keyrows[rid] = [(r['shabadId'].split('|'), float(r['start_s']), float(r['end_s']))
                        for r in csv.DictReader(open(f, encoding='utf-8', newline='')) if r.get('shabadId')]
    return keyrows[rid]

def members(spec):
    """verse ids of a keyed Shabad / Bani in BaniDB and in the STTM database."""
    out = dict(banidb(spec))
    for k, v in sttm_bani.get(spec, {}).items():
        out.setdefault(k, v)
    if not spec.startswith('bani:'):
        out.update({k: sttm_text[k] for k, s in sttm_shabads.items() if spec in s and k not in out})
    return out

report = {'made': time.strftime('%Y-%m-%d'), 'hf_dir': HF, 'checks': ['exists', 'belongs', 'text'], 'files': {}, 'dropped': []}
tot_in = tot_keep = 0
for f in sorted(glob.glob(opt('in', f'{L}/accepted/*.json'))):
    rows = json.load(open(f))
    keep = []
    for r in rows:
        vid = str(r['verseId'])
        bdb = {}
        why = []
        specs = [s for ids, a, b in windows(r['recording']) if a - WIN <= r['end_s'] and r['start_s'] <= b + WIN for s in ids]
        allspecs = [s for ids, _, _ in windows(r['recording']) for s in ids]
        for s in dict.fromkeys(allspecs):
            bdb.update(banidb(s))
        in_banidb = vid in bdb
        in_sttm = vid in sttm_text or any(vid in v for v in sttm_bani.values())
        if not (in_banidb or in_sttm):
            why.append('exists: verseId not in BaniDB nor the STTM database')
        owner = [s for s in specs if vid in members(s)]
        if not owner:
            why.append(f'belongs: verseId not in the Shabad/Bani keyed over {r["start_s"]}-{r["end_s"]} s ({"|".join(specs) or "none"})')
        db_texts = {t for t in (bdb.get(vid), sttm_text.get(vid), *(v.get(vid) for v in sttm_bani.values())) if t}
        if r.get('text') is not None and r['text'] not in db_texts:
            why.append('text: stored text differs from the database text for this verseId')
        if why:
            report['dropped'].append({k: r.get(k) for k in ('recording', 'category', 'verseId', 'shabadId', 'start_s', 'end_s', 'basis', 'source_batch')}
                                     | {'why': why, 'db_text_banidb': bdb.get(vid), 'db_text_sttm': sttm_text.get(vid), 'stored_text': r.get('text')})
            continue
        r['db_check'] = {'banidb': in_banidb, 'sttm': in_sttm, 'keyed_in': owner[0],
                         'text_equals': 'banidb' if r.get('text') == bdb.get(vid) else 'sttm'}
        keep.append(r)
    report['files'][os.path.basename(f)] = {'in': len(rows), 'kept': len(keep), 'dropped': len(rows) - len(keep)}
    tot_in += len(rows); tot_keep += len(keep)
    json.dump(keep, open(f, 'w'), ensure_ascii=False, indent=1)
report['totals'] = {'in': tot_in, 'kept': tot_keep, 'dropped': tot_in - tot_keep, 'banidb_fetched_now': fetched}
json.dump(cache, open(CACHE_P, 'w'), ensure_ascii=False)
REPORT = opt('report', f'{L}/remerge/validation-report.json')
os.makedirs(os.path.dirname(REPORT), exist_ok=True)
json.dump(report, open(REPORT, 'w'), ensure_ascii=False, indent=1)
print(f"rows {tot_in}  kept {tot_keep}  dropped {tot_in - tot_keep}  BaniDB fetched now: {fetched}")
for d in report['dropped']:
    print('  DROP', d['recording'], d['verseId'], d['start_s'], d['why'])
