#!/bin/bash
# package-hf.sh OUT_DIR - stage the standalone package published to the private HF dataset khalisfoundation/sttm-model-bench:
# this folder's scripts, STTM's search code copied into app-search/ (with the commit it came from), the card, and the
# published result tables. Upload OUT_DIR with huggingface_hub upload_folder (the scoring inputs already live there).
set -euo pipefail
cd "$(dirname "$0")"
OUT=${1:?usage: package-hf.sh OUT_DIR}
ROOT=$(git rev-parse --show-toplevel)
VF=www/main/addons/voice-follow
rm -rf "$OUT" && mkdir -p "$OUT/app-search/engine/retrieval" "$OUT/app-search/components" "$OUT/results/published"
cp bench.sh run.sh fetch.py infer.py score.js wer.py latency.py summary.py make_v2_frontend.py sample.json \
   requirements.txt gab-do-not-train.csv MODEL-GUIDE.md "$OUT/"
cp HF-CARD.md "$OUT/README.md"
{ printf '> In this package: start with README.md and `./bench.sh`. The app search code is in `app-search/`, so no STTM checkout is needed;\n> the paths and commands below are written for the STTM repo (`research/model-bench`).\n\n'; cat README.md; } > "$OUT/README-method.md"
cp RESULTS-*.md results*.md results*.json results-latency-*.log "$OUT/results/published/" 2>/dev/null || true
cp "$ROOT/$VF/engine/retrieval/text-index.js" "$OUT/app-search/engine/retrieval/"
cp "$ROOT/$VF/engine/fuzz.js" "$OUT/app-search/engine/"
cp "$ROOT/$VF/components/switchPolicy.js" "$OUT/app-search/components/"
COMMIT=$(git -C "$ROOT" log -1 --format=%H -- "$VF/engine/retrieval/text-index.js" "$VF/engine/fuzz.js" "$VF/components/switchPolicy.js")
printf '{\n "sttm_repo": "KhalisFoundation/sttm-desktop",\n "sttm_commit": "%s",\n "files": {\n  "engine/retrieval/text-index.js": "%s/engine/retrieval/text-index.js",\n  "engine/fuzz.js": "%s/engine/fuzz.js",\n  "components/switchPolicy.js": "%s/components/switchPolicy.js"\n }\n}\n' \
  "$COMMIT" "$VF" "$VF" "$VF" > "$OUT/app-search/SOURCE.json"
printf 'data/\ntranscripts/\ntranscripts-lines/\nresults/*\n!results/published/\nlocal-models.json\n.venv/\n' > "$OUT/.gitignore"
chmod +x "$OUT/bench.sh" "$OUT/run.sh"
echo "staged $OUT (app search from $COMMIT)"
