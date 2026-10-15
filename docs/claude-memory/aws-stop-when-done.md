---
name: aws-stop-when-done
description: Always stop (never terminate) every EC2 box the moment it has no work; applies to Arash's and Jashan's accounts
metadata:
  type: feedback
---

User (2026-09-26, repeated 2026-09-27 "Pause EC2 when we are not using, always"): stop idle EC2 instances immediately.
Never terminate. Arash's account (profile c10-bench, i-0ea2cc96c077a8150) has no credits: keep it stopped, run on
Jashan's account (profile gurbani-prod, 680476617406, us-east-2; boxes c10bench-j/j2/big, image c10-bench-img).

**Why:** idle boxes bill by the hour; stopping keeps disks (results, speech cache) for later.

**How to apply:** every queued run ends with: copy results off the box (to the Mac and the scoring box), then
`aws ec2 stop-instances`. Never leave a box idle while waiting on the user. A stopped box gets a new public IP on
start (update ~/.ssh/config). Related: [[mac-compute-limit]], [[cycle-numbering]].

2026-10-01: Jashan's Sept bill was $259 (c7a.32xlarge 21 h = $140, c7a.8xlarge 68 h = $112) and NO credits were
applied (Cost Explorer shows only Usage records). Arash's payer acct 373468206589 billed $21.85. User was alarmed.
Cost now matters: ask before starting big boxes, prefer one c7a.8xlarge, no repeat/noise runs without OK.
2026-10-01: at user's request ALL benchmark instances + disks were deleted in both accounts (terminated). Only the AMI
c10-bench-img (ami-0725f7ec72b8cadbf, snapshot snap-0fd8a0213f2906352, ~$5/mo) remains in Jashan's acct for rebuilds.
2026-10-01 later: AMI + snapshot also deleted at user request — accounts at $0; a new box needs a full rebuild (ask first).
2026-10-01 (follower2 session): user said "do not use AWS anymore at all without my express permission" — no AWS
CLI/console/MCP calls of any kind (not even status checks or stops) unless the user explicitly OKs it in chat. All
benchmark work runs locally on the Mac within [[mac-compute-limit]] (one nice-19 job), and sub-agents must be told.

2026-10-01 (late): "never use AWS without my permission fyi". This covers EVERY AWS call, including the sangat
tester pipeline's S3 (benchmark sync, presigned links, moving test sessions, uploading installers), not only EC2.
The tester app's own automatic uploads are the one standing exception (approved as part of the design). Ask first,
each time, and say what the call costs.
