# Upload plan: overnight pangti labels (NOT run, the owner signs off first)

Made 2026-10-23 from `labels/accepted/*.json` (batches 1, 2, 3, 4, 6; batch 5 has only 2 of the 3 checkers' votes, so
it has no accepted rows). Nothing below has been uploaded. Every command writes to a Khalis Foundation repo, so each one
waits for the owner's OK.

Read-only check done 2026-10-23: the Hugging Face dataset `khalisfoundation/GurbaniAutopilotBench` (revision
64fb0253) still has the same `manifest.csv` and the same 4 `lines.csv` files as the local copy
`~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4` that `labels/keys-final` was merged from. The dataset is
**public**, so anything uploaded there is public straight away.

## (a) Dataset `khalisfoundation/GurbaniAutopilotBench`: new pangti rows, source `aligned-3check`

Only 4 of the 299 accepted rows are new to the key. The other 295 sit on a pangti row that the key already scores
(same pangti, overlapping time). Those rows stay as they are, and the 295 confirmations are listed in
`keys-final/confirmed-3check.csv`. The merge found no conflicts and changed no existing row; the 4 new rows are
additions only.

| file in the dataset (path = local `labels/keys-final/<path>`) | change |
|---|---|
| `1-kirtan-shabad/rn21/lines.csv` | +1 row: 22187, 117.32-123.44 s, 0.97, aligned-3check |
| `1-kirtan-shabad/rn64/lines.csv` | +1 row: 35084, 97.68-112.2 s, 0.96, aligned-3check |
| `1-kirtan-shabad/rn73/lines.csv` | +1 row: 32574, 38.56-46.04 s, 0.97, aligned-3check |
| `3-bani-sung-like-kirtan/aarti/aa05/lines.csv` | +1 row: 75017, 208.76-213.08 s, 0.96, aligned-3check |
| `manifest.csv` | those 4 rows only: `lines_n` +1 and `lines_source` `aligned-2model-audited` -> `aligned-2model-audited+aligned-3check` |

Not proposed for upload: the 4 `shabads.csv` files (copied unchanged), `confirmed-3check.csv` (could later become
`human-verdicts/aligned-3check/confirmed.csv` if the owner wants the confirmations public) and `merge-report.json`.

Commands (run from `~/personal/sttm-ws3/research/gab-ui`):

```sh
# 0. re-check the dataset has not moved since the merge (must print "unchanged"); if it moved, re-merge from a fresh
#    snapshot: python3 labels/tools/merge-keys.py --hf-dir <fresh snapshot dir>
cat > /tmp/gab-up-check.py <<'EOF'
import os, filecmp
from huggingface_hub import hf_hub_download
tok = open(os.path.expanduser('~/.vf-hf-token')).read().strip()
base = os.path.expanduser('~/personal/live-darbar-venues/cache/gab-hf/701fee8e59c4/')
same = all(filecmp.cmp(hf_hub_download('khalisfoundation/GurbaniAutopilotBench', f, repo_type='dataset', token=tok,
                                       local_dir='gen/hf-check'), base + f, shallow=False)
           for f in ['manifest.csv', '1-kirtan-shabad/rn21/lines.csv', '1-kirtan-shabad/rn64/lines.csv',
                     '1-kirtan-shabad/rn73/lines.csv', '3-bani-sung-like-kirtan/aarti/aa05/lines.csv'])
print('unchanged' if same else 'MOVED: re-merge first')
EOF
uv run -q --with 'huggingface_hub>=0.30' python3 -I /tmp/gab-up-check.py

# 1. upload the 5 files in one commit (OWNER SIGN-OFF FIRST)
cat > /tmp/gab-up-keys.py <<'EOF'
import os
from huggingface_hub import HfApi, CommitOperationAdd
api = HfApi(token=open(os.path.expanduser('~/.vf-hf-token')).read().strip())
K = 'labels/keys-final'
files = ['1-kirtan-shabad/rn21/lines.csv', '1-kirtan-shabad/rn64/lines.csv', '1-kirtan-shabad/rn73/lines.csv',
         '3-bani-sung-like-kirtan/aarti/aa05/lines.csv', 'manifest.csv']
api.create_commit('khalisfoundation/GurbaniAutopilotBench', repo_type='dataset',
                  operations=[CommitOperationAdd(path_in_repo=f, path_or_fileobj=f'{K}/{f}') for f in files],
                  commit_message='Pangti keys: +4 rows (source aligned-3check: machine timing, accepted only when all 3 '
                                 'independent checkers named the same pangti, each confidence >= 0.95; not human)')
EOF
uv run -q --with 'huggingface_hub>=0.30' python3 -I /tmp/gab-up-keys.py
```

