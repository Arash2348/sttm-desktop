#!/bin/zsh
# run-stress.sh <tag> <root>: Gurdwara-PC slowdown (1 ORT thread + 120 ms per model pass), wall pace,
# mic never waits; screen events stamped at wall time. Rehras first 600 s, whole Aarti part.
TAG=$1; ROOT=$2; OUT=~/personal/sttm-release/research/level2-dataset/results/stress-$TAG; mkdir -p $OUT
cd ~/personal/sttm-release/research/level2-dataset
for spec in "rt11_rehras 600" "rt11_aarti 727" "rt11_fareed2 435"; do set -- ${=spec}
  echo "== $TAG $1 $(date +%T)"
  lockf -k /tmp/vf-bench.lock nice -n 19 env VF_ORT_THREADS=1 node tools/renton-stress.js --root $ROOT --pace wall --clip $1 --from 0 --to $2 --delay-ms 120 --out $OUT/$1.json > $OUT/$1.log 2>&1
done
echo "== $TAG stress done $(date +%T)"
