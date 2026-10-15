# Upload the audited pangti keys to the GAB dataset (one command, needs a WRITE token in env HF_TOKEN)

    bash research/cloud-gab/lines/hf-upload/upload.sh            # builds the files, shows the counts, opens a dataset PR
    bash research/cloud-gab/lines/hf-upload/upload.sh --main     # commit straight to main instead (owner OK required)

Builds from Azure gab-lines/ (results-sync pull): for every recording without human / publisher-slide line keys,
lines.csv = the auto-accepted rows, source `aligned-2model-audited`; manifest lines_n / lines_source updated;
human-verdicts/pangti-spot-check/ (owner 20/20, Oct 15 2026); one line on the dataset card. Refuses if the
manifest on Hugging Face changed since the keys were built.
