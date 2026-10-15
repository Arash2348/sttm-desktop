---
name: disk-hygiene
description: Mac disk filled up (Oct 13 2026) and the user's cleanup removed the benchmark model file; what is safe to delete vs must keep; agents must delete their temp outputs
metadata:
  type: project
---

Oct 13 2026 the Mac hit 101 MB free and every tool failed (ENOSPC). During cleanup the user
deleted ~/AAI/models/karansea-shabad-ctc/model.int8.onnx (restored from the app's own copy in
~/Library/Application Support/SikhiToTheMax/voice-follow/, sha256 prefix 5f9e41d867de).

MUST KEEP: ~/AAI/models/karansea-shabad-ctc/model.int8.onnx; ~/personal/live-darbar-venues/clips
and cache/5f9e41d867de-q16 (8.4 GB, also in Azure bench-cache/); the main worktrees with
unmerged work (sttm-desktop, sttm-replay, sttm-kirtan-line, sttm-akhand10, sttm-throughput2).
SAFE: live-darbar-venues/cache/replays (rebuilt), scratchpad vf-video frames, old
sttm-usertest-* profiles, stale worktrees of merged/abandoned branches.

**How to apply:** check `df` before long runs; every agent brief says "delete your temporary
outputs once scored"; if the user cleans up, give them the keep-list first. See
[[mac-compute-limit]], [[azure-bench-cache]].
