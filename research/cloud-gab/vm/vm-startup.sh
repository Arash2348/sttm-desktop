#!/bin/bash
# research/cloud-gab/vm/vm-startup.sh — the GCP VM's startup-script (instance metadata `startup-script`).
# Runs once per job id: reads the job id from instance metadata and the two keys from Google Secret Manager
# (secrets vf-hf-token, vf-azure-sas; only this VM's service account may read them), clones the cloud-gab branch, runs research/cloud-gab/vm/vm-job.sh <job>, then powers the VM off (STOP).
# Progress goes to the serial console with the prefix CGJOB (read it with: gcloud compute instances
# get-serial-port-output vf-record --zone us-east1-b | grep CGJOB). Start a job with:
#   gcloud compute instances add-metadata vf-record --zone us-east1-b --metadata cg-job=<job> \
#     --metadata-from-file startup-script=research/cloud-gab/vm/vm-startup.sh && gcloud compute instances start ...
MD=http://metadata.google.internal/computeMetadata/v1/instance
get() { curl -sf -H Metadata-Flavor:Google "$MD/attributes/$1"; }
JOB=$(get cg-job) || exit 0          # no job attached: an ordinary boot, do nothing
DONE=/var/lib/cg-job.done
[ "$(cat $DONE 2>/dev/null)" = "$JOB" ] && exit 0
exec > >(tee -a /var/log/cg-job.log | sed -u 's/^/CGJOB /' > /dev/ttyS0) 2>&1
echo "job $JOB start $(date -u +%FT%TZ) on $(hostname) $(nproc) cores"
export HOME=/root
sec() { gcloud secrets versions access latest --secret "$1" --project "$(curl -sf -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/project/project-id)" 2>/dev/null; }
HF_TOKEN="$(sec vf-hf-token)"; VF_AZURE_SAS="$(sec vf-azure-sas)"; export HF_TOKEN VF_AZURE_SAS
BRANCH=$(get cg-branch || echo claude/sweet-brahmagupta-x0uez6)
ZONE=$(curl -sf -H Metadata-Flavor:Google "$MD/zone" | sed 's#.*/##')
[ -n "$HF_TOKEN" ] && [ -n "$VF_AZURE_SAS" ] || { echo "JOB FAILED: secrets missing (Secret Manager)"; poweroff; exit 1; }
echo "keys read from Secret Manager"
# 6 h hard stop, whatever happens
shutdown -P +360 "cg-job 6 h limit" >/dev/null 2>&1 || true
# system tools (also on a machine that already has node from an earlier boot)
command -v unzip >/dev/null && command -v ffmpeg >/dev/null || { apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq git curl ffmpeg xz-utils unzip build-essential python3 >/dev/null 2>&1; }
# node 22
if ! /opt/node/bin/node -v 2>/dev/null | grep -q '^v22'; then
  apt-get install -y -qq git curl ffmpeg xz-utils unzip build-essential python3 >/dev/null 2>&1
  curl -sfL https://nodejs.org/dist/v22.22.0/node-v22.22.0-linux-x64.tar.xz | tar -xJ -C /opt && rm -rf /opt/node && mv /opt/node-v22.22.0-linux-x64 /opt/node
fi
export PATH=/opt/node/bin:$PATH
mkdir -p /home/user && cd /home/user
if [ -d sttm-desktop/.git ]; then git -C sttm-desktop fetch -q origin "$BRANCH" && git -C sttm-desktop checkout -q -f FETCH_HEAD
else git clone -q --depth 200 -b "$BRANCH" https://github.com/Arash2348/sttm-desktop sttm-desktop; fi
git -C sttm-desktop fetch -q --depth 200 origin '+refs/heads/*:refs/remotes/origin/*' || true
cd sttm-desktop && echo "code $(git rev-parse --short HEAD)"
FILL="$(get cg-fill || true)" FSUITES="$(get cg-suites || true)"; [ -n "$FILL" ] || unset FILL; [ -n "$FSUITES" ] || unset FSUITES; export FILL FSUITES
SCORE="$(get cg-score || true)"; [ -n "$SCORE" ] || unset SCORE; export SCORE
TEST_BUILDS="$(get cg-test || true)"; [ -n "$TEST_BUILDS" ] || unset TEST_BUILDS; export TEST_BUILDS
CG_BUILDS="$(get cg-builds || true)"; export CG_BUILDS
MS_TAG="$(get cg-mstag || true)"; MS_NEMO="$(get cg-nemo || true)"; MS_PRECS="$(get cg-precs || true)"   # model swap (x86m jobs)
for v in MS_TAG MS_NEMO MS_PRECS; do [ -n "${!v}" ] && export "$v" || unset "$v"; done   # ad-hoc builds "name:commit[:CONST=v,CONST=v] ..."
bash research/cloud-gab/vm/vm-job.sh "$JOB" && echo "JOB DONE $JOB $(date -u +%FT%TZ)" || echo "JOB FAILED $JOB (exit $?) $(date -u +%FT%TZ)"
echo "$JOB" > $DONE
sync; sleep 5; poweroff
