---
pretty_name: "GAB: Gurbani Autopilot Bench"
license: other
language:
  - pa
task_categories:
  - automatic-speech-recognition
tags:
  - gurbani
  - kirtan
  - paath
  - sikhitothemax
  - voice-follow
  - benchmark
configs:
  - config_name: manifest
    data_files: manifest.csv
    default: true
---

# GAB: Gurbani Autopilot Bench

**What it is.** SikhiToTheMax Voice-Follow listens to kirtan or paath and puts the right Gurbani on the screen, the way a sevadaar would. GAB is the test we use to check how well it does. It is a set of real recordings, each with an answer key that says which Shabad and which pangti was being sung or read at every moment.

**How it works.** We play each recording into the app, write down what the app showed on the screen, and compare it with the answer key. Every change to the app gets the same test, so we can see whether it got better or worse.

## What we check

For every recording, four simple questions:

1. **Did it find the right Shabad or Bani?** How quickly, and how often it showed the wrong one.
2. **Is the right pangti on the screen?** The share of time the sangat sees the pangti being sung or read, counting a pangti that appears within 1 second as on time.
3. **How far behind the voice is it?** In seconds.
4. **When they moved on, did the screen follow?** How quickly it switched to the next Shabad.

## What is inside

| Folder | What it holds | Recordings | Hours |
|---|---|---|---|
| `1-kirtan-shabad` | kirtan of a Shabad, including whole darbars with several Shabads | 176 | 23.9 |
| `2-bani-recited` | a Bani read aloud, one folder per Bani: Japji, Jaap, Tav Prasad Savaiye, Chaupai, Anand Sahib, Rehras, Sohila, Saloks | 47 | 1.4 |
| `3-bani-sung-like-kirtan` | a Bani sung like kirtan by a ragi jatha: Aarti, Rehras, Saloks (Asa di Vaar moved to `5-akhand-kirtan` in v1.4) | 57 | 4.4 |
| `4-akhand-paath` | reading Guru Granth Sahib Ji Ang after Ang | 3 | 0.5 |
| `5-akhand-kirtan` | Akhand Kirtan: smagams and Asa di Vaar sung in Akhand Kirtan style; many singers, the sangat singing along, many instruments (the GAB-Akhand Kirtan tier) | 37 | 6.2 |
| `human-verdicts` | checks made by listening: does a pangti start where the key says, and who was right when the app and the sevadaar disagreed | 90 checks | |

Every recording has its own folder with:
- `audio.wav`: the recording
- `lines.csv`: when each pangti starts and ends
- `shabads.csv`: which Shabad or Bani is playing when
- `meta.json`: where it comes from, the microphone, and how the answer key was made

`manifest.csv` lists every recording in one table.

## What changed in v1.4 (Oct 17 2026): a cleaner Sung Bani set

The owner listened to the Sung Bani recordings and found two problems; a check of every recording found three more.
- **Asa di Vaar moved to Akhand Kirtan.** The Asa di Vaar recordings are sung in Akhand Kirtan style (many voices, smagam), a
  different behaviour from a ragi jatha singing a Bani. ytasa1, nw11_asa1, nw11_asa2, nw11_session and ytasa2 move to
  `5-akhand-kirtan` (manifest notes `tags: akhand-kirtan`); splits unchanged (ytasa1 dev, Newton and ytasa2 test).
- **Talk is never scored as Bani.** rt11_fareed1 opens with 34 s of the ragi introducing the Shabad in Punjabi; it stays a gap
  (no key), now written in the notes.
- **Keys fixed.** aa24-aa27 (Renton hall, after Aarti): Jaap Sahib (Chatr chakr verses), Waheguru simran and a Sukhmani Salok
  (Shabad 880) were keyed as Aarti; now keyed as what is sung, simran and instruments left as gaps. rt11_fareed2: Salok 29
  (5239) sung inside Salok 28 (5238) is now keyed.
- **Each sung moment is scored once.** Cold-start cuts of one Aarti performance overlapped up to 6 times; one
  non-overlapping set of cuts per performance is kept, the rest carry `gab-exclude: <reason>` in the manifest notes
  (still in the dataset, not scored). nw11_session is scored through its cuts.
- Numbers from v1.3 and v1.4 are not comparable for Sung Bani and Akhand Kirtan; every scorecard says its version.

## Where the answers come from

We trust answers in this order:
1. **A person listening and checking**, in `human-verdicts`.
2. **What a sevadaar showed on the screen,** from real Gurdwara sessions. Very reliable, but it can lag the singing slightly.
3. **The captions of a video,** checked by eye.
4. **A computer guess** (forced alignment). Used only where nothing better exists, always marked, never used for the headline numbers.
   Since Oct 15 2026, every recording without human pangti times carries an **audited** computer guess: two speech models must agree within 1 s and hear the pangti's words (97% on the right pangti against GAB-Hard's human keys; a person confirmed 20 of 20 random ones). Marked `aligned-2model-audited` in `lines.csv`; shown as information, never as the headline. See `human-verdicts/pangti-spot-check`.

## Rules that keep the numbers honest

- Recordings are split into **train, dev and test** by whole sessions. We never tune on test.
- **Mixer feed and room microphone count equally.** About half of Gurdwaras use each.
- Every result says which version of GAB it used.

## How to run it

The tools are in `tools/`. `tools/RUNNING.md` has the exact steps. In short, one command replays every recording from saved model output, so a full check takes minutes instead of hours.

## Sources and permissions

Recordings come from Gurdwara sessions shared with Khalis Foundation and from public YouTube videos. The YouTube audio belongs to its uploaders, so this dataset is private to Khalis Foundation members. Please do not share the audio outside it.

