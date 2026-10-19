#!/bin/bash
# Internal: how reference.json was made (full sample, Mac, nice 19). Outside users never need this.
set -euo pipefail
cd "$(dirname "$0")/.."
nice -n 19 ~/AAI/voice-venv/bin/python gabkit.py run --clips 0 --threads 2 --name karanbir-int8 \
  --onnx ~/AAI/models/karansea-shabad-ctc/model.int8.onnx --spm ~/AAI/models/karansea-shabad-ctc/tokenizer.model
nice -n 19 ~/AAI/nemo-venv/bin/python gabkit.py run --clips 0 --name surinder-v3-ctc --hook reference/surinder_hook.py
~/AAI/voice-venv/bin/python gabkit.py make-reference --refs "karanbir-int8=Karanbir int8 (app model)" "surinder-v3-ctc=Surinder v3 CTC"
