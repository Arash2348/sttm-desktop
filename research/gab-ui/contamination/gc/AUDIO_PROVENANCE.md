# Audio row provenance

## Audited coverage

All **34,723 retained training/development rows** contain an original source
recording ID, start/end timestamps, duration and WAV SHA256. Packaged values
match the corresponding original manifest fields exactly. No IDs or timestamps
were inferred from filenames, rounded or repaired by this audit.

| Split | Rows | Source ID present | Ordered source timestamps present |
|---|---:|---:|---:|
|stage1/train|27,842|27,842|27,842|
|stage1/validation|3,093|3,093|3,093|
|stage2/train|3,408|3,408|3,408|
|stage2/validation|380|380|380|

See `provenance-audit.json` for the machine-readable coverage, per-split field
inventory, examples, duration checks and semantics.

## Column meanings

- `recording_id`: exact original `video_id` (including YouTube source IDs).
- `start_time`, `end_time`: seconds in the historical source-recording timeline,
  not offsets within the already-cut clip. Fractional seconds are preserved.
- `duration_seconds`: historical effective clip duration. All retained metadata
  source spans agree with it to much less than50ms; this is a metadata check,
  not new verification against the current remote recording.
- `audio_sha256`: hash of the complete original embedded WAV bytes, not a
  resampled decoder array and not the hash of the full upstream recording.
- `bundle_path`: original relative training-input path.
- `row_index`, `stage`, `split`: stable baseline identity/order.
- `source_row_json`: all original fields, including `video_id`, timestamps,
  confidence/quality fields and shabad/line metadata where available.

For example, the first stage1 train row has source ID `icv-Cd_-2A0`, start
6967.92s, end6969.92s and duration2.0s. The ID is not a dataset-name prefix to
strip; retain the complete ID. Source extraction code in the original project
explicitly uses this ID for YouTube subtitles.

## What is and is not verified

Every ID has11-character YouTube-compatible syntax. The historical data pipeline
uses YouTube video IDs/subtitles. The full URL is **not explicitly stored** in
these original rows. A URL such as `https://www.youtube.com/watch?v=VIDEO_ID`
is derived from the ID, not independent evidence that the video is currently
available, has the same content, or may be redistributed. No remote checks were
made, and no source URLs were fabricated as originally recorded provenance.

Publication/acquisition date, creator/performer identity, source-file hash and
per-recording license/permission are not completely recorded here. Keep those
unknown rather than guessing. The private upload rights-review requirement
still applies. A source ID and timestamp are useful provenance, not a license.

The fifteen extra original WAV assets outside effective manifests are retained
only to reconstruct the original bundle and preserve quarantine evidence; the
34,723-row coverage claim is for the four effective train/development splits,
not a claim that extra assets form a separately annotated training split.