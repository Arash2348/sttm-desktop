---
name: upload-without-asking
description: Uploading checked benchmark recordings/labels to the private HF GAB dataset needs no extra permission
metadata:
  type: feedback
---

The user (Oct 14 2026), on uploading Sukhmani Sahib to GAB: "yeah upload, you don't need to ask me."

**Why:** asking again after they've checked a recording just slows the flywheel.

**How to apply:** once a new recording's labels are checked (contact sheet ticked / ear check done), upload it to the private khalisfoundation/GurbaniAutopilotBench dataset and update the manifest without asking; tell them it's done. Still never upload unchecked labels as checked, and deletions on HF stay ask-first. See [[gab]], [[notify-when-done]].

Also (same day): "maybe you can have a subagent verify the contact sheets, but show me the ones you're confused on and I can confirm." So: an independent verifier agent checks contact sheets plus extra sampled frames; VERIFIED recordings upload directly; only uncertain rows go to the user as images.
