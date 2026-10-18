# Voice Autopilot panel redesign (parked)
This branch is the panel UI redesign only (display, no decision logic): bigger Voice Autopilot text, the confirmation dots/chips per heard pangti, evidence bars with the switch tick, amber rail, end-of-Shabad state, better contrast (candidateShelf.js, liveBoard.js, _voice-follow.scss, _dark-base.scss, en.json, VoiceFollow.jsx board rendering).
It also carries the evidence-chip feed for fragment confirm (liveBoard.fragments + test) from the 10.0.3 work; the VoiceFollow.jsx call into it lives with the logic on branch vf-10.0.3.
Parked by the owner on 2026-10-17 so it can be reviewed later; 9.0.5 ships the 9.0.4 panel plus the first-launch callout. Do not delete (ui-cands-2 is the original branch).
Base: 9.0.4 (8aae7686). Render check: ~/personal/uicands-shots/harness.
