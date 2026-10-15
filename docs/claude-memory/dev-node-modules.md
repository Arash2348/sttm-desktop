---
name: dev-node-modules
description: "Dev worktrees share ~/personal/sttm-desktop/node_modules via symlink; better-sqlite3 for Electron is installed from an isolated scratch dir, never via npm install in a worktree"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-10-09T02:42:43.237Z
---

On 2026-10-08 an `npm install --no-save better-sqlite3` in ~/personal/sttm-bani failed on node-gyp and wiped that whole node_modules tree. All worktrees (sttm-pr-visible etc.) now symlink `node_modules` -> `~/personal/sttm-desktop/node_modules`.

**Why:** a failed npm install rolls back and can delete the tree; the viewer window (top-right quadrant) is blank in dev when better-sqlite3 is missing.

**How to apply:** to (re)install better-sqlite3 for Electron 26, run in a scratch dir: `npm_config_runtime=electron npm_config_target=26.6.10 npm_config_disturl=https://electronjs.org/headers npm install better-sqlite3@9.6.0`, then copy `better-sqlite3`, `bindings`, `file-uri-to-path` into sttm-desktop/node_modules. Never run npm install inside a worktree. See [[tester-build-86c]].
