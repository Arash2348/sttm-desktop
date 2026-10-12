#!/bin/zsh
# MVP 9.0 (merge-validation runs on the current head): slowdown stress, Renton parts, stop tests.
# Big suites (L2 41, paath 60, Aarti 50, Fremont) wait for kirtan FINAL (run-big.sh).
R=~/personal/sttm-release/research/level2-dataset/results
L=(lockf -k /tmp/vf-bench.lock nice -n 19)
cd ~/personal/sttm-release/research/level2-dataset/tools
echo "== commit $(git rev-parse --short HEAD) $(date +%T)"
mkdir -p $R/stress-mvp90
for spec in "rt11_rehras 600" "rt11_aarti 727"; do set -- ${=spec}
  echo "== stress mvp90 $1 $(date +%T)"
  $L env VF_ORT_THREADS=1 node renton-stress.js --root ~/personal/sttm-release --pace wall --clip $1 --from 0 --to $2 --delay-ms 120 --out $R/stress-mvp90/$1.json > $R/stress-mvp90/$1.log 2>&1
done
echo "== renton mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js renton-bench.js --fast --out $R/renton-mvp90 > $R/renton-mvp90.log 2>&1
for Ln in short medium long; do echo "== stop $Ln $(date +%T)"; $L env VF_ORT_THREADS=3 VF_TEST_BANI_LENGTH=$Ln node -r ./no-shadow-preload.js stop-keeps-screen-test.js > $R/stop-test-$Ln.log 2>&1; echo "stop $Ln exit $?"; done
echo "== ALL DONE $(date +%T)"
