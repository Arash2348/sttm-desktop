---
name: hf-dual-write
description: "Experimental build pushes every finished shadow session to Hugging Face (khalisfoundation/sttm_desktop_<timestamp>) next to Azure; token in ~/.vf-hf-token, secret VF_HF_TOKEN"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-10T02:36:23.669Z
---

Built 2026-10-09 on branch voice-follow-visible-experimental (PR #2233): `shadow/hf.js` + `shadow/wav.js`. After a session is scored, the app converts the Opus segments to a 16 kHz mono WAV and pushes a private dataset repo `khalisfoundation/sttm_desktop_<timestamp>` in EXACTLY Jaspal's layout (push_sttm_desktop_recording.py): `data/train-00000-of-00001.parquet` (one row: source_url, audio{bytes,path} 16 kHz, duration, kv metadata `huggingface` features) written by the vendored hyparquet-writer (shadow/vendor, Babel-transpiled; BigInt `**` replaced by literals), `verse_timestamps.csv`, README front matter; our WAV/CSV/logs under `sttm/`. Verified by load_dataset from the Hub (venv at scratchpad/pyenv). Hub HTTP API only (preupload, git-lfs batch/verify, one commit); no npm package. Result in `hf-pushed.json`; retried every 2 min tick and at launch.

**Token:** the user's fine-grained HF token (org khalisfoundation, "create repos + write to repos created by this token", read) lives in `~/.vf-hf-token` (chmod 600). Never print it. Build injection: `VF_HF_TOKEN` env -> placeholder `__VF_HF_TOKEN__` via packaging/inject-upload-sas.js; secret set on the fork; tester-build.yml on visible-verify passes it. Khalis repo secret still to be added by Gauravjeet. No token field on the card (removed on request); setting `hf-token` remains as an unused fallback.

**Why:** the user wants dual-write now, not a backfill; Jaspal's parquet shard differs only in packing (his script can re-pack from `<ts>.wav` + `<ts>.csv`).

**How to apply:** test pushes from a hidden instance read the token file; the dev build's compiled config may carry the injected SAS+token (rebuild-js wipes it; re-run the inject script). Test repos created 2026-10-10 (sttm_desktop_2026_10_10T02_29_32_775Z, ..._02_30_00_000Z) can be deleted via DELETE /api/repos/delete. See [[tester-build-86c]].
