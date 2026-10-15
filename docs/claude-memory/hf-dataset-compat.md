---
name: hf-dataset-compat
description: "Jaspal's HF audio datasets (KhalisFoundation PR #2223) layout, and the converter that makes our Azure shadow sessions pushable to the same datasets (agreed Oct 8 2026: finish our experiment first, migrate later)"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-09T03:00:09.716Z
---

Jaspal Singh Saluja (Slack, Oct 8 2026) builds Hugging Face audio datasets from
KhalisFoundation/sttm-desktop PR #2223 (branch jsaluja:feature/audio-recording): one private
dataset per recording under the khalisfoundation org, each self-contained (he wants many small
datasets, not one mega repo). Layout the push script needs
(`scripts/push_sttm_desktop_recording.py <dir> --collection <gurdwara> --dataset-type paath|kirtan`,
token env `HF_TOKEN_KHALIS`):
- `<timestamp>/<timestamp>.wav` 16 kHz mono PCM16 (timestamp = ISO start with ':' '.' -> '-')
- `<timestamp>/<timestamp>.csv` = `verseId,timestamp_seconds` (every verse change, seconds from recording start); pushed as `verse_timestamps.csv` + README (collection, duration, dataset_type).

Agreement in the thread: we finish the Voice-Follow Azure experiment first; later point the
feature at the same datasets or backfill from Azure. Arash promised what we store in Azure
stays compatible.

**What exists:** `www/main/addons/voice-follow/shadow/tools/session-to-hf.py` (branch
`akhand-paath`) converts a downloaded session folder (audio-NNN.webm segments placed at their
`audio_segment` event times, human.jsonl verse rows, session.json startedAt) into exactly that
layout and prints the push command; verified on the New York Oct 7 session (1039 s WAV, 97 verse
rows). Needs ffmpeg (ffprobe optional). Our data has MORE than his (system timeline, overrides,
activity), so backfill loses nothing.

**How to apply:** when Jaspal wants Azure data on HF, download sessions (Azure = Khalis's, no AWS
rule issue), run the converter per session, push with his script. See [[tester-build-86c]].
