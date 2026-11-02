#!/bin/bash
# bench.sh - benchmark YOUR speech model against Karanbir's (the model STTM ships) on the same machine, in one command.
#
#   ./bench.sh --name my-model --onnx path/model.int8.onnx --tokenizer path/bpe.model --blank 512 [--frontend fe.onnx] [--jobs 2]
#
# Steps (each skips work already done, so a re-run resumes):
#   1. fetch the 47 clips, Karanbir's model and the scoring inputs (pinned, sha256-checked; about 1 GB the first time)
#   2. register your model by name (local-models.json) and copy its files into data/models/<name>/
#   3. transcribe 10 s and 4 s windows with both models (4 runs, --jobs in parallel, 4 threads each)
#   4. hit@5 per behaviour (score.js), letter error (wer.py), speed per window (latency.py, 2 threads like a slow PC)
# Results: results/<name>/summary.md (the short table), plus hit5.md, cer.md, latency.json and their .json. Karanbir is always re-run on YOUR machine because CPUs
# differ slightly (x86 vs Apple arm64), and the comparison is only fair on one machine.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
NAME= ONNX= TOK= BLANK= FE= JOBS=1
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME=$2 ;; --onnx) ONNX=$2 ;; --tokenizer) TOK=$2 ;; --blank) BLANK=$2 ;; --frontend) FE=$2 ;; --jobs) JOBS=$2 ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
  shift 2
done
[ -n "$NAME" ] && [ -f "$ONNX" ] && [ -f "$TOK" ] && [ -n "$BLANK" ] || {
  echo "usage: ./bench.sh --name NAME --onnx MODEL.onnx --tokenizer TOKENIZER.model --blank BLANK_ID [--frontend FE.onnx] [--jobs N]"; exit 2; }
case "$NAME" in karanbir|jaspal-v0|jaspal-v1|jaspal-v2|jaspal-v3|jaspal-indic-v0) echo "--name $NAME is a published model; pick another name"; exit 2 ;; esac

$PY fetch.py --models karanbir

D=data/models/$NAME
mkdir -p "$D"
cp "$ONNX" "$D/$(basename "$ONNX")"
cp "$TOK" "$D/$(basename "$TOK")"
FEB=null
if [ -n "$FE" ]; then cp "$FE" "$D/$(basename "$FE")"; FEB="\"$(basename "$FE")\""; fi
$PY - "$NAME" "$(basename "$ONNX")" "$(basename "$TOK")" "$BLANK" "$FEB" <<'EOF'
import json, os, sys
name, onnx, tok, blank, fe = sys.argv[1:]
p = 'local-models.json'
m = json.load(open(p)) if os.path.exists(p) else {}
m[name] = [None, onnx, tok, int(blank), json.loads(fe)]
json.dump(m, open(p, 'w'), indent=1)
EOF

for w in 10 4; do for m in karanbir "$NAME"; do echo "$m $w"; done; done |
  xargs -P "$JOBS" -L 1 sh -c "$PY infer.py --model \$0 --win \$1 > /dev/null"

R=results/$NAME
mkdir -p "$R"
node score.js --models "karanbir-w10,$NAME-w10,karanbir-w4,$NAME-w4" --md "$R/hit5.md" --json "$R/hit5.json"
$PY wer.py --models "karanbir,$NAME" --md "$R/cer.md" --json "$R/cer.json"
$PY latency.py 2 "karanbir,$NAME" | tail -1 > "$R/latency.json"
$PY summary.py "$R"
echo "Full tables in $R/: hit5.md (does the right Shabad come up), cer.md (letter error), latency.json (ms per window)."
