#!/usr/bin/env bash
# One-shot launcher for voice-follow E2E debugging.
# Run this in your OWN Terminal (the GUI must launch from your login session —
# macOS blocks it from the agent sandbox with a Mach-port error).
#
#   ./vf-debug.sh
#
# It: frees the debug port, (re)starts the alignment sidecar on :8000 if needed,
# then launches the desktop app with the CDP port so Claude can attach on :9222.
set -u
cd "$(dirname "$0")"

SIDECAR_DIR=/Users/asingh02/AAI/voice-align-server
VENV_PY=/Users/asingh02/AAI/voice-venv/bin/python
export KARANSEA_MODEL_DIR=/Users/asingh02/AAI/models/karansea-shabad-ctc

echo "==> Freeing debug port 9222 + stopping any old app"
lsof -ti:9222 | xargs kill -9 2>/dev/null
pkill -9 -f "Electron" 2>/dev/null
sleep 1

if lsof -ti:8000 >/dev/null 2>&1; then
  echo "==> Sidecar already up on :8000"
else
  echo "==> Starting alignment sidecar on :8000"
  ( cd "$SIDECAR_DIR" && "$VENV_PY" server.py > /tmp/vf-sidecar.log 2>&1 & )
  for i in $(seq 1 20); do
    lsof -ti:8000 >/dev/null 2>&1 && break
    sleep 1
  done
  lsof -ti:8000 >/dev/null 2>&1 && echo "    sidecar up" || echo "    WARN: sidecar not up yet (see /tmp/vf-sidecar.log)"
fi

echo "==> Launching desktop app with CDP on :9222 (leave this running)"
NODE_ENV=development exec ./node_modules/.bin/electron . --remote-debugging-port=9222
