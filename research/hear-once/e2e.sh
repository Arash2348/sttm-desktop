#!/bin/zsh
# End-to-end: today's app at i9 speed vs today / hear-once at i5 speeds, dev clips only.
T=/Users/asingh02/personal/sttm-ws4/research/level2-dataset/tools
export MODEL=~/personal/vf-shared-models/model.int8.onnx
R=~/personal/sttm-b-stream
CL=kh11,kh12,kh13,kh14,kh17,kh18,kh19,kh20,kh21,kh22,kh24,kh25,kh26,kh27,kh28,kh29
run() { # label speeds env...
  local lab=$1 sp=$2; shift 2
  echo "=== $lab $sp $*"
  env "$@" nice -n 19 node $T/sim-sweep.js --builds $lab=$R --clips $CL --speeds $sp --jobs 1 --fill --keep e2e/$lab
}
mkdir -p e2e
run base 2.08,0.54,0.33
# hear-once: every window is a cheap slice, so the engines can step at the full rate (fast tier)
run ho-draftlite 0.54,0.33 VF_TIER=fast VF_HEAR_ONCE=1 VF_HO_DRAFT=1 VF_HO_LD=0.64 VF_HO_DRAFT_HOP=1
run ho-nodraft 0.54,0.33 VF_TIER=fast VF_HEAR_ONCE=1
run ho-draft 0.54 VF_TIER=fast VF_HEAR_ONCE=1 VF_HO_DRAFT=1
echo E2E DONE
