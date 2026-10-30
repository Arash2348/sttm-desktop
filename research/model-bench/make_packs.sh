#!/bin/sh
# make_packs.sh - turn the models fetched by fetch.py into model packs the app engine can run
# (VF_SPEECH_MODEL=<pack>, see www/main/addons/voice-follow/engine/speech-model.js and BENCHMARKS.md).
#   ./make_packs.sh [out dir]    (default: data/packs)
# Files are hard-linked from data/models (no extra disk); each pack gets a model.json with the same
# blank id and front-end infer.py uses, so the app hears exactly what model-bench measured.
set -e
cd "$(dirname "$0")"
OUT="${1:-data/packs}"
M=data/models

pack() { # name onnx tokenizer blank [frontend json + io json]
  name=$1; onnx=$2; tok=$3; blank=$4; extra=$5
  [ -f "$M/$name/$onnx" ] || { echo "skip $name: $M/$name/$onnx missing (run fetch.py)"; return; }
  mkdir -p "$OUT/$name"
  for f in "$M/$name"/*; do ln -f "$f" "$OUT/$name/$(basename "$f")"; done
  printf '{\n  "name": "%s",\n  "onnx": "%s",\n  "tokenizer": "%s",\n  "blank": %s%s\n}\n' \
    "$name" "$onnx" "$tok" "$blank" "$extra" > "$OUT/$name/model.json"
  echo "$OUT/$name"
}

pack karanbir model.int8.onnx tokenizer.model 256
pack jaspal-v0 sggs-asr-v0.int8.onnx bpe.model 0
pack jaspal-v1 sggs-large-epoch90.int8.onnx bpe.model 0
pack jaspal-v3 sggs-asr-v3.int8.onnx bpe.model 0
# v2 takes features, not audio: v1's front-end (make_v2_frontend.py) runs first, as in infer.py.
pack jaspal-v2 sggs-asr-v2.int8.onnx bpe.model 0 ',
  "frontend": { "onnx": "frontend-from-v1.onnx", "features": "/Div_output_0", "featuresLen": "/Where_output_0" },
  "io": { "audio": "x", "audioLen": "x_lens", "logProbs": "log_probs", "outLen": "log_probs_len" }'
