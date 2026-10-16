#!/bin/bash
# research/cloud-gab/vm/vm-job.sh <job> — the work a VM boot does (called by vm-startup.sh, as root, from the repo root).
#   fill-x86 : record the missing model windows of the candidate builds on the x86-recorded clips (GAB-Akhand l3,
#              Renton Finds rn) on THIS machine (it recorded those entries), then push them to Azure bench-cache/
#   lines    : two-model pangti alignment for every GAB clip with Shabad/Bani truth (all tiers, all splits), upload to
#              Azure gab-lines/ (keys, alignments, review items; not the model output)
#   all      : fill-x86 and lines side by side (fill uses ~4 cores, lines the rest)
set -uo pipefail
JOB=$1
REPO=$(pwd)
NP=$(nproc)
bash research/cloud-gab/setup.sh --test --model --builds "gab-903:3fafc0ba ak-v6:488c3721 ak-ctc0:d71b304"
TOOLS=/home/user/gab-tools/research/level2-dataset/tools
P=/root/personal
mk() { # name base "CONST=v ..." committed like run-job.sh (same tree hash everywhere)
  local n=$1 base=$2; shift 2
  [ -d $P/$n ] || { git -C "$REPO" worktree add -q --detach $P/$n "$base"; ln -sfn "$REPO/node_modules" $P/$n/node_modules
    if [ $# -gt 0 ]; then
      for kv in $*; do sed -i "s/^const ${kv%%=*} = [^;]*;/const ${kv%%=*} = ${kv#*=};/" $P/$n/www/main/addons/voice-follow/components/VoiceFollow.jsx; done
      git -C $P/$n -c user.name=cloud-gab -c user.email=cloud-gab@localhost commit -qam "Experiment: $*" --date "2026-01-01T00:00:00Z"
    fi; }
  echo "build $n tree $(git -C $P/$n rev-parse --short=12 HEAD:www)"
}
# round 1 (on d71b304), the Shabad verifier pair, 9.0.4 as merged, window alignment (changes almost every window: last)
mk v6-prob d71b304 SWITCH_COMMIT_SOLID=0
mk v6-ctc d71b304 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 AK_LOCAL_CTC=2
mk v6-prob-ctc d71b304 SWITCH_COMMIT_SOLID=0 AK_LOCAL_CTC=2
mk v6-base3 1fb64d8 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0
mk v6-verify5 2245c15 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 VERIFY_LOCK=40
mk r904 2802526
mk window-align 122acab
FILL="${FILL:-v6-prob v6-ctc v6-prob-ctc v6-base3 v6-verify5 r904 window-align}"

push_cache() { # the grown linux-x64 entries to Azure bench-cache/, the replays to bench-results/
  node -e '
    const {SUITES}=require("./vf-suites");const r=require("./remote-cache");const fs=require("fs");
    const clips=[];for(const s of ["l3","rfinds"])for(const j of SUITES[s].jobs()){const p="/root/personal/live-darbar-venues/cache/5f9e41d867de-q16/"+j.id+"/provenance.json";let pl=null;try{pl=JSON.parse(fs.readFileSync(p)).platform}catch(_){}if(pl==="linux-x64")clips.push({id:j.id,wav:j.wav});}
    r.push({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16",clips,commit:"cloud-gab fill-x86",log:()=>{}}).then(x=>console.log("pushed to Azure bench-cache:",JSON.stringify(x)));'
  node "$REPO/research/cloud-gab/results-sync.js" push
}
fill_x86() {
  cd "$TOOLS"
  # the x86 clips (practice + test), pulled from Azure with their provenance
  local ONLY
  ONLY=$(node -e 'const {SUITES}=require("./vf-suites");const ids=[];for(const s of ["l3","rfinds"])for(const j of SUITES[s].jobs())ids.push(j.clip);console.log(ids.join(","))')
  node -e '
    const {SUITES}=require("./vf-suites");const r=require("./remote-cache");const {modelSha}=require("./emis-cache");
    const clips=[];for(const s of ["l3","rfinds"])for(const j of SUITES[s].jobs())clips.push({id:j.id,wav:j.wav});
    r.pull({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16",clips,log:()=>{}}).then(x=>console.log("pulled",x.pulled,"entries",(x.bytes/1e9).toFixed(1),"GB"));'
  node "$REPO/research/cloud-gab/results-sync.js" pull
  for c in $FILL; do
    echo "fill: $c"
    node vf-check.js --base $P/ak-v6 --cand $P/$c --suites l3,rfinds --only "$ONLY" --fill --no-pull --replay-only --jobs $(( NP > 8 ? NP / 2 : 4 )) --out /home/user/gab/fill-$c > /home/user/gab/fill-$c.log 2>&1; echo "fill $c exit $?"
    grep -E "REFUSED|recording|went past|replay-only|error" /home/user/gab/fill-$c.log | head -8
    push_cache
  done
  echo "fill-x86 done"
}
lines() {
  cd "$REPO/research/cloud-gab/lines"
  local J=$(( (NP - 4) / 2 )); [ $J -lt 2 ] && J=2
  for sp in dev test; do THREADS=2 node line-build.js --tiers main,akhand,hard --split $sp --jobs $J 2>&1 | grep -E "^[0-9]+ clips|FAILED|\[[0-9]+/[0-9]+ [0-9.]+ min\]" | awk 'NR%10==1 || /FAILED|clips,/'; done
  node line-eval.js
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix gab-lines --dir /home/user/gab/lines --skip '^(emis|work)/' --overwrite
  echo "lines done"
}
case "$JOB" in
  fill-x86*) fill_x86 ;;
  lines*) lines ;;
  all*) fill_x86 & lines; wait ;;
  *) echo "unknown job $JOB"; exit 2 ;;
esac
