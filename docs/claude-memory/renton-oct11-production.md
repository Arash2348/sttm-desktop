---
name: renton-oct11-production
description: "Oct 11 2026 full production run at Renton (experimental.7): three problems found (paath lag = pipeline backlog, kirtan won't auto-switch, Stop resets screen); data, diagnosis, fix branches, open follow-ups"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-12T05:51:43.708Z
---

Oct 11 2026 evening: the user ran the Khalis experimental build (9.3.2-experimental.7 = commit
265da34e, Windows PC "SinghSabhaDesktop", mixer -> USB Advanced Audio Device) through a whole
Renton program: Rehras, Aarti, kirtan (Shabad 2053), two Bhagat Fareed Saloks (5299, 5238), a
break, Hukamnama (3048, perfect, thumbs-up), Kirtan Sohila. Two sessions in Azure
(raw/renton-gurdwara/hardeep-singh-jashandeep-singh/2026-10-12/..T00-36-21.. 41 min and
..T01-18-07.. 87 min), fully uploaded; nothing reached Hugging Face (Khalis build has no
VF_HF_TOKEN secret).

**User's ratings:** Rehras/Aarti/Sohila accurate but latency builds to 6-7 lines (unusable);
kirtan good once locked but never switched by itself even at 70-90% (user tapped every time);
Hukamnama perfect; Stop jumped the screen to line 1 (brother).

**Root causes found (Oct 11-12):**
1. PAATH LAG = pipeline backlog, not (mainly) the follower: on that PC the pipeline runs at
   0.85-0.9x real time; the unbounded promise chain in VoiceFollow.jsx startAudio lets lag grow
   5-10 s/min (sawtooth, peaks 50 s Rehras, 84 s hidden), resetting at every Stop/Start. That is
   why short runs (Hukamnama) felt perfect. Workaround until fixed: Stop+Start every 3-4 min.
   The PC was only ~25% busy across 24 cores (single pipeline is the bottleneck).
2. KIRTAN LOCK (root cause found Oct 12): every tap was a FIRST LOCK after pressing Start, not a
   failed switch. (a) Start stopped the hidden run and began a cold search, discarding the hidden
   run's lock (5299 locked hidden at 523.7 s, Start at 551 threw it away, tap at 727); (b) sung
   kirtan dwelling on one pangti never meets the first-lock rule (2 different verses or one very
   clear decode), so the panel sat at exactly 70%. Fix f4cadff6: Start adopts the hidden run
   (>= 90%), Paath-pool opening needs full-text agreement (removed a wrong Aarti page during the
   Fareed talk), panel progress = real lock rule. The one-pangti first lock (Fremont 86->91%
   right Shabad) was tried and DROPPED: it wrong-locked Sep 27 Aarti aa18 and no text-only check
   separates it; needs an acoustic cross-check later. 'Canonical retrieval is closed' = harmless
   noise; backlog ~0 in kirtan.
3. STOP RESET: stop() calls restoreBaniLength() -> Bani reloads at the user's length -> line 1.

**Fix branches (all from 265da34e; worktrees ~/personal/sttm-<name>):** vf-bounded-lag
(throughput: cap backlog ~1 s, contiguous audio, share model runs, thread settings, 'perf'
event + CPU model logging; lands first), vf-paath-follower (follower2 for Banis only, strong
next-line prior, catch-up jump), vf-kirtan-lock, vf-stop-keeps-screen. Coordination file:
scratchpad vf-fix/COORD.md (session 7dc20a33). Test data: rt11_* clips in
~/personal/live-darbar-venues/clips with forced-alignment line truth for Rehras/Aarti/Sohila
and kirtan-targets.json; second check = Fremont line-level set (khalis-tests.json).

**Open follow-ups / to track:**
- Renton PC CPU model unknown (we log cpu count 24, mem 17 GB, not the model); look up
  Settings > System > About > Processor when next at the Gurdwara. Logging of CPU model +
  per-window ms is being added so future sessions answer this themselves.
- Session label still says mvp-8.6c-shadow in the experimental build (cosmetic).
- Windows "Failed to open: file not found" unhandled error at app restart (twice).
- Khalis workflows need `VF_HF_TOKEN: ${{ secrets.VF_HF_TOKEN }}` + the secret from Gauravjeet.
- Push tonight's two sessions to HF with the local token once the user says "push to HF".

**Morning deliverable (asked Oct 12 early):** results tables vs Renton + Fremont proving all
three problems solved, no regression on L2 41 / paath 65 / Aarti 50 / Fremont, integration branch
vf-mvp-9.0 (~/personal/sttm-release; the user named the release MVP 9.0), and a video of the 8.8 Electron app on this Mac running the
Renton audio. Report: research/level2-dataset/results/MVP-9.0.md.

**Why:** first full production run; these three problems decide whether sangat can use it.
**How to apply:** measure every fix on the rt11 clips + the Fremont set; the backlog fix must
land before judging the paath follower. See [[tester-build-86c]], [[hf-dual-write]].
