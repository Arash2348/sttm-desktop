---
name: pi-kiosk-build
description: "Raspberry Pi kiosk build of STTM + Voice-Follow (branch pi-kiosk on Arash2348 fork): what was built, every Pi-only fix, the green unattended CI test (2026-10-13), and what is still unproven"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-15T00:04:16.533Z
---

Gauravjeet's challenge (2026-10-12): STTM + voice model on a Raspberry Pi, STTM opens on boot and starts voice mode. Built on branch `pi-kiosk` (worktree ~/personal/sttm-pi, from Khalis experimental-release 5915de91), pushed to Arash2348/sttm-desktop. No PR opened yet (user to decide).

What works (CI-proven, GitHub `ubuntu-24.04-arm` runner; latest green run 38656390840 at merge commit a8c1fcbd, 2026-10-14, branch merged up to Khalis experimental-release 3fafc0ba, Shabad on the projector at 50 s / 53 s, no changelog window): `.github/workflows/pi-build.yml` builds an arm64 .deb (~700 MB, bundles speech model + Gurbani database), then an unattended kiosk test installs it with `packaging/pi/setup-pi.sh`, starts it via `packaging/pi/sttm-kiosk`, plays the demo Aarti as the mic (VF_DEMO_WAV), and the projector showed the right Shabad by itself: 38 s on 2 cores, 76 s on 4 cores. `workflow_dispatch` input `deb_run_id` reruns only the test against an earlier build (~10 min vs ~30).

Pi-only fixes (and why), all in that branch:
- Realm 10 has no Linux arm64 binary and its npm package can't compile → Pi build pins realm 11.10.2; `www/main/banidb/realm-open.js` upgrades the format-22 DB once with a writable open when a read-only open says "requires an upgrade" (benign "already opened with different read permissions" retries at startup).
- sharp's libvips can't load from inside app.asar → asarUnpack `node_modules/sharp/**`.
- Kiosk env `STTM_KIOSK=1` (set by the launcher): single screen = presenter full screen + always on top, no display sleep, no background throttling, audio allowed without a click, Voice-Follow auto-start after the DB exists + retry every 15 s; consent answered at install (`KIOSK_NAME`/`KIOSK_GURDWARA` in /etc/sttm-kiosk.conf), card never shown.
- Bundled Gurbani DB under resources/banidb, unpacked by the launcher on first start (offline first boot).
- GENERAL bug found: presenter 'resize' → 'external-display' → controller 'presenter-view' → re-place window → resize… looped ~1000/s where full screen doesn't stick (bare X server); `ipcMain.on('presenter-view')` now ignores a repeat within 1 s. Worth porting to Khalis main.

**Why:** the test runner is the closest stand-in for a Pi we have; a real Pi 5 has a GPU and a window manager the runner lacks.

**How to apply:** nothing is proven on real Pi hardware yet — the decisive check is a Pi 5 (8 GB) + USB mic + projector following `packaging/pi/README.md`. Khalis's own `berry-build.yml` is broken (fails on every push); ours replaces it. Speed on a Pi 5 is unmeasured (2-core runner leg passed). Related: [[tester-build-86c]], [[model-provenance]].
