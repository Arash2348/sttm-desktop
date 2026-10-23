# Checker 3 library (lens C, structure). Own scorer: heard text (greedy CTC of the cached speech-model output for a
# time range) vs a pangti sung once or several times (text repeated), character alignment with free start/end.
import json, os, re, csv, math
import numpy as np
S = os.path.dirname(os.path.abspath(__file__))
GAB = '/Users/asingh02/personal/sttm-ws3/research/gab-ui'
corpus = json.load(open(os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')))
DROP = re.compile(r'[\s।॥|0-9੦-੯.,;:!?\-▁ੱੰਂ]+')
ORD = {'੧': 'ਪਹਿਲਾ', '੨': 'ਦੂਜਾ', '੩': 'ਤੀਜਾ', '੪': 'ਚਉਥਾ', '੫': 'ਪੰਜਵਾ', '੯': 'ਨਾਵਾ'}
def spoken(u):
    u = (u or '').replace('ੴ', 'ਇਕ ਓਅੰਕਾਰ ')
    u = re.sub(r'(ਮਹਲਾ|ਮਃ)\s*([੧-੯])(?![੦-੯])', lambda m: f"ਮਹਲਾ {ORD.get(m.group(2), '')} ", u)
    return u
def norm(s): return DROP.sub('', s or '')
verse = {r['verseId']: r for r in corpus}
vtext = {r['verseId']: norm(spoken(r['text'])) for r in corpus}
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

def competitors(h, k=40):
    gs = {h[j:j + 3] for j in range(len(h) - 2)} & post.keys()
    if not gs: return []
    ix = np.concatenate([post[g] for g in gs]); w = np.concatenate([np.full(len(post[g]), idf[g]) for g in gs])
    sc = np.bincount(ix, weights=w, minlength=NV)
    top = np.argpartition(-sc, k)[:k]
    return [VIDS[int(i)] for i in top if sc[i] > 0]

SUB, INS, DEL, JUMP = 1.0, 1.0, 0.6, 2.5
def explain(h, t):
    """0..100: share of heard chars h explained by the pangti t: character alignment with free start/end, the text
    repeated once (a full repeat is free), restarts anywhere in the text at cost JUMP (kirtan repeats half-pangtis),
    unexplained heard chars cost INS, skipped pangti chars cost DEL."""
    n = len(h)
    if n == 0 or len(t) == 0: return 0.0
    T = np.frombuffer((t * 2).encode('utf-32-le'), dtype=np.uint32); m = len(T)
    prev = np.zeros(m + 1)
    jj = np.arange(m + 1) * DEL
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
def load_toks(rec, tokdir=os.path.join(S, 'tok')):
    if rec not in _toks:
        tk = json.load(open(os.path.join(tokdir, rec + '.json')))
        _toks[rec] = (np.array([t for t, _ in tk['toks']]), [p for _, p in tk['toks']], tk['cov'], tk['dur'])
    return _toks[rec]
def heard(rec, a, b):
    T, P, cov, dur = load_toks(rec)
    i, j = np.searchsorted(T, a), np.searchsorted(T, b)
    covered = sum(max(0, min(b, y) - max(a, x)) for x, y in cov) / max(0.01, b - a)
    raw = ''.join(P[i:j])
    return norm(raw), raw.replace('▁', ' ').strip(), covered

VAHEGURU = norm('ਵਾਹਿਗੁਰੂ')
def rank(h, shabad_ids, extra=()):
    """rank pangtis for heard text h: every pangti of the keyed Shabad(s) + corpus competitors + extra.
    Identical texts are one choice; the keyed Shabad's copy is named."""
    shabad_vs = [v for s in shabad_ids for v in sh_verses.get(s, [])]
    pool = set(shabad_vs) | set(extra) | (set(competitors(h)) if len(h) >= 6 else set())
    scores = {v: explain(h, vtext[v]) for v in pool}
    by_text = {}
    for v, s in scores.items():
        t = vtext[v]
        if t not in by_text or (v in shabad_vs and by_text[t] not in shabad_vs): by_text[t] = v
    ranked = sorted(by_text.values(), key=lambda v: -scores[v])
    return ranked, scores, shabad_vs

def key_rows(folder, rec):
    kd = f'{GAB}/hf-keys/{folder}/{rec}'
    rd = lambda f: list(csv.DictReader(open(f'{kd}/{f}', encoding='utf-8', newline='')))
    shab = [(r['shabadId'], float(r['start_s']), float(r['end_s'])) for r in rd('shabads.csv') if r.get('shabadId')]
    lines = [(int(r['verseId']), float(r['start_s']), float(r['end_s']),
              float(r['confidence']) if r.get('confidence') not in (None, '') else 1.0, r.get('source', ''))
             for r in rd('lines.csv')]
    return shab, lines

def decide(h, sids, extra=()):
    """my identification for heard text h given the keyed Shabad(s) sids: best pangti inside the keyed Shabads
    unless a corpus pangti of different text explains the hearing clearly better (> 10 points: a parmaan or another
    Shabad). Returns dict(my, s1, m_in (margin over the best different-text pangti of the keyed Shabads),
    m_out (margin over the best different-text pangti outside them), in_shabad, ranked, scores, svs)."""
    ranked, scores, svs = rank(h, sids, extra)
    if not ranked: return None
    svs_set = set(svs)
    ins = [v for v in ranked if v in svs_set]; outs = [v for v in ranked if v not in svs_set]
    if not ins: return None
    ib = ins[0]; s_in = scores[ib]
    out_diff = [v for v in outs if vtext[v] != vtext[ib]]
    s_out = scores[out_diff[0]] if out_diff else 0.0
    in_diff = [v for v in ins[1:] if vtext[v] != vtext[ib]]
    s_in2 = scores[in_diff[0]] if in_diff else 0.0
    if s_out > s_in + 10:
        ob = out_diff[0]
        return dict(my=ob, s1=scores[ob], m_in=scores[ob] - s_in, m_out=scores[ob] - max([scores[v] for v in out_diff[1:] if vtext[v] != vtext[ob]] or [0.0]),
                    in_shabad=False, ranked=ranked, scores=scores, svs=svs)
    return dict(my=ib, s1=s_in, m_in=s_in - s_in2, m_out=s_in - s_out, in_shabad=True, ranked=ranked, scores=scores, svs=svs)
