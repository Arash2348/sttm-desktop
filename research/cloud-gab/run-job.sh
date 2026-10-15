#!/bin/bash
# research/cloud-gab/run-job.sh — one helper session's whole job: set up, replay one build on the given GAB tiers,
# share the replay results through Azure (bench-results/), so the lead session scores and compares in seconds.
#
#   bash research/cloud-gab/run-job.sh <name> <rev> "<tiers>" ["<const>=<value> ..."] [--split test]
#   e.g. bash research/cloud-gab/run-job.sh ak-ctc d71b304 "main hard akhand" "AK_LOCAL_CTC=2"
#
# Constants are set in VoiceFollow.jsx and committed (same parent + same edit = same app tree hash in every session,
# so results are shared by tree). Replay only: never runs the speech model, never writes bench-cache/.
set -euo pipefail
NAME=$1 REV=$2 TIERS=$3 CONSTS=${4:-}
TEST=""; [[ " $* " == *" --split test "* ]] && TEST=1
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS=/home/user/gab-tools/research/level2-dataset/tools
LOG=/home/user/gab/logs; mkdir -p "$LOG"
if [ -n "$TEST" ]; then bash "$REPO/research/cloud-gab/setup.sh" --test --builds "$NAME:$REV"; else bash "$REPO/research/cloud-gab/setup.sh" --builds "$NAME:$REV"; fi
D=/root/personal/$NAME
if [ -n "$CONSTS" ] && [ "$(git -C "$D" log -1 --format=%s)" != "Experiment: $CONSTS" ]; then
  for kv in $CONSTS; do
    k=${kv%%=*} v=${kv#*=}
    grep -q "^const $k = " "$D/www/main/addons/voice-follow/components/VoiceFollow.jsx" || { echo "no constant $k"; exit 1; }
    sed -i "s/^const $k = [^;]*;/const $k = $v;/" "$D/www/main/addons/voice-follow/components/VoiceFollow.jsx"
  done
  git -C "$D" -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: $CONSTS" --date "2026-01-01T00:00:00Z"
fi
echo "[cloud-gab] $NAME app tree $(git -C "$D" rev-parse --short=12 HEAD:www)"
node "$REPO/research/cloud-gab/results-sync.js" pull
cd "$TOOLS"
for t in $TIERS; do
  VF_MIN_FREE_GB=3 ./gab run "$D" --set "$t" --tier full --jobs "$(nproc)" --manifest hf ${TEST:+--split test} > "$LOG/$NAME-$t.log" 2>&1 || echo "[cloud-gab] $NAME $t exit $?"
  grep -E "^\| \*\*Kirtan|INCOMPLETE|not run|Timing" "$LOG/$NAME-$t.log" | cut -c1-300 || true
  node "$REPO/research/cloud-gab/results-sync.js" push
  # free the model output of this tier before the next one (results are kept)
  find /root/personal/live-darbar-venues/cache -maxdepth 1 -name '*-q16' -exec rm -rf {} + 2>/dev/null || true
done
echo "[cloud-gab] JOB DONE $NAME"
