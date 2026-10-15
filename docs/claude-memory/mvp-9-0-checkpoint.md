---
name: mvp-9-0-checkpoint
description: MVP 9.0 checkpoint = commit 7165bd24 (local tag mvp-9.0-checkpoint-2026-10-12); the user tested it live on the Mac Oct 12 2026 and rated it pretty good; how to relaunch the test copy
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T04:20:31.876Z
---

Commit 7165bd24 (worktree ~/personal/sttm-release-next, detached; local git tag
`mvp-9.0-checkpoint-2026-10-12`, NOT pushed) = merges of the Renton fixes (bounded backlog,
Stop keeps screen, paath follower for Banis, kirtan Start adopts hidden run) + extra-long Rehras
header fix e7ff6324 + Asa di Vaar fix c212c736, on top of experimental.7 (265da34e).

The user ran it live on the Mac on Oct 12 2026 (mic, own profile) and said "it's pretty good":
this is the fallback version if later work (anticipation, replay harness) makes anything worse.

Videos of this exact build: ~/Desktop/VoiceFollow-MVP-9.0-Renton-final.mp4 and -short-final.mp4.
Numbers: research/level2-dataset/results/MVP-9.0.md in ~/personal/sttm-release.

Relaunch the user's test copy (dev app, profile ~/personal/sttm-usertest-profile, port 9340):
scratchpad usertest/launch.sh (session 7dc20a33); it builds with `npm run build:local` then runs
Electron from ~/personal/sttm-desktop/node_modules against the worktree. Stop with
`pkill -f "sttm-release-next --user-data-dir"`. No external monitor was attached that day.

**How to apply:** any later candidate is compared against this tag first; never rebase or delete
the tag. See [[renton-oct11-production]], [[north-star-goals]].

**Shipped (Oct 13 2026):** PR https://github.com/KhalisFoundation/sttm-desktop/pull/2238 = branch
`mvp-9.0.1-pr` (fork Arash2348) = MVP 9.0.1 (tag mvp-9.0.1-final: 9.0 + same-Gurbani-copies tie fix
+ download-bar row) merged onto experimental-release 70c6ce04 (Gauravjeet's Autopilot panel
redesign). Conflicts resolved in favour of the redesign; cached replay 170 clips 0 events differ.
Bench driver stubs for the redesign's UI imports live in sttm-replay (commit 2c7e982d).
