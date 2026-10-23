# Checker 1 decoder (own copy): greedy CTC over the cached x86 model output -> timed token stream.
import wave, numpy as np, hashlib, json, sys, os, zlib
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tok'); os.makedirs(OUT, exist_ok=True)
vocab = json.load(open(os.path.expanduser('~/AAI/karansea_vocab.json')))
BLANK = 256; GRID = 4096; SR = 16000
CACHE = os.path.expanduser('~/personal/live-darbar-venues/cache/5f9e41d867de-q16-x86')
CACHE2 = os.path.expanduser('~/personal/live-darbar-venues/cache/5f9e41d867de-q16')
def tile(f, idx, fb, WIN):
    step = GRID * ((WIN + GRID - 1) // GRID); N = len(f); end = step; toks = []; hit = 0; tried = 0; cov = []; last_end = -1.0  # overlapping cache windows: keep each second once
    while end <= N:
        tried += 1; e = None
        for d in sorted(range(-15, 16), key=abs):
            e2 = end + d * GRID
            if WIN <= e2 <= N:
                k2 = hashlib.sha1(f[e2 - WIN:e2].tobytes()).hexdigest() + ':' + str(WIN)
                if k2 in idx: e = idx[k2]; wend = e2; break
        if e is not None:
            hit += 1; cov.append([round((wend - WIN) / SR, 2), round(wend / SR, 2)])
            e['fb'].seek(e['o']); buf = zlib.decompress(e['fb'].read(e['n']), -15)
            frames, rows, C = np.frombuffer(buf[:12], dtype=np.uint32)
            arg = np.frombuffer(buf[12:12 + rows * 2], dtype=np.uint16)[:frames]
            t0 = (wend - WIN) / SR; prev = -1; cov[-1][0] = max(cov[-1][0], round(last_end, 2)) if last_end > 0 else cov[-1][0]; fd = (WIN / SR) / max(1, int(frames))
            for i, a in enumerate(arg):
                a = int(a)
                if a != prev and a != BLANK and t0 + i * fd >= last_end: toks.append([round(t0 + i * fd, 2), vocab[a]])
                prev = a
            last_end = wend / SR
        end += step
    return toks, hit, tried, cov
for arg_ in sys.argv[1:]:
    cid, cache_id, audio = arg_.split('=')
    # same speech model, same q16 quantisation: the Azure x86 pull first, the local Mac q16 cache fills windows the pull lacks
    with wave.open(os.path.expanduser(audio)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, cid
        f = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    idx = {}; fbs = []
    for cdir in (os.path.join(CACHE, cache_id), os.path.join(CACHE2, cache_id)):
        if not os.path.exists(os.path.join(cdir, 'emis.bin')): continue
        binsz = os.path.getsize(os.path.join(cdir, 'emis.bin')); fbx = open(os.path.join(cdir, 'emis.bin'), 'rb'); fbs.append(fbx)
        for l in open(os.path.join(cdir, 'index.jsonl')):
            try: e = json.loads(l)
            except Exception: continue
            if e['o'] + e['n'] <= binsz and e['k'] not in idx: e['fb'] = fbx; idx[e['k']] = e
    fb = None
    from collections import Counter
    cnt = Counter(int(k.split(':')[1]) for k in idx)
    Ls = [L for L, n in cnt.most_common() if L >= 64000 and n >= 10][:3] or [64000]
    best = None
    for L in Ls:
        r = tile(f, idx, fb, L)
        if best is None or r[1] > best[1]: best = r + (L,)
    toks, hit, tried, cov, L = best
    json.dump({'id': cid, 'dur': len(f) / SR, 'tried': tried, 'hit': hit, 'L': L, 'cov': cov, 'toks': toks}, open(os.path.join(OUT, cid + '.json'), 'w'), ensure_ascii=False)
    print(cid, 'windows', tried, 'found', hit, 'L', L, 'tokens', len(toks), flush=True)
