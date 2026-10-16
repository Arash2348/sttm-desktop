#!/bin/bash
# research/cloud-gab/mac-fill.sh — run on the Mac (Apple Silicon) to complete the 9.0.5 and 9.0.6 leaderboard rows.
# About 90 GAB recordings were first recorded on this Mac, and the cloud never mixes machines, so the speech-model
# windows these two versions ask for on those recordings can only be recorded here. This script builds both
# versions exactly as the cloud scored them (same commits, same constants, same tree), records the missing windows
# (--fill), scores main GAB, GAB-Akhand and GAB-Hard, and shares the results through Azure (bench-results/), so the
# cloud session republishes both rows complete in a couple of minutes.
#
#   TOOLS=<your gab-tools checkout>/research/level2-dataset/tools  VF_AZURE_SAS=...  HF_TOKEN=...  \
#     bash research/cloud-gab/mac-fill.sh
# Run it from the root of this sttm-desktop checkout. Takes about an hour, unattended. Never prints the keys.
set -euo pipefail
REPO=$(pwd)
: "${TOOLS:?set TOOLS to your gab-tools research/level2-dataset/tools folder}"
: "${VF_AZURE_SAS:?set VF_AZURE_SAS (the Azure key)}"; : "${HF_TOKEN:?set HF_TOKEN}"
git -C "$REPO" fetch -q origin vf-9.0.4 exp-on-904
P=${P:-$HOME/personal/gab-builds}; mkdir -p "$P"
build() { # name commit "CONST=value ..."
  local n=$1 base=$2 consts=$3 d="$P/$1"
  [ -d "$d" ] || git -C "$REPO" worktree add -q --detach "$d" "$base"
  git -C "$d" checkout -q -f --detach "$base"
  ln -sfn "$REPO/node_modules" "$d/node_modules"
  if [ -n "$consts" ]; then
    for kv in $consts; do sed -i '' "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" "$d/www/main/addons/voice-follow/components/VoiceFollow.jsx"; done
    git -C "$d" -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: $consts" --date "2026-01-01T00:00:00Z"
  fi
  echo "$n: app tree $(git -C "$d" rev-parse --short=12 HEAD:www) (cloud: $4)"
}
build v905 1271040 "" 6ae3b837aa39
build cand906b 747b9b7 "NEAR_TWIN=0.03 AARTI_FOLLOW=1" d1d7b9676dc8
node "$REPO/research/cloud-gab/results-sync.js" pull
cd "$TOOLS"
for n in v905 cand906b; do
  for t in main akhand hard; do
    ./gab run "$P/$n" --set "$t" --tier full --manifest hf --fill > "$P/$n-$t.log" 2>&1 || true
    echo "$n $t: $(grep -cE 'INCOMPLETE' "$P/$n-$t.log" || true) incomplete line(s)"
  done
done
node "$REPO/research/cloud-gab/results-sync.js" push
echo "done: tell the cloud session 'Mac fill done' and it republishes both rows complete"
