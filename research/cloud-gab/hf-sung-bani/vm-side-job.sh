#!/bin/bash
# side-job on a VM that is already running another cg-job: own /tmp (own bench lock), own paths, ~12 cores
set -uo pipefail
REPO=/home/user/sttm-desktop; TOOLS=/home/user/gab-tools/research/level2-dataset/tools; P=/root/personal; NP=12; export HOME=/root PATH=/opt/node/bin:$PATH
sec() { gcloud secrets versions access latest --secret "$1" --project vf-bench-sttm 2>/dev/null; }
HF_TOKEN="$(sec vf-hf-token)"; VF_AZURE_SAS="$(sec vf-azure-sas)"; export HF_TOKEN VF_AZURE_SAS
push_cache() { # the grown linux-x64 entries to Azure bench-cache/, the replays to bench-results/
  node -e '
    const {SUITES}=require("./vf-suites");const r=require("./remote-cache");const fs=require("fs");
    const clips=[];for(const s of process.argv[1].split(","))for(const j of SUITES[s].jobs()){const p="/root/personal/live-darbar-venues/cache/5f9e41d867de-q16/"+j.id+"/provenance.json";let pl=null;try{pl=JSON.parse(fs.readFileSync(p)).platform}catch(_){}if(pl==="linux-x64")clips.push({id:j.id,wav:j.wav});}
    r.push({root:"/root/personal/live-darbar-venues/cache",model:"5f9e41d867de",codec:"q16",clips,commit:"cloud-gab fill-x86",log:()=>{}}).then(x=>console.log("pushed to Azure bench-cache:",JSON.stringify(x)));' "$FSUITES"
  node "$REPO/research/cloud-gab/results-sync.js" push
}
sungbani() {
  local BENCH=/home/user/gab/sbk-bench REV="${SB_REV:-main}" OUTD=/home/user/gab/sbk-out
  mkdir -p "$BENCH" "$OUTD"
  export SB_IDRE
  local R="https://huggingface.co/datasets/khalisfoundation/GurbaniAutopilotBench/resolve/${REV//\//%2F}"
  if [ -n "${SB_STAGE:-}" ]; then
    # the staged PR files (clips + manifest) from Azure
    for sp in ${SB_STAGE//,/ }; do node "$REPO/research/cloud-gab/results-sync.js" pull --prefix "$sp" --dir "/home/user/gab/sbk-stage/$sp"; done
    # (the dataset PR is opened from the Mac with hf-pr.js by a token that may open PRs; this job only scores)
    local LAST; LAST=${SB_STAGE##*,}
    cp -r "/home/user/gab/sbk-stage/$LAST/." "$BENCH/"
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
    for asp in ${SB_ALIGN_SPLIT:-dev}; do (cd "$REPO/research/cloud-gab/lines" && VF_BENCHMARK="$BENCH" THREADS=2 node line-build.js --tiers main,akhand --ids "$SB_ALIGN" --split "$asp" --jobs "${SB_ALIGN_JOBS:-4}" 2>&1 | tail -12); done
    [ "${SB_ALIGN_MODE:-keys}" = audit ] || node -e '
      const fs=require("fs"),path=require("path");const [B,L,ids]=process.argv.slice(1);
      for(const f of fs.readdirSync(path.join(L,"keys"),{recursive:true}).filter(x=>x.endsWith("lines.csv"))){const id=path.basename(path.dirname(f));if(!ids.split(",").some(p=>id.startsWith(p)))continue;
        const [h,...rows]=fs.readFileSync(path.join(L,"keys",f),"utf8").trim().split(String.fromCharCode(10));const k=h.split(",");const ci=k.indexOf("confidence"),si=k.indexOf("source");
        const keep=rows.filter(r=>{const c=r.split(",");return c[si]==="aligned-2model-sure";}).map(r=>{const c=r.split(",");c[si]="aligned-2model-audited";return c.join(",");});
        const dst=path.join(B,path.dirname(f),"lines.csv");fs.writeFileSync(dst,[h,...keep].join(String.fromCharCode(10))+String.fromCharCode(10));console.log("aligned keys",id,keep.length,"of",rows.length);}' "$BENCH" /home/user/gab/lines "$SB_ALIGN"
    mkdir -p "$OUTD/keys"; (cd /home/user/gab/lines && cp -r keys align summary.json "$OUTD/keys/" 2>/dev/null)
  fi
  cd "$TOOLS"
  node "$REPO/research/cloud-gab/results-sync.js" pull >/dev/null 2>&1
  node vf-check.js --record --roots $P/r904 --suites apaath --only "$ONLY" --no-pull --jobs "${SB_JOBS:-$NP}" > /home/user/gab/sbk-record.log 2>&1; echo "sungbani record r904 exit $?"
  grep -E "REFUSED|recorded|error|done:" /home/user/gab/sbk-record.log | tail -5
  FSUITES=apaath push_cache
  local PRE="${SB_IDS:-ytjapji_Rt1TyWzPykc,ytjaap_Rt1TyWzPykc,yttavprasad_Rt1TyWzPykc,ytrehras_Rt1TyWzPykc,ytaarti_Rt1TyWzPykc,ytsalokm9_Rt1TyWzPykc,ytsohila_Rt1TyWzPykc}"
  for b in ${SB_BUILDS:-r904}; do
    for sp in ${SB_SPLITS:-dev}; do
      local SPA=""; [ "$sp" = test ] && SPA="--split test"
      VF_MIN_FREE_GB=3 ./gab run $P/$b --set main --tier full --jobs "${SB_JOBS:-$NP}" --manifest "$BENCH" --folders "${SB_FOLDERS:-3-bani-sung-like-kirtan}" --ids "$PRE" $SPA > /home/user/gab/sbk-score-$b-$sp.log 2>&1; echo "sungbani score $b $sp exit $?"
      grep -E "^\| \*\*|INCOMPLETE|Not run" /home/user/gab/sbk-score-$b-$sp.log | cut -c1-260
      local d; d=$(ls -td $(grep -l "${ONLY%%,*}" "$TOOLS"/../results/gab/*-run/scorecard.json 2>/dev/null | xargs -n1 dirname) 2>/dev/null | head -1)
      [ -n "$d" ] && mkdir -p "$OUTD/$b-$sp" && cp "$d"/scorecard.* "$OUTD/$b-$sp/" && cp /home/user/gab/sbk-score-$b-$sp.log "$OUTD/$b-$sp/"
    done
  done
  node "$REPO/research/cloud-gab/results-sync.js" push
  node "$REPO/research/cloud-gab/results-sync.js" push --prefix sung-bani-data/kirtan-results --dir "$OUTD" --overwrite
  echo "sungbani done"
}
sungbani
