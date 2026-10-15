#!/bin/bash
# research/cloud-gab/lines/review-mac.sh — on the owner's Mac: get the latest pangti review queue from Azure and open the
# review page. Answers stay on the Mac (~/personal/gab-lines/answers.jsonl) and are shared back with --push.
#
#   bash research/cloud-gab/lines/review-mac.sh          # pull the queue, start http://localhost:8772, open it
#   bash research/cloud-gab/lines/review-mac.sh --push   # after a session: count + share your answers (Azure gab-lines/)
# Needs: node, ~/.vf-azure-sas (as for vf-check cache pull), the GAB wavs in ~/personal/live-darbar-venues/clips.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
L=${LINES:-$HOME/personal/gab-lines}
mkdir -p "$L"
if [ "${1:-}" = "--push" ]; then
  LINES="$L" node "$HERE/line-apply.js" --lines "$L"
  cp "$L/answers.jsonl" "$L/answers-$(hostname -s).jsonl" 2>/dev/null || true
  node "$HERE/../results-sync.js" push --prefix gab-lines --dir "$L" --skip '^(emis|work|env|final)/|^answers\.jsonl$' --overwrite
  exit 0
fi
node "$HERE/../results-sync.js" pull --prefix gab-lines --dir "$L"
cp -n "$HOME/personal/vf-benchmark/manifest.csv" "$L/manifest.csv" 2>/dev/null || true
( sleep 1.5; open "http://localhost:8772" 2>/dev/null || true ) &
LINES="$L" exec node "$HERE/review-server.js" --lines "$L"
