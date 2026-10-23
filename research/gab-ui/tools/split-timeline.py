#!/usr/bin/env python3
"""split-timeline.py <gab run timeline.json> <out_dir> <slug>
Splits one `gab run --keep` timeline (folders 2-bani-recited, 3-bani-sung-like-kirtan, 4-akhand-paath) into the
viewer's per-category files <slug>-paath.json, <slug>-sungbani.json, <slug>-akhandpaath.json, in the same format as
timeline-orig/<slug>-main.json (keys gab,label,commit,set,split,clips,texts; texts renumbered per file)."""
import json, os, re, sys

CATS = [('paath', '2-bani-recited'), ('sungbani', '3-bani-sung-like-kirtan'), ('akhandpaath', '4-akhand-paath')]
src, out, slug = sys.argv[1:4]
# gab-timeline.js finds the YouTube link from cache_id; the Ang-after-Ang rows (ytap_<video>_<start>-<end>) have no
# cache_id, so their link comes from the id. Time-stretched copies (_x1.35) keep yt null: their seconds do not line
# up with the video, so the viewer's player would show the wrong moment.
def yt_from_id(i):
    m = re.match(r'^yt[a-z0-9]*_([\w-]{11})_(\d+)-(\d+)$', i)
    return {'v': m.group(1), 'at': int(m.group(2))} if m else None
d = json.load(open(src))
for key, folder in CATS:
    keep = [c for c in d['clips'] if c['folder'] == folder or c['folder'].startswith(folder + '/')]
    m, texts = {}, []
    def ref(i):
        if i < 0: return i
        if i not in m: m[i] = len(texts); texts.append(d['texts'][i])
        return m[i]
    clips = [{'id': c['id'], 'folder': c['folder'], 'gurdwara': c.get('gurdwara') or '', 'dur': c['dur'], 'basis': c['basis'],
              'kb': c['kb'], 'yt': c['yt'] or yt_from_id(c['id']), 'n': c['n'], 'runs': [[r[0], r[1], r[2], ref(r[3]), ref(r[4])] for r in c['runs']]}
             for c in keep]
    o = {'gab': d['gab'], 'label': None, 'commit': d['commit'], 'set': d['set'],
         'split': 'practice recordings (held-out test set not included)', 'texts': texts, 'clips': clips}
    f = os.path.join(out, f'{slug}-{key}.json')
    json.dump(o, open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f, len(clips), 'clips', len(texts), 'texts')
