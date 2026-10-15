---
name: tester-build-86c
description: "The sangat tester build is branch mvp-8.6c-shadow (shadow layer on MVP 8.6 = Cycle 8 + same-Gurbani lock + Sundar Gutka paath), built by GitHub Actions on Arash's fork"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-03T05:37:41.565Z
---

The shadow tester build the user wants (decided 2026-10-02) is branch `mvp-8.6c-shadow` in worktree `~/personal/sttm-86c-shadow`: the whole shadow layer from `mvp-8.1-shadow`, squashed, on top of `mvp-8.6-c8-bani` @ fa250815 (tag mvp-8.6, owned by the "Testing STTM Desktop Sundar-Gutka Path (Jashan)" session). Not follower-v2, not plain 8.6, not 8.1 alone.

Build: GitHub Actions workflow `tester-build.yml` on Arash2348/sttm-desktop (dispatch by REST with the keychain token; the fork's default branch was switched so dispatch works). Mac must be packaged with the package.json config (`--mac dmg zip --arm64 -c.npmRebuild=false`); Khalis's `packaging/electron-builder.macArm.yml` replaces the build block and drops the model, mic text and product name. A push also triggers Khalis's own workflow, which fails with 0 jobs; ignore it and watch the dispatched run id.

Mac DMG: unzip the CI zip, strip onnxruntime `bin/napi-v6/{linux,win32}`, `codesign --force --deep --sign -`, `hdiutil create`. Scripts in the session scratchpad (ci-fetch.py, make-dmg.sh, e2e/drive-86c-gui.js) are wiped on restarts.

**Why:** the user asked for one build that combines all shadow work with the 8.6 paath code, and verified end to end on both platforms.

**How to apply:** build from this branch only; put fixes there; related [[best-version-cycle8]], [[mvp-8-6-bani]], [[work-in-background]].

Azure migration (Oct 8 2026): shadow uploads now PUT straight to Khalis's Azure Blob container `voice-follow-training-data` (account banidb) with a create/write/list container SAS (expires 2027-01-08), same raw/<gurdwara>/<tester>/<date>/<session>/ layout; no Lambda/S3. SAS is never committed: `packaging/inject-upload-sas.js` (npm postbuild) replaces `__VF_UPLOAD_SAS__` in the compiled config from env VF_UPLOAD_SAS; fork secret VF_UPLOAD_SAS is set (tester-build.yml fails without it); Khalis's build-mac/build-windows on the PR branch inject it only if their repo has the secret. List the container read-only with: curl "https://banidb.blob.core.windows.net/voice-follow-training-data?restype=container&comp=list&<SAS>". Proof session: raw/test-gurdwara-sahib/azure-proof-test/2026-10-08/. Old S3 bucket vf-shadow-sessions-680476617406 still holds Oct 1-7 data.

Experimental channel (Oct 8 2026): #2226 (8.6c shadow, hidden) merged into KhalisFoundation experimental-release; #2231 (model fetch) merged; #2232 (arm64 Mac YAML duplicate keys + restored Voice-Follow/consent styles as `www/src/scss/_voice-follow.scss`) opened, verified green on the fork for Mac+Windows. Khalis published 9.3.2-experimental.5 for Windows (consent card unstyled until #2232). Khalis's workflows run only on push to dev/master/release/experimental-release; experimental release script appends `.experimental` to appId and publishes to S3 sttm-releases (manifest `experimental.yml`). Rule from the user: verify on the fork (tester-build.yml on a verify branch) + installer E2E BEFORE asking Gauravjeet to merge anything.

Visible-feature PR (branch `voice-follow-visible-experimental`, worktree ~/personal/sttm-pr-visible): experimental-release + mvp-8.7-ui + runtime visible mode (visibleRef/shadowing(): Start in the panel takes over from the hidden shadow run, Stop hands back; screen changes mirrored to the bus; human.jsonl `override` flag and score `visible`/`overrides`; Settings switch `voice-follow-enabled`; experimental note in the panel). Lesson: wrappers passed into hook deps must be useCallback-stable or the cleanup effect re-runs each render and kills the audio session.

Visible-feature PR opened Oct 9 (KhalisFoundation/sttm-desktop, from Arash2348:voice-follow-visible-experimental): verified before opening — dev scenario (hidden find 8 s, take-over, override, hand-back, Stop/Start again, Settings switch), fork CI green Mac+Windows (run 37866346647), installer E2E hidden with Azure upload (10 files, score visible 35 s / overrides 1), engine identical to 8.7 on the 8 Oct 5 clips (bench with SHADOW_BUILD forced off via a -r preload, since the harness reads screen actions). Includes #2232's fixes. Not yet announced to Gauravjeet; the user decides when.


## 2026-10-09 update: PR #2233 at production quality
- Branch voice-follow-visible-experimental (head cd1a7c92), verify branch visible-verify; fork tester-build.yml is **workflow_dispatch only** (push does not trigger it): dispatch via API, then poll the run.
- Panel: no experimental text; rail+percent seeded at lock; candidate rows = Shabad's fixed first line (loaded once) with heard words bold; 1% rule; Bani members / same-Gurbani copies hidden; one faint next line; no heartbeat.
- Mic: header control (short faint name + icon next to the eye), menu lists inputs, live swap feeds the same worklet; quiet = dimmed icon, no text; NO enumerateDevices at mount (a stuck CoreAudio input stalls the audio service and then every AudioContext).
- Installer E2E v2 passed (video visible-installer-e2e-v2.mp4 on release test-videos-2026-10-08; Desktop copy VoiceFollow-Visible-Installer-E2E-v2.mp4); 8 files in Azure; Stop/Start and Settings switch re-verified. One transient vf_retrieval_failed after Stop+Start (known Renton lead), recovered.
- Mac gotcha: CoreAudio input enumeration wedged once (Electron 26 + ffmpeg hung, playback fine); fix = `sudo killall coreaudiod` (user). Probe: scratchpad/bare/main2.js.
- Status: waiting on the user to decide when to tell Gauravjeet (#2232 then #2233).
