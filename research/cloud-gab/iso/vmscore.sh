#!/bin/bash
# Re-score VM 2's builds from their shared replays (replays reused, no model): one worktree, one build at a time
set -u
REPO=/home/user/sttm-desktop; W=/root/personal/vmscore; T=/home/user/gab-tools/research/level2-dataset/tools
node $REPO/research/cloud-gab/results-sync.js pull | tail -1
[ -d $W ] || { git -C $REPO worktree add -q --detach $W 53220a0; ln -sfn $REPO/node_modules $W/node_modules; }
for spec in "aarti1x 53220a0 AARTI_FOLLOW=1" "aarti2x 53220a0 AARTI_FOLLOW=2" "kf5 f6c8ab0 KIRTAN_FOLLOW=5" "akpaath eb789375"; do
  set -- $spec; n=$1 base=$2; shift 2
  git -C $W checkout -q -f --detach $base
  if [ $# -gt 0 ]; then for kv in $*; do sed -i "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" $W/www/main/addons/voice-follow/components/VoiceFollow.jsx; done
    git -C $W -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: $*" --date "2026-01-01T00:00:00Z"; fi
  echo "== $n tree $(git -C $W rev-parse --short=12 HEAD:www)"
  for t in main akhand; do
    (cd $T && VF_MIN_FREE_GB=1 VF_NO_EMIS_PULL=1 ./gab run $W --set $t --tier full --jobs 4 --manifest hf > /home/user/gab/logs/vm2-$n-$t.log 2>&1); echo "$n $t exit $?"
    grep -E "^\| \*\*(Kirtan|Bani|Akhand)|Timing" /home/user/gab/logs/vm2-$n-$t.log | grep -v 'no clip\|no GAB\|not run' | cut -c1-230
  done
done
