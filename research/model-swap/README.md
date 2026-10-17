# Model swap: v4 one-command plan, for when Surinder Singh grants access

Status (Oct 17 2026): v3 in-app test stopped by the owner (v3 only ~5% better CER: not worth switching).
What is here, all unfinished but working:
- App switch: `engine/model-manager.js` `ASR_MODEL` (default `karanbir-int8`, no behaviour change); `VF_ASR_MODEL` / `VF_ASR_MODEL_PATH` override.
- `export_app_onnx.py` (.nemo -> app ONNX, fp32 + int8, pa-only CTC head, mel front-end in the graph) and `verify_app_onnx.py`.
  v3 check (20 windows): fp32 = NeMo 20/20; int8 vs fp32 2.0% letters differ; 2 threads x86 RTF v3 int8 0.033, fp32 0.046, Karanbir int8 0.031.
- VM job `x86m` on branch `model-swap-1-vm`. Steps and the message to Surinder Singh: `V4-PLAN.md`.
