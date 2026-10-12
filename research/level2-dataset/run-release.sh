#!/bin/zsh
# MVP 9.0 release runs in the lead's priority order; each job takes the shared lock on its own.
R=~/personal/sttm-release/research/level2-dataset/results; RB=~/personal/sttm-release-base/research/level2-dataset/results
V=/private/tmp/claude-501/-Users-asingh02-personal-sttm-desktop/7dc20a33-cab3-495f-b630-6acf57f0287c/scratchpad/vf-fix
L=(lockf -k /tmp/vf-bench.lock nice -n 19)
T=~/personal/sttm-release/research/level2-dataset/tools
KH=kh01_sttm_desktop_2026_10_08T03_18_48_617Z,kh02_sttm_desktop_2026_10_08T03_30_14_004Z,kh03_sttm_desktop_2026_10_08T03_40_41_289Z,kh04_sttm_desktop_2026_10_08T03_51_10_447Z,kh05_sttm_desktop_2026_10_08T04_05_00_105Z
# 1. slowdown stress, base vs 9.0
for spec in "rt11_rehras 600" "rt11_aarti 727" "rt11_fareed2 435"; do set -- ${=spec}
  for b in base:$HOME/personal/sttm-release-base mvp90:$HOME/personal/sttm-release; do tag=${b%%:*}; root=${b#*:}; mkdir -p $R/stress-$tag
    echo "== stress $tag $1 $(date +%T)"
    cd $T && $L env VF_ORT_THREADS=1 node renton-stress.js --root $root --pace wall --clip $1 --from 0 --to $2 --delay-ms 120 --out $R/stress-$tag/$1.json > $R/stress-$tag/$1.log 2>&1
  done
done
# 2. Renton parts --fast
for b in base:$HOME/personal/sttm-release-base:$RB mvp90:$HOME/personal/sttm-release:$R; do tag=${b%%:*}; rest=${b#*:}; root=${rest%%:*}; out=${rest#*:}
  echo "== renton $tag $(date +%T)"
  cd $root/research/level2-dataset/tools && $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js renton-bench.js --fast --out $out/renton-$tag > $out/renton-$tag.log 2>&1
done
# 3. Fremont: 9.0, and base unless another agent's 265da34e run exists
echo "== khalis mvp90 $(date +%T)"
cd ~/personal/sttm-release/research/level2-dataset/tools && $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js khalis-bench.js --tests ../khalis-tests.json --fast --trace --only $KH --out $R/kh-mvp90 > $R/kh-mvp90.log 2>&1
if ! [ -s $V/throughput/khalis-sttm-throughput-base/results.json ] || [ $(grep -c '"clip"' $V/throughput/khalis-sttm-throughput-base/results.json) -lt 5 ]; then
  echo "== khalis base $(date +%T)"
  cd ~/personal/sttm-release-base/research/level2-dataset/tools && $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js khalis-bench.js --tests ../khalis-tests.json --fast --trace --only $KH --out $RB/kh-base > $RB/kh-base.log 2>&1
fi
# 4. Level-2 41, paath 65, Aarti 50 on 9.0 (base = Oct 6 runs, reproduced event-for-event on 12 clips)
cd ~/personal/sttm-release/research/level2-dataset/tools
echo "== L2 mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --fast --out $R/l2-mvp90 > $R/l2-mvp90.log 2>&1
echo "== paath mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --truth paath-tests.json --prefix pt --fast --out $R/pt-mvp90 > $R/pt-mvp90.log 2>&1
echo "== aarti mvp90 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --truth aarti-tests.json --prefix aa --fast --trace-all --out $R/aa-mvp90 > $R/aa-mvp90.log 2>&1
# base spot check that the Oct 6 paath/Aarti runs still stand for 265da34e
echo "== spot base $(date +%T)"
cd ~/personal/sttm-release-base/research/level2-dataset/tools && $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --truth paath-tests.json --prefix pt --fast --only pt20,pt35,pt43,pt55 --out $RB/pt-spot > $RB/pt-spot.log 2>&1
$L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --truth aarti-tests.json --prefix aa --fast --trace-all --only aa01,aa13,aa43 --out $RB/aa-spot > $RB/aa-spot.log 2>&1
# 5. stop tests
cd ~/personal/sttm-release/research/level2-dataset/tools
for Ln in short medium long; do echo "== stop $Ln $(date +%T)"; $L env VF_ORT_THREADS=3 VF_TEST_BANI_LENGTH=$Ln node -r ./no-shadow-preload.js stop-keeps-screen-test.js > $R/stop-test-$Ln.log 2>&1; echo "stop $Ln exit $?"; done
echo "== ALL DONE $(date +%T)"
