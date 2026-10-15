---
name: model-provenance
description: "Who made the acoustic model (karansea-shabad-ctc), its license, float weights, and the author's write-up/benchmark"
metadata:
  node_type: memory
  type: project
  originSessionId: ede5f9e7-b768-4c63-88a2-750e7d398289
  modified: 2026-09-28T20:25:21.784Z
---

`karansea/indicconformer-stt-pa-ctc-shabad-preview` on Hugging Face, by Karanbir Singh ("karansea"). Model card read
2026-09-28:
- License: MIT. CTC-only finetune of ai4bharat/indicconformer_stt_pa_hybrid_ctc_rnnt_large (MIT), trained April 2026.
- Files: model.int8.onnx (184 MB, what the app downloads), model.onnx (480 MB FP32), tokenizer.model, edge-vocab.json.
- No formal paper. Write-up: https://www.karanbirsingh.com/gurbani-captioning/ ; prototype https://bani.karanbirsingh.com ;
  benchmark repo https://github.com/karanbirsingh/live-gurbani-captioning-benchmark-v1
- Still unknown: exact training recipe/data (check the write-up before any fine-tuning).

Related: [[level3-policy]], [[verified-data-home]]

**Candidate models (user, Oct 14 2026):** (1) Karanbir's, in production: https://huggingface.co/karansea/indicconformer-stt-pa-ctc-shabad-preview; (2) Surinder Singh's: https://huggingface.co/surindersinghssj/indicconformer-pa-v3-kirtan (use fp32; int8 broken); (3) Jaspal Singh Saluja's new model, link pending; (4) Sukhpal Singh's fine-tune of Karanbir's: https://huggingface.co/sukhpalsingh/baniguru_v1. The hearing-score diagnostic (results/HEARING.md, tools/hearing-score) compares them; a model switch needs strictly-better evidence on GAB.
