#!/usr/bin/env python3
"""Independent checker 2, label batches 1 and 2 (GAB pangti candidates).

Usage: BATCH=batch2 CHK_WORK=<dir with emis/<id>.f32> python -I identify.py [recording ...]   (needs numpy + rapidfuzz)
then   BATCH=batch2 CHK_WORK=<dir> VOTES_OUT=../../votes/batch2-checker2.json python -I decide.py

For every candidate span: (1) identify the pangti myself from fresh full-clip speech-model emissions
(forced CTC alignment with repeats + free boundaries, scored as explanatory gain over a garbage baseline,
against ALL pangtis of the keyed Shabad, every pangti any candidate in the recording names, and the best
competitors from the whole Gurbani corpus found by a trigram search over the heard text), (2) lens B timing:
best-fit boundaries of the chosen pangti inside [start-6, end+6] (clipped at the neighbouring spans) vs the
candidate's boundaries, (3) a calibrated confidence. Writes raw features per span to feats.json.
"""
import json, os, re, sys, pickle, math
import numpy as np
from rapidfuzz import fuzz

SCR = os.environ.get('CHK_WORK') or os.path.dirname(os.path.abspath(__file__))  # emis/<id>.f32 (labels/tools/emis2.js karanbir), feats-<id>.json, postings.pkl
GAB = '/Users/asingh02/personal/sttm-ws3/research/gab-ui'
C, BLANK, FPS = 257, 256, 25
GARBAGE, ENTER_MID, LEAVE_MID, REPEAT, TOKEN_FLOOR, BLANK_SCALE = -1.2, -3.0, -3.0, -3.0, -6.0, 3.0
PAD_S = 6.0

vocab = json.load(open(os.path.expanduser('~/AAI/karansea_vocab.json')))
pieces = json.load(open(os.path.expanduser('~/AAI/karansea_pieces.json')))
PID = {e['p']: i for i, e in enumerate(pieces)}
PSC = {e['p']: e['s'] for e in pieces}

def sp_encode(text):
    syms = list('▁' + (text or '').replace(' ', '▁'))
    if not syms: return []
    while True:
        best, bi = -1e9, -1
        for i in range(len(syms) - 1):
            sc = PSC.get(syms[i] + syms[i + 1])
            if sc is not None and sc > best: best, bi = sc, i
        if bi < 0: break
        syms[bi:bi + 2] = [syms[bi] + syms[bi + 1]]
    return [PID.get(s, 0) for s in syms]

ORD = {'੧': 'ਪਹਿਲਾ', '੨': 'ਦੂਜਾ', '੩': 'ਤੀਜਾ', '੪': 'ਚਉਥਾ', '੫': 'ਪੰਜਵਾ', '੯': 'ਨਾਵਾ'}
def spoken(u):
    u = (u or '').replace('ੴ', 'ਇਕ ਓਅੰਕਾਰ ')
    u = re.sub(r'(ਮਹਲਾ|ਮਃ)\s*([੧-੯])(?![੦-੯])', lambda m: f"ਮਹਲਾ {ORD.get(m.group(2), '')} ", u)
    u = re.sub(r'ਪਾਤਿਸ਼ਾਹੀ\s*੧੦', 'ਪਾਤਿਸ਼ਾਹੀ ਦਸਵੀ ', u)
    u = re.sub(r'[॥।]|[0-9੦-੯]+', ' ', u)
    return ' '.join(u.split())

DROP = re.compile(r'[\s।॥|0-9੦-੯.,;:!?\-▁ੱੰਂ]+')
def norm(s): return DROP.sub('', s or '')

