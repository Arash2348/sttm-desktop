#!/usr/bin/env python3
"""emit_mms1b.py <id> <audio.wav> [...]   (2026-10-23, GAB independent-aligner feasibility, second model)

Frame-level Gurmukhi character log-probabilities (50 frames/s) from Meta MMS-1B-all with its public Punjabi
adapter (facebook/mms-1b-all @3d33597, adapter.pan; trained on MMS-lab / FLEURS / CommonVoice style generic speech).
NOT the app's speech model and nothing from its caches. Output: out/emis-mms1b/<id>.npy (float16) + vocab.json.
"""
import json, os, sys, time
import numpy as np, soundfile as sf, torch, torchaudio
from transformers import Wav2Vec2ForCTC, Wav2Vec2CTCTokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
M = f'{HERE}/models/mms-1b-all'
torch.set_num_threads(int(os.environ.get('INDEP_THREADS', '4')))
OUT = f'{HERE}/out/emis-mms1b'; os.makedirs(OUT, exist_ok=True)
CH, CTX = 30.0, 2.0
LIMIT = float(os.environ.get('INDEP_LIMIT_S', '0'))

def main():
    tok = Wav2Vec2CTCTokenizer.from_pretrained(M, target_lang='pan')
    voc = tok.get_vocab()
    json.dump(voc, open(f'{OUT}/vocab.json', 'w'), ensure_ascii=False)
    model = None
    args = sys.argv[1:]
    for rid, wav in zip(args[0::2], args[1::2]):
        dst = f'{OUT}/{rid}.npy'
        if os.path.exists(dst) or not os.path.exists(wav):
            continue
        if model is None:
            model = Wav2Vec2ForCTC.from_pretrained(M, target_lang='pan', ignore_mismatched_sizes=True).eval()
            model.load_adapter('pan')
        x, sr = sf.read(wav, dtype='float32', always_2d=True)
        x = torch.from_numpy(x.mean(1))
        if sr != 16000:
            x = torchaudio.functional.resample(x, sr, 16000)
        if LIMIT:
            x = x[:int(LIMIT * 16000)]
        n = x.shape[0]; t0 = time.time(); parts = []
        step, ctx = int(CH * 16000), int(CTX * 16000)
        for s in range(0, n, step):
            a, b = max(0, s - ctx), min(n, s + step + ctx)
            seg = x[a:b]
            seg = (seg - seg.mean()) / (seg.std() + 1e-7)
            with torch.inference_mode():
                e = model(seg[None]).logits[0]
            e = torch.log_softmax(e, -1).numpy()
            k0 = (s - a) // 320; k1 = k0 + (min(n, s + step) - s) // 320
            parts.append(e[k0:min(k1, e.shape[0])])
        E = np.concatenate(parts).astype(np.float16)
        np.save(dst, E)
        dur = n / 16000; el = time.time() - t0
        print(f'{rid}: {dur:.0f} s audio, {el:.0f} s compute, RTF {el/dur:.3f}, frames {E.shape[0]} x {E.shape[1]}', flush=True)

if __name__ == '__main__':
    main()
