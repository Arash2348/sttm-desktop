# GAB vs Karanbir Singh's training data (gurbani-captioning/punjabi-ctc-data)

Checked 2026-10-24 from the dataset's own per-clip provenance (YouTube video id + start/end seconds for all 34,723
training/validation clips, 39.2 h from 114 videos). Only metadata columns were read; no audio was downloaded.

| | Count |
|---|---|
| GAB recordings from YouTube (all splits) | 328 recordings, 122 videos |
| GAB recordings whose video appears in the training data | **4** (all dev split, none test) |
| ...whose time range actually overlaps training clips | 4 |

| GAB recording | Split | GAB length | Overlapping training audio |
|---|---|---|---|
| ytraji_T30vHxIXQ2I_0-721 | dev | 721 s | 344 s (84 clips) |
| ytraji_mQHmKVVMJNI_0-414 | dev | 414 s | 248 s (31 clips) |
| ytraji_D-AMT8vwvfc_0-347 | dev | 347 s | 184 s (41 clips) |
| ytsalokm9_QjnT83rU4so_0-1210 | dev | 1210 s | 37 s (11 clips) |

These four were **removed from GAB on 2026-10-24** (dataset commit ec3f8ff9: audio, keys and manifest rows); none of them
had been shown on the GAB pages. Every other GAB recording (including all SGPC, Renton, Yuba City, AKJ and Manchester clips and the
whole held-out test split) does not share a video with this training data.

Caveats: this is Karanbir Singh's reproduced model's data (Oct 2026). The training data of the earlier model that Voice
Autopilot ships (karansea IndicConformer) is not published, so it cannot be checked the same way.

Do-not-train list for any fine-tune: gab-youtube-blocklist.csv (video id + seconds per GAB recording).

## Same source, different broadcasts (Darbar Sahib)

Exact audio is not shared, but the training data is overwhelmingly from the same source as GAB's Darbar Sahib set:

| | |
|---|---|
| Training hours from the "SGPC, Sri Amritsar" YouTube channel | 33.4 of 39.2 h (85%); the rest is rajikaurrr (5.7 h) |
| GAB Darbar Sahib videos from that same channel | 12 of 13 (different broadcasts/days) |
| GAB Darbar Sahib recordings whose Shabad also appears in training | 7 of 22 |

So a model trained on this data has heard the same hall, broadcast mix and many of the same Shabads (likely often the
same raagis) as GAB's Darbar Sahib recordings. Results on them are in-domain for such a model and will look better than
on other Gurdwara Sahibs. Recommendation: report Kirtan with and without the Darbar Sahib recordings when comparing models
trained on this data.
