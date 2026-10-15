---
name: never-over-budget
description: "HARD RULE from the user (Oct 13 2026): never exceed the cloud credit, never waste money, credits must be consumed before the user's card; every cloud job has a hard stop and is stopped when idle"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T07:20:39.672Z
---

The user: "it is very important to me that we don't go over our budget!! and that we don't
waste money when needed... make sure we never go above what our credit allows, and make sure
the credits are what is used, and it's not being taken out from me first."

**Why:** they were burned by an AWS bill before ([[aws-stop-when-done]]).

**How to apply:**
- GCP: budget counts GROSS usage (credit treatment = exclude-all-credits) so the kill-switch
  fires at $150 of real usage, well inside the $300 credit; never raise the cap above the
  remaining credit. Google applies promotional credit before the card automatically.
- Every VM: --max-run-duration (6 h) + STOP, stopped the moment its job ends; resize down for
  light work; nothing left running overnight without a job.
- Before any new paid resource (bigger VM, GPU, more projects, storage): state the hourly cost
  and expected total to the user first.
- Report spend-to-date in the cloud status table. See [[gcp-bench-vm]].
