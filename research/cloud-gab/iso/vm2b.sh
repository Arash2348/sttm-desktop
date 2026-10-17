#!/bin/bash
set -u
REPO=/home/user/sttm-desktop; W=/root/personal/vmscore; T=/home/user/gab-tools/research/level2-dataset/tools; R=/home/user/gab-tools/research/level2-dataset/results/gab
node $REPO/research/cloud-gab/results-sync.js pull | tail -1
run() { local n=$1 base=$2 split=$3 tiers=$4; shift 4
  git -C $W checkout -q -f --detach $base
  if [ $# -gt 0 ]; then for kv in $*; do sed -i "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" $W/www/main/addons/voice-follow/components/VoiceFollow.jsx; done
    git -C $W -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: $*" --date "2026-01-01T00:00:00Z"; fi
  echo "== $n ($split) tree $(git -C $W rev-parse --short=12 HEAD:www)"
  for t in $tiers; do
    (cd $T && VF_MIN_FREE_GB=1 VF_NO_EMIS_PULL=1 ./gab run $W --set $t --tier full --jobs 4 --manifest hf $( [ $split = test ] && echo --split test ) > /home/user/gab/logs/v2b-$n-$split-$t.log 2>&1); echo "$n $split $t exit $? card $(ls -t $R | head -1)"
    grep -E "^\| \*\*(Kirtan|Bani|Akhand)|INCOMPLETE" /home/user/gab/logs/v2b-$n-$split-$t.log | grep -v 'no clip\|no GAB\|replay runner\|no Akhand Paath clip' | cut -c1-200
  done; }
run v905 1271040 prac akhand
run twin3 02afebe prac "main akhand" KIRTAN_FOLLOW=1 NEAR_TWIN=0.03
run twin6 02afebe prac "main akhand" KIRTAN_FOLLOW=1 NEAR_TWIN=0.06
run simran1 f677da3 prac "main akhand" KIRTAN_FOLLOW=1 SIMRAN_HOLD=1