# ---- corpus + trigram postings over pangtis
corpus = json.load(open(os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')))
verse = {r['verseId']: r for r in corpus}
by_shabad = {}
for r in corpus:
    for s in (r.get('shabadIds') or [r['shabadId']]):
        by_shabad.setdefault(s, []).append(r['verseId'])
PK = os.path.join(SCR, 'postings.pkl')
if os.path.exists(PK):
    post, idf, ntext = pickle.load(open(PK, 'rb'))
else:
    ntext = {r['verseId']: norm(spoken(r['text'])) for r in corpus}
    post = {}
    for v, t in ntext.items():
        for g in {t[j:j + 3] for j in range(len(t) - 2)}:
            post.setdefault(g, []).append(v)
    post = {g: np.array(v, dtype=np.int32) for g, v in post.items()}
    N = len(corpus)
    idf = {g: math.log(N / (1 + len(v))) for g, v in post.items()}
    pickle.dump((post, idf, ntext), open(PK, 'wb'))
MAXV = max(verse) + 1

def search(heard, k=25):
    h = norm(heard)
    gs = {h[j:j + 3] for j in range(len(h) - 2)} & post.keys()
    if not gs: return []
    ix = np.concatenate([post[g] for g in gs]); w = np.concatenate([np.full(len(post[g]), idf[g]) for g in gs])
    sc = np.bincount(ix, weights=w, minlength=MAXV)
    top = np.argpartition(-sc, k)[:k]
    return [int(i) for i in top if sc[i] > 0]

# ---- CTC alignment of one pangti (with repeats) inside a window, free boundaries
def align(lp, ids):
    """lp: (T, C) log-probs of the window. ids: token ids. Returns dict(total, gain, start, end, conf, frames)."""
    T = lp.shape[0]
    U = len(ids)
    ext = [BLANK]
    for i in ids: ext += [i, BLANK]
    S = len(ext); ext = np.array(ext)
    k = np.arange(S)
    tok = ext != BLANK
    em = lp[:, ext].copy()
    em[:, ~tok] *= BLANK_SCALE
    em[:, tok] = np.maximum(em[:, tok], TOKEN_FLOOR)
    NEG = -1e30
    can2 = np.zeros(S, bool)  # skip over blank when neighbouring tokens differ
    for s in range(3, S):
        if ext[s] != BLANK and ext[s] != ext[s - 2]: can2[s] = True
    entry = np.where(k <= 1, 0.0, ENTER_MID)
    leave = np.where((k == S - 1) | (k == S - 2), 0.0, LEAVE_MID)
    # garbage (audio not explained by this pangti) is never worse than sitting on the pangti's blank state, so the
    # alignment does not swallow silence / other singing just to avoid the garbage cost; a small epsilon makes
    # entering and leaving the text as tight as possible around the sung tokens
    g = np.maximum(lp[:, BLANK] * BLANK_SCALE, GARBAGE) + 0.05
    prev = entry + em[0]
    bp = np.zeros((T, S), np.int8)       # 0 stay 1 s-1 2 s-2 3 from pre 4 repeat
    pre = np.empty(T); pre[0] = g[0]
    postv = np.empty(T); postv[0] = NEG; postfrom = np.full(T, -1, np.int32)
    repfrom = np.zeros(T, np.int32)
    for t in range(1, T):
        best = prev.copy(); code = np.zeros(S, np.int8)
        a = np.full(S, NEG); a[1:] = prev[:-1]
        m = a > best; best[m] = a[m]; code[m] = 1
        a = np.full(S, NEG); a[2:] = prev[:-2]; a[~can2] = NEG
        m = a > best; best[m] = a[m]; code[m] = 2
        # enter from pre
        a = pre[t - 1] + entry
        m = a > best; best[m] = a[m]; code[m] = 3
        # repeat: from exit states back to k<=1
        ex = max(prev[S - 1], prev[S - 2]); exs = S - 1 if prev[S - 1] >= prev[S - 2] else S - 2
        r = ex + REPEAT
        for s0 in (0, 1):
            if r > best[s0]: best[s0] = r; code[s0] = 4
        repfrom[t] = exs
        cur = best + em[t]
        bp[t] = code
        pre[t] = pre[t - 1] + g[t]
        lv = prev + leave
        j = int(np.argmax(lv))
        if lv[j] > postv[t - 1]: postv[t] = lv[j] + g[t]; postfrom[t] = j
        else: postv[t] = postv[t - 1] + g[t]
        prev = cur
    lv = prev + leave; j = int(np.argmax(lv))
    if lv[j] > postv[T - 1]: total, t, s = lv[j], T - 1, j
    else:
        total = postv[T - 1]; t = T - 1
        while t > 0 and postfrom[t] < 0: t -= 1
        s = postfrom[t]; t -= 1
        if t < 0: return None
    end = t
    # backtrack inside the text
    tokframes = []; start = None
    while True:
        if ext[s] != BLANK: tokframes.append((t, ext[s]))
        c = bp[t, s]
        if t == 0: start = 0; break
        if c == 3: start = t; break
        if c == 4: s = repfrom[t]; t -= 1; continue
        s -= int(c); t -= 1
    gain = total - float(g.sum())
    if tokframes:
        conf = float(np.mean([lp[tt, ii] for tt, ii in tokframes]))
    else: conf = -30.0
    return dict(total=float(total), gain=float(gain), start=start, end=end, conf=conf, ntok=len(tokframes), U=U)

def greedy(lp):
    arg = lp.argmax(1); out = []; prev = -1
    for i, a in enumerate(arg):
        a = int(a)
        if a != prev and a != BLANK: out.append((i, vocab[a]))
        prev = a
    return out

def heard_text(toks, f0, f1):
    return ''.join(p for f, p in toks if f0 <= f < f1).replace('▁', ' ').strip()

BATCH = os.environ.get('BATCH', 'batch1')
cands = json.load(open(f'{GAB}/labels/candidates/{BATCH}.json'))
only = sys.argv[1:]
recs = sorted({c['recording'] for c in cands})
feats = []
for rid in recs:
    if only and rid not in only: continue
    f = os.path.join(SCR, 'emis', rid + '.f32')
    lp = np.fromfile(f, dtype=np.float32).reshape(-1, C)
    T = lp.shape[0]
    toks = greedy(lp)
    rows = [(i, c) for i, c in enumerate(cands) if c['recording'] == rid]
    rows.sort(key=lambda x: x[1]['start_s'])
    rec_vids = {c['verseId'] for _, c in rows}
    for n, (ci, c) in enumerate(rows):
        s, e = c['start_s'], c['end_s']
        prev_e = rows[n - 1][1]['end_s'] if n > 0 else -1e9
        next_s = rows[n + 1][1]['start_s'] if n + 1 < len(rows) else 1e9
        lo = max(0.0, s - PAD_S, prev_e - 1.5); hi = min(T / FPS, e + PAD_S, next_s + 1.5)
        f0, f1 = int(lo * FPS), int(hi * FPS)
        if f1 - f0 < 10: f1 = min(T, f0 + 10)
        win = lp[f0:f1]
        heard = heard_text(toks, int((s - 1) * FPS), int((e + 1) * FPS))
        heard_core = heard_text(toks, int((s - 0.3) * FPS), int((e + 0.3) * FPS))
        hc = norm(heard_core)
        def explain(nt, words):
            """how much of the heard text this pangti explains: greedily match the pangti, or a prefix / suffix / half
            of it at word boundaries (half lines and endings are sung over and over), into the heard text, blank out
            the matched part, repeat; 0..100"""
            if not hc or not nt: return 0.0
            W = len(words)
            needles = {nt}
            for k in range(2, W):
                for nd in (''.join(words[:k]), ''.join(words[W - k:])):
                    if len(nd) >= 8: needles.add(nd)
            if W >= 6:
                q = W // 4
                nd = ''.join(words[q:q + W // 2])
                if len(nd) >= 8: needles.add(nd)
            rem = hc; covered = 0.0
            for _ in range(4):
                bestm = None
                for nd in needles:
                    if len(nd) <= len(rem):
                        al = fuzz.partial_ratio_alignment(nd, rem)
                        if al is None: continue
                        sc, a, b = al.score, al.dest_start, al.dest_end
                    else:
                        al = fuzz.partial_ratio_alignment(rem, nd)
                        if al is None: continue
                        sc, a, b = al.score, 0, len(rem)
                    if sc < 70: continue
                    val = sc / 100 * (b - a)
                    if bestm is None or val > bestm[0]: bestm = (val, a, b)
                if bestm is None: break
                val, a, b = bestm
                covered += val; rem = rem[:a] + '#' * (b - a) + rem[b:]
            return 100.0 * covered / len(hc)
        def tscore(nt, words):
            if not hc or not nt: return 0.0
            t = max(fuzz.ratio(hc, nt * k) for k in (1, 2, 3, 4))
            return max(t, explain(nt, words))
        # heard tokens inside the lens-B window, for the heard-token timing fit
        wt = [(fr / FPS, pc) for fr, pc in toks if f0 <= fr < f1]
        def token_run(nt):
            """best-fit span from the heard tokens: tokens whose 3-piece context matches the pangti, grouped into
            runs (gap <= 3 s), the run overlapping the candidate most (then longest) wins"""
            hits = []
            for i, (tm, pc) in enumerate(wt):
                ctx = norm(''.join(p2 for _, p2 in wt[max(0, i - 2):i + 3]))
                ctx7 = norm(''.join(p2 for _, p2 in wt[max(0, i - 3):i + 4]))
                if (len(ctx) >= 5 and fuzz.partial_ratio(ctx, nt) >= 72) or (len(ctx7) >= 7 and fuzz.partial_ratio(ctx7, nt) >= 75): hits.append(tm)
            runs = []
            for tm in hits:
                if runs and tm - runs[-1][1] <= 5.0: runs[-1][1] = tm; runs[-1][2] += 1
                else: runs.append([tm, tm, 1])
            if not runs: return None
            # an isolated first / last hit far from the rest of its run is a stray context match, not the boundary
            for r in runs:
                hs = [t for t in hits if r[0] <= t <= r[1]]
                while len(hs) >= 4 and hs[1] - hs[0] > 2.5: hs.pop(0)
                while len(hs) >= 4 and hs[-1] - hs[-2] > 2.5: hs.pop()
                r[0], r[1], r[2] = hs[0], hs[-1], len(hs)
            def ov(r): return max(0.0, min(e, r[1] + 0.4) - max(s, r[0]))
            r = max(runs, key=lambda r: (ov(r), r[2]))
            return dict(run_start=round(r[0], 2), run_end=round(r[1] + 0.4, 2), run_n=r[2], runs=len(runs))
        pool = set(by_shabad.get(c['shabadId'], [])) | rec_vids | set(search(heard))
        res = {}
        for v in pool:
            txt = spoken(verse[v]['text'])
            ids = [i for i in sp_encode(txt) if i != 0]
            if len(ids) < 2: continue
            a = align(win, ids)
            if a is None: continue
            a['verseId'] = v
            a['start_s'] = round(lo + a['start'] / FPS, 2); a['end_s'] = round(lo + a['end'] / FPS, 2)
            ht = heard_text(toks, f0 + a['start'], f0 + a['end'] + 1)
            a['check'] = round(fuzz.partial_ratio(norm(ht), norm(txt)) / 100, 3) if ht else 0.0
            a['ovl'] = max(0.0, min(e, a['end_s']) - max(s, a['start_s'])) / max(0.5, e - s)
            a['in_shabad'] = v in by_shabad.get(c['shabadId'], [])
            a['ntext'] = norm(txt)
            a['tscore'] = round(tscore(a['ntext'], [norm(w) for w in txt.split() if norm(w)]), 1)
            a['run'] = token_run(a['ntext'])
            res[v] = a
        # rank by gain among alignments that overlap the candidate span
        ranked = sorted(res.values(), key=lambda a: (-a['tscore'], -a['gain']))
        feats.append(dict(ci=ci, recording=rid, cand_verseId=c['verseId'], cand_text=c['text'], prev_end=prev_e if n>0 else None, next_start=next_s if n+1<len(rows) else None, shabadId=c['shabadId'], start_s=s, end_s=e,
                          tier=c['evidence']['tier'], heard=heard, heard_core=heard_core, lo=lo, hi=hi,
                          cand_self=res.get(c['verseId']),
                          top=[{k: a[k] for k in ('verseId', 'tscore', 'gain', 'start_s', 'end_s', 'conf', 'check', 'ovl', 'in_shabad', 'ntok', 'U', 'ntext', 'run')} for a in ranked[:8]]))
        print(rid, n, c['verseId'], f'{s}-{e}', 'top', [(a['verseId'], a['tscore'], round(a['gain'])) for a in ranked[:3]], flush=True)
    json.dump(feats, open(os.path.join(SCR, f'feats-{rid}.json'), 'w'), ensure_ascii=False); feats = []
