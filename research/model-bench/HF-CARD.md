---
license: other
tags: [gurbani, benchmark, speech-recognition]
---
# GAB hearing bench: test your Gurbani speech model the way STTM uses it

Private to the khalisfoundation org. One command (`bash bench.sh`) compares **your** ONNX speech model with Karanbir's model (the one
STTM Voice Autopilot ships) on the same 47 Gurbani Autopilot Bench (GAB) clips and the same machine, and prints the
tables we share: how often the right Shabad comes up from what the model heard, per behaviour, plus letter error and
speed. You do not need the STTM app or its code.

## Run it

Needs Python 3.10+, Node 18+, about 3 GB of disk, and a Hugging Face token that can read the khalisfoundation org.

```bash
hf download khalisfoundation/sttm-model-bench --repo-type dataset --local-dir gab-hearing-bench
cd gab-hearing-bench
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export HF_TOKEN=hf_...   # or: hf auth login
PY=.venv/bin/python bash bench.sh --name my-model --onnx /path/model.int8.onnx --tokenizer /path/bpe.model --blank 512 --jobs 2
```

It ends by printing `results/my-model/summary.md`:

| Behaviour | 10 s: Karanbir | 10 s: yours | 4 s: Karanbir | 4 s: yours |
|---|---|---|---|---|
| Kirtan, mixer feed | 69.2 | 77.0 ✅ | 32.7 | 35.9 ✅ |
| Kirtan, hall laptop mic (GAB-Hard) | 20.0 | 32.2 ✅ | 4.5 | 8.2 ✅ |
| ... | | | | |

(example: jssaluja/sggs-asr-indic-v0-onnx, Apple M-series Mac). ✅ clearly better, ➖ within noise, ❌ clearly worse,
where "clear" means the 95% interval from resampling whole clips excludes 0.

**Time.** The first run downloads about 1 GB. Then four transcription passes (your model and Karanbir's, 10 s and 4 s
windows; 12,442 windows each) plus letter error: roughly 1-2 hours on a recent laptop with `--jobs 2`, much less on a
many-core machine with a higher `--jobs` (each job uses 4 threads). Re-running skips finished work. Testing a second
model reuses Karanbir's transcripts.

**What your model must look like.** ONNX on onnxruntime CPU; input `audio` (float32, 16 kHz mono, `[1, samples]`) and
`audio_len` (int64); output `log_probs` (frames x vocab, CTC) and `out_len`; a SentencePiece tokenizer; tell it the
blank id (`--blank`). If your graph takes features instead of audio, pass the audio-to-features graph as `--frontend`.
See `MODEL-GUIDE.md` for what the app needs (speed, size, behaviour during katha).

## What it measures

- **hit@5 (headline).** Each recording is listened to in overlapping windows (one per second) of 10 s (what the app searches with)
  and 4 s (what it follows lines with). Each window is decoded alone (greedy CTC), and its text is searched with the
  app's own Gurbani search (`app-search/`, copied unchanged from STTM; `app-search/SOURCE.json` names the commit) over
  the pinned STTM corpus. A hit means the true Shabad is among the top 5. For paath, any Shabad of the true Bani counts.
- **Letter error (CER), edge-tolerant.** Each human- or caption-timed pangti is transcribed and compared with its BaniDB
  text; label edges and kirtan repeats are not charged.
- **Speed.** Median ms per window at 2 threads, as on a slower Gurdwara Sahib PC.
- **Truth is never made with a speech model:** human labels or the broadcaster's own captions only.
- **Behaviours (47 clips, 12,442 s):** kirtan (mixer feed; hall laptop mic), Akhand Kirtan, paath (hall; studio), Bani
  sung as kirtan, Akhand Paath (natural speed; sped up 1.35x). Clips, models and corpus are pinned by revision and
  sha256, so a run on the same kind of CPU reproduces exactly; x86 and Apple arm64 differ slightly, which is why
  Karanbir's model is always re-run on your machine.

**This is hearing only.** It does not show how the full app follows a diwan with your model (switching, line
following, lag). In past tests, a model that heard better did not always do better in the app until the app's
settings were retuned. A model that does well here is next replayed through the app by the STTM team.

## Training data

`gab-do-not-train.csv` lists every GAB recording and its source. Please keep these out of training and say if any
overlap: a model that has heard the test clips scores higher than it should.

## Files

| File | What |
|---|---|
| `bench.sh` | the one command above |
| `fetch.py`, `infer.py`, `score.js`, `wer.py`, `latency.py`, `summary.py` | the steps it runs (each also runs alone; see the top of each file) |
| `run.sh` | the full published comparison of every registered model |
| `sample.json` | the 47 clips, their behaviour and time range, the pinned GAB revision |
| `app-search/` | STTM's search code, copied unchanged (`SOURCE.json`) |
| `corpus-97f67774fcf00cdd.json` | the search corpus (142,576 pangtis from the STTM database, Oct 12 2026), unchanged BaniDB text |
| `bani-members.json` | the Shabads of every Bani, for paath truth |
| `results/` | published runs: `published/` tables for Karanbir and Jaspal's models |
| `README-method.md` | the full method, caveats and published x86 results |

Gurbani text is taken unchanged from the STTM database (BaniDB). Questions: the STTM Voice Autopilot team.
