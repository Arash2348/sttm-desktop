---
name: voice-follow-desktop-integration
description: Voice-follow ported into the SikhiToTheMax DESKTOP app (Electron) as an addon for E2E testing
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b41ad2f-0977-45ce-9d30-1c3d7bba4ee8
  modified: 2026-09-10T02:46:48.361Z
---

E2E target for [[voice-follow-project]]: the SikhiToTheMax **desktop** app (Gurbani projector).
Repo `github.com/KhalisFoundation/sttm-desktop` cloned to `/Users/asingh02/AAI/sttm-desktop`
(Electron v9.3.2; renderer = React + easy-peasy store; source `www/main/*` Babel-compiled to
`www/js/*` which the HTML actually loads — edits need `npm run build-js`, or `npm start` auto-watches).

**The app's own "voice" feature is NOT reusable for us:** `voice-wave` = a frequency-bar visualizer
only; `silence.js` = RMS VAD; the voice-search records one clip → POSTs to a CLOUD transcript API →
first-letter shabad search. That is blind one-shot shabad FINDING, not real-time within-shabad line
following. We bring OUR pipeline (local karansea CTC + line decoder sidecar); reuse from the app only
the mic permission plumbing (already wired in `app.js`) — no CSP blocks getUserMedia or ws://localhost.

**Integration built (2026-09-09):** new addon `www/main/addons/voice-follow/` (component
`components/VoiceFollow.jsx` + `index.js`); registered in `www/main/addons/index.js`; mounted
unconditionally as a fixed floating panel in `www/main/launchpad/Launchpad.jsx` (no toolbar/i18n/CSS
plumbing — a test widget). It: reads `activeShabadId` from the navigator store; `banidb.loadShabad()`
→ `filterRequiredVerseItems()` → per line `{verseId, words: tokenize(anvaad.unicode(verse.Gurmukhi))}`
(DB stores ASCII font Gurmukhi; **must** `anvaad.unicode()` before sending or matching breaks);
opens `ws://127.0.0.1:8000/ws`, sends `{type:'init', engine:'karansea', profile:'kirtan'|'karansea',
sampleRate, verses}`; streams raw Float32 PCM via an inline **Blob** AudioWorklet (avoids file:// path
issues); on `{type:'position', lineIndex}` calls `setActiveVerseId(lines[lineIndex].verseId)` +
`setLineNumber(lineIndex+1)`.

**Why that drives everything:** setting `activeVerseId` on `GlobalState.navigator` auto-broadcasts
`update-viewer-setting` over IPC to the viewer `<webview>` (`ShabadDeck` re-renders the projected
slide), plus `show-line` to the OBS overlay and socket 'data' to mobile — highlight + projection +
overlay + sync all follow from that one setter. Template studied: `addons/bani-controller/`
(external-input-drives-line-selection) + its `use-socket-listeners.js`.

**BUILD BLOCKER (2026-09-09, in Claude Code sandbox):** `npm install` cannot complete from
inside the agent env — outbound to github.com's release CDN is **EPERM-blocked** by the egress
allowlist (only PixelCloud/Google/Meta hosts allowed; github is not). registry.npmjs.org works, but
the `electron` binary (`node install.js` → github releases), `realm`/`sharp` prebuilds, and
`electron-chromedriver` (pulled by test-only `spectron`) all download from github → blocked. No
cached electron binary anywhere on the machine. Two OTHER fixes discovered that ARE needed regardless:
(1) system python3 is 3.12 which **removed `distutils`** → node-gyp (`mdns`) fails; fix by pointing
node-gyp at a python with setuptools: `PYTHON=/Users/asingh02/AAI/voice-venv/bin/python` (has
distutils/setuptools 84). (2) `spectron` → `electron-chromedriver@v17` download 404s/blocks; it is
test-only, safe to drop. **Handoff:** user must run install in their OWN Terminal (open egress),
not via the agent. Recipe: `cd /Users/asingh02/AAI/sttm-desktop && PYTHON=/Users/asingh02/AAI/voice-venv/bin/python npm install --no-audit --no-fund` then `npm start`. If chromedriver still blocks, `npm install --omit=dev` won't work (electron+babel are devDeps); instead temporarily remove `spectron` from devDependencies.

**To run E2E:** start the sidecar (`voice-align-server`, `python server.py`, :8000, venv
`/Users/asingh02/AAI/voice-venv`, `KARANSEA_MODEL_DIR=/Users/asingh02/AAI/models/karansea-shabad-ctc`);
then in sttm-desktop `npm install` (Electron + native `realm` — heavy) then `npm start`. Open a shabad,
pick Path/Kirtan, click Start. NOTE: desktop uses the STREAMING `karansea_engine.py` via profiles, NOT
the offline bench winners — porting the [[voice-follow-oracle-bakeoff]] wins into the engine is a follow-up.

