#!/bin/bash
# kscore.sh <bench dir> <out dir> <azure prefix> <id prefixes> <folders> — score 9.0.4 (r904) on the given clips from the
# q16 namespace (where these x86 recordings were made), both splits, and share the scorecards
export HOME=/root PATH=/opt/node/bin:$PATH VF_EMIS_CODEC=q16
sec() { gcloud secrets versions access latest --secret "$1" --project vf-bench-sttm 2>/dev/null; }
export VF_AZURE_SAS="$(sec vf-azure-sas)" HF_TOKEN="$(sec vf-hf-token)"
B=$1; O=$2; PFX=$3; IDS=$4; F=$5; export VF_BENCHMARK=$B
cd /home/user/gab-tools/research/level2-dataset/tools
for sp in test dev; do SPA=""; [ $sp = test ] && SPA="--split test"
  VF_MIN_FREE_GB=3 ./gab run /root/personal/r904 --set main --tier full --jobs 6 --manifest "$B" --folders "$F" --ids "$IDS" $SPA > /tmp/ks-$sp.log 2>&1; echo "score $sp exit $?"
  sc=$(grep -o 'scorecard: .*json' /tmp/ks-$sp.log | tail -1 | cut -d' ' -f2); mkdir -p "$O/r904-$sp"; [ -n "$sc" ] && cp "$(dirname $sc)"/scorecard.* "$O/r904-$sp/"; cp /tmp/ks-$sp.log "$O/r904-$sp/"
  grep -E "Not run|neither" /tmp/ks-$sp.log | cut -c1-200
done
node /home/user/sttm-desktop/research/cloud-gab/results-sync.js push
node /home/user/sttm-desktop/research/cloud-gab/results-sync.js push --prefix "$PFX" --dir "$O" --overwrite
echo KSCORE DONE
