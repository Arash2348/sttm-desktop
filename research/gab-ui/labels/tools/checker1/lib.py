# Checker 1 scoring library. Heard text = greedy CTC of the cached speech-model output for a time range.
# A pangti is scored by how much of the heard text it EXPLAINS: character alignment of heard -> pangti with
# free start, free end and restarts (kirtan repeats half-pangtis), so a long span of "first half x3" is explained
# by the pangti that owns that half, not by a short unrelated pangti that happens to contain the same words.
import json, os, re
import numpy as np
S = os.path.dirname(os.path.abspath(__file__))
corpus = json.load(open(os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')))
DROP = re.compile(r'[\s।॥|0-9੦-੯.,;:!?\-▁ੱੰਂ]+')
def norm(s): return DROP.sub('', s or '')
verse = {r['verseId']: r for r in corpus}
vtext = {r['verseId']: norm(r['text']) for r in corpus}
sh_verses = {}
for r in corpus:
    for s in (r.get('shabadIds') or [r['shabadId']]): sh_verses.setdefault(s, []).append(r['verseId'])
VIDS = [r['verseId'] for r in corpus]
VT = [vtext[v] for v in VIDS]
post = {}
for i, t in enumerate(VT):
    for g in {t[j:j + 3] for j in range(len(t) - 2)}: post.setdefault(g, []).append(i)
post = {g: np.array(v, dtype=np.int32) for g, v in post.items()}
NV = len(VIDS); idf = {g: np.log(NV / (1 + len(v))) for g, v in post.items()}

def cands(h, k=60):
    """best competing pangtis of the whole Gurbani corpus for heard text h (idf-weighted trigram retrieval)"""
    gs = {h[j:j + 3] for j in range(len(h) - 2)} & post.keys()
    if not gs: return []
    ix = np.concatenate([post[g] for g in gs]); w = np.concatenate([np.full(len(post[g]), idf[g]) for g in gs])
    sc = np.bincount(ix, weights=w, minlength=NV)
    top = np.argpartition(-sc, k)[:k]
    return [VIDS[int(i)] for i in top if sc[i] > 0]

SUB, INS, DEL, JUMP = 1.0, 1.0, 1.0, 3.0
def explain(h, t):
    """0..100: share of heard chars h explained by pangti t (free start/end, restarts cost JUMP)"""
    n, m = len(h), len(t)
    if n == 0 or m == 0: return 0.0
    T = np.frombuffer(t.encode('utf-32-le'), dtype=np.uint32)
    jj = np.arange(m + 1) * DEL
    prev = np.zeros(m + 1)
    for i in range(n):
        c = ord(h[i])
        sub = np.where(T == c, 0.0, SUB)
        base = prev.min() + JUMP
        row = np.empty(m + 1)
        row[0] = prev[0] + INS
        row[1:] = np.minimum(np.minimum(prev[:-1], base) + sub, prev[1:] + INS)
        row = np.minimum.accumulate(row - jj) + jj
        prev = row
    return 100.0 * max(0.0, 1.0 - prev.min() / n)

_toks = {}
def heard(rec, a, b, tokdir=os.path.join(S, 'tok')):
    if rec not in _toks:
        tk = json.load(open(os.path.join(tokdir, rec + '.json')))
        _toks[rec] = (np.array([t for t, _ in tk['toks']]), [p for _, p in tk['toks']], tk['cov'])
    T, P, cov = _toks[rec]
    i, j = np.searchsorted(T, a), np.searchsorted(T, b)
    covered = sum(max(0, min(b, y) - max(a, x)) for x, y in cov) / max(0.01, b - a)
    raw = ''.join(P[i:j])
    return norm(raw), raw.replace('▁', ' ').strip(), covered

VAHEGURU = norm('ਵਾਹਿਗੁਰੂ')
def judge(h, shabad_ids):
    """rank pangtis for heard text h: every pangti of the keyed Shabad(s) + corpus competitors.
    Copies of the same Gurbani (identical text) are one choice; the keyed Shabad's copy is named."""
    shabad_vs = [v for s in shabad_ids for v in sh_verses.get(s, [])]
    pool = set(shabad_vs) | set(cands(h) if len(h) >= 6 else [])
    scores = {v: explain(h, vtext[v]) for v in pool}
    by_text = {}
    for v, s in scores.items():
        t = vtext[v]
        if t not in by_text or (v in shabad_vs and by_text[t] not in shabad_vs): by_text[t] = v
    ranked = sorted(by_text.values(), key=lambda v: -scores[v])
    return ranked, scores, shabad_vs
