#!/bin/bash
set -euo pipefail
H="$(cd "$(dirname "$0")" && pwd)"; W=$(mktemp -d); L=/home/user/gab/lines
node "$H/../../results-sync.js" pull --prefix gab-lines --dir "$L" >/dev/null
R=https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/main
curl -sS -f -H "Authorization: Bearer $HF_TOKEN" -o "$W/manifest.main.csv" $R/manifest.csv
curl -sS -f -H "Authorization: Bearer $HF_TOKEN" -o "$W/README.main.md" $R/README.md
cp "$H/add-docs.js" "$H/spot20-items.json" "$W/"
node "$H/build.js" "$W" "$L"
node "$W/add-docs.js"
node -e 'const fs=require("fs");const W=process.argv[1];const f=JSON.parse(fs.readFileSync(W+"/files.json"));const nd=[JSON.stringify({key:"header",value:{summary:"Pangti-level answer keys (aligned, 2 models, audited)",description:"Two speech models must agree within 1 s and hear the pangti words; 97% right pangti against GAB-Hard human keys; owner spot check 20/20 (Oct 15 2026). Shown as information, never the headline. See human-verdicts/pangti-spot-check."}}),...f.map(x=>JSON.stringify({key:"file",value:{path:x.path,content:Buffer.from(x.content).toString("base64"),encoding:"base64"}}))].join("\n");fs.writeFileSync(W+"/commit.ndjson",nd)' "$W"
Q="?create_pr=1"; [[ " $* " == *" --main "* ]] && Q=""
curl -sS -X POST -H "Authorization: Bearer $HF_TOKEN" -H "Content-Type: application/x-ndjson" --data-binary @"$W/commit.ndjson" "https://huggingface.co/api/datasets/khalisfoundation/GurbaniAutopilotBench/commit/main$Q"; echo
