---
name: check-pr-status
description: Before citing any GitHub PR link, check its live state via the GitHub API (open / merged / closed) and say it
metadata:
  type: feedback
---

The user (Oct 14 2026): "when you pull github links always check if they've already been merged please."

**Why:** stale status (calling a merged PR "open" or vice versa) misleads them and the other brother.

**How to apply:** every time a PR link appears in a reply, first query its state (git credential token + curl api.github.com/repos/<owner>/<repo>/pulls/<n>, never print the token) and state merged/open/closed with date and who merged. See [[notify-when-done]].
