#!/usr/bin/env python3
"""Approach 11 — search-only benchmark (no app replay).

Feeds the SAME model transcripts (Karanbir fp32, 4 s windows, 1 s hop) to several Shabad search methods and
scores how often each ranks the true Shabad first, how soon it finds it, and how often it is confidently wrong.

Methods
  fl      our first-letter search, re-implemented from VoiceFollow.jsx: start-anchored 8-letter query (weight 12),
          sliding CONTAINS grams of 8/6/5/4 letters (weight = length), leave-one-out variants of the last 8
          letters, 8 results per query, vote weight = w * (8 - rank) / 8, votes decay 0.8 per decode.
  flc     same, but letters are folded into acoustic-confusion classes before searching (Karanbir idea 2).
  tri     our full-text 3-gram TextIndex (engine/retrieval/text-index.js), best line score per Shabad.
  fuzzy   Karanbir Singh's kirtan-captioning matcher (engine/matcher.py find_candidates): rapidfuzz partial_ratio
          over every content line, Shabad score = best * 0.7 + min(good lines >= 60, 5) * 6.
  hybrid  what the app could afford in JS: 3-gram prefilter (top 400 lines) then Karanbir's fuzzy scoring.

Query text at time t = the non-overlapping 4 s windows ending at t, t-4, t-8, t-12 (about 16 s, like his 15 s
window). Evaluated every STEP seconds. Truth = shabads.csv (Shabad rows only; Bani-only rows skipped).

  ~/AAI/voice-venv/bin/python -I search_bench.py [--model karanbir-fp32] [--step 2] [--methods fl,flc,tri,fuzzy,hybrid]
"""
import argparse, csv, json, math, os, re, sys, time, unicodedata
from collections import defaultdict
from rapidfuzz import fuzz, process

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, '..', 'level2-dataset')
ap = argparse.ArgumentParser()
ap.add_argument('--model', default='karanbir-fp32')
ap.add_argument('--step', type=float, default=2.0)
ap.add_argument('--methods', default='fl,flc,tri,fuzzy,hybrid')
ap.add_argument('--clips', default='')
ap.add_argument('--sggs', action='store_true', help='corpus = Sri Guru Granth Sahib Ji only (his setup); score only SGGS truth')
ap.add_argument('--qwin', type=int, default=16, help='query length in seconds (multiple of 4)')
ap.add_argument('--out', default=os.path.join(HERE, 'results'))
A = ap.parse_args()
METHODS = A.methods.split(',')

# ---------------- corpus ----------------
cdir = os.path.expanduser('~/personal/live-darbar-venues/cache/corpus')
cfile = sorted((os.path.join(cdir, f) for f in os.listdir(cdir) if f.endswith('.json')), key=os.path.getmtime)[-1]
corpus = json.load(open(cfile))
SGGS_MAX_VERSE = 60403  # BaniDB: verses 1..60403 are Sri Guru Granth Sahib Ji
if A.sggs:
    corpus = [r for r in corpus if r['verseId'] <= SGGS_MAX_VERSE]
SGGS_SHABADS = {s for r in corpus if r['verseId'] <= SGGS_MAX_VERSE for s in (r.get('shabadIds') or [r['shabadId']])}

def base(s):  # drop nukta so ਸ਼ == ਸ etc.
    return unicodedata.normalize('NFC', unicodedata.normalize('NFD', s or '').replace('਼', ''))

GURMUKHI_LETTER = re.compile(r'[ਅ-ਹੲੳੴਖ਼-ਫ਼]')
def first_letters(text):
    out = []
    for w in re.split(r'[\s।॥|.,;:!?\-]+', base(text)):
        if not w or re.fullmatch(r'[0-9੦-੯]+', w):
            continue
        m = GURMUKHI_LETTER.search(w)
        if m and m.start() == 0:
            out.append(w[0])
    return ''.join(out)

# Acoustic confusion classes (Karanbir idea 2): voiced/unvoiced and aspirated pairs per place of articulation,
# nasals, flaps, sibilants, and the vowel carriers. Folded letters search as one symbol.
CLASSES = ['ਕਖਗਘ', 'ਚਛਜਝ', 'ਟਠਡਢ', 'ਤਥਦਧ', 'ਪਫਬਭ', 'ਨਣਙਞਮ', 'ਰੜਲ', 'ਸਸ਼', 'ਹ', 'ਯ', 'ਵ', 'ੳਅੲ']
FOLD = {}
for cls in CLASSES:
    for ch in base(cls):
        FOLD[ch] = cls[0]
fold = lambda s: ''.join(FOLD.get(c, c) for c in s)

