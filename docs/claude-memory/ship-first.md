---
name: ship-first
description: "HARD RULE (user, Oct 13 2026): one release in flight at a time; new ideas queue behind it; no videos unless trivial; the user tests subjectively to save time; the product has deadlines, be efficient with time"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T19:38:51.760Z
---

The user (Oct 13 2026): "why do we need to do anything after 9.0.1... we tend to keep looping...
I can subjectively test things too to save you time after we have a final version... only make
videos if it's easy... become more efficient with time management, this product has deadlines."

**Why:** five parallel tracks shared one benchmark queue and one VM, so each took hours; a usage
pause cost six more; the release slipped behind scope I added.

**How to apply:** finish the release-critical fix first, with the minimum checks that decide
ship/no-ship; the user tests on the Mac; PR. Everything else (tiers, Akhand bundle, adaptive
page turn, videos) is a queued list worked ONE at a time after the PR. Do not start a new
agent for an idea mid-release; write it to the list. Videos only when a single cheap scene
proves something the user cannot test themselves. Report "done in" times honestly and keep them.
See [[test-small-first]], [[never-over-budget]], [[north-star-goals]].
