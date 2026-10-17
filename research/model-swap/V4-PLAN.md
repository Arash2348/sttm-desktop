# Surinder Singh's speech model in Voice Autopilot: how to run v4 in one command

Branches on the fork: `model-swap-1` (app switch + export/verify scripts), `model-swap-1-vm` (VM job `x86m`).

## What exists
- App: `engine/model-manager.js` has a model list and `ASR_MODEL` (default `karanbir-int8`, no behaviour change).
  `VF_ASR_MODEL=<id>` or `VF_ASR_MODEL_PATH=<file.onnx>` picks another model. Every model honours one contract:
  audio + audio_len in, log_probs [1, F, 257] (pa pieces + blank 256, 40 ms frames) + out_len out, mel front-end inside.
- `export_app_onnx.py`: .nemo -> `model.fp32.onnx`, `model.int8.onnx`, `tokens.txt`, `tokenizer.model`, `export.json`.
  It stops if the pa tokenizer differs from the app's vocabulary (v3: byte-identical to Karanbir's, sha 63a2e8f1).
- `verify_app_onnx.py`: fp32 vs NeMo, int8 vs fp32 on 20 windows, 2-thread speed vs Karanbir int8.
- VM job `x86m`: export (if needed) + verify + share files in Azure `bench-models/` + record and score every GAB tier,
  practice and test, per precision, in the model's own cache namespace. Scorecards: Azure
  `bench-results/x86-cards/<build>-s<tag><prec>/<tier>-<dev|test>.json`.

## v4, once Surinder Singh grants access
1. Accept access on huggingface.co/surindersinghssj/indicconformer-pa-v4-kirtan with the account whose token is in the
   VM's Secret Manager secret `vf-hf-token` (or replace that secret with a token of the account that has access).
2. Check the file name in the repo (expected `indicconformer-pa-v4-kirtan.nemo`; his run log calls the checkpoint
   `indicconformer-pa-v3-kirtan.nemo`), then run (one command, from a checkout of `model-swap-1-vm`):
   ```
   G=~/google-cloud-sdk/bin/gcloud; $G compute instances add-metadata vf-record-2 --zone us-east1-b \
     --metadata '^;^cg-job=x86m-v4-1;cg-mstag=v4;cg-nemo=surindersinghssj/indicconformer-pa-v4-kirtan/<file>.nemo;cg-precs=int8;cg-fill=aarti906;cg-score=aarti906;cg-builds=;cg-suites=;cg-test=;cg-branch=model-swap-1-vm' \
     --metadata-from-file startup-script=research/cloud-gab/vm/vm-startup.sh && $G compute instances start vf-record-2 --zone us-east1-b
   ```
   The VM stops itself at the end (or at 6 h; start it again with the same metadata to resume).
3. Progress: `$G compute instances get-serial-port-output vf-record-2 --zone us-east1-b | grep CGJOB`.
   Results: `node research/cloud-gab/results-sync.js pull --prefix bench-results/x86-cards --dir <dir>`; compare
   `aarti906-sv4int8` with `aarti906` (current model) and `aarti906-sv3int8`.
4. If v4 uses a different tokenizer the export stops with "pa slice ... != pa tokenizer" or the app-vocabulary check:
   then the app needs that model's vocab/pieces (not built; v3 and v4 share the base model's tokenizer per his config,
   `update_tokenizer: false`).
5. To ship any of these models: host the exported file (e.g. a Khalis Foundation HF repo; Apache-2.0 allows it with
   attribution), fill `url` in `MODELS`, set `ASR_MODEL`, update the CI model download in build-*.yml.

## Message to send Bhai Surinder Singh

> Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh Bhai Surinder Singh Ji,
>
> I work on Voice Autopilot in SikhiToTheMax (Khalis Foundation): it listens to kirtan and paath and puts the right
> pangti on screen by itself. We have tested your indicconformer-pa-v3-kirtan inside the app on our benchmark (GAB:
> kirtan, paath, sung Bani such as Aarti, Akhand Paath, Akhand Kirtan), exported to ONNX with your pa-only CTC approach.
>
> Could you give us read access to surindersinghssj/indicconformer-pa-v4-kirtan (HF account: <owner's HF user name>)?
> We would run the same test and share every number with you, per track.
>
> Licence: v3 is Apache-2.0. Could you confirm v4 is under the same licence, and that we may ship it (ONNX export,
> int8) inside SikhiToTheMax, free for the sangat, with credit to you on the model card and in the app's about page?
> If you prefer, we can host the export only in a Khalis Foundation repo with your name on it, or not redistribute
> it until you say so.
>
> Bhul chuk maaf. Thank you for your seva.
