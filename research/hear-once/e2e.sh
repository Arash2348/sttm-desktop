#!/bin/zsh
# End-to-end: today's app at i9 speed vs today / hear-once at i5 speeds, dev clips only.
T=/Users/asingh02/personal/sttm-ws4/research/level2-dataset/tools
export MODEL=~/personal/vf-shared-models/model.int8.onnx
R=~/personal/sttm-b-stream
CL=${CL:-kh12,kh13,kh17,kh19,kh20,kh21,kh26,kh27,kh28,kh29}
run() { # label speeds env...
  local lab=$1 sp=$2; shift 2
  echo "=== $lab $sp $*"
  env "$@" nice -n 19 node $T/sim-sweep.js --builds $lab=$R --clips $CL --speeds $sp --jobs 1 --fill --keep ${OUT:-e2e}/$lab
}
mkdir -p ${OUT:-e2e}
[ -z "$SKIP_BASE" ] && run base 2.08,0.54,0.33
run ho-nodraft 0.54,0.33 VF_TIER=fast VF_HEAR_ONCE=1
run ho-draftlite 0.54,0.33 VF_TIER=fast VF_HEAR_ONCE=1 VF_HO_DRAFT=1 VF_HO_LD=0.64 VF_HO_DRAFT_HOP=1
echo E2E DONE
