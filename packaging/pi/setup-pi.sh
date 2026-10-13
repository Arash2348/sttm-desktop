#!/usr/bin/env bash
# One-time setup of a Raspberry Pi (Raspberry Pi OS 64-bit, Bookworm) as an STTM projector
# appliance: installs SikhiToTheMax, starts it at login with the presenter view on the
# projector and Voice-Follow listening, logs in automatically and keeps the screen awake.
#
#   ./setup-pi.sh path/to/sttm-desktop_*_arm64.deb
#
# Non-interactive (for scripted installs): set NONINTERACTIVE=1 and, to record kirtan for
# Voice-Follow research, KIOSK_NAME and KIOSK_GURDWARA.
set -euo pipefail

die() { echo "setup-pi: $*" >&2; exit 1; }

DEB=${1:-}
[ -n "$DEB" ] && [ -f "$DEB" ] || die "usage: $0 path/to/sttm-desktop_*_arm64.deb"
DEB=$(cd "$(dirname "$DEB")" && pwd)/$(basename "$DEB")
HERE=$(cd "$(dirname "$0")" && pwd)
[ "$(dpkg --print-architecture)" = "arm64" ] ||
  die "this needs 64-bit Raspberry Pi OS (arm64); found $(dpkg --print-architecture)"
[ "$(id -u)" -ne 0 ] || die "run as the desktop user (it uses sudo where needed), not as root"

echo "== Installing SikhiToTheMax"
sudo apt-get update -qq
# libavahi-compat-libdnssd1: Bonjour discovery used by STTM's Bani Controller (mdns).
sudo apt-get install -y libavahi-compat-libdnssd1 unzip "$DEB"

echo "== Installing the kiosk launcher"
sudo install -m 755 "$HERE/sttm-kiosk" /usr/local/bin/sttm-kiosk

KIOSK_NAME=${KIOSK_NAME:-}
KIOSK_GURDWARA=${KIOSK_GURDWARA:-}
if [ "${NONINTERACTIVE:-0}" != "1" ]; then
  cat <<'TXT'

Voice-Follow research recording (optional)
This build can record the kirtan audio and what is shown on screen, and send it to the
Voice-Follow team to make Voice-Follow better. Nothing else is collected.
Leave the name blank to record nothing.
TXT
  read -r -p "Your name (blank = do not record): " KIOSK_NAME
  if [ -n "$KIOSK_NAME" ]; then read -r -p "Gurdwara: " KIOSK_GURDWARA; fi
fi
# Quote for a shell-sourced file.
q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
sudo tee /etc/sttm-kiosk.conf >/dev/null <<EOF
# SikhiToTheMax kiosk settings (read by /usr/local/bin/sttm-kiosk at every start)
KIOSK_NAME=$(q "$KIOSK_NAME")
KIOSK_GURDWARA=$(q "$KIOSK_GURDWARA")
STTM_EXTRA_FLAGS=''
EOF

echo "== Starting STTM at login"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/sttm-kiosk.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=SikhiToTheMax kiosk
Comment=STTM on the projector with Voice-Follow listening
Exec=/usr/local/bin/sttm-kiosk
X-GNOME-Autostart-enabled=true
EOF

if command -v raspi-config >/dev/null 2>&1; then
  echo "== Desktop auto-login and no screen blanking"
  sudo raspi-config nonint do_boot_behaviour B4
  sudo raspi-config nonint do_blanking 1
else
  echo "== raspi-config not found (not Raspberry Pi OS): set auto-login and screen blanking by hand"
fi

cat <<'TXT'

Done. Plug in a USB microphone and the projector, then reboot:
  sudo reboot
After login STTM opens on the projector and Voice-Follow starts listening by itself.
To change the recording choice later, edit /etc/sttm-kiosk.conf and reboot.
TXT
