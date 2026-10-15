---
name: adaptive-performance
description: Design (user ask Oct 13 2026) for working well on every Gurdwara machine incl. slow PCs: per-session perf telemetry -> Azure fleet report -> app self-test picks a performance tier and steps live -> tiers benchmarked at 0.5x/0.7x/0.9x/1.2x on the Intel VM; target 0.4 s lag on a Renton-class PC
metadata:
  type: project
---

The user (Oct 13 2026): speed is only useful if the PC does not backlog; 1.2 s on a slowed engine
is too much; the bar is ~0.4 s (the Mac number) everywhere, "even slow PCs", done smartly by
looking at Azure and users' specs.

**The loop:**
1. Telemetry: every session logs CPU count/model, memory, per-minute perf (audio s per wall s),
   backlog, lag, chosen tier (9.0 has most; CPU model + tier being added).
2. Fleet report: research/level2-dataset/tools/fleet-report.js (branch vf-fleet-report, worktree
   ~/personal/sttm-fleet) reads only the small jsonl from Azure raw/ sessions, one row per
   machine with recommended tier; results/FLEET.md. Read-only on Azure.
3. Adaptive tiers in the app (branch vf-throughput-2, worktree ~/personal/sttm-throughput2):
   ~2 s self-test on start picks threads + tier; tiers fast / normal / slow / minimum; live step
   down when backlog > ~0.5 s, step up with headroom, hysteresis; tier and steps logged.
4. Benchmarked on the slowed-engine harness (renton-stress.js) at 0.5x/0.7x/0.9x/1.2x; Intel VM
   (GCP vf-record) is the reference; fast tier on normal speed must be unchanged.

**How to apply:** report per-tier lag tables; Renton's first evening on 9.0 is the first real
check (expect ~0.85-0.9x there). See [[north-star-goals]], [[gcp-bench-vm]], [[renton-oct11-production]].
