#!/bin/zsh
# 9f3502ed: stop tests (fixed expectation), then the Shabad-side suites (L2-41, Fremont).
# Paath-60 and Aarti-50 wait for the paath fix + asa FINAL so they run once on the final head.
R=~/personal/sttm-release/research/level2-dataset/results
L=(lockf -k /tmp/vf-bench.lock nice -n 19)
KH=kh01_sttm_desktop_2026_10_08T03_18_48_617Z,kh02_sttm_desktop_2026_10_08T03_30_14_004Z,kh03_sttm_desktop_2026_10_08T03_40_41_289Z,kh04_sttm_desktop_2026_10_08T03_51_10_447Z,kh05_sttm_desktop_2026_10_08T04_05_00_105Z
cd ~/personal/sttm-release/research/level2-dataset/tools
echo "== commit $(git rev-parse --short HEAD) $(date +%T)"
for Ln in short medium long; do echo "== stop $Ln $(date +%T)"; $L env VF_ORT_THREADS=3 VF_TEST_BANI_LENGTH=$Ln node -r ./no-shadow-preload.js stop-keeps-screen-test.js > $R/stop-test-$Ln.log 2>&1; echo "stop $Ln exit $?"; done
echo "== L2 $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js bench-runner.js --fast --out $R/l2-mvp90 > $R/l2-mvp90.log 2>&1
echo "== khalis $(date +%T)"; $L env VF_ORT_THREADS=3 node -r ./no-shadow-preload.js khalis-bench.js --tests ../khalis-tests.json --fast --trace --only $KH --out $R/kh-mvp90 > $R/kh-mvp90.log 2>&1
echo "== ALL DONE $(date +%T)"
