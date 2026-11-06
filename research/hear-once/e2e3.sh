#!/bin/zsh
T=/Users/asingh02/personal/sttm-ws4/research/level2-dataset/tools
export MODEL=~/personal/vf-shared-models/model.int8.onnx
R=~/personal/sttm-b-stream
CL=kh12,kh13,kh17,kh19,kh20,kh21,kh26,kh27,kh28,kh29
run() { local lab=$1 sp=$2; shift 2; echo "=== $lab $sp $*"; env "$@" nice -n 19 node $T/sim-sweep.js --builds $lab=$R --clips $CL --speeds $sp --jobs 1 --fill --keep e2e3/$lab; }
mkdir -p e2e3; cp -r e2e2/base e2e3/ 2>/dev/null
rm -rf e2e3/bg-nodraft e2e3/bg-follow-only e2e3/bg-draftlite
run bg-search-only 0.33 VF_TIER=fast VF_HEAR_ONCE=1 VF_HO_MINS=5
run bg-search-only-sync 0.54,0.33 VF_HEAR_ONCE=1 VF_HO_MINS=5
run bg-follow-only 0.54 VF_TIER=fast VF_HEAR_ONCE=1 VF_HO_MAXS=4.1
run bg-nodraft 0.54 VF_TIER=fast VF_HEAR_ONCE=1
echo E2E3 DONE
