---
name: end-with-action-items
description: "End every reply with ranked human next steps, then a one-line TLDR of what Claude did/showed"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-26T00:24:26.485Z
---

Always end a status update or reply with a short ranked list: "Your highest-ROI action items" — only things that need the
user (verifications, decisions, space, approvals), each with a time estimate and why it unblocks work. If nothing is needed,
say so explicitly.

Then the very last line is a one-line **TLDR:** of what Claude did or showed in that message (user asked 2026-09-26).

**Why:** the user (2026-09-25) wants to finish their part quickly so Claude can keep moving without waiting.

**How to apply:** rank by how much each item unblocks Claude's running work or adds verified data per minute of the
user's time; keep it to 1–4 items; never pad with optional busywork. Related: [[verified-data-home]]
