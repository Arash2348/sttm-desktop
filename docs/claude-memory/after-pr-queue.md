---
name: after-pr-queue
description: Queue of work parked behind the MVP 9.0.1 PR (Oct 13 2026), with branch/worktree and status for each; work ONE at a time after the PR
metadata:
  type: project
---

Parked behind the 9.0.1 PR (user decision Oct 13 2026), in my suggested order:
0. Aarti on the paath follower (user wants it; NEXT PR, not #2238): branch aarti-paath-follower
   f397647b (= PR branch + reverse of 308b58cb), worktree ~/personal/sttm-aarti. Measured Oct 13 on
   the cache + real-model fill: Renton Aarti lag 2.4 -> 1.2 s, exact 32.5 -> 38.7 %; Aarti-50 wrong
   0.2 -> ~0.4 % (3 wrong switches on aa03/04/08/09/50), right 85.3 -> ~84.7, found 43 same. User
   accepts the wrong-page trade-off for the speed. Hold-on profile CANCELLED by the user (Oct 13 2026): plain fast Aarti (PR #2242) is enough.
1. Slow-PC adaptive tiers: branch vf-throughput-2, ~/personal/sttm-throughput2, THROUGHPUT-2.md
   (thread matrix partly measured on the VM; tiers not implemented). Goal: 0.4 s on Renton-class PC.
2. Akhand / Sehaj Paath on 9.0: branch vf-akhand-9, ~/personal/sttm-akhand9, AKHAND-9.md (merge
   done or partial; cloud runs partial).
3. Pace-adaptive page turn: branch vf-paath-adaptive e7af244a, FINAL on replay; a dial (paceOffS):
   user to pick; recommend 9.0 timing default + future Viewer setting.
4. Skip-recovery half of 9.1 alone (re-acquire 514239c4) measured on 9.0.
5. Asa di Vaar part 2 reopen bug (needs Gauravjeet's clean recording to matter).
6. Fleet report cron + "--real" filter (vf-fleet-report bc4438ea, works today).
7. Next-line preview in the Viewer (proposal to Khalis).
8. Videos: only cheap single scenes on request; scene files kept under scratchpad vf-video.

**How to apply:** pick #1 after the PR; do not run two at once. See [[ship-first]].
