---
name: north-star-goals
description: "The user's end goals for Voice-Follow with concrete numeric targets (accurate line, low latency, same on all Gurdwara hardware, fast Shabad switching, accurate finding); every cycle reports against these"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T03:23:13.171Z
---

Set Oct 12 2026. The user wants goals stated as numbers on named production sets, not vague
themes. Big goal: Voice-Follow is extremely accurate (correct line), extremely fast (low
latency), distributable (same behaviour on every Gurdwara PC), fast at switching Shabads, and
accurate at finding new Shabads.

**Numeric targets (report baseline vs now vs target against these every time):**
1. Correct line: Renton Rehras/Sohila 95% exact-line of voiced time (strict reported alongside);
   kirtan L2-41 same-line 95%.
2. Latency: paath median lag <= 0 s (flip in the breath pause), p90 <= 0.3 s; kirtan line lag
   <= 0.5 s.
3. Same on all hardware: screen within ~0.4 s of the reader (the Mac number) on a Renton-class PC
   (user, Oct 13 2026: 1.2 s on the slowed engine is too much); backlog <= 1 s for a whole 90-min session on the slowest Gurdwara PC
   (Renton 24-core at 0.85x real time is the worst known); every session logs CPU model + perf.
4. Shabad switching: right Shabad shown within 10 s of the new Shabad starting; zero manual
   taps in a full kirtan darbar.
5. Finding: first lock within 15 s of the Shabad starting, wrong-Shabad locks <= 1% (L2-41,
   Aarti-50, Fremont).

**How to apply:** every cycle's report is one table with these five rows. See
[[always-baseline-numbers]], [[test-small-first]], [[renton-oct11-production]].

**Hardware parity (added Oct 13 2026):** Gurdwaras run mostly Windows laptops/PCs (Intel/AMD),
some Macs; the goal is "good everywhere". Finding: the int8 model's output differs between
Apple silicon and x86 (~0.9% of frames flip top letter), so benchmarks measured on the Mac are
not exactly production. Rule: before a release, run the key suites on both an x86 machine (the
GCP VM, see [[gcp-bench-vm]]) and a Mac; report both; treat x86 as the production reference.
