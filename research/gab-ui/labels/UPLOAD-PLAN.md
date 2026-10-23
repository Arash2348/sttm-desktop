# Upload plan: calibrated pangti labels (NOT run, the owner signs off first)

Made 2026-10-23 from `labels/accepted/batch1-6.json` (re-merged with `labels/calibrated-rule.json`, checked against
BaniDB / the STTM Gurbani database by `labels/tools/validate-banidb.py`, merged by `labels/tools/merge-keys.py`).
Nothing below has been uploaded. Every command writes to a Khalis Foundation repo, so each one waits for the owner's OK.

**The dataset `khalisfoundation/GurbaniAutopilotBench` is PUBLIC.** Anything uploaded there is public straight away.
Before uploading, re-check that it still matches the local copy `~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4`
(step 0); if it moved, re-merge from a fresh snapshot.

## (a) Dataset `khalisfoundation/GurbaniAutopilotBench`: new pangti rows

161 new rows (30.0 sung minutes) in 39 recordings: 160 Kirtan rows with source `aligned-3check-calibrated`
(confidence column = the per-span measured score: 1.0 tier A, 0.983 tier B, 0.963 tier C) and 1 Sung Bani row (aa05)
with source `aligned-3check` (strict rule). Existing rows are never changed (checked: every existing row of the 39
files is present unchanged). 1,157 accepted rows confirm a row the key already scores and are listed in
`keys-final/confirmed-3check.csv` (not uploaded). Conflicts: 2 accepted rows overlap an existing scored row of the
neighbouring pangti by 1-3 s (clip41 24412, rn63 2436) and were not added; 74 overlap another accepted row (mostly the
same pangti found by each model separately) and only the first was added. No human row was touched.

| file in the dataset (path = local `labels/keys-final/<path>`) | change |
|---|---|
| `1-kirtan-shabad/<id>/lines.csv` for clip03, clip06, clip07, clip09, clip10, clip12, clip13, clip17, clip18, clip19, clip20, clip25, clip26, clip27, clip28, clip30, clip32, clip33, clip36, clip40, clip41, rn09, rn10, rn11, rn12, rn21, rn22, rn30, rn31, rn52, rn60, rn61, rn63, rn64, rn66, rn71, rn73, rn80 | + rows, source `aligned-3check-calibrated` |
| `3-bani-sung-like-kirtan/aarti/aa05/lines.csv` | +1 row: 75017, source `aligned-3check` |
| `manifest.csv` | those 39 rows only: `lines_n` and `lines_source` (`...+aligned-3check-calibrated` / `+aligned-3check`) |

Not proposed for upload: the `shabads.csv` copies (unchanged), `confirmed-3check.csv`, `merge-report.json`.

Hold back (owner choice): clip17 (key says Shabad 3085 for 30-1000 s, but checker 3 heard other Shabads from
~440 s) and clip12 (two possible Shabads for one window). Their new rows lie inside the part of the key that is not in
doubt, but a person should settle those keys first. To leave them out, drop their two paths from `files` below and
re-run `merge-keys.py` after removing their rows from `accepted/`.

Commands (run from `~/personal/sttm-ws3/research/gab-ui`):

```sh
# 0. the dataset has not moved since the merge (must print "unchanged")
cat > /tmp/gab-up-check.py <<'EOF'
import os, glob, filecmp
from huggingface_hub import hf_hub_download
tok = open(os.path.expanduser('~/.vf-hf-token')).read().strip()
base = os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4/')
K = 'labels/keys-final/'
files = ['manifest.csv'] + sorted(p[len(K):] for p in glob.glob(K + '**/lines.csv', recursive=True))
same = all(filecmp.cmp(hf_hub_download('khalisfoundation/GurbaniAutopilotBench', f, repo_type='dataset', token=tok,
                                       local_dir='gen/hf-check'), base + f, shallow=False) for f in files)
print('unchanged' if same else 'MOVED: re-merge first')
EOF
uv run -q --with 'huggingface_hub>=0.30' python3 -I /tmp/gab-up-check.py

# 1. upload the 39 lines.csv files + manifest.csv in one commit (OWNER SIGN-OFF FIRST; the dataset is PUBLIC)
cat > /tmp/gab-up-keys.py <<'EOF'
import os, glob
from huggingface_hub import HfApi, CommitOperationAdd
api = HfApi(token=open(os.path.expanduser('~/.vf-hf-token')).read().strip())
K = 'labels/keys-final/'
files = ['manifest.csv'] + sorted(p[len(K):] for p in glob.glob(K + '**/lines.csv', recursive=True))
assert len(files) == 40, len(files)
api.create_commit('khalisfoundation/GurbaniAutopilotBench', repo_type='dataset',
                  operations=[CommitOperationAdd(path_in_repo=f, path_or_fileobj=K + f) for f in files],
                  commit_message='Pangti keys: +161 rows in 39 recordings (aligned-3check-calibrated: machine timing, all 3 '
                                 'independent checkers named the same pangti, aligner tier A/B/C, measured 98.3% right on '
                                 'human keys (Kirtan); verseIds checked against BaniDB; not human; existing rows unchanged)')
EOF
uv run -q --with 'huggingface_hub>=0.30' python3 -I /tmp/gab-up-keys.py
```

