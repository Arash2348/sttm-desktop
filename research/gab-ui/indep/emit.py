#!/usr/bin/env python3
"""emit.py <id> <audio.wav> [...]   (2026-10-23, GAB independent-aligner feasibility)

Frame-level character log-probabilities (50 frames/s) from Meta MMS forced-alignment model
(torchaudio.pipelines.MMS_FA, public, trained on generic multilingual read speech; uroman alphabet).
NOT the app's speech model and nothing from its caches. Output: out/emis/<id>.npy (float16, T x 29).
Run at low priority: nice -n 19, torch threads = 4.
"""
import os, sys, time
import numpy as np, soundfile as sf, torch, torchaudio

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault('TORCH_HOME', f'{HERE}/models')
torch.set_num_threads(int(os.environ.get('INDEP_THREADS', '4')))
OUT = f'{HERE}/out/emis'; os.makedirs(OUT, exist_ok=True)
CH, CTX = 30.0, 2.0  # seconds per chunk, context each side (dropped)

def main():
    args = sys.argv[1:]
    model = None
    for rid, wav in zip(args[0::2], args[1::2]):
        dst = f'{OUT}/{rid}.npy'
        if os.path.exists(dst):
            continue
        if model is None:
            model = torchaudio.pipelines.MMS_FA.get_model(with_star=False).eval()
        if not os.path.exists(wav):
            print(f"{rid}: missing audio {wav}", flush=True); continue
        x, sr = sf.read(wav, dtype='float32', always_2d=True)
        x = torch.from_numpy(x.mean(1))
        if sr != 16000:
            x = torchaudio.functional.resample(x, sr, 16000)
        n = x.shape[0]; t0 = time.time(); parts = []
        step, ctx = int(CH * 16000), int(CTX * 16000)
        for s in range(0, n, step):
            a, b = max(0, s - ctx), min(n, s + step + ctx)
            with torch.inference_mode():
                e, _ = model(x[a:b][None])
            e = torch.log_softmax(e[0], -1).numpy()
            # frame k covers samples ~ k*320; keep frames belonging to [s, s+step)
            k0 = (s - a) // 320; k1 = k0 + (min(n, s + step) - s) // 320
            parts.append(e[k0:min(k1, e.shape[0])])
        E = np.concatenate(parts).astype(np.float16)
        np.save(dst, E)
        dur = n / 16000; el = time.time() - t0
        print(f'{rid}: {dur:.0f} s audio, {el:.0f} s compute, RTF {el/dur:.3f}, frames {E.shape[0]}', flush=True)

if __name__ == '__main__':
    main()
