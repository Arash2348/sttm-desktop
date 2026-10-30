#!/bin/sh
# make_packs.sh - turn the models fetched by fetch.py into model packs the app engine can run
# (VF_SPEECH_MODEL=<pack>, see www/main/addons/voice-follow/engine/speech-model.js and BENCHMARKS.md).
#   ./make_packs.sh [out dir]    (default: data/packs)
# Files are hard-linked from data/models (no extra disk); each pack gets vocab.json, pieces.json and a model.json with the same
# blank id infer.py uses, so the app hears exactly what model-bench measured.
set -e
cd "$(dirname "$0")"
OUT="${1:-data/packs}"
M=data/models

PY=${PY:-.venv/bin/python}
pack() { # name onnx tokenizer blank
  name=$1; onnx=$2; tok=$3; blank=$4
  [ -f "$M/$name/$onnx" ] || { echo "skip $name: $M/$name/$onnx missing (run fetch.py)"; return; }
  $PY make_pack_json.py "$M/$name/$onnx" "$M/$name/$tok" "$blank" "$OUT/$name" "$name"
}

pack karanbir model.int8.onnx tokenizer.model 256
pack jaspal-v0 sggs-asr-v0.int8.onnx bpe.model 0
pack jaspal-v1 sggs-large-epoch90.int8.onnx bpe.model 0
pack jaspal-v3 sggs-asr-v3.int8.onnx bpe.model 0
# jaspal-v2 takes features, not audio: model-bench only (infer.py runs v1's front-end first); no app pack.
