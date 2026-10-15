---
name: notify-when-done
description: Always tell the user (proactively, with results/screenshots) as soon as any background task finishes
metadata:
  type: feedback
---

The user (Oct 14 2026): "always let me know when you are done."

**Why:** they work across devices and come back later; silence after a background job leaves them unsure.

**How to apply:** when a background agent/job completes, send a short completion message right away (send screenshots/files with SendUserFile, status proactive), even if no decision is needed. See [[end-with-action-items]].
