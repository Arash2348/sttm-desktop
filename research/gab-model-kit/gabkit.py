#!/usr/bin/env python3
"""gabkit - score a Gurbani speech model on GAB (Gurbani Autopilot Bench) recordings, next to our reference models.

  python gabkit.py run   --name mymodel --onnx model.onnx --spm tokenizer.model [--blank 0] [--clips 2]
  python gabkit.py run   --name mymodel --hook my_model.py[:transcribe]           [--clips 2]
  python gabkit.py score --name mymodel [--clips 2]          (re-score saved transcripts, no model needed)

What it does (README.md has the plain-words version):
  1. Downloads only the audio segments it needs from the Hugging Face dataset khalisfoundation/GurbaniAutopilotBench
     (HTTP range reads of each clip's audio.wav) plus each clip's lines.csv / shabads.csv (true pangti times, Shabad ids).
  2. Runs the model on (a) every 4 s window, 1 s hop, of each segment - what the STTM app hears live - and
     (b) every whole pangti cut at its true line boundaries (1 s .. --max-pangti-s long).
  3. Scores (a) by retrieval: the app's own character-trigram search (TextIndex, ported from the app) over the Gurbani
     corpus snapshot in corpus.json.gz -> is the true Shabad in the top 5 (hit@5), and a 30 s majority vote of the
     top-1 Shabad; (b) by CER / found-CER / WER against the pangti's Gurbani text.
  4. Writes results/<name>/results.md + results.json with reference.json numbers (Karanbir int8; Surinder v3 CTC coming) on
     exactly the same segments.

Dependencies: numpy, huggingface_hub; onnxruntime + sentencepiece for --onnx. Nothing else (no Node, no app build).
"""
import argparse, csv, gzip, importlib.util, io, json, math, os, re, struct, sys, time, unicodedata
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000
WIN, HOP = 4.0, 1.0
MIN_LETTERS = 8      # the app never searches less text than this
VOTE_S = 30
TOPK = 5

# ------------------------------------------------------------------------------------------------ text --------
_NORM = re.compile(r'[\s।॥|0-9੦-੯.,;:!?-]+')
_MARKS = re.compile('[਼-੍ੑੰੱੵ]')
_PUNCT_W = re.compile(r'[।॥|0-9੦-੯.,;:!?-]+')


def norm(s):            # = the app's infer.norm / TextIndex norm (no spaces, punctuation, digits)
    return _NORM.sub('', s or '')


def base_letters(s):    # = TextIndex baseLetters (vowel signs and nasal marks dropped)
    return _MARKS.sub('', unicodedata.normalize('NFC', norm(s)))


def chars(s):           # CER units: app norm + NFC (so tokenizers that emit decomposed nukta etc. are not penalised)
    return unicodedata.normalize('NFC', norm(s))


def words(s):
    return unicodedata.normalize('NFC', _PUNCT_W.sub(' ', s or '')).split()


def lev(a, b):
    """Edit distance (insert/delete/substitute = 1) between sequences a (reference) and b (hypothesis)."""
    if not a:
        return len(b)
    prev = list(range(len(a) + 1))
    for j in range(1, len(b) + 1):
        cur = [j] + [0] * len(a)
        bj = b[j - 1]
        for i in range(1, len(a) + 1):
            cur[i] = min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (a[i - 1] != bj))
        prev = cur
    return prev[-1]


def found_edits(ref, hyp):
    """Edits to match ALL of ref against its best-matching stretch of hyp (hyp's prefix/suffix are free)."""
    n = len(ref)
    if not n:
        return 0
    prev = list(range(n + 1))
    best = n
    for j in range(1, len(hyp) + 1):
        cur = [0] + [0] * n
        hj = hyp[j - 1]
        for i in range(1, n + 1):
            cur[i] = min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (ref[i - 1] != hj))
        best = min(best, cur[n])
        prev = cur
    return best


