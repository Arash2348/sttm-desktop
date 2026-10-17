# Voice / instrument separation (htdemucs) of GAB recordings: writes <id>.wav (vocals only, 16 kHz mono int16)
import sys, os, numpy as np, soundfile as sf, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
torch.set_num_threads(4)
m = get_model('htdemucs'); m.eval()
vi = m.sources.index('vocals')
for f in sys.argv[2:]:
    out = os.path.join(sys.argv[1], os.path.basename(f))
    if os.path.exists(out): continue
    x, sr = sf.read(f, dtype='float32', always_2d=True)          # the GAB wavs are 16 kHz mono
    x = x.mean(1)
    up = torch.from_numpy(np.interp(np.arange(0, len(x), sr / 44100), np.arange(len(x)), x).astype(np.float32))
    wav = up[None].repeat(2, 1)[None]                            # (1, 2, T) at 44.1 kHz
    with torch.no_grad():
        s = apply_model(m, wav, split=True, overlap=0.1, progress=False)[0, vi].mean(0).numpy()
    back = np.interp(np.arange(0, len(s), 44100 / 16000), np.arange(len(s)), s)
    back = back / max(1e-6, np.abs(back).max()) * 0.9
    sf.write(out, (back * 32767).astype(np.int16), 16000, subtype='PCM_16')
    print('done', os.path.basename(f), flush=True)