**GUI can't be launched from the agent sandbox** — `npm start` GUI dies with
`mach_port_rendezvous.cc Check failed ... bootstrap_check_in ... Permission denied (1100)` SIGTRAP
(macOS denies Mach bootstrap to sandbox-spawned GUI apps). User must launch from their OWN Terminal.

**Incremental compile (no full rebuild):** to apply a single edited `www/main/**` file, run
`PATH="$HOME/.nvm/versions/node/v18.20.8/bin:$PATH" node node_modules/@babel/cli/bin/babel.js
www/main/<f>.jsx -o www/js/<f>.js --source-maps` (mirror path under www/js). Full build is
`npm run build-js` / `build-js:sm`.

**WHITE-SCREEN CRASH debug (2026-09-09):** user reported the app "crashes to a white screen while
using" voice-follow. Cause class: an uncaught RENDER exception unmounts the whole React tree → blank
window. There are TWO React roots that both read `navigator.activeVerseId` and had NO error boundary:
main window (`www/main/app.jsx` → Launchpad) and the viewer/projector window (`www/main/viewer/viewerApp.jsx`
→ ShabadDeck). `setActiveVerseId` from the addon fans out to the viewer via `update-viewer-setting` IPC
(`viewer/store/ViewerState.js`), so a bad verse can crash EITHER window. Suspect unguarded async paths in
`viewer/ShabadDeck/ShabadDeck.jsx` (`loadShabadVerse(...).then(result => result.map(...))` at ~L160 throws
if result is null/undefined) and rapid decoder flip-flop firing `setActiveVerseId` ~4×/s (DB load + smooth
scroll in two windows). FIX SHIPPED: added `www/main/common/ErrorBoundary.jsx` (class boundary +
window.onerror/unhandledrejection global handlers) wrapping both roots; it renders the stack instead of
white-screening AND appends every crash to `os.tmpdir()/sttm-voicefollow-errors.log`. Next run: reproduce,
then read that log (or DevTools Cmd+Opt+I) to get the exact stack and fix the specific throw.
NOTE: on macOS `os.tmpdir()` = `/var/folders/.../T/`, NOT `/tmp` — the crash log lives there.

**ROOT-CAUSED + FIXED (2026-09-09):** the white-screen was `TypeError: Cannot perform 'get' on a
proxy that has been revoked` thrown in `VoiceFollow` render (`useStoreState((s)=>s.navigator)` then
reading `.activeShabadId` off the returned slice). Real root: EVERY navigator setter returned the
immer draft (`return state;` in `common/store/navigator-settings/create-navigator-settings.js`).
easy-peasy actions run inside immer; returning the draft makes immer treat it as the replacement
state and then REVOKES it on finalize → the navigator slice easy-peasy holds is a revoked proxy →
next render reading any prop throws. voice-follow triggered it because it fires `setActiveVerseId`/
`setLineNumber` repeatedly. FIX: removed `return state;` from the navigator setter factory (mutating
the draft is sufficient) + hardened VoiceFollow to select the primitive directly
(`useStoreState((s)=>s.navigator.activeShabadId)`). Also removed the SAME `return state;` anti-pattern
from all other immer actions: `GlobalState.js` (app/baniController/setPadding), `create-user-settings-state.js`,
`create-overlay-settings-state.js`, `overlay/store/OverlayState.js`. LEFT ALONE: `navigator/misc/state-manager/reducer.js`
`return state;` is a plain useReducer default case (correct). All recompiled to `www/js`. Verify by
restarting the app (reload over CDP HANGS — socket.io retry never reaches network-idle).

**SHABAD-SWITCH BUG FIXED (2026-09-09):** VoiceFollow read `activeShabadId` only at Start and never
reacted, so switching shabads mid-listen kept matching the OLD shabad's lines. Fix in `VoiceFollow.jsx`:
`start()` now `cleanup()`s first + records `followingShabadRef.current = activeShabadId`; a `useEffect`
watching `activeShabadId` re-runs `start()` when it changes while listening (any menu — search/history/
favorites/arrows all go through `navigator/search/hooks/use-new-shabad.jsx` → `setActiveShabadId`).
Banis/ceremonies are a SEPARATE path (`isSundarGutkaBani`/`isCeremonyBani` + `sundarGutkaBaniId`/
`ceremonyId`, NOT activeShabadId) — voice-follow can't load those yet, so it now stops cleanly with a
message instead of following a stale shabad. `cleanup()` also nulls the old ws handlers before close so
a torn-down socket's onclose can't flip status. Bani/ceremony support = follow-up.

