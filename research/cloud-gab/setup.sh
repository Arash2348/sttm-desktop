#!/bin/bash
# research/cloud-gab/setup.sh — make a Claude cloud container ready to run GAB (Gurbani Autopilot Bench) by replay.
# Idempotent: rerun any time; each step is skipped when already done. See README.md next to this file.
#
#   bash research/cloud-gab/setup.sh            # deps, tools, database, practice audio (train + dev), Mac path layout
#   bash research/cloud-gab/setup.sh --test     # also the test-split audio (only for the final candidate)
#   bash research/cloud-gab/setup.sh --builds "gab-903:3fafc0ba ak-v6:488c3721"   # worktrees under ~/personal
#
# Needs env HF_TOKEN and VF_AZURE_SAS (cloud environment settings). Never prints them.
# Replay only: nothing here runs the speech model or writes to Azure.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
GAB=/home/user/gab
TOOLS_WT=/home/user/gab-tools
TOOLS="$TOOLS_WT/research/level2-dataset/tools"
say() { printf '[cloud-gab] %s\n' "$*"; }
for v in HF_TOKEN VF_AZURE_SAS; do [ -n "${!v:-}" ] || { say "$v is MISSING (add it in the environment settings, then start a new session)"; exit 1; }; done
case "$VF_AZURE_SAS" in *" "*) say "note: VF_AZURE_SAS contains a space; the patched tools strip it, but fix the saved value";; esac

# 1. app dependencies (realm's postinstall analytics call can hang on the proxy: skipped via REALM_DISABLE_ANALYTICS)
if [ ! -f "$REPO/node_modules/realm/build/Release/realm.node" ]; then
  say "npm ci (about 5 min)"
  (cd "$REPO" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null)
  (cd "$REPO/node_modules/realm" && REALM_DISABLE_ANALYTICS=1 npx --no-install prebuild-install --tag-prefix= -r napi)
fi
node -e "require('$REPO/node_modules/realm')" && say "realm ok"

# 2. GAB tools (branch gab-tools-handoff) + the cloud patch (env paths, SAS whitespace)
if [ ! -d "$TOOLS_WT" ]; then
  git -C "$REPO" fetch -q origin gab-tools-handoff
  git -C "$REPO" worktree add -q --detach "$TOOLS_WT" origin/gab-tools-handoff
  git -C "$TOOLS_WT" apply "$REPO/research/cloud-gab/gab-tools-cloud.patch"
fi
ln -sfn "$REPO/node_modules" "$TOOLS_WT/node_modules"

# 3. the Mac layout the tools expect, by symlink (no tool edits needed for paths)
mkdir -p "$GAB"/{bench,clips,userdata} /root/personal/live-darbar-venues/cache "/root/Library/Application Support" /Users/asingh02/AAI/models/karansea-shabad-ctc
ln -sfn "$GAB/clips" /root/personal/live-darbar-venues/clips
ln -sfn "$GAB/bench" /root/personal/vf-benchmark
ln -sfn "$REPO" /root/personal/sttm-desktop
ln -sfn "$GAB/userdata" "/root/Library/Application Support/SikhiToTheMax"
[ -e /Users/asingh02/personal ] || ln -s /root/personal /Users/asingh02/personal
# replay never loads the model; the cache directory is named by its sha (5f9e41d867de in Azure), seeded here.
# --model puts the real int8 model there (needed only to record / fill / align); its sha is checked, and the memo keeps
# the same placeholder sha so saved replays (keyed by it) stay shared between sessions with and without the model
M=/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx
if [[ " $* " == *" --model "* ]] && [ "$(stat -c %s "$M" 2>/dev/null || echo 0)" -lt 1000000 ]; then
  say "speech model (184 MB, public)"
  curl -sSL -f -o "$M.part" "https://huggingface.co/karansea/indicconformer-stt-pa-ctc-shabad-preview/resolve/main/model.int8.onnx?download=true"
  [ "$(sha256sum "$M.part" | cut -c1-12)" = 5f9e41d867de ] || { say "model sha mismatch"; exit 1; }
  mv "$M.part" "$M"
fi
if [[ " $* " == *" --model "* ]] && [ ! -s /home/user/gab/model/surinder/indicconformer-pa-ctc.onnx ]; then
  say "second model for line alignment (Surinder pa-v3-kirtan fp32, 482 MB, public)"
  mkdir -p /home/user/gab/model/surinder
  curl -sSL -f -o /home/user/gab/model/surinder/indicconformer-pa-ctc.onnx "https://huggingface.co/surindersinghssj/indicconformer-pa-v3-kirtan/resolve/main/onnx-pa-only/fp32/indicconformer-pa-ctc.onnx"
fi
[ -s "$M" ] && [ "$(stat -c %s "$M")" -gt 1000000 ] && { mkdir -p /home/user/gab/model; ln -sfn "$M" /home/user/gab/model/model.int8.onnx; }
[ -e "$M" ] || echo "placeholder: replay never runs the model" > "$M"
node -e 'const fs=require("fs"),M=process.argv[1],f="/root/personal/live-darbar-venues/cache/model-sha.json";const st=fs.statSync(M);let m={};try{m=JSON.parse(fs.readFileSync(f))}catch(_){};m[`${fs.realpathSync(M)}|${st.size}|${st.mtimeMs}`]="5f9e41d867de0000placeholder-sha12-from-azure";fs.writeFileSync(f,JSON.stringify(m,null,1))' "$M"
# BSD lockf -> flock
if ! command -v lockf >/dev/null; then
  cat > /usr/local/bin/lockf <<'EOF'
#!/bin/sh
# BSD lockf shim on flock: lockf [-k] [-t 0] file cmd...
nb=""; while [ $# -gt 0 ]; do case "$1" in -k) shift;; -t) [ "$2" = 0 ] && nb="-n -E 75"; shift 2;; -s) shift;; *) break;; esac; done
f="$1"; shift; exec flock $nb "$f" "$@"
EOF
  chmod +x /usr/local/bin/lockf
fi

# 4. public BaniDB database
if [ ! -f "$GAB/userdata/sttmdesktop-evergreen-v2.realm" ]; then
  say "BaniDB database"
  curl -sS -f -o "$GAB/userdata/db.zip" https://banidb.blob.core.windows.net/database/sttmdesktop-evergreen-v2.zip
  (cd "$GAB/userdata" && unzip -o -q db.zip && rm db.zip)
fi

# 5. manifest + audio from Hugging Face (practice split; --test adds the test split)
curl -sS -f -H "Authorization: Bearer $HF_TOKEN" -o "$GAB/bench/manifest.csv" \
  https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/main/manifest.csv
node "$REPO/research/cloud-gab/fetch-audio.js" main,hard,akhand prac
[[ " $* " == *" --test "* ]] && node "$REPO/research/cloud-gab/fetch-audio.js" main,hard,akhand test

# 6. build worktrees (name:rev), node_modules symlinked
specs=""; take=0
for a in "$@"; do case "$a" in --builds) take=1;; --*) take=0;; *) [ $take = 1 ] && specs="$specs $a";; esac; done
if [ -n "$specs" ]; then
  for s in $specs; do
    d="/root/personal/${s%%:*}"
    [ -d "$d" ] || git -C "$REPO" worktree add -q --detach "$d" "${s#*:}"
    ln -sfn "$REPO/node_modules" "$d/node_modules"
  done
fi
# always pass --manifest hf: it fetches the answer keys (shabads.csv / lines.csv); without them every score reads "-"
say "ready. cd $TOOLS && VF_MIN_FREE_GB=3 ./gab run /root/personal/<build> --tier smoke --jobs 4 --manifest hf"
