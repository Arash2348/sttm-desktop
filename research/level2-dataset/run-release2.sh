#!/bin/zsh
# MVP 9.0 re-runs after the bench-driver fix (base runs stay valid: base has no paath follower).
R=~/personal/sttm-release/research/level2-dataset/results
L=(lockf -k /tmp/vf-bench.lock nice -n 19)
T=~/personal/sttm-release/research/level2-dataset/tools
KH=kh01_sttm_desktop_2026_10_08T03_18_48_617Z,kh02_sttm_desktop_2026_10_08T03_30_14_004Z,kh03_sttm_desktop_2026_10_08T03_40_41_289Z,kh04_sttm_desktop_2026_10_08T03_51_10_447Z,kh05_sttm_desktop_2026_10_08T04_05_00_105Z
cd $T
echo "== commit $(git rev-parse --short HEAD) $(date +%T)"
mkdir -p $R/stress-mvp90
for spec in "rt11_rehras 600" "rt11_aarti 727"; do set -- ${=spec}
  echo "== stress mvp90 $1 $(date +%T)"
  $L env VF_ORT_THREADS=1 node renton-stress.js --root ~/personal/sttm-release --pace wall --clip $1 --from 0 --to $2 --delay-ms 120 --out $R/stress-mvp90/$1.json > $R/stress-mvp90/$1.log 2>&1
done
echo "== renton mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js renton-bench.js --fast --out $R/renton-mvp90 > $R/renton-mvp90.log 2>&1
echo "== paath mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --truth paath-tests.json --prefix pt --fast --out $R/pt-mvp90 > $R/pt-mvp90.log 2>&1
echo "== aarti mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --truth aarti-tests.json --prefix aa --fast --trace-all --out $R/aa-mvp90 > $R/aa-mvp90.log 2>&1
for Ln in short medium long; do echo "== stop $Ln $(date +%T)"; $L env VF_ORT_THREADS=3 VF_TEST_BANI_LENGTH=$Ln node -r ./no-shadow-preload.js stop-keeps-screen-test.js > $R/stop-test-$Ln.log 2>&1; echo "stop $Ln exit $?"; done
echo "== khalis mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js khalis-bench.js --tests ../khalis-tests.json --fast --trace --only $KH --out $R/kh-mvp90 > $R/kh-mvp90.log 2>&1
echo "== L2 mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --fast --out $R/l2-mvp90 > $R/l2-mvp90.log 2>&1
echo "== ALL DONE $(date +%T)"
