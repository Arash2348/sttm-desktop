#!/bin/bash
# research/cloud-gab/vm/vm-startup.sh — the GCP VM's startup-script (instance metadata `startup-script`).
# Runs once per job id: reads the job id + secrets from instance metadata, removes the secrets from metadata,
# clones the cloud-gab branch, runs research/cloud-gab/vm/vm-job.sh <job>, then powers the VM off (STOP).
# Progress goes to the serial console with the prefix CGJOB (read it with: gcloud compute instances
# get-serial-port-output vf-record --zone us-east1-b | grep CGJOB). Started by research/cloud-gab/vm/vm.sh.
MD=http://metadata.google.internal/computeMetadata/v1/instance
get() { curl -sf -H Metadata-Flavor:Google "$MD/attributes/$1"; }
JOB=$(get cg-job) || exit 0          # no job attached: an ordinary boot, do nothing
DONE=/var/lib/cg-job.done
[ "$(cat $DONE 2>/dev/null)" = "$JOB" ] && exit 0
exec > >(tee -a /var/log/cg-job.log | sed -u 's/^/CGJOB /' > /dev/ttyS0) 2>&1
echo "job $JOB start $(date -u +%FT%TZ) on $(hostname) $(nproc) cores"
export HF_TOKEN="$(get vf-hf-token)" VF_AZURE_SAS="$(get vf-azure-sas)" HOME=/root
BRANCH=$(get cg-branch || echo claude/sweet-brahmagupta-x0uez6)
ZONE=$(curl -sf -H Metadata-Flavor:Google "$MD/zone" | sed 's#.*/##')
# secrets leave the metadata as soon as they are read (they stay only in this process's environment)
gcloud compute instances remove-metadata "$(hostname)" --zone "$ZONE" --keys vf-hf-token,vf-azure-sas >/dev/null 2>&1 && echo "secrets removed from metadata"
[ -n "$HF_TOKEN" ] && [ -n "$VF_AZURE_SAS" ] || { echo "JOB FAILED: secrets missing"; poweroff; exit 1; }
# node 22
if ! /opt/node/bin/node -v 2>/dev/null | grep -q '^v22'; then
  apt-get install -y -qq git curl ffmpeg xz-utils >/dev/null 2>&1
  curl -sfL https://nodejs.org/dist/v22.22.0/node-v22.22.0-linux-x64.tar.xz | tar -xJ -C /opt && rm -rf /opt/node && mv /opt/node-v22.22.0-linux-x64 /opt/node
fi
export PATH=/opt/node/bin:$PATH
mkdir -p /home/user && cd /home/user
if [ -d sttm-desktop/.git ]; then git -C sttm-desktop fetch -q origin "$BRANCH" && git -C sttm-desktop checkout -q -f FETCH_HEAD
else git clone -q --depth 200 -b "$BRANCH" https://github.com/Arash2348/sttm-desktop sttm-desktop; fi
cd sttm-desktop && echo "code $(git rev-parse --short HEAD)"
bash research/cloud-gab/vm/vm-job.sh "$JOB" && echo "JOB DONE $JOB $(date -u +%FT%TZ)" || echo "JOB FAILED $JOB (exit $?) $(date -u +%FT%TZ)"
echo "$JOB" > $DONE
sync; sleep 5; poweroff
