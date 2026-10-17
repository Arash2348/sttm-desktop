# GAB v1.4: Sung Bani cleanup (Oct 17 2026)

Owner's request: Sung Bani is the number-one goal, and the set must measure only Bani sung like kirtan by a ragi jatha.

- `detect.js`: heard text (replay traces) vs the keyed Gurbani, in 5 s buckets: stretches of many words that match no pangti = talk candidates.
- `tile.py`: one non-overlapping set of cuts per Aarti performance (max keyed seconds, keyed windows in recording time).
- `edit.py <dataset copy>`: all v1.4 edits (Asa di Vaar to 5-akhand-kirtan + `tags: akhand-kirtan`; `gab-exclude:` notes; aa24-aa27 and rt11_fareed2 key fixes; rt11_fareed1 talk note); writes `<dir>.changes.json`.
- `mix.py <dataset copy>`: keyed minutes per Bani and split.
- `pr.js <v14 dir> <v14 dir>.changes.json README-dataset-v1.4.md [--commit]`: one HF PR (audio re-pointed, no upload; manifest self-checked).
  Opened as HF PR #10 with the write token (~/.vf-hf-token-write). `pr2.js` pushes follow-up commits to refs/pr/10.
- Tools: `../gab-tools-cloud.patch` now also reads `gab-exclude:` from the manifest and labels scorecards GAB v1.4.
- Listening page (not published): `../listen-sung-bani/index.html`; mp3 clips in ~/personal/sung-bani-v14/listen.