# ------------------------------------------------------------------------------------- corpus + retrieval -----
class Corpus:
    def __init__(self, path=os.path.join(HERE, 'corpus.json.gz')):
        rows = json.load(gzip.open(path, 'rt', encoding='utf-8'))['rows']
        self.vid = np.array([r[0] for r in rows], dtype=np.int64)
        self.sid = np.array([r[1] for r in rows], dtype=np.int64)
        self.text = [r[2] for r in rows]
        self.verse = {r[0]: i for i, r in enumerate(rows)}
        self.lines_of = {}
        for r in rows:
            self.lines_of.setdefault(r[1], []).append(r[2])
        self.N = len(rows)
        ush, self.sidx = np.unique(self.sid, return_inverse=True)
        self.ush = ush
        self.indexes = [self._build(norm), self._build(base_letters)]
        self._memo, self._same = {}, {}

    def _build(self, f):
        post = {}
        for i, t in enumerate(self.text):
            for g in dict.fromkeys(_grams(f(t))):
                post.setdefault(g, []).append(i)
        return f, {g: np.array(v, dtype=np.int32) for g, v in post.items()}

    def top_shabads(self, text):
        """TextIndex.search(text, 60) as the app runs it, reduced to the top 5 distinct Shabad ids."""
        if text in self._memo:
            return self._memo[text]
        best = np.zeros(len(self.ush))
        for f, post in self.indexes:
            q = list(dict.fromkeys(_grams(f(text))))
            if len(q) < 2:
                continue
            ids, wts, weight = [], [], 0.0
            for g in q:
                p = post.get(g)
                n = 0 if p is None else len(p)
                idf = math.log(1 + self.N / (1 + n))
                weight += idf
                if n:
                    ids.append(p); wts.append(np.full(n, idf))
            if not ids:
                continue
            sc = np.bincount(np.concatenate(ids), weights=np.concatenate(wts), minlength=self.N) / weight
            np.maximum.at(best, self.sidx, sc)
        nz = np.nonzero(best)[0]
        order = nz[np.lexsort((self.ush[nz], -best[nz]))][:TOPK]
        out = [int(self.ush[k]) for k in order]
        self._memo[text] = out
        return out

    # same Gurbani in two places (e.g. a Sohila Shabad and its copy elsewhere) counts as right - the app's rule
    _HEAD = re.compile(r'ੴ|ਮਹਲਾ|ਪਾਤਿਸਾਹੀ|ਘਰੁ|^ਪਉੜੀ|^ਸਲੋਕ|^ਰਾਗੁ')
    _DUPV = {'ਆ': 'ਅ', 'ਈ': 'ਇ', 'ਊ': 'ਉ', 'ਐ': 'ਏ', 'ਔ': 'ਓ'}

    def _dup(self, s):
        out = set()
        for l in self.lines_of.get(s, []):
            if not l or self._HEAD.search(l):
                continue
            l = re.sub(r'[।॥|0-9੦-੯.,;:!?\-\s]+', '', l)
            l = re.sub('[ਾ-ੌਁ-ਃੰੱ਼੍]', '', l)
            l = re.sub('[ਆਈਊਐਔ]', lambda m: self._DUPV[m.group(0)], l)
            if len(l) >= 8:
                out.add(l)
        return out

    def same_gurbani(self, a, b):
        k = (a, b) if a < b else (b, a)
        if k not in self._same:
            A, B = self._dup(a), self._dup(b)
            small, big = (A, B) if len(A) <= len(B) else (B, A)
            ok = False
            if len(small) >= 2:
                need, hit, left = 0.8 * len(small), 0, len(small)
                for l in small:
                    left -= 1
                    if l in big or any(abs(len(l) - len(m)) <= 4 and partial_ratio(l, m) >= 90 for m in big):
                        hit += 1
                    if hit >= need:
                        ok = True; break
                    if hit + left < need:
                        break
            self._same[k] = ok
        return self._same[k]

    def is_right(self, shown, ok):
        if shown in ok:
            return True
        return any(isinstance(o, int) and self.same_gurbani(shown, o) for o in ok)


