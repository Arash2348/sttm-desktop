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
lines() {
  cd "$REPO/research/cloud-gab/lines"
  local J=$(( (NP - 4) / 2 )); [ $J -lt 2 ] && J=2
  for sp in dev test; do THREADS=2 node line-build.js --tiers main,akhand,hard --split $sp --jobs $J 2>&1 | grep -E "^[0-9]+ clips|FAILED|\[[0-9]+/[0-9]+ [0-9.]+ min\]" | awk 'NR%10==1 || /FAILED|clips,/'; done
  node line-eval.js
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix gab-lines --dir /home/user/gab/lines --skip '^(emis|work)/' --overwrite
  echo "lines done"
}
# P0 Sung Bani (owner, Oct 17): the owner's all-Banis-sung Nitnem video (Rt1TyWzPykc) cut into 5-10 min clips
# (hf-sung-bani/). Fetches the clips from the dataset revision SB_REV (the open PR, refs/pr/N, until merged), records
# their model output on 9.0.4 (r904) on THIS machine (x86), fills what the 9.0.6 candidate (cand906b) asks for,
# pushes the cache, scores both builds on just these clips (SB_STAGE: the staged PR files from Azure instead of HF), and shares the scorecards (Azure sung-bani-data/).
sungbani() {
  local BENCH=/home/user/gab/sb-bench REV="${SB_REV:-main}" OUTD=/home/user/gab/sb-out
  mkdir -p "$BENCH" "$OUTD"
  export SB_IDRE
  local R="https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/${REV//\//%2F}"
  if [ -n "${SB_STAGE:-}" ]; then
    # the staged PR files (clips + manifest) from Azure
    for sp in ${SB_STAGE//,/ }; do node "$REPO/research/cloud-gab/results-sync.js" pull --prefix "$sp" --dir "/home/user/gab/stage/$sp"; done
    # (the dataset PR is opened from the Mac with hf-pr.js by a token that may open PRs; this job only scores)
    local LAST; LAST=${SB_STAGE##*,}
    cp -r "/home/user/gab/stage/$LAST/." "$BENCH/"
  else
    curl -sS -f -L -H "Authorization: Bearer $HF_TOKEN" -o "$BENCH/manifest.csv" "$R/manifest.csv" || { echo "sungbani: no manifest at $REV"; return 1; }
  fi
  export VF_BENCHMARK="$BENCH"
  local IDS
  IDS=$(cd "$TOOLS" && node -e 'const {parseCsv,canonRows}=require("./vf-manifest");const rows=canonRows(parseCsv(require("fs").readFileSync(process.argv[1],"utf8")));console.log(rows.filter(r=>new RegExp(process.env.SB_IDRE||"^yt[a-z0-9]+_Rt1TyWzPykc_").test(r.id)&&/apaath:/.test(r.suite_jobs||"")).map(r=>r.id+"@"+r.content_folder).join(","))' "$BENCH/manifest.csv")
  local ONLY=""
  for x in ${IDS//,/ }; do
    local id=${x%@*} f=${x#*@}; ONLY="$ONLY,$id"
    mkdir -p "$BENCH/$f/$id"
    for g in audio.wav shabads.csv lines.csv meta.json; do
      [ -s "$BENCH/$f/$id/$g" ] || curl -sS -f -L -H "Authorization: Bearer $HF_TOKEN" -o "$BENCH/$f/$id/$g" "$R/$f/$id/$g" || echo "sungbani: $id/$g not fetched"
    done
  done
  ONLY=${ONLY#,}; echo "sungbani: $(echo "$ONLY" | tr ',' '\n' | wc -l) clips from $REV"
  if [ -n "${SB_ALIGN:-}" ]; then
    # recordings with no on-screen pangtis: two-model forced alignment of the known Bani (line-build.js), keep the
    # starts both models agree on (within 1 s, words heard: check >= 0.5) as aligned-2model-audited, share the keys
    for x in ${IDS//,/ }; do local id=${x%@*} f=${x#*@} hit=0; for p in ${SB_ALIGN//,/ }; do [[ "$id" == "$p"* ]] && hit=1; done; [ $hit = 1 ] || continue
      cp "$BENCH/$f/$id/audio.wav" "/home/user/gab/clips/$(cd "$TOOLS" && node -e 'const {parseCsv,canonRows}=require("./vf-manifest");const r=canonRows(parseCsv(require("fs").readFileSync(process.argv[1],"utf8"))).find(r=>r.id===process.argv[2]);console.log(r.source_file)' "$BENCH/manifest.csv" "$id")"; done
    (cd "$REPO/research/cloud-gab/lines" && VF_BENCHMARK="$BENCH" THREADS=4 node line-build.js --tiers main,akhand --ids "$SB_ALIGN" --split "${SB_ALIGN_SPLIT:-dev}" --jobs 4 2>&1 | tail -5)
    node -e '
      const fs=require("fs"),path=require("path");const [B,L,ids]=process.argv.slice(1);
      for(const f of fs.readdirSync(path.join(L,"keys"),{recursive:true}).filter(x=>x.endsWith("lines.csv"))){const id=path.basename(path.dirname(f));if(!ids.split(",").some(p=>id.startsWith(p)))continue;
        const [h,...rows]=fs.readFileSync(path.join(L,"keys",f),"utf8").trim().split(String.fromCharCode(10));const k=h.split(",");const ci=k.indexOf("confidence"),si=k.indexOf("source");
        const keep=rows.filter(r=>{const c=r.split(",");return c[si]==="aligned-2model-sure";}).map(r=>{const c=r.split(",");c[si]="aligned-2model-audited";return c.join(",");});
        const dst=path.join(B,path.dirname(f),"lines.csv");fs.writeFileSync(dst,[h,...keep].join(String.fromCharCode(10))+String.fromCharCode(10));console.log("aligned keys",id,keep.length,"of",rows.length);}' "$BENCH" /home/user/gab/lines "$SB_ALIGN"
    mkdir -p "$OUTD/keys"; (cd /home/user/gab/lines && cp -r keys align summary.json "$OUTD/keys/" 2>/dev/null)
  fi
  cd "$TOOLS"
  node "$REPO/research/cloud-gab/results-sync.js" pull >/dev/null 2>&1
  node vf-check.js --record --roots $P/r904 --suites apaath --only "$ONLY" --no-pull --jobs "$NP" > /home/user/gab/sb-record.log 2>&1; echo "sungbani record r904 exit $?"
  grep -E "REFUSED|recorded|error|done:" /home/user/gab/sb-record.log | tail -5
  for round in 1 2 3 4 5; do
    node vf-check.js --base $P/r904 --cand $P/cand906b --suites apaath --only "$ONLY" --fill --no-pull --replay-only --jobs "$NP" --out /home/user/gab/sb-fill > /home/user/gab/sb-fill.log 2>&1; echo "sungbani fill cand906b round $round exit $?"
    grep -E "REFUSED|recording|went past|replay-only|error" /home/user/gab/sb-fill.log | head -5
    grep -qE "replay-only: .* [1-9][0-9]* cache misses" /home/user/gab/sb-fill.log || break
  done
  FSUITES=apaath push_cache
  local PRE="${SB_IDS:-ytjapji_Rt1TyWzPykc,ytjaap_Rt1TyWzPykc,yttavprasad_Rt1TyWzPykc,ytrehras_Rt1TyWzPykc,ytaarti_Rt1TyWzPykc,ytsalokm9_Rt1TyWzPykc,ytsohila_Rt1TyWzPykc}"
  for b in r904 cand906b; do
    for sp in ${SB_SPLITS:-dev}; do
      local SPA=""; [ "$sp" = test ] && SPA="--split test"
      VF_MIN_FREE_GB=3 ./gab run $P/$b --set main --tier full --jobs "$NP" --manifest "$BENCH" --folders 3-bani-sung-like-kirtan --ids "$PRE" $SPA > /home/user/gab/sb-score-$b-$sp.log 2>&1; echo "sungbani score $b $sp exit $?"
      grep -E "^\| \*\*|INCOMPLETE|Not run" /home/user/gab/sb-score-$b-$sp.log | cut -c1-260
      local d; d=$(ls -td "$TOOLS"/../results/gab/*-run 2>/dev/null | head -1)
      [ -n "$d" ] && mkdir -p "$OUTD/$b-$sp" && cp "$d"/scorecard.* "$OUTD/$b-$sp/" && cp /home/user/gab/sb-score-$b-$sp.log "$OUTD/$b-$sp/"
    done
  done
  node "$REPO/research/cloud-gab/results-sync.js" push
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix sung-bani-data/results --dir "$OUTD" --overwrite
  echo "sungbani done"
}
case "$JOB" in
  fill-x86*) fill_x86; [[ "$JOB" == *apaath* ]] && apaath; [ -n "${SCORE:-}" ] && score_builds; [ -n "${TEST_BUILDS:-}" ] && test_split ;;
  sungbani*) sungbani ;;
  apaath-test*) AP_SPLIT=test apaath; node "$REPO/research/cloud-gab/results-sync.js" push ;;
  apaath*) apaath ;;
  score*) score_builds; [ -n "${TEST_BUILDS:-}" ] && test_split ;;
  test*) test_split ;;
  lines*) lines ;;
  all*) fill_x86 & lines; wait ;;
  *) echo "unknown job $JOB"; exit 2 ;;
esac
