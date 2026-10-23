# Checker 3 (own copy): greedy-CTC decode of the cached speech-model output -> timed token stream per recording.
# usage: python3 -I decode.py <out_dir> id=cache_dir=audio.wav ...
import wave, numpy as np, hashlib, json, sys, os, zlib
from collections import Counter
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
vocab = json.load(open(os.path.expanduser('~/AAI/karansea_vocab.json')))
BLANK = 256; GRID = 4096; SR = 16000

def tile(f, idx, fb, WIN):
    step = GRID * ((WIN + GRID - 1) // GRID); N = len(f); end = step; toks = []; hit = tried = 0; cov = []
    while end <= N:
        tried += 1; e = None
        for d in sorted(range(-15, 16), key=abs):
            e2 = end + d * GRID
            if WIN <= e2 <= N:
                k2 = hashlib.sha1(f[e2 - WIN:e2].tobytes()).hexdigest() + ':' + str(WIN)
                if k2 in idx: e = idx[k2]; wend = e2; break
        if e is not None:
            hit += 1; cov.append([round((wend - WIN) / SR, 2), round(wend / SR, 2)])
            fb.seek(e['o']); buf = zlib.decompress(fb.read(e['n']), -15)
            frames, rows, C = np.frombuffer(buf[:12], dtype=np.uint32)
            arg = np.frombuffer(buf[12:12 + rows * 2], dtype=np.uint16)[:frames]
            t0 = (wend - WIN) / SR; prev = -1; fd = (WIN / SR) / max(1, int(frames))
            for i, a in enumerate(arg):
                a = int(a)
                if a != prev and a != BLANK: toks.append([round(t0 + i * fd, 2), vocab[a]])
                prev = a
        end += step
    return toks, hit, tried, cov

for arg_ in sys.argv[2:]:
    cid, cdir, audio = arg_.split('=')
    with wave.open(os.path.expanduser(audio)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, cid
        f = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    idx = {}
    binsz = os.path.getsize(os.path.join(cdir, 'emis.bin'))
    for l in open(os.path.join(cdir, 'index.jsonl')):
        try: e = json.loads(l)
        except Exception: continue
        if e['o'] + e['n'] <= binsz: idx[e['k']] = e
    fb = open(os.path.join(cdir, 'emis.bin'), 'rb')
    cnt = Counter(int(k.split(':')[1]) for k in idx)
    Ls = [L for L, n in cnt.most_common() if L >= 64000 and n >= 10][:3] or [64000]
    best = None
    for L in Ls:
        r = tile(f, idx, fb, L)
        if best is None or r[1] > best[1]: best = r + (L,)
    toks, hit, tried, cov, L = best
    json.dump({'id': cid, 'dur': len(f) / SR, 'tried': tried, 'hit': hit, 'L': L, 'cov': cov, 'toks': toks},
              open(os.path.join(OUT, cid + '.json'), 'w'), ensure_ascii=False)
    print(cid, 'windows', tried, 'found', hit, 'L', L, 'tokens', len(toks), 'dur', round(len(f) / SR), flush=True)
