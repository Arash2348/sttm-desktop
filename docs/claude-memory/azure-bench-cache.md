---
name: azure-bench-cache
description: Replay/benchmark cache lives in the Khalis Azure container under bench-cache/ (user ask Oct 12 2026); SAS stored in ~/.vf-azure-sas (never in source); pushed/pulled by vf-check cache push|pull
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T06:19:44.457Z
---

The user asked (Oct 12 2026) to keep the cached-replay benchmark cache "somewhere stable we can
always use" and suggested the Azure container shared with Khalis. Layout: account banidb,
container voice-follow-training-data, prefix `bench-cache/<model-version>/<codec>/<audio-sha256>`
+ `bench-cache/manifest.json`. Entries hold model outputs only: no audio, no secrets.

SAS (sp=racwl, valid to 2027-01-08) is in `~/.vf-azure-sas` (mode 600) / env VF_AZURE_SAS. Never
commit, log or paste it. No azcopy/az on the Mac: plain curl PUT (x-ms-blob-type: BlockBlob) and
GET, same shape as the shadow uploader. Azure is not AWS: no approval gate, but never delete
outside bench-cache/.

**How to apply:** `vf-check cache pull` before recording a clip; `cache push` after. Renew the SAS
before Jan 2027 (ask Gauravjeet). See [[hf-dual-write]], [[test-small-first]].
