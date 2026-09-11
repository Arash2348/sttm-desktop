#!/bin/zsh
# ============================================================================
# Voice-follow CENTRAL KPI runner (Kirtan Mode / shabad-switching).
#
# Runs the SHIPPED autopilot config (CONF=3, FOLLOW_WIN=4) through the real-
# kirtan switch harness on every benchmark dataset and prints the topline KPIs
# we optimize for. Override CONF=/FOLLOW_WIN=/etc on the command line to try a
# change and compare against these numbers.
#
# THE KPIs (agreed topline metrics):
#   on-correct %  = % of time the RIGHT shabad is on screen   -> MAXIMIZE (primary)
#   erroneous %   = % of time a WRONG/unrelated shabad shows   -> MINIMIZE (the bad one)
#   stale %       = % of time still showing the PREVIOUS shabad -> tolerable, track only
#   recall        = fraction of real shabad-changes caught
#   latency (med) = seconds to catch a change
#
# Usage:
#   ./run_kpis.sh            # shipped config on all datasets
#   CONF=4 ./run_kpis.sh     # try a change; compare the table to the baseline below
# ============================================================================
export PATH="$HOME/.nvm/versions/node/v18.20.8/bin:$PATH"
export NODE_PATH=/Users/asingh02/aai/ort-spike/node_modules
export MODEL=${MODEL:-/Users/asingh02/AAI/models/karansea-shabad-ctc/model.int8.onnx}
BENCH=/Users/asingh02/aai/kirtan_bench
HARNESS=/Users/asingh02/AAI/vf-kirtan-switch-eval.js
CONF=${CONF:-3}
export CONF

# dataset label : wav : manifest
DATASETS=(
  "86min-live-voiceA:$BENCH/kirtan_full_16k.wav:$BENCH/kirtan_manifest.json"
  "51shabad-45s-voiceB:$BENCH/kirtan_pull_16k.wav:$BENCH/kirtan_pull_manifest.json"
  "stress-9s-voiceB:$BENCH/kirtan_stress_16k.wav:$BENCH/kirtan_stress_manifest.json"
  "88shabad-45s-multi20:$BENCH/kirtan_multi_16k.wav:$BENCH/kirtan_multi_manifest.json"
  "stress-9s-multi20:$BENCH/kirtan_multi_stress_16k.wav:$BENCH/kirtan_multi_stress_manifest.json"
)

printf "\n%-24s %8s %8s %8s %8s %8s\n" "DATASET (CONF=$CONF)" "correct" "stale" "erron." "recall" "lat_med"
printf "%s\n" "----------------------------------------------------------------------------------"
for row in $DATASETS; do
  label="${row%%:*}"; rest="${row#*:}"; wav="${rest%%:*}"; man="${rest#*:}"
  [ -f "$wav" ] || { printf "%-24s  (missing wav)\n" "$label"; continue; }
  out=$(WAV="$wav" MANIFEST="$man" node --max-old-space-size=1024 "$HARNESS" 2>/dev/null)
  corr=$(echo "$out" | grep "TIME ON CORRECT" | grep -oE "[0-9.]+%" | head -1)
  stale=$(echo "$out" | grep "stale (late)" | grep -oE "[0-9.]+%" | head -1)
  err=$(echo "$out" | grep "ERRONEOUS" | grep -oE "[0-9.]+%" | head -1)
  rec=$(echo "$out" | grep "switch recall" | grep -oE "[0-9]+/[0-9]+" | head -1)
  lat=$(echo "$out" | grep "switch latency" | grep -oE "median [0-9.]+s" | grep -oE "[0-9.]+s")
  printf "%-24s %8s %8s %8s %8s %8s\n" "$label" "$corr" "$stale" "$err" "$rec" "$lat"
done
echo ""
