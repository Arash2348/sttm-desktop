GAB v1.4: the Sung Bani set measures only Bani sung like kirtan by a ragi jatha.

- Asa di Vaar sung in Akhand Kirtan style (many voices) moves to 5-akhand-kirtan with `tags: akhand-kirtan`: ytasa1, nw11_asa1, nw11_asa2, nw11_session, ytasa2. Audio re-pointed (same LFS objects, no upload); splits unchanged.
- rt11_fareed1: 0-34 s is the ragi's spoken introduction in Punjabi; kept as a gap (no key) and written in the notes.
- Key fixes: aa24-aa27 (Jaap Sahib Chatr chakr verses and a Sukhmani Salok after Aarti were keyed as Aarti; simran and instruments now gaps); rt11_fareed2 keys Salok 29 (5239) sung inside Salok 28.
- One non-overlapping set of cuts per Aarti performance; the other cuts stay in the dataset with `gab-exclude: <reason>` in the notes (read by the GAB tools from v1.4). nw11_session is scored through its cuts.
- manifest.csv: only those rows change (every other line byte-identical); meta.json follows the manifest; README folder table recounted and a v1.4 section added.

Tools: GAB tools v1.4 read `gab-exclude:` from the manifest notes (fork branch sung-bani-v14, research/cloud-gab/gab-tools-cloud.patch).
