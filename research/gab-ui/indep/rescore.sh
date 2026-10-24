#!/bin/bash
# rescore.sh   (2026-10-23 full run) pangti re-score of 9.0.5 / 10.0.4 / 10.0.5 / 9.0.8 with ONLY the independent keys
# plus the existing human / broadcast-caption keys (no aligned-2model / aligned-3check rows), into timeline-indep/.
# Same recipe as timeline-pangti-v3 (labels/OVERVIEW.md): pangti-timeline.js for 9.0.5 / 10.0.4 / 10.0.5 from the
# saved replay traces, gab-quick (same scoring code) for 9.0.8. Coverage rule 60% (COVER_MIN default).
set -e
G="$(cd "$(dirname "$0")/.." && pwd)"
cd "$G"
python3 indep/export.py
python3 indep/overlay.py --out gen/indep-ds
export GAB_HF_DS=$G/gen/indep-ds
rm -rf timeline-indep
GAB_TIMELINE_SRC=$G/timeline-orig nice -n 19 node tools/pangti-timeline.js --out timeline-indep
rm -rf gen/gab-cache-indep
node tools/quick-keys-v2.js timeline-indep gen/gab-cache-indep
nice -n 19 node tools/gab-quick.js f475fd9a --keys-cache gen/gab-cache-indep --set all --jobs 4 || echo "gab-quick exit $?"
python3 - "$G" <<'EOF'
import json, os, sys, glob, shutil
G = sys.argv[1]
q = sorted(glob.glob(f'{G}/quick-out/q-f475fd9a-gab-cache-indep/timeline/q-f475fd9a-gab-cache-indep-*.json'))
for f in q:
    cat = f.rsplit('-', 1)[1][:-5]
    d = json.load(open(f)); d['label'] = 'Gurbani Autopilot 9.0.8'
    json.dump(d, open(f'{G}/timeline-indep/v908-f475fd9a-{cat}.json', 'w'))
# four-build tier index, as on the viewer (site/timeline/index.json lists 9.0.5, 10.0.4, 10.0.5, 9.0.8 per tier)
shutil.copyfile(f'{G}/site/timeline/index.json', f'{G}/timeline-indep/index.json')
print('9.0.8 files:', len(q))
EOF