norm_tri = lambda s: re.sub(r'[\s।॥|0-9੦-੯.,;:!?\-]+', '', s or '')
def base_letters(s):
    return re.sub(r'[਼-੍ੑੰੱੵ]', '', unicodedata.normalize('NFC', norm_tri(s)))
def norm_fuzzy(text):  # Karanbir's normalize_text
    text = re.sub(r'[॥੦੧੨੩੪੫੬੭੮੯।]', '', text or '')
    text = re.sub(r'([ਾ-੍ੰੱ])\1+', r'\1', text)
    return ' '.join(text.split()).strip()

HEADER_TOKENS = set('ਮਹਲਾ ਮਃ ਗਉੜੀ ਆਸਾ ਆਸਾਵਰੀ ਸੋਰਠਿ ਸੂਹੀ ਤਿਲੰਗ ਭੈਰਉ ਬਸੰਤ ਬਸੰਤੁ ਮਾਝ ਮਾਰੂ ਸਾਰਗ ਬਿਲਾਵਲੁ ਬਿਲਾਵਲ ਧਨਾਸਰੀ ਕਾਨੜਾ ਮਲਾਰ ਮਾਲੀ ਮਾਲੀਗਉੜਾ ਨਟ ਟੋਡੀ ਜੈਤਸਰੀ ਲਲਤ ਨਾਮਦੇਵ ਕਬੀਰ ਰਾਗੁ ਮਝ ਘਰੁ ਸਲੋਕੁ ਸਲੋਕ ਚਉਪਦੇ ਦੁਪਦੇ ਤਿਪਦੇ ਪਉੜੀ ਸਲੋਕਮਃ ਸਲੋਕਮਹਲਾ ਜ਼ੋਲਨਾ ਛੰਤ ਛੰਤੁ ਰਹਾਉ ਅਸਟਪਦੀ ਅਸਟਪਦੀਆ ਵਾਰ ਦੋਹਰਾ'.split())
def is_header(n):
    if len(n) < 15:
        return True
    for w in n.split():
        if w in HEADER_TOKENS or w.isdigit() or all(c in '੦੧੨੩੪੫੬੭੮੯' for c in w) or len(w) <= 2:
            continue
        return False
    return True

LINES = []  # (shabadIds, fl, flc, fuzzy_norm)
for r in corpus:
    sids = r.get('shabadIds') or [r['shabadId']]
    fl = first_letters(r['text'])
    LINES.append((sids, fl, fold(fl), norm_fuzzy(r['text'])))
CONTENT = {}  # idx -> normalized text (Karanbir's flat index: len >= 5, headers filtered)
content_count = defaultdict(int)
for i, (sids, _, _, n) in enumerate(LINES):
    if len(n) >= 5 and not is_header(n):
        CONTENT[i] = n
        for s in sids:
            content_count[s] += 1

# 4-gram postings over first-letter strings (plain and folded) for fast CONTAINS / BEGINSWITH
def build_fl_index(key):
    post = defaultdict(list)
    for i, L in enumerate(LINES):
        s = L[key]
        seen = set()
        for j in range(len(s) - 3):
            g = s[j:j + 4]
            if g not in seen:
                seen.add(g)
                post[g].append(i)
    return post
FL_POST = {1: build_fl_index(1), 2: build_fl_index(2)}

def fl_query(q, key, start=False, limit=8):
    """banidb-like: first `limit` lines (corpus order) whose FL CONTAINS q (or BEGINSWITH q)."""
    cand = FL_POST[key].get(q[:4], [])
    out = []
    for i in cand:
        s = LINES[i][key]
        if (s.startswith(q) if start else q in s):
            out.append(i)
            if len(out) >= limit:
                break
    return out

# 3-gram TextIndex (two normalizations, IDF-weighted, best line per Shabad)
def grams(s, n=3):
    return {s[i:i + n] for i in range(len(s) - n + 1)}
TRI = []
for normf in (norm_tri, base_letters):
    post = defaultdict(list)
    for i, r in enumerate(corpus):
        for g in grams(normf(r['text'])):
            post[g].append(i)
    TRI.append((normf, post))
NROWS = len(corpus)

def search_tri(text, cap=60, lines=False):
    merged = {}
    line_scores = defaultdict(float)
    for normf, post in TRI:
        q = grams(normf(text))
        if len(q) < 2:
            continue
        scores = defaultdict(float)
        weight = 0.0
        for g in q:
            ids = post.get(g, [])
            idf = math.log(1 + NROWS / (1 + len(ids)))
            weight += idf
            for i in ids:
                scores[i] += idf
        for i, sc in scores.items():
            v = sc / weight
            line_scores[i] = max(line_scores[i], v)
            for s in LINES[i][0]:
                if v > merged.get(s, 0):
                    merged[s] = v
    if lines:
        return line_scores
    return sorted(merged.items(), key=lambda x: (-x[1], x[0]))[:cap]

