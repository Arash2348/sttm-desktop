#!/bin/bash
set -u
REPO=/home/user/sttm-desktop; W=/root/personal/vmscore; T=/home/user/gab-tools/research/level2-dataset/tools
node $REPO/research/cloud-gab/results-sync.js pull | tail -1
run() { # name base split tiers consts...
  local n=$1 base=$2 split=$3 tiers=$4; shift 4
  git -C $W checkout -q -f --detach $base
  if [ $# -gt 0 ]; then for kv in $*; do sed -i "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" $W/www/main/addons/voice-follow/components/VoiceFollow.jsx; done
    git -C $W -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: $*" --date "2026-01-01T00:00:00Z"; fi
  echo "== $n ($split) tree $(git -C $W rev-parse --short=12 HEAD:www)"
  for t in $tiers; do
    (cd $T && VF_MIN_FREE_GB=1 VF_NO_EMIS_PULL=1 ./gab run $W --set $t --tier full --jobs 4 --manifest hf $( [ $split = test ] && echo --split test ) > /home/user/gab/logs/vm1-$n-$split-$t.log 2>&1); echo "$n $split $t exit $?"
    grep -E "^\| \*\*(Kirtan|Bani|Akhand)|INCOMPLETE|Timing" /home/user/gab/logs/vm1-$n-$split-$t.log | grep -v 'no clip\|no GAB\|replay runner\|no Akhand Paath clip' | cut -c1-230
  done
}
run v905 1271040 prac main
run r904 2802526 test "main akhand hard"
run v905 1271040 test "main akhand hard"
run stack2 0452ce2 prac "akhand main" SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 AK_LOCAL_CTC=2 VERIFY_LOCK=40 VERIFY_CANDS=6
run stack2-wa 0452ce2 prac "akhand main" SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0
