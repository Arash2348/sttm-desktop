---
name: mac-compute-limit
description: "Never run benchmarks/speech model in parallel on the user's Mac; heavy compute goes to the AWS box; sub-agents must be told so explicitly"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 380c698c-883c-4552-830b-761a87c36ef2
  modified: 2026-09-26T07:33:43.387Z
---

On the user's Mac: at most ONE low-priority job at a time (nice 19), never parallel benchmark runs, never disk-wide find/bfs. All Cycle 10 benchmark compute runs on the AWS EC2 box (ssh host `c10`).

**Why:** 2026-09-26 a multi-agent workflow's agents started ~10 bench-runner/conf.js jobs locally (load average 341-365); the user noticed the throttling and a peer session had to SIGSTOP them. The user expected everything heavy to be on EC2.

**How to apply:** Every Workflow/Agent prompt that touches Voice-Follow benchmarking must say: read code and trace files only; never run bench-runner.js, the ONNX model, or node inference locally; experiments go through the main session's EC2 `try.sh`. Check `uptime` on the Mac after launching any workflow. Related: [[cycle10-scope]].

**2026-10-02 update:** the user's Mac crashed/restarted during the tester-build work while several background tasks (CI pollers, builds, S3 syncs) ran at once. Keep at most ONE background task on the Mac, never run a local electron-builder build while CI is building, keep pollers to one process with sleep >= 60 s, and prefer CI (GitHub Actions on the fork) for all installer builds.

**Update Oct 13 2026 (user):** "I'm not really using my Mac right now, use as much as you want,
but in a way I can still do things on my Mac." So: everything at nice 19; vf-check runs 3 replay
slots x 4 workers (of 14 cores) in parallel; model record/fill still one at a time. Leave ~2 cores
free; never launch visible apps.