**PLACEMENT (2026-09-09, user chose "setup modal + status pill"):** promoted from the hardcoded
floating panel to a real toolbar tool. Added toolbar item `'voice-follow'` (mic icon
`www/assets/img/icons/voice-follow.svg`, SCSS `#tool-voice-follow` in `src/scss/styles.scss`, i18n
`TOOLBAR.VOICE_FOLLOW` in `www/locales/en.json`, displayName in `toolbar/components/ToolbarItem.jsx`,
listed in `toolbar/components/Toolbar.jsx` toolbarTop). `Launchpad.jsx` now passes
`isOpen={overlayScreen==='voice-follow'} onScreenClose` to `<VoiceFollow/>` (kept ALWAYS-MOUNTED so the
mic/WebSocket session survives closing the modal). VoiceFollow renders (a) a centered setup/control
modal via shared `common/sttm-ui` `Overlay` (mode + Start/Stop + status), hidden with `d-none` unless
open, content wrapped with `onClick stopPropagation` so control clicks don't hit the backdrop-close; and
(b) a compact corner status pill shown while listening + modal closed, click reopens modal.

**CDP Page.reload CRASHES THE APP — DO NOT HOT-RELOAD (2026-09-09):** the "all black / broke down"
the user saw after `vf-reload.js` was a hard renderer SIGSEGV, NOT a code bug. Crash report
`~/Library/Logs/DiagnosticReports/Electron Helper (Renderer)-*.ips`: `EXC_BAD_ACCESS` in
`realm::node::napi_init` / `napi_get_named_property`. A Page.reload re-`require`s the native N-API
addon `realm.node` (via banidb); native modules can't re-init in the same renderer process → segfault.
Both renderers reload → both die → black windows; CDP `Runtime.evaluate` then HANGS (browser process
alive at ~0% CPU, `ps` shows only `--type=gpu`/`--type=utility`, NO `--type=renderer`). Verify a hang
this way (trivial `1+1` eval times out on both targets + no renderer process). RECOVERY + the only dev
loop: to apply recompiled `www/js`, FULLY restart — user quits Electron and re-runs `./vf-debug.sh`
(the one macOS-forced action). `vf-reload.js` is now defused with a warning header. No safe renderer
hot-reload exists while realm is loaded. (The revoked-proxy `return state;` fixes are fine — last
ErrorBoundary log entry was the pre-fix 17:48 crash, nothing new after the reload.)

**NEAR-SPEAKER GATE — TRIED AND REVERTED (2026-09-09):** user wanted the mic to focus on the person
singing INTO it and ignore quieter background katha/kirtan (grandma's TV), built in (no UI). Built a
lightweight adaptive loudness gate (`voice-align-server/proximity_gate.py` `ProximityGate`: per-20ms-frame
RMS, slow-attack/fast-decay noise-floor envelope, open at +9 dB above floor, hysteresis + 250 ms hangover,
mute background-only frames with a per-sample ramp) and wired it into `server.py` before `aligner.push`.
**It made things WORSE** — user: background STILL got through AND near speech lost words → wrong shabad
selected. LESSON: a single-mic energy gate can't separate near voice from background katha/kirtan (both
are continuous speech-like signals at overlapping levels), and muting frames chops holes in the rolling
CTC window that drop words. FULLY REVERTED: removed the import/var/processing from `server.py`, deleted
`proximity_gate.py`, restarted sidecar, verified baseline recognizes on unmodified audio again. Real
background rejection needs ML source separation / speaker diarization (a big project) or a proximity/
directional cue we don't have from one mic — do NOT retry energy gating. The no-filter baseline is the
one the user said "does a good job"; leave audio untouched unless pursuing real separation.

**CDP E2E RE-ATTACH RECIPE:** user launches `npm run debug` (build:local + electron with
`--remote-debugging-port=9222`) from their OWN Terminal; then `browser_list_pages` shows page 0 = main
`www/index.html`, page 1 = viewer. Screenshot page 0 to see the ErrorBoundary panel if it crashed.
NEVER `browser_navigate`/reload this app — socket.io keeps the network busy so reload + all later CDP
calls hang. If browser MCP wedges ("Command failed with no output"), user runs `/mcp` to reconnect it.