<!-- GAB-LEADERBOARD:START -->
## Leaderboard

**Gurbani Autopilot** is STTM Desktop's Voice-Follow. Full, sortable leaderboard: [khalisfoundation/GAB-leaderboard](https://huggingface.co/spaces/khalisfoundation/GAB-leaderboard). GAB v1.3, practice recordings only (the test set is never shown).

🟢 best · 🟡 in between · 🔴 worst, compared with the other versions in the same column. Higher % is better; fewer wrong-Shabad seconds is better.

### Versions

| Version | Kirtan: right Shabad | Kirtan: wrong Shabad (s per hour) | Bani recited: right Bani | Bani sung: right Bani | Bani sung: wrong Bani (s per hour) | GAB-Hard kirtan: right Shabad | Akhand Kirtan: right Shabad |
|---|---:|---:|---:|---:|---:|---:|---:|
| 8.6 · Cycle 8 + Bani paath, tester build (Sep 29) | – | – | 95.7% | – | – | – | 78.2% |
| 8.6c · Renton Gurdwara production run (Oct 11) | 🟢 92.8% | 🟢 107.7 | 95.7% | 🟢 85% | 🟢 38 | – | 78.2% |
| 9.0 · checkpoint, tested by the user (Oct 12) | 🔴 92.6% | 🟡 111.2 | 95.7% | 🔴 84.2% | 🔴 49.5 | 52.8% | 78.2% |
| 9.0.1 · first release | 🔴 92.6% | 🔴 113 | 95.7% | 🟢 85% | 🟢 38 | 52.8% | 78.2% |
| 9.0.1 + version stamp | 🔴 92.6% | 🔴 113 | 95.7% | 🟢 85% | 🟢 38 | 52.8% | 78.2% |
| 9.0.1 + faster Aarti | 🔴 92.6% | 🟡 111.2 | 95.7% | 🔴 84.2% | 🔴 49.5 | 52.8% | 78.2% |
| 9.0.2 · works on slow computers | 🔴 92.6% | 🟡 111.2 | 95.7% | 🔴 84.2% | 🔴 49.5 | 52.8% | 78.2% |
| 9.0.3 · new panel | 🔴 92.6% | 🟡 111.2 | 95.7% | 🔴 84.2% | 🔴 49.5 | 52.8% | 78.2% |
| ** 9.0.4 · 9.0.4** ← in the app now | 🔴 92.6% | 🟡 111.2 | 95.7% | 🔴 84.2% | 🔴 49.5 | 52.8% | 78.2% |

### Ideas being tested (not in the app)

Each idea is compared with the version it was built from: 🟢 better, 🔴 worse, ➖ same.

| Version | Kirtan: right Shabad | Kirtan: wrong Shabad (s per hour) | Bani recited: right Bani | Bani sung: right Bani | Bani sung: wrong Bani (s per hour) | GAB-Hard kirtan: right Shabad | Akhand Kirtan: right Shabad |
|---|---:|---:|---:|---:|---:|---:|---:|
| Experiment: 9.0.5 · 9.0.5 (gate fix)<br><sub>vs  9.0.4 · 9.0.4</sub> | not scored yet | not scored yet | not scored yet | not scored yet | not scored yet | ➖ 52.8% | ➖ 78.2% |
| Experiment: 9.0.4 · 9.0.6 candidate (near-twin + Aarti profile 1)<br><sub>vs  9.0.4 · 9.0.4</sub> | not scored yet | not scored yet | not scored yet | not scored yet | not scored yet | not scored yet | 🟢 78.7% (+0.5) |

Main GAB is everyday Gurdwara audio (livestream and mixer feeds, studio paath). GAB-Hard is the Fremont hall laptop-mic recordings, tracked apart. GAB-Akhand Kirtan is smagam kirtan (many singers, the sangat singing along, many instruments), tracked apart. Pangti numbers (right pangti %) are shown under each Shabad number on the leaderboard; outside GAB-Hard they rest on audited two-model aligned keys (a person confirmed 20 of 20 random ones).

<details><summary>Exact code tested (commit ids)</summary>

- Gurbani Autopilot 8.6 · Cycle 8 + Bani paath, tester build (Sep 29): `fa250815bc98`
- Gurbani Autopilot 8.6c · Renton Gurdwara production run (Oct 11): `265da34e14fb`
- Gurbani Autopilot 9.0 · checkpoint, tested by the user (Oct 12): `7165bd2499cd`
- Gurbani Autopilot 9.0.1 · first release: `2cb8b003cfa4`
- Gurbani Autopilot 9.0.1 + version stamp: `c69b420b16c0` (Voice-Follow 9.0.1)
- Gurbani Autopilot 9.0.1 + faster Aarti: `db8f47cb870d` (Voice-Follow 9.0.1)
- Gurbani Autopilot 9.0.2 · works on slow computers: `973866605d3e` (Voice-Follow 9.0.2)
- Gurbani Autopilot 9.0.3 · new panel: `3fafc0baf8a7` (Voice-Follow 9.0.3)
- Gurbani Autopilot  9.0.4 · 9.0.4: `28025260fa94` (Voice-Follow 9.0.4)
- Idea: Experiment: 9.0.5 · 9.0.5 (gate fix): `1271040c795e` (Voice-Follow 9.0.5)
- Idea: Experiment: 9.0.4 · 9.0.6 candidate (near-twin + Aarti profile 1): `322829576cb3` (Voice-Follow 9.0.4)

</details>

<!-- GAB-LEADERBOARD:END -->