def fuzzy_rank(query, idx_texts, top_k=10):
    q = norm_fuzzy(query)
    if not q.strip():
        return []
    matches = process.extract(q, idx_texts, scorer=fuzz.partial_ratio, limit=top_k * 20)
    per = defaultdict(list)
    for _, score, idx in matches:
        for s in LINES[idx][0]:
            per[s].append(score)
    out = []
    for s, sc in per.items():
        best = max(sc)
        good = sum(1 for x in sc if x >= 60)
        bonus = 0.0 if content_count.get(s, 0) < 3 else min(good, 5) * 6.0
        out.append((s, best * 0.7 + bonus))
    out.sort(key=lambda x: -x[1])
    return out[:top_k]

def search_fuzzy(text):
    return fuzzy_rank(text, CONTENT)

def search_tri_agree(text, good=0.5):
    # Karanbir's multi-line agreement on top of our 3-gram line scores:
    # Shabad score = best line * 0.7 + min(lines >= good, 5) * 0.06 (same shape as his best*0.7 + min(good,5)*6, scaled 0-1)
    ls = search_tri(text, lines=True)
    per = defaultdict(list)
    for i, v in sorted(ls.items(), key=lambda x: -x[1])[:400]:
        for s in LINES[i][0]:
            per[s].append(v)
    out = []
    for s, sc in per.items():
        bonus = 0.0 if content_count.get(s, 0) < 3 else min(sum(1 for x in sc if x >= good), 5) * 0.06
        out.append((s, max(sc) * 0.7 + bonus))
    out.sort(key=lambda x: -x[1])
    return out[:10]

def search_hybrid(text):
    ls = search_tri(text, lines=True)
    top = sorted(ls.items(), key=lambda x: -x[1])[:400]
    sub = {i: CONTENT[i] for i, _ in top if i in CONTENT}
    return fuzzy_rank(text, sub) if sub else []

class FLVoter:
    """Our first-letter proposer, stateful across decodes like the app."""
    def __init__(self, key):
        self.key = key
        self.votes = defaultdict(float)
    def step(self, text):
        fl = first_letters(text)
        if self.key == 2:
            fl = fold(fl)
        for k in list(self.votes):
            self.votes[k] *= 0.8
            if self.votes[k] < 0.4:
                del self.votes[k]
        if len(fl) >= 4:
            qs, seen = [], set()
            def add(q, w, start):
                if len(q) < 4 or len(qs) >= 16 or (q, start) in seen:
                    return
                seen.add((q, start)); qs.append((q, w, start))
            add(fl[:8], 12, True)
            for k in (8, 6, 5, 4):
                for s in range(len(fl) - k, -1, -1):
                    if len(fl) >= k:
                        add(fl[s:s + k], k, False)
            tail = fl[-8:]
            for d in range(1, len(tail) - 1):
                add(tail[:d] + tail[d + 1:], len(tail) - 1, False)
            for q, w, start in qs:
                hits = fl_query(q, self.key, start)
                n = len(hits)
                for rank, i in enumerate(hits):
                    for s in LINES[i][0][:1]:
                        self.votes[s] = min(60.0, self.votes[s] + w * (n - rank) / n)
        return sorted(self.votes.items(), key=lambda x: -x[1])[:10]

# ---------------- clips ----------------
sample = json.load(open(os.path.join(DS, 'tools/hearing-sample.json')))['clips']
if A.clips:
    want = set(A.clips.split(','))
    sample = [c for c in sample if c['id'] in want]
TX = os.path.join(DS, 'results/hearing/transcripts', A.model)

def read_csv(p):
    return list(csv.DictReader(open(p))) if os.path.exists(p) else []

