# Benchmark a new speech model: step by step (for a person or an AI agent)

Goal: answer "is model X better than Karanbir's model in STTM Voice Autopilot?" with numbers that anyone can
reproduce. Two stages. **model-bench** checks how well the model hears on its own (about 1 h). **GAB** checks how
well the whole app keeps the right Gurbani on screen with that model inside it (minutes from the cache, a few hours
to record a new model's output once). Background and rules: [BENCHMARKS.md](BENCHMARKS.md) and
[model-bench/MODEL-GUIDE.md](model-bench/MODEL-GUIDE.md).

Give an agent this file and say: "Benchmark `<model repo or files>` against Karanbir's model by following
research/BENCHMARK-A-MODEL.md, and report the tables from step 7."

## Rules (read first)

- Never train or tune on GAB `test` clips. `--split test` is only for the final reported numbers.
  `model-bench/gab-do-not-train.csv` lists clips that must stay out of training data.
- Answer keys come from people (or the sevadaar's screen), never from a speech model.
- Never print tokens (`~/.vf-hf-token`, `~/.vf-azure-sas`). HF data stays private to the khalisfoundation org.
- Write to Azure only under `bench-cache/` (what `gab fill` pushes).
- Gurbani text is never written or changed: everything refers to pangtis by verse id.
- Record model output on **x86-64** (Linux or Intel). That is the reference. Arm Macs agree on rankings but are not
  byte-identical.

## 0. Setup (once)

```bash
git clone https://github.com/KhalisFoundation/sttm-desktop && cd sttm-desktop && git checkout experimental-release
npm ci                                       # Node 20; if realm/better-sqlite3 fail to load: npm rebuild <name> --build-from-source
python3 -m venv research/model-bench/.venv && research/model-bench/.venv/bin/pip install -r research/model-bench/requirements.txt
```

Also needed:
- `~/.vf-hf-token`: an HF read token for the khalisfoundation org.
- `~/.vf-azure-sas`: Azure bench-cache access (write access lets `gab fill` share what it records).
- STTM's Gurbani database. Open STTM once on this machine, or set `VF_BANIDB_USER_DATA` to a folder that has
  `sttmdesktop-evergreen-v2.realm` and `realm-schema-evergreen.json`. `gab` stops with this message when it is missing.
- GAB answer keys and test lists (`VF_GAB_DATA`). They are kept out of this public repo; they come with the private
  GAB data.

## 1. Make a model pack

A pack is a folder: the ONNX, the model's own SentencePiece `.model`, and a `model.json`:

```json
{ "name": "jaspal-v3", "onnx": "model.int8.onnx", "tokenizer": "bpe.model", "blank": 0 }
```

- The ONNX takes `audio` (float32, 16 kHz mono, shape [1, samples]) and `audio_len` (int64), and returns `log_probs`
  (CTC, [1, frames, classes]) and `out_len`.
  - Other names: add `"io": {"audio": ..., "audioLen": ..., "logProbs": ..., "outLen": ...}`.
  - A model that takes features: add `"frontend": {"onnx": ..., "features": ..., "featuresLen": ...}`. See
    `model-bench/make_packs.sh` for Jaspal v2.
- `blank` is the CTC blank id. Output class `i` must be tokenizer piece `i`.
- `model-bench/make_packs.sh` builds packs for the published models that `fetch.py` downloads.

## 2. Check the pack (2 minutes)

```bash
cd research/model-bench && .venv/bin/python fetch.py          # clips + published models (once, about 1.4 GB)
node check_pack.js <pack folder>                              # must print 24/24 windows identical
```

This runs the same 10 s windows through the app's engine and through `infer.py`. Anything less than all identical
means a wrong `blank`, tokenizer, front-end or `io` name. Fix the pack before going on.

## 3. model-bench (step A of MODEL-GUIDE section 5, about 1 h)

```bash
.venv/bin/python infer.py --onnx <pack>/<onnx> --spm <pack>/<tokenizer> --blank <id> --name <name>-w10 --win 10
node score.js            # hit@5 per behaviour vs Karanbir;  .venv/bin/python wer.py  for WER/CER;  latency.py 2  for speed
```

Pass if no behaviour is clearly worse than Karanbir's and latency is no worse. If it fails, stop and report.

## 4. Record the model's output for GAB (once per model; x86)

```bash
cd ../level2-dataset/tools
VF_SPEECH_MODEL=<pack> ./gab fill --root upstream --tier smoke --jobs 4      # 9 clips first
VF_SPEECH_MODEL=<pack> ./gab fill --root upstream --jobs 4                   # then every train + dev clip (hours)
```

`gab fill` first pulls anything already in the shared cache and records only the rest. It records train + dev only
(add `--split test` only for final numbers). It pushes to Azure unless `--no-push`; without write access, use
`--no-push`. The cache is keyed by the ONNX file's sha256, so each model gets its own and nothing is overwritten.

## 5. Score both models on the same build

```bash
./gab run upstream --tier full --out /tmp/gab-karanbir
VF_SPEECH_MODEL=<pack> ./gab run upstream --tier full --out /tmp/gab-<name>
./gab compare --cards /tmp/gab-karanbir/scorecard.json /tmp/gab-<name>/scorecard.json --name-a karanbir --name-b <name>
```

Optional tiers, the same way: `--set hard` (GAB-Hard, hall laptop mic) and `--set akhand` (Akhand Kirtan).
**INCOMPLETE** means some clip's model output is missing: run step 4 for it, then score again.

## 6. Prove it repeats

```bash
VF_SPEECH_MODEL=<pack> ./gab run upstream --tier smoke --out /tmp/gab-<name>-a
VF_SPEECH_MODEL=<pack> ./gab run upstream --tier smoke --out /tmp/gab-<name>-b
./gab compare --cards /tmp/gab-<name>-a/scorecard.json /tmp/gab-<name>-b/scorecard.json   # every number identical
```

Stronger: record the smoke clips twice into two empty caches (`VF_EMIS_CACHE=<empty dir>` with `--no-push`) and
compare them. Jaspal v2 gave identical bytes on 3,094 of 3,094 windows.

## 7. Report

Two tables, plus the build commit and both model sha256s (printed on every scorecard):

1. **model-bench:** hit@5 per behaviour, CER, latency (ms per 10 s window at 2 threads). Karanbir vs the new model.
2. **GAB, per behaviour:** right Shabad/Bani %, sangat sees the right pangti %, wrong-Shabad seconds per hour, time to
   find p50/p90, and clips per behaviour. Karanbir vs the new model.

Say plainly:
- The app's settings were tuned on Karanbir's model, so a close result may improve after tuning for the new model
  (on `dev`, never `test`).
- Which numbers rest on fewer than 3 clips.

The bar for shipping a model is MODEL-GUIDE section 5: no behaviour worse in GAB, then a live test by the owner.
