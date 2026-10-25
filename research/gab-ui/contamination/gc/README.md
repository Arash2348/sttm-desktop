---
language:
- pa
task_categories:
- automatic-speech-recognition
configs:
- config_name: stage1
  default: true
  data_files:
  - split: train
    path: data/stage1/train-*.parquet
  - split: validation
    path: data/stage1/validation-*.parquet
- config_name: stage2
  data_files:
  - split: train
    path: data/stage2/train-*.parquet
  - split: validation
    path: data/stage2/validation-*.parquet
---

# Punjabi CTC training inputs — frozen seed42 baseline, private review

This is a byte-preserving package of the completed corrected-v2 training data,
not a newly collected or newly human-verified dataset. No extra partitioning,
resampling, transcript repair or seed-dependent selection occurred in packaging.
The seed determines the training procedure, not a claim of independent splitting.

## Effective split sizes

| Configuration | Train | Validation |
|---|---:|---:|
|stage1|27,842|3,093|
|stage2|3,408|380|

Stage1 uses recovered historical gold-finetune allocation. Stage2 uses recovered
April audio and original allocation, minus15 CTC-infeasible train rows and1
validation row. Original manifests, exact excluded rows, feasibility evidence,
source identifiers/timestamps and the original input hash lock are preserved.

## Loading

Use standard Hugging Face Datasets Parquet loading, selecting the `stage1` or
`stage2` configuration. Every row embeds a complete original WAV in an `Audio`
column. No custom loading script is required. Audio is mono16kHz PCM16; SHA256
is over the complete original WAV bytes, not a possibly resampled decoder array.

Other columns: text, recording_id, source start/end times when available,
duration_seconds, stage/split, original bundle_path, audio_sha256, row_index and
source_row_json. That JSON preserves original metadata, confidences and labels;
it is not a new annotation-quality guarantee. Preserve row_index ordering for
training reproduction; do not alphabetize clips when rebuilding manifests.

Provenance was audited across all **34,723 retained rows**: original source IDs,
ordered start/end timestamps and WAV hashes are present for every row, with
exact agreement to original metadata. `recording_id` preserves original
`video_id`; timestamps are in seconds on the source recording. All IDs have
YouTube-compatible syntax, but full source URLs, current availability and rights
were not independently verified. See `AUDIO_PROVENANCE.md` and the audit JSON.

`data/extra/` contains original WAV assets absent from effective manifests so
the exact original bundle can be reconstructed; it is **not a training split**.
`bundle-metadata/` preserves exact historical contextual metadata, some of which
contains superseded planning/status fields. Use the effective recipe and cards
for current execution, not status assertions inside those historical documents.

## Annotation quality and leakage limits

The historical labels are weak or not independently verified as verbatim sung
transcriptions. Confidence fields are provenance, not calibrated probability.
CTC feasibility does not guarantee correct alignment or good labels.
Historical stage2 training and development share recordings. Those development
results are not recording-independent generalization. Do not silently replace
the historical split and call it the same baseline. A rigorous new held-out
split should be separately versioned and recording-disjoint.

## V1 benchmark assets

`benchmark/test/` pins the public Live Captioning for Gurbani Kirtan v1 revision
5cfa23d583c8157e09beb07c911bc1009ae41b10. Its caption annotations are aligned;
they are distinct from the weak-label development set. Annotations CC BY4.0;
public scorer MIT. Attribution and original notices accompany the recipe.
Four original benchmark WAVs and the frozen matcher corpus archive are included
for private review, subject to separate audio/corpus redistribution rights.
Never train on the benchmark or treat its twelve correlated cases as twelve
independent recordings. Labels specify canonical lines and timing, not every
sung repetition/partial syllable; naive canonical-line WER is not official v1.

## Rights, privacy and intended sharing

**Private access only pending rights review.** Public availability of a recording
does not by itself grant redistribution permission. This card does not grant
a new license to source recordings, upstream models, labels or canonical corpus.
Do not publish personal histories, credentials or original chat/editor evidence.
The release is for expert assessment of the documented baseline and limitations.