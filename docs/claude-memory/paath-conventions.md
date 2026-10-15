---
name: paath-conventions
description: "User's answers (Oct 12 2026) on paath/kirtan practice that shape follower design: step-backs are deliberate emphasis; headers usually spoken; after evening Rehras comes Aarti (else kirtan); Rehras length varies by reader so extra-long must still handle jumps; Aarti is sung; rahao repeat = screen goes back"
metadata:
  node_type: memory
  type: project
  originSessionId: 7dc20a33-cab3-495f-b630-6acf57f0287c
  modified: 2026-10-13T06:43:37.377Z
---

Answers from the user (Oct 12 2026), to be treated as design facts:
1. Step-backs in paath (re-reading a pangti) are deliberate, for emphasis: not stumbles. Follow
   them back promptly; one line is the norm. See [[rehras-repeat-pattern]].
2. Headers/section titles in Rehras are spoken most of the time; some sevadaars skip them. The
   follower must handle both (header rows in the profile, but a jump past them is normal).
3. Evening: after Rehras comes Aarti, otherwise kirtan. Mornings vary a lot. So the end of
   Rehras should hand over to the kirtan/Aarti search, not hold the last line for long.
4. Rehras length varies by reader. Following the extra-long version "should be good for everyone"
   PROVIDED the follower keeps handling jumps within Rehras (skipping the sections a shorter
   version omits) as well as it did before. Regression test: short/medium/long readers on the
   extra-long profile must still be followed through the skips.
5. Aarti is almost always SUNG like kirtan, and the Shabad set differs by Gurdwara. So Aarti
   stays on the kirtan follower, not a fixed-order Bani; Aarti-50 remains the set.
6. Kirtan: when the jatha repeats the rahao (or any line), the screen should GO BACK to the
   repeated line, not stay on the latest verse. Product decision.
7. Slowest Gurdwara PC: unknown; keep collecting CPU model + perf from sessions.

**How to apply:** encode 1, 2, 4, 6 as tests (step-back follow time, header skip, short-reader
on extra-long profile, rahao return) in the smoke tier. See [[north-star-goals]],
[[renton-oct11-production]].

**Newton / Gauravjeet's Asa di Vaar (added Oct 12 2026):** Gauravjeet thinks his Windows laptop
had voice isolation / noise suppression on the mic, which is why only ~11% of lines were audible
in that session. So the Newton numbers (24% -> 67% within-1) reflect a mic setting, not the
follower; a clean re-recording is expected to be far better (YouTube Vaar 97%). Action: add a
setup check / warning in the app for Windows voice isolation (Settings > System > Sound > mic
> Audio enhancements, and OEM apps like MaxxAudio), and mention it in the sangat guide.

**Instrumental breaks (user, Oct 13 2026, from the Fremont check):** when the jatha plays only
instruments after singing a pangti, the screen should KEEP that pangti (the sevadaar is right
to hold it); moving ahead during instruments is wrong. Candidate kirtan follower rule: no line
advance without new sung letters; hold through instrumental gaps.

**Fremont who-is-right check (user ear, Oct 13 2026, 30 app-vs-sevadaar disagreements, 544 s):**
sevadaar right 25, instruments-only keep-previous 3, neither 1, unsure 1, app right 0. The
Fremont 59% is REAL kirtan line-following weakness, not answer-key lag (my earlier guess was
wrong). Pattern: app mostly AHEAD (14/30 one line early incl. during instruments; 5 jumped 4+
lines ahead; 7 behind, 5 of them 4+). Fix direction: kirtan follower must not advance without
new sung letters of the next line; far jumps need much more evidence. Items/answers in
research/level2-dataset/linecheck-fremont/.
User observation (low confidence): divergences often coincide with more hall resonance and
sangat singing together (muddier audio) -> check recognizer confidence there; confidence-aware hold.
Recording condition matters: Fremont (Jaspal's kh*) is probably a laptop/computer mic in the hall
(room acoustics, reverb, sangat), NOT a mixer feed like Renton (USB from the mixer). Unconfirmed;
ask Jaspal. Both conditions must be good; the user estimates Gurdwaras split roughly 50/50 between mixer feed and a room/laptop mic, so weight them equally. Tag every benchmark clip with its mic path
(mixer-feed | room-mic | laptop-mic-near-speaker | unknown) and report scores split by it.
