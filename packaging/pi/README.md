# SikhiToTheMax on a Raspberry Pi (projector appliance)

Plug a Raspberry Pi into the projector and a microphone. When it powers on, STTM opens on
the projector and Voice-Follow starts listening by itself: it finds the Shabad being sung
and follows the lines with nobody at a keyboard. A sevadaar can still plug in a keyboard
and mouse and use STTM normally at any time.

## What you need

| Part | Notes |
|---|---|
| Raspberry Pi 5, 8 GB | Voice-Follow's speech model needs the Pi 5's speed. A Pi 4 is not recommended. |
| Official 27 W USB-C power supply | Under-powered Pis slow down. |
| Active cooler for the Pi 5 | The speech model keeps the CPU busy during kirtan. |
| microSD card, 32 GB or more | Or an NVMe drive with an M.2 HAT for faster start-up. |
| Micro-HDMI to HDMI cable | To the projector. A second screen on the other HDMI port becomes the sevadaar's controller. |
| Microphone | A USB audio interface taking a line feed from the Gurdwara mixer is best. A USB microphone near the ragis also works. |

## Set it up (once)

1. Flash **Raspberry Pi OS (64-bit)** with Raspberry Pi Imager and finish the first-boot
   setup (user, Wi-Fi or Ethernet).
2. Copy `sttm-desktop_<version>_arm64.deb` from the "Raspberry Pi build" workflow's
   `sttm-pi-deb` artifact, plus this folder, onto the Pi.
3. In a terminal on the Pi:

   ```bash
   cd pi
   ./setup-pi.sh ../sttm-desktop_*_arm64.deb
   ```

   It asks whether to record kirtan for Voice-Follow research. Leave the name blank to
   record nothing.
4. Plug in the microphone and the projector, then `sudo reboot`.

## What happens at power-on

1. The Pi logs in to the desktop by itself, with screen blanking turned off.
2. `/usr/local/bin/sttm-kiosk` starts STTM with `STTM_KIOSK=1`.
3. With only the projector connected, the presenter view fills it. With two screens, the
   controller opens on the first screen and the projector shows the presenter view, as on
   any computer.
4. On the very first boot STTM downloads its Gurbani database, so the Pi needs internet
   once; Voice-Follow waits for it. After that, about 8 seconds after start-up Voice-Follow
   starts listening. If it stops on its own, for example
   when the microphone is unplugged, it tries again every 15 seconds.
5. If STTM closes or crashes, the launcher opens it again.

A sevadaar who presses Stop in the Voice-Follow panel stays in control until they press
Start again.

## Settings

`/etc/sttm-kiosk.conf`, read at every start:

| Setting | Meaning |
|---|---|
| `KIOSK_NAME` | Who set the Pi up. Blank means nothing is recorded. |
| `KIOSK_GURDWARA` | Which Gurdwara the recordings come from. |
| `STTM_EXTRA_FLAGS` | Extra command-line flags for STTM, rarely needed. |

To stop the kiosk starting at login, delete `~/.config/autostart/sttm-kiosk.desktop`.

## Choosing the microphone

The Pi uses the system's default input. To check or change it:

```bash
wpctl status
```

```bash
wpctl set-default <id of the USB input>
```