Afterwards: refresh the local HF copy (or point `GAB_HF_DS` at `gen/keys-final-ds-v3`, built by
`python3 tools/keys-overlay.py --out gen/keys-final-ds-v3`), then refresh the private quick-runner key set
(`gab-quick --build-cache` and `gab-quick --push` to `khalisfoundation/GAB-cache`, which refuses if that dataset is not
private) so the 12 newly passing Kirtan recordings and aa05 join the quick sets. Until then use
`gab-quick <ref> --keys-cache gen/gab-cache-v3`.

## (b) GAB viewer Spaces: timelines re-scored with these keys (`timeline-pangti-v3`)

`timeline-pangti-v3/` holds the pangti-level re-score of 9.0.5, 10.0.4 and 10.0.5 (`tools/pangti-timeline.js`,
`GAB_HF_DS=gen/keys-final-ds-v3 GAB_TIMELINE_SRC=timeline-orig`) and 9.0.8 (`v908-f475fd9a-*.json`, from
`gab-quick f475fd9a --keys-cache gen/gab-cache-v3 --set all`). Kirtan grows from 7 to 19 scored recordings
(18 for 10.0.4, which has no replay for one of them).

| Space | what changes |
|---|---|
| `khalisfoundation/GAB` (public, YouTube-source recordings only) | `timeline/*.json`: the Kirtan tab gains the newly passing public recordings in every build; 9.0.8 in every tab |
| `khalisfoundation/GAB-leaderboard` (private) | `timeline/*.json` (same, plus private recordings; Sung Bani keeps aa05), `audio/*` for new recordings. Its `index.html` leaderboard is left alone |

Commands (run from `~/personal/sttm-ws3/research/gab-ui`, after (a) or independently):

```sh
# 1. build both data sets from timeline-pangti-v3 (overwrites site/timeline and private-fixed/timeline)
GAB_PANGTI_DIR=timeline-pangti-v3 python3 tools/build-site.py
python3 tools/build-audio.py            # private mp3 + index for the newly kept recordings (reads private-fixed/timeline)
GAB_PANGTI_DIR=timeline-pangti-v3 python3 tools/build-site.py   # again, so site/audio copies the new public mp3s

# 2. leak scan of the public folder: no private ids / names / links (must print nothing)
grep -rlE 'kh[0-9]{2}_sttm|nw11_|rt11_|ut13_|asingh|@gmail|drive.google' site/timeline site/*.html || true

# 3. upload (OWNER SIGN-OFF FIRST)
cat > /tmp/gab-up-spaces.py <<'EOF'
import os
from huggingface_hub import HfApi
api = HfApi(token=open(os.path.expanduser('~/.vf-hf-token')).read().strip())
api.upload_folder(repo_id='khalisfoundation/GAB', repo_type='space', folder_path='site',
                  allow_patterns=['timeline/*.json', 'audio/*'], delete_patterns=['timeline/*.json'],
                  commit_message='GAB viewer: pangti re-score with the calibrated 3-checker keys (Kirtan 7 -> 19 recordings); 9.0.8 in every tab')
api.upload_folder(repo_id='khalisfoundation/GAB-leaderboard', repo_type='space', folder_path='private-fixed',
                  allow_patterns=['timeline/*.json', 'audio/*'],
                  commit_message='GAB viewer (private): pangti re-score with the calibrated 3-checker keys; 9.0.8')
EOF
uv run -q --with 'huggingface_hub>=0.30' python3 -I /tmp/gab-up-spaces.py
```

Do not write to `khalisfoundation/GAB` or `khalisfoundation/GAB-leaderboard` from any other session. ws3 owns
these pages.
