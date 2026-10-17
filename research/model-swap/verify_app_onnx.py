#!/usr/bin/env python3
"""verify_app_onnx.py - checks an exported app ONNX (export_app_onnx.py) on N real windows:
  1. fp32 ONNX vs the NeMo modules (PyTorch reference): greedy text identical, max |log-prob diff|
  2. int8 ONNX vs fp32 ONNX: greedy text identical, character edit distance, mean |diff| of exp(max lp) (confidence)
  3. CPU speed at --threads (default 2) on 10 s windows (the app's recognizer window): ms per window and RTF,
     for every model given with --speed (e.g. Karanbir's int8).
Usage: python verify_app_onnx.py --nemo m.nemo --dir out_dir --wavs a.wav,b.wav,... [--n 20] [--speed name=path ...]
"""
import argparse, json, os, sys, time, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SR = 16000


def read_wav(p):
    with wave.open(p, 'rb') as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, p
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def greedy(lp, blank):
    ids = lp.argmax(-1)
    out, prev = [], -1
    for i in ids.tolist():
        if i != prev and i != blank:
            out.append(i)
        prev = i
    return out


def ed(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)]


def session(path, threads):
    import onnxruntime as ort
    o = ort.SessionOptions()
    o.intra_op_num_threads = threads
    o.inter_op_num_threads = 1
    o.add_session_config_entry('session.intra_op.allow_spinning', '0')
    return ort.InferenceSession(path, o, providers=['CPUExecutionProvider'])


def run(sess, w):
    lp, n = sess.run(['log_probs', 'out_len'], {'audio': w[None, :], 'audio_len': np.array([len(w)], dtype=np.int64)})
    return lp[0, :int(n[0])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--nemo')
    ap.add_argument('--dir', required=True)
    ap.add_argument('--wavs', required=True)
    ap.add_argument('--n', type=int, default=20)
    ap.add_argument('--win', type=float, default=10.0)
    ap.add_argument('--threads', type=int, default=2)
    ap.add_argument('--speed', nargs='*', default=[])
    a = ap.parse_args()
    import sentencepiece as spm
    sp = spm.SentencePieceProcessor()
    sp.Load(os.path.join(a.dir, 'tokenizer.model'))
    blank = sp.get_piece_size()
    wavs = a.wavs.split(',')
    # N windows spread over the recordings (round robin, evenly spaced inside each), lengths 10 s plus a few odd ones
    per = [[] for _ in wavs]
    for i in range(a.n):
        per[i % len(wavs)].append(i)
    wins = []
    for wi, p in enumerate(wavs):
        pcm = read_wav(p)
        k = len(per[wi])
        for j in range(k):
            L = int(a.win * SR) if (len(wins) % 5) else int((2.5 + 1.7 * (len(wins) % 3)) * SR) + 37  # some odd lengths
            s = int((len(pcm) - L) * (j + 1) / (k + 1))
            wins.append((os.path.basename(p), round(s / SR, 1), pcm[s:s + L].copy()))
    f32 = session(os.path.join(a.dir, 'model.fp32.onnx'), 4)
    i8 = session(os.path.join(a.dir, 'model.int8.onnx'), 4)
    ref = None
    if a.nemo:
        import torch
        torch.set_num_threads(4)
        from export_app_onnx import load_nemo, reference
        M = load_nemo(a.nemo)
        ref = lambda w: reference(M, w)
    rows = []
    for name, t, w in wins:
        lf = run(f32, w)
        li = run(i8, w)
        tf, ti = sp.decode(greedy(lf, blank)), sp.decode(greedy(li, blank))
        r = {'clip': name, 't': t, 'sec': round(len(w) / SR, 2), 'frames': lf.shape[0], 'fp32': tf, 'int8': ti,
             'int8_same': tf == ti, 'int8_ed': ed(tf, ti), 'chars': len(tf),
             'conf_fp32': float(np.exp(lf.max(-1)).mean()), 'conf_int8': float(np.exp(li.max(-1)).mean()),
             'int8_max_lp_diff': float(np.abs(lf - li).max())}
        if ref:
            lr = ref(w)
            tr = sp.decode(greedy(lr, blank))
            r.update({'ref': tr, 'fp32_same_as_ref': tr == tf, 'fp32_max_lp_diff_vs_ref': float(np.abs(lr - lf).max()) if lr.shape == lf.shape else None})
        rows.append(r)
        print(json.dumps(r, ensure_ascii=False))
    s = {'windows': len(rows),
         'int8_text_identical': sum(r['int8_same'] for r in rows),
         'int8_char_ed_total': sum(r['int8_ed'] for r in rows), 'fp32_chars_total': sum(r['chars'] for r in rows),
         'int8_char_diff_pct': round(100 * sum(r['int8_ed'] for r in rows) / max(1, sum(r['chars'] for r in rows)), 2),
         'conf_mean_abs_diff': round(float(np.mean([abs(r['conf_fp32'] - r['conf_int8']) for r in rows])), 4)}
    if ref:
        s['fp32_text_identical_to_nemo'] = sum(r['fp32_same_as_ref'] for r in rows)
        s['fp32_max_lp_diff_vs_nemo'] = max((r['fp32_max_lp_diff_vs_ref'] or 0) for r in rows)
    # speed: 10 s windows, --threads, after 2 warm-up passes
    speed = {}
    ten = [w for _, _, w in wins if len(w) == int(a.win * SR)][:8]
    models = [('v-fp32', os.path.join(a.dir, 'model.fp32.onnx')), ('v-int8', os.path.join(a.dir, 'model.int8.onnx'))]
    models += [tuple(x.split('=', 1)) for x in a.speed]
    for nm, pth in models:
        ss = session(pth, a.threads)
        for w in ten[:2]:
            run(ss, w)
        ms = []
        for rep in range(2):
            for w in ten:
                t0 = time.perf_counter()
                run(ss, w)
                ms.append((time.perf_counter() - t0) * 1000)
        med = float(np.median(ms))
        speed[nm] = {'threads': a.threads, 'windows': len(ms), 'median_ms_per_10s_window': round(med, 1), 'rtf': round(med / 1000 / a.win, 4)}
        print(nm, speed[nm])
    s['speed'] = speed
    print('SUMMARY', json.dumps(s))
    json.dump({'summary': s, 'rows': rows}, open(os.path.join(a.dir, 'verify.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
