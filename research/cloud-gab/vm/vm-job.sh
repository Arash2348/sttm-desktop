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
# verifier settings from the sweep (top 3 / top 6 candidates, lower bars)
mk v6-vk3l10 2245c15 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 VERIFY_LOCK=10 VERIFY_CANDS=3
mk v6-vk3l20 2245c15 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 VERIFY_LOCK=20 VERIFY_CANDS=3
mk v6-vk6l40 2245c15 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 VERIFY_LOCK=40 VERIFY_CANDS=6
mk r904 2802526
mk window-align 122acab
# P1 Akhand Kirtan stack (owner's keep rule: headline up, wrong-Shabad time not up): local pangti scoring + the
# verifier at top 6 / bar 40, probation off, on the session branch (42b8d7e)
mk v6-stack 42b8d7e SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 AK_LOCAL_CTC=2 VERIFY_LOCK=40 VERIFY_CANDS=6
# Akhand stack 2 (Oct 16): the Akhand lineage + window alignment (fixed decode grid, so one fill serves every
# variant after it) + the verifier's absolute floor (branch ak-stack2). stack2 = the stack as scored before (floor
# off); stack2-dry = traces every verifier check but never locks on it (offline sweep of VERIFY_LOCK / VERIFY_FLOOR
# from the bench trace); stack2-wa = V6 + window alignment only (the lineage's base)
mk stack2 0452ce2 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 AK_LOCAL_CTC=2 VERIFY_LOCK=40 VERIFY_CANDS=6
mk stack2-dry 0452ce2 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0 AK_LOCAL_CTC=2 VERIFY_LOCK=40 VERIFY_CANDS=6 VERIFY_DRY=1
mk stack2-wa 0452ce2 SWITCH_COMMIT_SOLID=0 PROBATION_DECODES=0
# 9.0.4 lineage (branch exp-on-904): Aarti sung-follower profiles (P1 Sung Bani) and the Kirtan pre-arm profiles
# (P0 lag); the cloud helpers for these were refused by the platform, so the VM records and scores them (cg-fill /
# cg-score), main tier, against 9.0.4's own windows
mk aarti1x 53220a0 AARTI_FOLLOW=1
mk aarti2x 53220a0 AARTI_FOLLOW=2
mk kf4 f6c8ab0 KIRTAN_FOLLOW=4
mk kf5 f6c8ab0 KIRTAN_FOLLOW=5
# P0 Akhand Paath: the Shabad-sequence mode candidate (reads the sequence instead of Ang after Ang)
mk akpaath eb789375
# 9.0.5 as merged (vf-9.0.4 @ 1271040): the held-back test split check before it goes to experimental
mk v905 1271040
# near-twin Shabad veto on top of 9.0.5 (owner's listening check, l3clip16: Farid Saloks 71 / 72)
mk twin3 02afebe KIRTAN_FOLLOW=1 NEAR_TWIN=0.03
mk twin6 02afebe KIRTAN_FOLLOW=1 NEAR_TWIN=0.06
# simran hold on top of 9.0.5 (owner, Oct 16: hold the pangti while the sangat chants Waheguru simran)
mk simran1 f677da3 KIRTAN_FOLLOW=1 SIMRAN_HOLD=1
# 9.0.6 candidate: 9.0.4 + near-twin 0.03 + Aarti profile 1, WITHOUT the gate fix (9.0.5's gate fix did not hold on the test split)
mk cand906 02afebe NEAR_TWIN=0.03 AARTI_FOLLOW=1
# ... with the near-twin veto refined (never holds a near tie that includes the Shabad on screen)
mk cand906b 747b9b7 NEAR_TWIN=0.03 AARTI_FOLLOW=1
# P0 Kirtan lag: two-signal pre-arm (profile 6) on 9.0.4
mk kf6 c803b53 KIRTAN_FOLLOW=6
# P0 Kirtan lag: shorter line-follower window (3.0 s, 2.5 s) on 9.0.4
mk kf7 7e5a23b KIRTAN_FOLLOW=7
mk kf8 7e5a23b KIRTAN_FOLLOW=8
# x86 reference (owner, Oct 17): the 9.0.6 Aarti half alone, and the Bani-end exit (branch lev-1)
mk aarti906 747b9b7 AARTI_FOLLOW=1
mk lev1 e7583176 BANI_END_EXIT=1
# ad-hoc builds from metadata cg-builds="name:commit[:CONST=v,CONST=v] ..." (no edit of this file needed)
for spec in ${CG_BUILDS:-}; do IFS=: read -r bn bc bk <<< "$spec"; mk "$bn" "$bc" ${bk//,/ }; done
# owner (Oct 16): the Akhand verdict first: verifier builds + probation, Akhand (l3) only; Renton later for the keepers
FILL="${FILL:-v6-prob v6-base3 v6-verify5 v6-vk3l10 v6-vk3l20 v6-vk6l40 v6-ctc v6-prob-ctc r904 window-align}"
FSUITES="${FSUITES:-l3}"

push_cache() { # the grown linux-x64 entries to Azure bench-cache/, the replays to bench-results/
  node -e '
    const {SUITES}=require("./vf-suites");const r=require("./remote-cache");const fs=require("fs");
    const clips=[];for(const s of process.argv[1].split(","))for(const j of SUITES[s].jobs()){const p="/root/personal/live-darbar-venues/cache/5f9e41d867de-q16/"+j.id+"/provenance.json";let pl=null;try{pl=JSON.parse(fs.readFileSync(p)).platform}catch(_){}if(pl==="linux-x64")clips.push({id:j.id,wav:j.wav});}
    r.push({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16",clips,commit:"cloud-gab fill-x86",log:()=>{}}).then(x=>console.log("pushed to Azure bench-cache:",JSON.stringify(x)));' "$FSUITES"
  node "$REPO/research/cloud-gab/results-sync.js" push
}
# Akhand Paath (owner's P0): give the 4-akhand-paath rows their runner locally (hf-akhand-paath/jobs.js, same edit as the
# GAB PR), fetch the practice-split captioned recordings, record their model output on 9.0.4, push, score the row.
apaath() {
  local BENCH=/home/user/gab/bench
  node "$REPO/research/cloud-gab/hf-akhand-paath/jobs.js" --local "$BENCH/manifest.csv"
  local IDS
  IDS=$(cd "$TOOLS" && node -e 'const {parseCsv,canonRows}=require("./vf-manifest");const rows=canonRows(parseCsv(require("fs").readFileSync(process.argv[1],"utf8")));console.log(rows.filter(r=>r.content_folder==="4-akhand-paath"&&(process.env.AP_SPLIT==="test"?r.split==="test":r.split!=="test")&&r.id.startsWith("ytap_")).map(r=>r.id).join(","))' "$BENCH/manifest.csv")
  echo "apaath: $IDS"
  for id in ${IDS//,/ }; do
    mkdir -p "$BENCH/4-akhand-paath/$id"
    for f in audio.wav shabads.csv lines.csv meta.json; do
      [ -s "$BENCH/4-akhand-paath/$id/$f" ] || curl -sS -f -L -H "Authorization: Bearer $HF_TOKEN" -o "$BENCH/4-akhand-paath/$id/$f" "https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/main/4-akhand-paath/$id/$f" || echo "apaath: $id/$f not fetched"
    done
  done
  cd "$TOOLS"
  node vf-check.js --record --roots $P/r904 --suites apaath --only "$IDS" --no-pull > /home/user/gab/apaath-record.log 2>&1; echo "apaath record exit $?"
  grep -E "REFUSED|recorded|error|done:" /home/user/gab/apaath-record.log | tail -5
  FSUITES=apaath push_cache
  VF_MIN_FREE_GB=3 ./gab run $P/r904 --set main --tier full --jobs "$NP" --manifest "$BENCH" --folders 4-akhand-paath ${AP_SPLIT:+--split $AP_SPLIT} > /home/user/gab/apaath-score.log 2>&1; echo "apaath score exit $?"
  grep -E "^\| \*\*Akhand Paath|INCOMPLETE|Not run" /home/user/gab/apaath-score.log | cut -c1-300
  echo "apaath done"
}
fill_x86() {
  cd "$TOOLS"
  # the x86 clips (practice + test), pulled from Azure with their provenance
  local ONLY
  ONLY=$(node -e 'const {SUITES}=require("./vf-suites");const ids=[];for(const s of process.argv[1].split(","))for(const j of SUITES[s].jobs())ids.push(j.clip);console.log(ids.join(","))' "$FSUITES")
  node -e '
    const {SUITES}=require("./vf-suites");const r=require("./remote-cache");const {modelSha}=require("./emis-cache");
    const clips=[];for(const s of process.argv[1].split(","))for(const j of SUITES[s].jobs())clips.push({id:j.id,wav:j.wav});
    r.pull({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16",clips,log:()=>{}}).then(x=>console.log("pulled",x.pulled,"entries",(x.bytes/1e9).toFixed(1),"GB"));' "$FSUITES"
  node "$REPO/research/cloud-gab/results-sync.js" pull
  for c in $FILL; do
    echo "fill: $c"
    # a lock at a new moment asks for windows past what one round recorded: fill until a round has no cache miss (max 5)
    for round in 1 2 3 4 5; do
      node vf-check.js --base $P/ak-v6 --cand $P/$c --suites "$FSUITES" --only "$ONLY" --fill --no-pull --replay-only --jobs $(( NP > 8 ? NP / 2 : 4 )) --out /home/user/gab/fill-$c > /home/user/gab/fill-$c.log 2>&1; echo "fill $c round $round exit $?"
      grep -E "REFUSED|recording|went past|replay-only|error" /home/user/gab/fill-$c.log | head -8
      grep -qE "replay-only: .* [1-9][0-9]* cache misses" /home/user/gab/fill-$c.log || break
      grep -qE "REFUSED to record" /home/user/gab/fill-$c.log && ! grep -qE "recording [1-9]" /home/user/gab/fill-$c.log && break
    done
    push_cache
  done
  echo "fill-x86 done"
}
# cg-score: after the fill, score these builds on every tier here (32 cores: minutes) and share the results
# (bench-results/replays), so the lead session compares scorecards without pulling the model windows.
score_builds() {
  cd "$TOOLS"
  for b in ${SCORE:-}; do
    for t in main akhand hard; do
      VF_MIN_FREE_GB=3 ./gab run $P/$b --set $t --tier full --jobs "$NP" --manifest hf > /home/user/gab/score-$b-$t.log 2>&1; echo "score $b $t exit $?"
      grep -E "^\| \*\*|INCOMPLETE|Not run|Timing" /home/user/gab/score-$b-$t.log | cut -c1-240
    done
  done
  node "$REPO/research/cloud-gab/results-sync.js" push
  echo "score done"
}
# cg-test: the held-back test split, once, on builds about to ship (GAB.md split rule): records the windows a build
# needs on the test recordings (--fill, this machine's platform only) and scores every tier; results to Azure
test_split() {
  cd "$TOOLS"
  for b in ${TEST_BUILDS:-}; do
    for t in main akhand hard; do
      VF_MIN_FREE_GB=3 ./gab run $P/$b --set $t --tier full --jobs "$NP" --manifest hf --split test --fill > /home/user/gab/test-$b-$t.log 2>&1; echo "test $b $t exit $?"
      grep -E "^\| \*\*|INCOMPLETE|Not run|Timing" /home/user/gab/test-$b-$t.log | cut -c1-240
    done
  done
  node "$REPO/research/cloud-gab/results-sync.js" push
  echo "test done"
}
# x86 reference (owner, Oct 17 2026): every GAB recording (all tiers, practice + test, GAB manifest on HF main) gets x86
# model output in the codec namespace q16-x86, for each build in FILL; then each build in SCORE is scored on every tier,
# practice and test, from that namespace only. Mac (q16, darwin-arm64) entries are never read or written here.
# Resumable: the local cache and saved replays survive the 6 h stop; rerunning the same job skips finished work.
x86() {
  export VF_EMIS_CODEC=q16-x86 VF_RECORD_JOBS="${VF_RECORD_JOBS:-10}" VF_REPLAY_MAX="${VF_REPLAY_MAX:-$(( NP - 2 ))}" VF_REPLAY_SLOTS=8
  unset VF_SPLIT
  local C=/root/personal/live-darbar-venues/cache BENCH=/home/user/gab/bench W=/home/user/gab/x86 t0=$(date +%s)
  mkdir -p $W/cards
  cd "$TOOLS"
  # Akhand Paath audio + keys live in the benchmark folder (its runner reads them there), both splits
  node -e 'const {parseCsv,canonRows}=require("./vf-manifest");const rows=canonRows(parseCsv(require("fs").readFileSync(process.argv[1],"utf8")));console.log(rows.filter(r=>(r.suite_jobs||"").startsWith("apaath:")).map(r=>r.content_folder+"/"+r.id).join(" "))' "$BENCH/manifest.csv" > $W/apaath.txt
  for d in $(cat $W/apaath.txt); do mkdir -p "$BENCH/$d"; for f in audio.wav shabads.csv lines.csv meta.json; do
    [ -s "$BENCH/$d/$f" ] || curl -sS -f -L -H "Authorization: Bearer $HF_TOKEN" -o "$BENCH/$d/$f" "https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/main/$d/$f" 2>/dev/null || true; done; done
  # every GAB recording with a runner and audio here (the first suite job of each manifest row, as gab run picks it)
  node -e '
    const fs=require("fs");const {parseCsv,canonRows}=require("./vf-manifest");const G=require("./gab-score");const {SUITES}=require("./vf-suites");
    const rows=canonRows(parseCsv(fs.readFileSync(process.argv[1],"utf8")));const ex=G.loadSets().exclude||{};const memo={};const jobs=[];const miss=[];
    for(const r of rows){if(ex[r.id])continue;const first=(r.suite_jobs||"").split(";").filter(Boolean)[0];if(!first)continue;const [s,c]=first.split(":");if(!SUITES[s])continue;
      memo[s]=memo[s]||SUITES[s].jobs();const j=memo[s].find(x=>x.clip===c||x.id===c);if(!j||!fs.existsSync(j.wav)){miss.push(r.id);continue;}jobs.push({suite:s,clip:j.clip,id:j.id,wav:j.wav,dur:j.dur,split:r.split});}
    fs.writeFileSync(process.argv[2],JSON.stringify(jobs));console.log(`x86: ${jobs.length} GAB recordings (${(jobs.reduce((a,j)=>a+j.dur,0)/3600).toFixed(1)} h), ${miss.length} without audio/runner here: ${miss.join(" ")}`);' "$BENCH/manifest.csv" $W/jobs.json
  local SUITES_L ONLY_L
  SUITES_L=$(node -e 'console.log([...new Set(require(process.argv[1]).map(j=>j.suite))].join(","))' $W/jobs.json)
  ONLY_L=$(node -e 'console.log([...new Set(require(process.argv[1]).map(j=>j.clip))].join(","))' $W/jobs.json)
  # seed the x86 namespace: this machine's own linux-x64 q16 entries (local copy), then whatever Azure q16-x86 holds
  node -e '
    const fs=require("fs"),path=require("path");const jobs=require(process.argv[1]);const C=process.argv[2];let n=0;
    for(const j of jobs){const src=path.join(C,"5f9e41d867de-q16",j.id),dst=path.join(C,"5f9e41d867de-q16-x86",j.id);
      if(fs.existsSync(path.join(dst,"index.jsonl")))continue;let p=null;try{p=JSON.parse(fs.readFileSync(path.join(src,"provenance.json"))).platform}catch(_){}
      if(p!=="linux-x64"||!fs.existsSync(path.join(src,"index.jsonl")))continue;fs.cpSync(src,dst,{recursive:true});n++;}
    console.log("x86: seeded",n,"entries from this machine'"'"'s linux-x64 q16 cache");' $W/jobs.json $C
  node -e '
    const r=require("./remote-cache");const jobs=require(process.argv[1]);
    r.pull({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16-x86",clips:jobs.map(j=>({id:j.id,wav:j.wav})),log:()=>{}}).then(x=>console.log("x86: pulled",x.pulled,"q16-x86 entries",(x.bytes/1e9).toFixed(1),"GB"));' $W/jobs.json
  node "$REPO/research/cloud-gab/results-sync.js" pull
  df -h / | tail -1
  # once (Oct 17): kh04 was recorded by two processes at once in the first x86 run (fremont + jaspal) before the tools
  # serialised that; its x86 entry was never shared, drop it here so it is recorded again cleanly
  [ -f $W/kh04-reset ] || { rm -rf "$C/5f9e41d867de-q16-x86/kh04_sttm_desktop_2026_10_08T03_51_10_447Z"; touch $W/kh04-reset; echo "x86: kh04 entry reset"; }
  # record: each FILL build replays every recording; a recording that leaves the cache (no x86 output yet, or a
  # behaviour that asks for new windows) is recorded with the model on this machine, then replayed again
  # cg-nofill=1 (Oct 18): replay-only, never run the model; a recording without x86 output stays "not run" in the scorecard
  local NOFILL; NOFILL=$(curl -sf -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/instance/attributes/cg-nofill || true)
  [ -n "$NOFILL" ] && echo "x86: replay-only (no model runs)"
  for b in $([ -n "$NOFILL" ] || echo ${FILL:-$SCORE}); do
    [ -f $W/filled-$b ] && { echo "x86 fill $b: done earlier"; continue; }
    for round in 1 2 3 4; do
      rm -f $W/fill-$b/replay.json
      node vf-check.js --base $P/$b --cand $P/$b --suites "$SUITES_L" --only "$ONLY_L" --fill --no-pull --replay-only --jobs $(( NP - 2 )) --out $W/fill-$b > $W/fill-$b.log 2>&1; echo "x86 fill $b round $round exit $? ($(( ($(date +%s) - t0) / 60 )) min)"
      grep -E "REFUSED|went past|replay-only:" $W/fill-$b.log | cut -c1-300
      local left; left=$(node -e 'try{const r=require(process.argv[1]);console.log(r.missed.length+r.failed.length)}catch(_){console.log(-1)}' $W/fill-$b/replay.json)
      echo "x86 fill $b: $left recordings still not replayed"
      [ "$left" = 0 ] && { touch $W/filled-$b; break; }
    done
    rm -rf $W/fill-$b/base $W/fill-$b/.jobs
  done
  # share: the x86 entries (only those larger than Azure's copy) and the replays
  node -e '
    const r=require("./remote-cache");const jobs=require(process.argv[1]);
    r.push({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16-x86",clips:jobs.map(j=>({id:j.id,wav:j.wav})),commit:"cloud-gab x86 reference",log:()=>{}}).then(x=>console.log("x86: pushed to Azure bench-cache q16-x86:",x.pushed,"entries",(x.bytes/1e9).toFixed(1),"GB"));' $W/jobs.json
  node "$REPO/research/cloud-gab/results-sync.js" push
  # score: every tier, practice and test, x86 namespace only
  for b in ${SCORE:-}; do
    for sp in dev test; do for t in main akhand hard; do
      VF_MIN_FREE_GB=3 ./gab run $P/$b --set $t --tier full --jobs $(( NP - 2 )) --manifest hf --split $sp --out $W/run-$b-$t-$sp > $W/score-$b-$t-$sp.log 2>&1; echo "x86 score $b $t $sp exit $?"
      grep -E "^\| \*\*|INCOMPLETE|Not run" $W/score-$b-$t-$sp.log | cut -c1-240
      mkdir -p $W/cards/$b; cp $W/run-$b-$t-$sp/scorecard.json $W/cards/$b/$t-$sp.json 2>/dev/null; cp $W/run-$b-$t-$sp/scorecard.md $W/cards/$b/$t-$sp.md 2>/dev/null
    done; done
  done
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix bench-results/x86-cards --dir $W/cards --overwrite
  node "$REPO/research/cloud-gab/results-sync.js" push
  echo "x86 done ($(( ($(date +%s) - t0) / 60 )) min)"
}
# Kirtan find (Oct 17): the new GurbaniRattan + rajikaurrr kirtan recordings (dataset PRs #14-#16, staged in Azure
# sung-bani-data/, their model output in the q16 namespace): fill + score 9.0.4 and the KN_BUILDS on them, both splits;
# scorecards and the 9.0.4 run (traces) to Azure bench-results/kirnew/<job>/
kirnew() {
  export VF_EMIS_CODEC=q16
  KN_BUILDS="${KN_BUILDS:-$(curl -sf -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/instance/attributes/cg-kn || true)}"
  local BENCH=/home/user/gab/kn-bench ST=/home/user/gab/kn-stage O=/home/user/gab/kn-out
  mkdir -p "$BENCH" "$O"
  for sp in sung-bani-data/kirtan-gr-b1 sung-bani-data/kirtan-gr-b2 sung-bani-data/kirtan-raji-b3 sung-bani-data/kirtan-b23 sung-bani-data/kirtan-daras; do
    node "$REPO/research/cloud-gab/results-sync.js" pull --prefix "$sp" --dir "$ST/$sp" | tail -1; cp -r "$ST/$sp/." "$BENCH/"; done
  export VF_BENCHMARK="$BENCH"
  cd "$TOOLS"
  local ONLY
  ONLY=$(node -e 'const {parseCsv,canonRows}=require("./vf-manifest");const rows=canonRows(parseCsv(require("fs").readFileSync(process.argv[1],"utf8")));console.log(rows.filter(r=>/^yt(gr|raji)_/.test(r.id)&&r.content_folder==="1-kirtan-shabad").map(r=>r.id).join(","))' "$BENCH/manifest.csv")
  echo "kirnew: $(echo "$ONLY" | tr ',' '\n' | wc -l) clips"
  node -e '
    const {SUITES}=require("./vf-suites");const r=require("./remote-cache");const ids=new Set(process.argv[1].split(","));
    const clips=SUITES.apaath.jobs().filter(j=>ids.has(j.clip)||ids.has(j.id)).map(j=>({id:j.id,wav:j.wav}));
    r.pull({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16",clips,log:()=>{}}).then(x=>console.log("kirnew: pulled",x.pulled,"q16 entries for",clips.length,"clips"));' "$ONLY"
  node "$REPO/research/cloud-gab/results-sync.js" pull | tail -1
  for b in ${KN_BUILDS:-}; do
    for round in 1 2 3 4; do
      node vf-check.js --base $P/r904 --cand $P/$b --suites apaath --only "$ONLY" --fill --no-pull --replay-only --jobs $(( NP - 2 )) --out /home/user/gab/kn-fill-$b > /home/user/gab/kn-fill-$b.log 2>&1; echo "kirnew fill $b round $round exit $?"
      grep -E "REFUSED|went past|replay-only:" /home/user/gab/kn-fill-$b.log | cut -c1-200
      grep -qE "replay-only: .* [1-9][0-9]* cache misses" /home/user/gab/kn-fill-$b.log || break
    done
  done
  for b in r904 ${KN_BUILDS:-}; do for sp in dev test; do
    local SPA=""; [ $sp = test ] && SPA="--split test"
    VF_MIN_FREE_GB=3 ./gab run $P/$b --set main --tier full --jobs $(( NP - 2 )) --manifest "$BENCH" --folders 1-kirtan-shabad --ids "$ONLY" $SPA --out "$O/run-$b-$sp" > /home/user/gab/kn-score-$b-$sp.log 2>&1; echo "kirnew score $b $sp exit $?"
    grep -E "^\| \*\*Kirtan|INCOMPLETE|Not run" /home/user/gab/kn-score-$b-$sp.log | cut -c1-240
    mkdir -p "$O/cards/$b"; cp "$O/run-$b-$sp/scorecard.json" "$O/cards/$b/$sp.json" 2>/dev/null
  done; done
  # the 9.0.4 traces for the miss diagnosis (text only)
  mkdir -p "$O/trace-r904"; find "$O/run-r904-dev" "$O/run-r904-test" -name '*.events.jsonl' -exec cp {} "$O/trace-r904/" \; 2>/dev/null
  find "$O/run-r904-dev" "$O/run-r904-test" -path '*apaath/*.json' -not -name '*.events*' -exec cp {} "$O/trace-r904/" \; 2>/dev/null
  echo "kirnew: $(ls $O/trace-r904 | wc -l) trace files"
  node "$REPO/research/cloud-gab/results-sync.js" push | tail -1
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix "bench-results/kirnew/$JOB" --dir "$O" --skip '^run-' --overwrite | tail -1
  echo "kirnew done"
}
# Owner live session (Oct 17, 2026-10-17T03-12-41-944Z) offline: the session cut into 30-min pieces with the live
# screen as truth (staged in Azure sung-bani-data/owner-live-20261017, not in GAB); x86 output (q16-x86); r904 + SESS_BUILDS
sess() {
  export VF_EMIS_CODEC=q16-x86 VF_RECORD_JOBS="${VF_RECORD_JOBS:-10}" VF_REPLAY_MAX="${VF_REPLAY_MAX:-$(( NP - 2 ))}"
  local BENCH=/home/user/gab/sess-bench O=/home/user/gab/sess-out
  mkdir -p "$BENCH" "$O"
  node "$REPO/research/cloud-gab/results-sync.js" pull --prefix sung-bani-data/owner-live-20261017 --dir "$BENCH" | tail -1
  export VF_BENCHMARK="$BENCH"
  cd "$TOOLS"
  local ONLY
  ONLY=$(node -e 'const {parseCsv,canonRows}=require("./vf-manifest");const rows=canonRows(parseCsv(require("fs").readFileSync(process.argv[1],"utf8")));console.log(rows.filter(r=>/^owner_live_/.test(r.id)).map(r=>r.id).join(","))' "$BENCH/manifest.csv")
  echo "sess: $ONLY"
  node "$REPO/research/cloud-gab/results-sync.js" pull | tail -1
  for b in r904 ${SESS_BUILDS:-}; do
    for round in 1 2 3 4; do
      node vf-check.js --base $P/$b --cand $P/$b --suites apaath --only "$ONLY" --fill --no-pull --replay-only --jobs $(( NP - 2 )) --out /home/user/gab/sess-fill-$b > /home/user/gab/sess-fill-$b.log 2>&1; echo "sess fill $b round $round exit $?"
      grep -E "REFUSED|went past|replay-only:" /home/user/gab/sess-fill-$b.log | cut -c1-200
      grep -qE "replay-only: .* [1-9][0-9]* cache misses" /home/user/gab/sess-fill-$b.log || break
    done
    VF_MIN_FREE_GB=3 ./gab run $P/$b --set main --tier full --jobs $(( NP - 2 )) --manifest "$BENCH" --folders 1-kirtan-shabad --ids "$ONLY" --out "$O/run-$b" > /home/user/gab/sess-score-$b.log 2>&1; echo "sess score $b exit $?"
    grep -E "^\| \*\*Kirtan|INCOMPLETE|Not run" /home/user/gab/sess-score-$b.log | cut -c1-240
    mkdir -p "$O/cards/$b"; cp "$O/run-$b/scorecard.json" "$O/cards/$b/dev.json" 2>/dev/null
    mkdir -p "$O/trace-$b"; find "$O/run-$b" -name '*.events.jsonl' -exec cp {} "$O/trace-$b/" \; 2>/dev/null
  done
  node -e '
    const r=require("./remote-cache");const {SUITES}=require("./vf-suites");const ids=new Set(process.argv[1].split(","));
    const clips=SUITES.apaath.jobs().filter(j=>ids.has(j.clip)||ids.has(j.id)).map(j=>({id:j.id,wav:j.wav}));
    r.push({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16-x86",clips,commit:"cloud-gab owner session",log:()=>{}}).then(x=>console.log("sess: pushed",x.pushed,"q16-x86 entries"));' "$ONLY"
  node "$REPO/research/cloud-gab/results-sync.js" push | tail -1
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix "bench-results/r907-sess/$JOB" --dir "$O" --skip '^run-' --overwrite | tail -1
  echo "sess done"
}
lines() {
  cd "$REPO/research/cloud-gab/lines"
  local J=$(( (NP - 4) / 2 )); [ $J -lt 2 ] && J=2
  for sp in dev test; do THREADS=2 node line-build.js --tiers main,akhand,hard --split $sp --jobs $J 2>&1 | grep -E "^[0-9]+ clips|FAILED|\[[0-9]+/[0-9]+ [0-9.]+ min\]" | awk 'NR%10==1 || /FAILED|clips,/'; done
  node line-eval.js
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix gab-lines --dir /home/user/gab/lines --skip '^(emis|work)/' --overwrite
  echo "lines done"
}
# the older jobs keep the first cache namespace (q16: linux-x64 entries on the clips this VM recorded first) for both
# their fill and their score, so a job started before Oct 17 behaves as it did; x86* is the x86 reference for everything
[[ "$JOB" == x86* ]] || export VF_EMIS_CODEC="${VF_EMIS_CODEC:-q16}"
case "$JOB" in
  fill-x86*) fill_x86; [[ "$JOB" == *apaath* ]] && apaath; [ -n "${SCORE:-}" ] && score_builds; [ -n "${TEST_BUILDS:-}" ] && test_split ;;
  apaath-test*) AP_SPLIT=test apaath; node "$REPO/research/cloud-gab/results-sync.js" push ;;
  apaath*) apaath ;;
  score*) score_builds; [ -n "${TEST_BUILDS:-}" ] && test_split ;;
  test*) test_split ;;
  x86-sess*) SESS_BUILDS="${SESS_BUILDS:-$(curl -sf -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/instance/attributes/cg-sess || true)}" sess ;;
  x86-kirnew*) kirnew ;;
  x86-both*) kirnew; unset VF_BENCHMARK; cd "$REPO"; x86 ;;
  x86*) x86 ;;
  lines*) lines ;;
  all*) fill_x86 & lines; wait ;;
  *) echo "unknown job $JOB"; exit 2 ;;
esac
