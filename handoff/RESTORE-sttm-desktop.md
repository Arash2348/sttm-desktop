# Restore + upstream recipe — sttm-desktop voice-follow

Your work is safe locally at /Users/asingh02/AAI/sttm-desktop
Branch: feature/voice-follow  (latest commit 39cbaf0)
Tag:    pre-autopilot         (clean base = 2f451be)

## After the eval — bring the public repo back

### If you DELETED the fork:
1. On GitHub, fork KhalisFoundation/sttm-desktop again (gives a fresh, proper fork).
2. Point your local "fork" remote at the new fork and push:
   cd /Users/asingh02/AAI/sttm-desktop
   git remote set-url fork https://github.com/Arash2348/sttm-desktop.git
   git push -u fork feature/voice-follow
   git push fork pre-autopilot   # push the baseline tag too
Done — public again, proper fork, ready to upstream.

### If you only made it PRIVATE:
GitHub -> repo -> Settings -> General -> Danger Zone -> Change visibility -> Public.
(One click. Nothing to re-push.)

## To upstream to KhalisFoundation (any time, from any fork state)
Your commits are portable, so this always works:
1. Ensure you have a *fork* of KhalisFoundation/sttm-desktop (re-fork if needed).
2. git push fork feature/voice-follow
3. Open a PR: base = KhalisFoundation/sttm-desktop, compare = Arash2348:feature/voice-follow
The fork relationship is only a convenience for the PR button — it can always be recreated.

## Remotes (current)
fork    https://github.com/Arash2348/sttm-desktop.git
origin  https://github.com/KhalisFoundation/sttm-desktop.git