results = {m: {} for m in METHODS}
os.makedirs(A.out, exist_ok=True)
t0 = time.time()
for clip in sample:
    f = os.path.join(TX, clip['id'] + '.jsonl')
    if not os.path.exists(f):
        continue
    tx = {round(r['t'], 1): r['text'] for r in map(json.loads, open(f)) if r.get('t') is not None}
    segs = []
    for r in read_csv(os.path.join(clip['truth'], 'shabads.csv')):
        if r.get('start_s', '') == '' or r.get('end_s', '') == '':
            continue
        ids = [int(x) for x in str(r['shabadId']).split('|') if x and not x.startswith('bani:') and x.lstrip('-').isdigit()]
        if A.sggs:
            ids = [i for i in ids if i in SGGS_SHABADS]
        if ids:
            segs.append((float(r['start_s']), float(r['end_s']), set(ids)))
    if not segs:
        continue
    def truth_at(t):
        out = set()
        for a, b, ids in segs:
            if a <= t <= b:
                out |= ids
        return out
    times = sorted(tx)
    tmax = max(times)
    voters = {m: FLVoter(1 if m == 'fl' else 2) for m in METHODS if m in ('fl', 'flc')}
    per = {m: [] for m in METHODS}
    t = 4.0
    while t <= tmax:
        parts = [tx.get(round(t - 4 * k, 1), '') for k in range(A.qwin // 4 - 1, -1, -1)]
        q = ' '.join(p for p in parts if p).strip()
        truth = truth_at(t - 2)
        for m in METHODS:
            if m in voters:
                ranked = voters[m].step(q)
            elif m == 'tri':
                ranked = search_tri(q) if q else []
            elif m == 'triagree':
                ranked = search_tri_agree(q) if q else []
            elif m == 'fuzzy':
                ranked = search_fuzzy(q) if q else []
            else:
                ranked = search_hybrid(q) if q else []
            top = [s for s, _ in ranked[:5]]
            if len(ranked) >= 2 and ranked[0][1] > 0:
                sep = ranked[0][1] / (ranked[0][1] + ranked[1][1])
            else:
                sep = 1.0 if ranked else 0.0
            per[m].append({'t': t, 'truth': sorted(truth), 'top': top, 'sep': round(sep, 3), 'has_text': bool(q)})
        t += A.step
    for m in METHODS:
        results[m][clip['id']] = {'tier': clip['tier'], 'segs': [(a, b, sorted(i)) for a, b, i in segs], 'rows': per[m]}
    print(f"{clip['id']} ({clip['tier']}) done {time.time() - t0:.0f}s", file=sys.stderr, flush=True)

TAG = f"{A.model}-q{A.qwin}{'-sggs' if A.sggs else ''}"
json.dump(results, open(os.path.join(A.out, f'search-{TAG}.json'), 'w'))

# ---------------- score ----------------
def score(rows, segs):
    scored = [r for r in rows if r['truth']]
    top1 = sum(1 for r in scored if r['top'][:1] and r['top'][0] in r['truth'])
    top5 = sum(1 for r in scored if set(r['top']) & set(r['truth']))
    wrong_conf = sum(1 for r in scored if r['top'][:1] and r['top'][0] not in r['truth'] and r['sep'] >= 0.65)
    finds = []
    for a, b, ids in segs:
        ids = set(ids)
        rs = [r for r in rows if a <= r['t'] - 2 <= b]
        found = None
        for x, y in zip(rs, rs[1:]):
            if x['top'][:1] and y['top'][:1] and x['top'][0] in ids and y['top'][0] in ids:
                found = x['t'] - a
                break
        finds.append(found)
    return len(scored), top1, top5, wrong_conf, finds

print(f"\nApproach 11 search-only bench — {TAG}, query {A.qwin} s, every {A.step:g} s, {time.time() - t0:.0f} s total\n")
hdr = f"{'tier':8} {'method':7} {'windows':>7} {'top-1':>6} {'top-5':>6} {'conf-wrong':>10} {'found':>7} {'median find s':>13}"
print(hdr)
summary = {}
for tier in ('main', 'hard', 'akhand', 'all'):
    for m in METHODS:
        n = t1 = t5 = wc = 0
        finds = []
        for cid, r in results[m].items():
            if tier != 'all' and r['tier'] != tier:
                continue
            a, b, c, d, f = score(r['rows'], r['segs'])
            n += a; t1 += b; t5 += c; wc += d; finds += f
        if not n:
            continue
        got = [x for x in finds if x is not None]
        med = sorted(got)[len(got) // 2] if got else None
        summary.setdefault(tier, {})[m] = {'windows': n, 'top1': 100 * t1 / n, 'top5': 100 * t5 / n, 'confWrong': 100 * wc / n,
                                           'found': f'{len(got)}/{len(finds)}', 'medianFind': med}
        print(f"{tier:8} {m:7} {n:7d} {100 * t1 / n:5.1f}% {100 * t5 / n:5.1f}% {100 * wc / n:9.1f}% {len(got):3d}/{len(finds):<3d} {('%.0f' % med) if med is not None else '-':>13}")
json.dump(summary, open(os.path.join(A.out, f'summary-{TAG}.json'), 'w'), indent=1)
