#!/usr/bin/env python3
"""make_pack_json.py <onnx> <sentencepiece.model> <blank> <out dir> [name]
Writes a model pack the app engine can run with VF_SPEECH_MODEL=<out dir>: the ONNX (hard link or copy),
vocab.json (id -> piece, the model's output classes) and pieces.json ([{p, s}] for the app's encoder),
both read from the SentencePiece file, plus model.json. No code in the app parses .model files."""
import json, os, shutil, sys
import sentencepiece as spm
onnx, spmf, blank, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
name = sys.argv[5] if len(sys.argv) > 5 else os.path.basename(os.path.normpath(out))
sp = spm.SentencePieceProcessor(model_file=spmf)
n = sp.get_piece_size()
vocab = [sp.id_to_piece(i) for i in range(n)]
pieces = [{'p': sp.id_to_piece(i), 's': sp.get_score(i)} for i in range(n)]
os.makedirs(out, exist_ok=True)
dst = os.path.join(out, os.path.basename(onnx))
if not os.path.exists(dst):
    try: os.link(onnx, dst)
    except OSError: shutil.copyfile(onnx, dst)
json.dump(vocab, open(os.path.join(out, 'vocab.json'), 'w'), ensure_ascii=False)
json.dump(pieces, open(os.path.join(out, 'pieces.json'), 'w'), ensure_ascii=False)
json.dump({'name': name, 'onnx': os.path.basename(onnx), 'vocab': 'vocab.json', 'pieces': 'pieces.json', 'blank': blank}, open(os.path.join(out, 'model.json'), 'w'), indent=1)
print(out, 'pieces', n, 'blank', blank)
