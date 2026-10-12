#!/bin/zsh
# run-suites.sh <worktree> <tag>: all five suites, --fast, each under the shared bench lock.
W=$1; TAG=$2; R=$W/research/level2-dataset/results
cd $W/research/level2-dataset/tools || exit 1
L=(lockf -k /tmp/vf-bench.lock nice -n 19 env VF_ORT_THREADS=3)
P=(node -r ./no-shadow-preload.js)
echo "== $TAG renton $(date +%T)"; $L $P renton-bench.js --fast --out $R/renton-$TAG > $R/renton-$TAG.log 2>&1
echo "== $TAG L2 $(date +%T)"; $L $P bench-runner.js --fast --out $R/l2-$TAG > $R/l2-$TAG.log 2>&1
echo "== $TAG paath $(date +%T)"; $L $P bench-runner.js --truth paath-tests.json --prefix pt --fast --out $R/pt-$TAG > $R/pt-$TAG.log 2>&1
echo "== $TAG aarti $(date +%T)"; $L $P bench-runner.js --truth aarti-tests.json --prefix aa --fast --trace-all --out $R/aa-$TAG > $R/aa-$TAG.log 2>&1
echo "== $TAG khalis $(date +%T)"; $L $P khalis-bench.js --tests ../khalis-tests.json --fast --trace --only kh01_sttm_desktop_2026_10_08T03_18_48_617Z,kh02_sttm_desktop_2026_10_08T03_30_14_004Z,kh03_sttm_desktop_2026_10_08T03_40_41_289Z,kh04_sttm_desktop_2026_10_08T03_51_10_447Z,kh05_sttm_desktop_2026_10_08T04_05_00_105Z --out $R/kh-$TAG > $R/kh-$TAG.log 2>&1
echo "== $TAG done $(date +%T)"
