#!/bin/zsh
# A/B: CONTROL (acoustic-only) vs TWO-SIGNAL (strong first-letter -> relaxed acoustic bar).
# Holds the shipped config fixed (CONF=3, FOLLOW_WIN=4, LEN_MIN=15) and toggles only the
# two-signal tier. Prints correct/stale/erron/recall/lock-in/never-locked/latency per config.
export PATH="$HOME/.nvm/versions/node/v18.20.8/bin:$PATH"
export NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules
export MODEL=${MODEL:-/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx}
BENCH=/Users/asingh02/aai/kirtan_bench
HARNESS=/Users/asingh02/AAI/vf-kirtan-switch-eval.js

# label : wav : manifest : cap-min (0=full)
DATASETS=(
  "voiceA-20m:$BENCH/kirtan_full_16k.wav:$BENCH/kirtan_manifest.json:20"
  "51shabad-voiceB-20m:$BENCH/kirtan_pull_16k.wav:$BENCH/kirtan_pull_manifest.json:20"
  "stress-voiceB:$BENCH/kirtan_stress_16k.wav:$BENCH/kirtan_stress_manifest.json:0"
  "multi20-25m:$BENCH/kirtan_multi_16k.wav:$BENCH/kirtan_multi_manifest.json:25"
  "stress-multi20:$BENCH/kirtan_multi_stress_16k.wav:$BENCH/kirtan_multi_stress_manifest.json:0"
)

run() { # $1=wav $2=man $3=cap  extra env passed in
  local cap=""; [ "$3" != "0" ] && cap="--cap-min $3"
  env "${EXTRA[@]}" WAV="$1" MANIFEST="$2" CONF=3 FOLLOW_WIN=4 LEN_MIN=15 FL_GATE=${FG:-0} \
    node --max-old-space-size=1024 "$HARNESS" ${=cap} 2>/dev/null
}

row() { # $1=label $2=out
  local corr stale err rec lock nl lat
  corr=$(echo "$2" | grep "TIME ON CORRECT" | grep -oE "[0-9.]+%" | head -1)
  stale=$(echo "$2" | grep "stale (late)" | grep -oE "[0-9.]+%" | head -1)
  err=$(echo "$2" | grep "ERRONEOUS" | grep -oE "[0-9.]+%" | head -1)
  rec=$(echo "$2" | grep "switch recall" | grep -oE "[0-9]+/[0-9]+" | head -1)
  lock=$(echo "$2" | grep "LOCK-IN" | grep -oE "\([0-9]+%\)" | head -1)
  nl=$(echo "$2" | grep "LOCK-IN" | grep -oE "never-locked: [0-9]+" | grep -oE "[0-9]+")
  lat=$(echo "$2" | grep "switch latency" | grep -oE "median [0-9.]+s" | grep -oE "[0-9.]+s")
  printf "%-22s %8s %8s %8s %8s %8s %6s %8s\n" "$1" "$corr" "$stale" "$err" "$rec" "$lock" "$nl" "$lat"
}

printf "\n%-22s %8s %8s %8s %8s %8s %6s %8s\n" "DATASET / config" "correct" "stale" "erron." "recall" "lockin" "n-lock" "lat_med"
printf "%s\n" "--------------------------------------------------------------------------------------"
for d in $DATASETS; do
  label="${d%%:*}"; r="${d#*:}"; wav="${r%%:*}"; r="${r#*:}"; man="${r%%:*}"; cap="${r##*:}"
  [ -f "$wav" ] || { printf "%-22s (missing)\n" "$label"; continue; }
  EXTRA=(FL_STRONG=0); row "$label | CONTROL" "$(run "$wav" "$man" "$cap")"
  EXTRA=(FL_STRONG=${TS_FL:-6} SMIN_STRONG=${TS_SMIN:-0.50} MARG_STRONG=${TS_MARG:-0.10})
  row "$label | 2SIG(${TS_FL:-6}/${TS_SMIN:-0.50}/${TS_MARG:-0.10})" "$(run "$wav" "$man" "$cap")"
  echo ""
done