Afterwards, keep the scoring copy in step by refreshing the local HF copy (or point `GAB_HF_DS` at
`gen/keys-final-ds`, which `tools/keys-overlay.py` builds), and refresh the private quick-runner cache key set
(`gab-quick --build-cache` / `--push` to `khalisfoundation/GAB-cache`) so `aa05` joins the Sung Bani quick set.

## (b) GAB viewer Spaces: timelines re-scored with these keys (`timeline-pangti-v2`)

`timeline-pangti-v2/` holds the pangti-level re-score of 9.0.5, 10.0.4 and 10.0.5 (`tools/pangti-timeline.js` from
the saved replays, keys = `labels/keys-final` over the HF copy). It also holds the new 9.0.8 timelines
(`v908-f475fd9a-*.json`, from `gab-quick f475fd9a --keys-cache gen/gab-cache-v2`), which are added to
`index-extra.json`. Building the site changes the following:

| Space | what changes |
|---|---|
| `khalisfoundation/GAB` (public, YouTube-source recordings only) | `timeline/index.json` + 6 new `timeline/v908-f475fd9a-*.json` (9.0.8 in every tab). The 18 existing timeline files come out byte-identical to the current local build (`site/timeline`): the only recording whose key changed in a scored set (aa05) is not public. |
| `khalisfoundation/GAB-leaderboard` (private) | `timeline/index.json`, 6 new 9.0.8 files, and the 3 Sung Bani files (9.0.5 / 10.0.4 / 10.0.5) now include aa05 (28 -> 29 recordings). The `hard` and `real` tabs are unchanged. Only `timeline.html` + `timeline/` go there; its `index.html` leaderboard is left alone. |

Dry run, already done (`GAB_SITE_OUT=<scratch>`): public 6 tabs × 4 builds; 9.0.8 Akhand Paath has 3 of 4 public
(5 of 8 private) recordings, because 3 recordings miss the model-output cache.

Commands (run from `~/personal/sttm-ws3/research/gab-ui`, after (a) or independently):

```sh
# 1. build both data sets from timeline-pangti-v2 (overwrites site/timeline and private-fixed/timeline)
GAB_PANGTI_DIR=timeline-pangti-v2 python3 tools/build-site.py
python3 tools/build-audio.py            # private page audio index (adds aa05 if missing)

# 2. leak scan of the public folder: no private ids / names / links (must print nothing)
grep -rlE 'kh[0-9]{2}_sttm|nw11_|rt11_|ut13_|asingh|@gmail|drive.google' site/timeline site/*.html || true

# 3. upload (OWNER SIGN-OFF FIRST)
cat > /tmp/gab-up-spaces.py <<'EOF'
import os
from huggingface_hub import HfApi
api = HfApi(token=open(os.path.expanduser('~/.vf-hf-token')).read().strip())
api.upload_folder(repo_id='khalisfoundation/GAB', repo_type='space', folder_path='site',
                  allow_patterns=['timeline/*.json'], delete_patterns=['timeline/*.json'],
                  commit_message='GAB viewer: pangti re-score with the overnight aligned-3check keys; 9.0.8 in every tab')
api.upload_folder(repo_id='khalisfoundation/GAB-leaderboard', repo_type='space', folder_path='private-fixed',
                  allow_patterns=['timeline/*.json', 'audio/*'],
                  commit_message='GAB viewer (private): pangti re-score with the overnight aligned-3check keys; 9.0.8; aa05 in Sung Bani')
EOF
uv run -q --with 'huggingface_hub>=0.30' python3 -I /tmp/gab-up-spaces.py
```

Do not write to `khalisfoundation/GAB` or `khalisfoundation/GAB-leaderboard` from any other session. ws3 owns
these pages.