def _grams(s, n=3):
    return [s[i:i + n] for i in range(len(s) - n + 1)]


def _lcs(a, b):
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b):
            cur.append(prev[j] + 1 if x == y else max(prev[j + 1], cur[j]))
        prev = cur
    return prev[-1]


def partial_ratio(s1, s2):   # = the app's fuzz.partialRatio
    a, b = (s1, s2) if len(s1) <= len(s2) else (s2, s1)
    if not a:
        return 0
    best = 0
    for st in range(len(b) - len(a) + 1):
        best = max(best, 200 * _lcs(a, b[st:st + len(a)]) / (2 * len(a)))
        if best == 100:
            break
    return best


# ------------------------------------------------------------------------------------------------- data --------
class Data:
    def __init__(self, repo, root):
        self.repo, self.root = repo, root
        os.makedirs(os.path.join(root, 'audio'), exist_ok=True)
        self._folders = None

    def _get(self, rel):
        from huggingface_hub import hf_hub_download
        try:
            return hf_hub_download(self.repo, rel, repo_type='dataset', local_dir=os.path.join(self.root, 'hf'))
        except Exception as e:  # gated: give the fix, not a traceback
            if any(k in str(e) for k in ('401', '403', 'gated', 'Access', 'restricted')):
                sys.exit(f'Cannot read {self.repo}: run `hf auth login` and accept the dataset terms at '
                         f'https://huggingface.co/datasets/{self.repo} (approval is automatic).')
            raise

    def folder(self, clip):
        if self._folders is None:
            with open(self._get('manifest.csv'), newline='', encoding='utf-8') as f:
                self._folders = {r['id']: r['audio'].rsplit('/', 1)[0] for r in csv.DictReader(f)}
        return self._folders[clip]

    def truth(self, clip):
        out = {}
        for name in ('lines', 'shabads'):
            with open(self._get(f'{self.folder(clip)}/{name}.csv'), newline='', encoding='utf-8') as f:
                out[name] = [r for r in csv.DictReader(f) if r.get('start_s') not in ('', None) and r.get('end_s') not in ('', None)]
        return out

    def audio(self, clip, s0, s1):
        """float32 16 kHz mono samples of clip seconds [s0, s1]; fetched with range reads and cached as a wav."""
        p = os.path.join(self.root, 'audio', f'{clip}@{s0:g}-{s1:g}.wav')
        if not os.path.exists(p):
            from huggingface_hub import HfFileSystem
            fs = HfFileSystem()
            with fs.open(f'datasets/{self.repo}/{self.folder(clip)}/audio.wav', 'rb') as f:
                head = f.read(4096)
                assert head[:4] == b'RIFF' and head[8:12] == b'WAVE', clip
                pos, fmt, data = 12, None, None
                while pos + 8 <= len(head):
                    cid, size = head[pos:pos + 4], struct.unpack('<I', head[pos + 4:pos + 8])[0]
                    if cid == b'fmt ':
                        fmt = struct.unpack('<HHIIHH', head[pos + 8:pos + 24])
                    if cid == b'data':
                        data = (pos + 8, size); break
                    pos += 8 + size + (size & 1)
                assert fmt and fmt[0] == 1 and fmt[1] == 1 and fmt[2] == SR and fmt[5] == 16, (clip, fmt)
                a = int(round(s0 * SR)) * 2
                b = min(int(round(s1 * SR)) * 2, data[1])
                f.seek(data[0] + a)
                raw = f.read(b - a)
            import wave
            with wave.open(p + '.tmp', 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(raw)
            os.replace(p + '.tmp', p)
        import wave
        with wave.open(p, 'rb') as w:
            return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def segments(sample, clips_n, tiers=None):
    out = []
    for tier, t in sample['tiers'].items():
        if tiers and tier not in tiers:
            continue
        for clip, s0, s1 in t['segments'][:clips_n or None]:
            out.append({'tier': tier, 'clip': clip, 's0': float(s0), 's1': float(s1), 'id': f'{clip}@{float(s0):g}-{float(s1):g}'})
    return out


def pangtis_of(truth, s0, s1, max_s, corpus):
    out = []
    for r in truth['lines']:
        a, b = float(r['start_s']), float(r['end_s'])
        if a < s0 or b > s1 or not (1.0 <= b - a <= max_s):
            continue
        if r.get('confidence') not in (None, '') and float(r['confidence']) < 0.6:   # weak alignment: not scored
            continue
        v = int(r['verseId'])
        if v in corpus.verse:
            out.append({'v': v, 'a': a, 'b': b})
    return out


def window_truth(truth, corpus):
    sh = []
    for r in truth['shabads']:
        ids = set()
        for x in str(r['shabadId']).split('|'):
            ids.add(x if x.startswith('bani:') else int(x))
        sh.append((float(r['start_s']), float(r['end_s']), ids))
    ln = [(float(r['start_s']), float(r['end_s']), int(r['verseId'])) for r in truth['lines']]

    def ok_at(t):   # window [t-4, t]: Shabad ids true at its centre + the Shabad of any pangti it overlaps by >= 1 s
        c = t - WIN / 2
        cover = [ids for a, b, ids in sh if a <= c <= b]
        if not cover:
            return None
        ok = set().union(*cover)
        for a, b, v in ln:
            if min(t, b) - max(t - WIN, a) >= 1 and v in corpus.verse:
                ok.add(int(corpus.sid[corpus.verse[v]]))
        return ok if any(isinstance(o, int) for o in ok) else None
    return ok_at


# ------------------------------------------------------------------------------------------------ models -------
class OnnxCTC:
    """Karanbir-style ONNX: audio [1, T] float32 + audio_len [1] int64 -> log_probs [1, F, V], out_len [1]; greedy CTC."""

    def __init__(self, path, spm_path, blank=None, threads=4, names='audio,audio_len,log_probs,out_len'):
        import onnxruntime as ort, sentencepiece as spm
        o = ort.SessionOptions(); o.intra_op_num_threads = threads; o.inter_op_num_threads = 1
        self.sess = ort.InferenceSession(path, o, providers=['CPUExecutionProvider'])
        self.i_audio, self.i_len, self.o_lp, self.o_len = names.split(',')
        self.sp = spm.SentencePieceProcessor(); self.sp.Load(spm_path)
        self.blank = blank
        self.desc = f'onnx {os.path.basename(path)} + {os.path.basename(spm_path)}, greedy CTC, blank {"last" if blank is None else blank}'

    def __call__(self, w):
        lp, n = self.sess.run([self.o_lp, self.o_len], {self.i_audio: w[None, :].astype(np.float32), self.i_len: np.array([len(w)], dtype=np.int64)})
        blank = lp.shape[-1] - 1 if self.blank is None else self.blank
        ids, prev, col = lp[0, :int(n[0])].argmax(-1).tolist(), -1, []
        for i in ids:
            if i != prev and i != blank:
                col.append(int(i))
            prev = i
        return self.sp.decode(col)


class Hook:
    """Any framework: a Python file defining transcribe(audio: np.ndarray float32, 16 kHz mono) -> str."""

    def __init__(self, spec):
        path, _, fn = spec.partition(':')
        s = importlib.util.spec_from_file_location('gab_hook', os.path.abspath(path))
        m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
        self.fn = getattr(m, fn or 'transcribe')
        self.desc = f'hook {os.path.basename(path)}:{fn or "transcribe"}'

    def __call__(self, w):
        return str(self.fn(np.ascontiguousarray(w, dtype=np.float32)) or '')


# --------------------------------------------------------------------------------------------------- run -------
def run(a, data, corpus, segs):
    model = OnnxCTC(a.onnx, a.spm, a.blank, a.threads) if a.onnx else Hook(a.hook)
    od = os.path.join(a.out, a.name)
    os.makedirs(od, exist_ok=True)
    meta = {'model': model.desc, 'started': time.strftime('%Y-%m-%d %H:%M'), 'max_pangti_s': a.max_pangti_s}
    json.dump(meta, open(os.path.join(od, 'meta.json'), 'w'), indent=1)
    for k, s in enumerate(segs):
        f = os.path.join(od, f"{s['id']}.jsonl")
        if os.path.exists(f):
            continue
        pcm = data.audio(s['clip'], s['s0'], s['s1'])
        tr = data.truth(s['clip'])
        rows, t0 = [], time.time()
        t = WIN
        while t <= len(pcm) / SR + 1e-6:
            w = pcm[int(round((t - WIN) * SR)):int(round(t * SR))]
            c = time.perf_counter(); txt = model(w); ms = (time.perf_counter() - c) * 1000
            rows.append({'kind': 'win', 't': round(s['s0'] + t, 3), 'text': txt, 'ms': round(ms, 1)})
            t += HOP
        for p in pangtis_of(tr, s['s0'], s['s1'], a.max_pangti_s, corpus):
            w = pcm[int(round((p['a'] - s['s0']) * SR)):int(round((p['b'] - s['s0']) * SR))]
            try:
                txt = model(w)
            except Exception as e:   # a model that fails on a pangti scores it as empty (and says so)
                txt = ''; print(f"  ! {s['id']} pangti {p['a']}-{p['b']}: {type(e).__name__}", file=sys.stderr)
            rows.append({'kind': 'pangti', 'v': p['v'], 'a': p['a'], 'b': p['b'], 'text': txt})
        with open(f + '.tmp', 'w', encoding='utf-8') as fh:
            fh.write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
        os.replace(f + '.tmp', f)
        print(f"[{k + 1}/{len(segs)}] {s['tier']} {s['id']}: {sum(r['kind'] == 'win' for r in rows)} windows, "
              f"{sum(r['kind'] == 'pangti' for r in rows)} pangtis ({time.time() - t0:.0f} s)", flush=True)


# ------------------------------------------------------------------------------------------------- score -------
KEYS = ('win', 'hit1', 'hit5', 'usable', 'vote_right', 'vote_wrong', 'ms', 'ms_n', 'pangtis', 'empty', 'ref_c', 'edit_c', 'found_c', 'ref_w', 'edit_w')


def score_segment(rows, s, data, corpus):
    tr = data.truth(s['clip'])
    ok_at = window_truth(tr, corpus)
    st = dict.fromkeys(KEYS, 0)
    st['ms'] = 0.0
    W = [r for r in rows if r['kind'] == 'win']
    tops = [(r['t'], (corpus.top_shabads(r['text']) or [None])[0] if len(norm(r['text'])) >= MIN_LETTERS else None) for r in W]
    oks = [ok_at(r['t']) for r in W]
    j0 = 0
    for k, r in enumerate(W):
        if 'ms' in r:
            st['ms'] += r['ms']; st['ms_n'] += 1
        ok = oks[k]
        if ok is None:
            continue
        st['win'] += 1
        if len(norm(r['text'])) >= MIN_LETTERS:
            st['usable'] += 1
            top = corpus.top_shabads(r['text'])
            rank = next((i for i, x in enumerate(top) if corpus.is_right(x, ok)), -1)
            st['hit1'] += rank == 0; st['hit5'] += rank >= 0
        while j0 < len(tops) and tops[j0][0] <= r['t'] - VOTE_S:
            j0 += 1
        cnt = {}
        for t, x in tops[j0:]:
            if t > r['t']:
                break
            if x is not None:
                cnt[x] = cnt.get(x, 0) + 1
        srt = sorted(cnt.items(), key=lambda kv: -kv[1])
        if srt and srt[0][1] >= 3 and (len(srt) == 1 or srt[0][1] > srt[1][1]):
            # right = the voted Shabad was true at some point of the 30 s it votes over (paath moves Shabad every
            # few pangtis; a vote that names the Shabad read 20 s ago is lag, not a wrong Shabad)
            span = set().union(*[o for o, (t, _) in zip(oks[j0:k + 1], tops[j0:k + 1]) if o is not None])
            right = corpus.is_right(srt[0][0], span)
            st['vote_right'] += right; st['vote_wrong'] += not right
    for r in rows:
        if r['kind'] != 'pangti':
            continue
        ref = corpus.text[corpus.verse[r['v']]]
        rc, hc, rw, hw = chars(ref), chars(r['text']), words(ref), words(r['text'])
        st['pangtis'] += 1; st['empty'] += not hc
        st['ref_c'] += len(rc); st['edit_c'] += lev(rc, hc); st['found_c'] += found_edits(rc, hc)
        st['ref_w'] += len(rw); st['edit_w'] += lev(rw, hw)
    return st


def summarise(stats):
    S = dict.fromkeys(KEYS, 0)
    for st in stats:
        for k in KEYS:
            S[k] += st.get(k, 0)
    pct = lambda x, n: round(100 * x / n, 1) if n else None
    return {'segments': len(stats), 'pangtis': S['pangtis'], 'CER': pct(S['edit_c'], S['ref_c']), 'found_CER': pct(S['found_c'], S['ref_c']),
            'WER': pct(S['edit_w'], S['ref_w']), 'empty_pangti_pct': pct(S['empty'], S['pangtis']), 'windows': S['win'],
            'hit1': pct(S['hit1'], S['win']), 'hit5': pct(S['hit5'], S['win']), 'usable': pct(S['usable'], S['win']),
            'vote_right': pct(S['vote_right'], S['win']), 'vote_wrong': pct(S['vote_wrong'], S['win']),
            'ms_per_window': round(S['ms'] / S['ms_n'], 1) if S['ms_n'] else None}


def score(a, data, corpus, segs, sample):
    od = os.path.join(a.out, a.name)
    per = {}
    for s in segs:
        f = os.path.join(od, f"{s['id']}.jsonl")
        if not os.path.exists(f):
            continue
        rows = [json.loads(l) for l in open(f, encoding='utf-8') if l.strip()]
        per[s['id']] = dict(score_segment(rows, s, data, corpus), tier=s['tier'])
    ref = json.load(open(os.path.join(HERE, 'reference.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'reference.json')) else {'models': {}}
    table, tiers = [], [t for t in sample['tiers'] if any(v['tier'] == t for v in per.values())]
    for t in tiers:
        ids = [k for k, v in per.items() if v['tier'] == t]
        table.append(dict(tier=t, model=a.name, **summarise([per[k] for k in ids])))
        for rm, rv in ref['models'].items():
            have = [rv['segments'][k] for k in ids if k in rv['segments']]
            if len(have) == len(ids):   # reference only on exactly the same segments
                table.append(dict(tier=t, model=rm, **summarise(have)))
    meta = json.load(open(os.path.join(od, 'meta.json'))) if os.path.exists(os.path.join(od, 'meta.json')) else {}
    out = {'name': a.name, 'meta': meta, 'kit': {'window_s': WIN, 'hop_s': HOP, 'vote_s': VOTE_S, 'max_pangti_s': a.max_pangti_s,
           'corpus': 'corpus.json.gz', 'dataset': sample['dataset']}, 'table': table, 'segments': per}
    json.dump(out, open(os.path.join(od, 'results.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    f = lambda x: '-' if x is None else f'{x:g}'
    L = [f"# GAB model kit: {a.name}", '', f"Model: {meta.get('model', '?')}. Same segments for every row; lower CER / WER is better, higher hit@5 / vote right is better.", '',
         '| tier | model | pangtis | CER % | found-CER % | WER % | windows | hit@5 % | 30 s vote right % (wrong %) |', '|---|---|---|---|---|---|---|---|---|']
    for r in table:
        L.append(f"| {sample['tiers'][r['tier']]['label'] if r['model'] == a.name else ''} | {'**' + r['model'] + '**' if r['model'] == a.name else r['model']} | {r['pangtis']} | "
                 f"{f(r['CER'])} | {f(r['found_CER'])} | {f(r['WER'])} | {r['windows']} | {f(r['hit5'])} | {f(r['vote_right'])} ({f(r['vote_wrong'])}) |")
    ms = [r['ms_per_window'] for r in table if r['model'] == a.name and r['ms_per_window']]
    if ms:
        L += ['', f"Speed on this machine: {sum(ms) / len(ms):.0f} ms per 4 s window (not comparable across machines)."]
    open(os.path.join(od, 'results.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('\n'.join(L))
    return out


def make_reference(a, names):
    """Internal: fold full-sample results of reference models into reference.json."""
    ref = {'_doc': 'Per-segment raw counts of the reference models on the full kit sample (gabkit.py run --clips 0). '
                   'The kit sums them over whatever segments a user ran, so comparisons are always like for like.', 'models': {}}
    for spec in names:
        name, _, label = spec.partition('=')
        r = json.load(open(os.path.join(a.out, name, 'results.json'), encoding='utf-8'))
        ref['models'][label or name] = {'model': r['meta'].get('model'), 'max_pangti_s': r['kit']['max_pangti_s'],
                                        'segments': {k: {kk: v[kk] for kk in KEYS} for k, v in r['segments'].items()}}
    json.dump(ref, open(os.path.join(HERE, 'reference.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('wrote reference.json:', ', '.join(ref['models']))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['run', 'score', 'make-reference'])
    ap.add_argument('--name', help='results folder name for this model')
    ap.add_argument('--onnx', help='Karanbir-style CTC ONNX (audio, audio_len -> log_probs, out_len)')
    ap.add_argument('--spm', help='SentencePiece tokenizer .model for --onnx')
    ap.add_argument('--blank', type=int, default=None, help='CTC blank id (default: last class)')
    ap.add_argument('--hook', help='python file with transcribe(audio float32 16 kHz) -> str; file.py:func for another name')
    ap.add_argument('--clips', type=int, default=2, help='segments per tier (default 2 = quick check; 0 = all)')
    ap.add_argument('--tiers', default='', help='comma list: paath_hall,paath_studio,kirtan,hard,akhand (default all)')
    ap.add_argument('--threads', type=int, default=4)
    ap.add_argument('--max-pangti-s', type=float, default=20.0, help='longest pangti cut fed whole (default 20 s; references use 20)')
    ap.add_argument('--out', default=os.path.join(HERE, 'results'))
    ap.add_argument('--data', default=os.path.join(HERE, 'gab-data'), help='download cache')
    ap.add_argument('--refs', nargs='*', default=[], help='make-reference: name[=label] ...')
    a = ap.parse_args()
    if a.cmd == 'make-reference':
        return make_reference(a, a.refs)
    if not a.name:
        ap.error('--name is required')
    if a.cmd == 'run' and not (a.hook or (a.onnx and a.spm)):
        ap.error('run needs --onnx + --spm, or --hook')
    sample = json.load(open(os.path.join(HERE, 'sample.json'), encoding='utf-8'))
    segs = segments(sample, a.clips, set(filter(None, a.tiers.split(','))))
    data = Data(sample['dataset'], a.data)
    print('loading Gurbani corpus + search index ...', flush=True)
    corpus = Corpus()
    if a.cmd == 'run':
        run(a, data, corpus, segs)
    score(a, data, corpus, segs, sample)


if __name__ == '__main__':
    main()
