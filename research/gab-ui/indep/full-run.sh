#!/bin/bash
# full-run.sh <form> [<form> ...]   (2026-10-23) one job at a time, nice 19, 4 threads; frozen FEASIBILITY.md params.
# Per form: MMS_FA emissions -> MMS-1B pan emissions -> HMM with each model -> two-model agreement (out/pred/full_agree).
set -e
cd "$(dirname "$0")"
export INDEP_THREADS=4 OMP_NUM_THREADS=4 MKL_NUM_THREADS=4 INDEP_JOBS=${INDEP_JOBS:-$PWD/out/jobs-full.json} TOKENIZERS_PARALLELISM=false
PY=.venv/bin/python
P=partial=-10,any=-10,blank=3
for form in "$@"; do
  T0=$(date +%s)
  pairs=$($PY -c "import json,sys;print(' '.join(f\"{j['id']} {j['audio']}\" for j in json.load(open('$INDEP_JOBS'))['jobs'] if j['form']=='$form'))")
  ids=$($PY -c "import json;print(','.join(j['id'] for j in json.load(open('$INDEP_JOBS'))['jobs'] if j['form']=='$form'))")
  echo "== $form start $(date)"
  nice -n 19 $PY emit.py $pairs
  T1=$(date +%s)
  nice -n 19 $PY emit_mms1b.py $pairs 2>&1 | { grep -v -i warn || true; }
  T2=$(date +%s)
  nice -n 19 $PY label.py run full_fa --model fa --ids "$ids" --p $P | tail -1
  nice -n 19 $PY label.py run full_mms1b --model mms1b --ids "$ids" --p $P | tail -1
  $PY label.py combine full_agree --a full_fa --b full_mms1b
  T3=$(date +%s)
  echo "TIMING $form emis_fa $((T1-T0)) emis_mms1b $((T2-T1)) hmm $((T3-T2)) total $((T3-T0))"
  echo "== $form done $(date)"
done
