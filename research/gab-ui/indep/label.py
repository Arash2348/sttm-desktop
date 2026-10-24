#!/usr/bin/env python3
"""label.py run <tag> [--ids a,b] [--set kirtan-train|kirtan-dev|kbv1|paath|sungbani|all] [--p k=v,...]
   label.py eval <tag> [--set ...]

Independent pangti timings for GAB recordings (2026-10-23 feasibility test). Uses ONLY:
  - out/emis/<id>.npy from emit.py (Meta MMS_FA, public; not the app's model, no app caches / alignments / votes),
  - the human Shabad-level key (shabads.csv) to know which Shabad is playing (Kirtan / Sung Bani); for Paath the
    union of the clip's keyed Shabads (the Ang range) with a sequential prior,
  - Gurbani text looked up by verseId in the STTM database corpus dump (read-only). Text is only romanised
    internally for scoring; labels are verseIds; Gurbani text is never written or altered; words never split.
Human lines.csv is used ONLY in `eval`, never in `run`.
"""
import csv, glob, json, math, os, re, sys, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VB = os.path.expanduser('~/personal/vf-benchmark')
KB = os.path.expanduser('~/personal/gab-builds/kbv1-bench')
CORPUS = os.path.expanduser('~/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json')
FPS = 50
DEFAULT = dict(gamma=4.0, partial=-3.0, repeat=-1.5, next=-1.0, rahao=-1.5, any=-6.0, fill=-3.0, from_fill=-3.0)
DICT = {c: i for i, c in enumerate("-aienoutsrmkldghybpwcvjzf'qx")}

def opt(k, d=None):
    return sys.argv[sys.argv.index(f'--{k}') + 1] if f'--{k}' in sys.argv else d

# ---------------------------------------------------------------- recordings
def recordings():
    recs = {}
    for x in csv.DictReader(open(f'{VB}/manifest.csv')):
        if x['lines_source'] not in ('human', 'broadcast-caption') or x['split'] == 'test' or x['id'].endswith('_x1.35'):
            continue
        cf = x['content_folder']
        form = 'paath' if cf.startswith('4-') else 'sungbani' if cf.startswith('3-') else 'kirtan'
        sub = f"kirtan-{x['split']}" if form == 'kirtan' else form
        recs[x['id']] = dict(id=x['id'], dir=f"{VB}/{cf}/{x['id']}", form=form, set=sub)
    for k in ['IZOsmkdmmcg', 'kchMJPK9Axs', 'kZhIA8P6xWI', 'zOtIpxMT9hU']:
        rid = f'kbv1_{k}'
        recs[rid] = dict(id=rid, dir=f'{KB}/1-kirtan-shabad/{rid}', form='kirtan', set='kbv1')
    return recs

def pick(recs):
    ids = opt('ids'); st = opt('set', 'all')
    out = [r for r in recs.values() if (ids and r['id'] in ids.split(',')) or (not ids and (st == 'all' or r['set'] == st or r['form'] == st))]
    return [r for r in out if os.path.exists(f"{HERE}/out/{EMIS}/{r['id']}.npy")]

# ---------------------------------------------------------------- Gurbani lookup (read-only)
_corp = None
def shabad_verses(sid):
    global _corp
    if _corp is None:
        _corp = {}
        for r in json.load(open(CORPUS)):
            for s in (r.get('shabadIds') or [r['shabadId']]):
                _corp.setdefault(str(s), []).append((r['verseId'], r['text']))
    return sorted(_corp.get(str(sid), []))

_ur = None
_tokcache = {}
MODEL = opt('model', 'fa')  # fa = MMS_FA (uroman letters); mms1b = MMS-1B-all + Punjabi adapter (Gurmukhi letters)
EMIS = {'fa': 'emis', 'mms1b': 'emis-mms1b'}[MODEL]
_gvoc = None
SKIPW = re.compile(r'^[॥।੦-੯0-9]*$')
def tokens(text):
    """romanised character ids + word index per character. Whole words only; display-only marks dropped
    (verse numbers, ॥, the word ਰਹਾਉ which is not sung)."""
    global _ur, _gvoc
    if text in _tokcache:
        return _tokcache[text]
    if MODEL == 'mms1b':
        if _gvoc is None:
            _gvoc = json.load(open(f'{HERE}/out/emis-mms1b/vocab.json'))
        tok, wid, w = [], [], 0
        for word in text.split():
            word = re.sub(r'[॥।੦-੯0-9]', '', word)
            if not word or word == 'ਰਹਾਉ':
                continue
            ids = [_gvoc[c] for c in word if c in _gvoc and _gvoc[c] > 4]
            if not ids:
                continue
            if tok:
                tok.append(_gvoc['|']); wid.append(w - 1)  # word separator belongs to the previous word
            tok += ids; wid += [w] * len(ids); w += 1
        _tokcache[text] = (tok, wid)
        return tok, wid
    if _ur is None:
        import uroman
        _ur = uroman.Uroman()
    tok, wid, w = [], [], 0
    for word in text.split():
        word = re.sub(r'[॥।੦-੯0-9]', '', word)
        if not word or word == 'ਰਹਾਉ':
            continue
        rom = _ur.romanize_string(word, lcode='pan').lower()
        ids = [DICT[c] for c in rom if c in DICT and c != '-']
        if not ids:
            continue
        tok += ids; wid += [w] * len(ids); w += 1
    _tokcache[text] = (tok, wid)
    return tok, wid

HEADW = ('ਮਹਲਾ', 'ਮਃ', 'ਸਲੋਕੁ', 'ਸਲੋਕ', 'ਪਉੜੀ', 'ਰਾਗੁ', 'ਛੰਤ', 'ਘਰੁ', 'ਕਬਿਤੁ', 'ਸਵਈਏ', 'ਸਵੈਯਾ', 'ਦੋਹਰਾ', 'ਚੌਪਈ', 'ੴ', 'ਪਾਤਿਸਾਹੀ')
def is_header(t):
    """display-only heading line (raag / author / form), normally not sung in kirtan: short, no verse number, and
    made of heading words. Used only to leave such lines out of the Kirtan / Sung Bani candidate list."""
    w = [x for x in t.replace('॥', ' ').split() if x]
    if re.search(r'[੦-੯]', t) and not re.search(r'ਮਹਲਾ [੦-੯]|ਮਃ [੦-੯]', t):
        return False
    return len(w) <= 2 or (len(w) <= 6 and any(h in t for h in HEADW))

def rahao_set(verses):
    out = set()
    for i, (vid, t) in enumerate(verses):
        if 'ਰਹਾਉ' in t:
            out.add(i)
            if i > 0 and not re.search(r'॥[੦-੯]+॥', verses[i - 1][1]) and 'ਮਹਲਾ' not in verses[i - 1][1]:
                out.add(i - 1)
    return out

# ---------------------------------------------------------------- run
def segments(rec):
    rows = list(csv.DictReader(open(f"{rec['dir']}/shabads.csv")))
    rows = [(r['shabadId'], float(r['start_s']), float(r['end_s'])) for r in rows if r.get('shabadId')]
    if rec['form'] == 'paath':
        sids = []
        for s, _, _ in rows:
            for x in s.split('|'):
                if x not in sids:
                    sids.append(x)
        return [(sids, min(r[1] for r in rows), max(r[2] for r in rows))]
    segs = []
    for s, a, b in rows:
        sids = s.split('|')
        if segs and segs[-1][0] == sids and a - segs[-1][2] < 5:
            segs[-1] = (sids, segs[-1][1], max(b, segs[-1][2]))
        else:
            segs.append((sids, a, b))
    return segs

def run_rec(rec, P):
    import hmm
    E = np.load(f"{HERE}/out/{EMIS}/{rec['id']}.npy").astype(np.float32)
    T = E.shape[0]; nsec = int(math.ceil(T / FPS))
    pred = [0] * nsec; conf = [0.0] * nsec; second = [0] * nsec
    for sids, a, b in segments(rec):
        verses = []
        for s in sids:
            verses += [v for v in shabad_verses(s) if v not in verses]
        verses.sort()
        verses = [v for v in verses if tokens(v[1])[0] and not (rec['form'] != 'paath' and P.get('noheader', 1) and is_header(v[1]))]
        if not verses:
            continue
        g = hmm.build([tokens(t) for _, t in verses], rahao_set(verses), P)
        f0, f1 = int(a * FPS), min(T, int(math.ceil(b * FPS)))
        if f1 - f0 < FPS:
            continue
        post, _ = hmm.posteriors(E[f0:f1], g, P)
        vids = [v for v, _ in verses] + [0]
        for sec in range(int(a), min(nsec, int(math.ceil(b)))):
            lo, hi = max(sec * FPS, f0) - f0, min((sec + 1) * FPS, f1) - f0
            if hi <= lo:
                continue
            m = post[lo:hi].mean(0)
            k = int(m.argmax())
            pred[sec] = vids[k]; conf[sec] = float(m[k])
            second[sec] = vids[int(np.argsort(m)[-2])] if len(m) > 1 else 0
    return dict(id=rec['id'], form=rec['form'], set=rec['set'], pred=pred, conf=conf, second=second, params=P)

def cmd_run(tag):
    P = dict(DEFAULT)
    if opt('p'):
        for kv in opt('p').split(','):
            k, v = kv.split('='); P[k] = float(v)
    od = f'{HERE}/out/pred/{tag}'; os.makedirs(od, exist_ok=True)
    tot_a = tot_c = 0.0
    for rec in pick(recordings()):
        t0 = time.time()
        r = run_rec(rec, P)
        el = time.time() - t0; dur = len(r['pred'])
        tot_a += dur; tot_c += el
        r['model'] = MODEL
        json.dump(r, open(f"{od}/{rec['id']}.json", 'w'))
        print(f"{rec['id'][:40]:40s} {rec['set']:12s} {dur:6.0f} s audio {el:6.1f} s", flush=True)
    print(f'TOTAL {tot_a/3600:.2f} h audio, {tot_c:.0f} s compute, {tot_c/max(tot_a,1)*3600/60:.1f} min per hour', flush=True)

# ---------------------------------------------------------------- eval (human keys used only here)
def truth(rec, nsec):
    tr = [0] * nsec
    for r in csv.DictReader(open(f"{rec['dir']}/lines.csv")):
        a, b = float(r['start_s']), float(r['end_s'])
        for s in range(max(0, int(a)), min(nsec, int(math.ceil(b)))):
            if a <= s + 0.5 < b:
                tr[s] = int(r['verseId'])
    return tr

def wilson_lb(k, n, z=1.96):
    if n == 0:
        return float('nan')
    p = k / n
    return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n)

def evaluate(rows, thr, tol=2):
    keyed = lab = ok = okx = 0
    spans = []  # (n_seconds, correct?)
    bnd = []
    for rec, r in rows:
        tr = truth(rec, len(r['pred']))
        n = len(tr)
        cur = None
        for s in range(n):
            if not tr[s]:
                cur = None
                continue
            keyed += 1
            p = r['pred'][s] if r['conf'][s] >= thr else 0
            if not p:
                cur = None
                continue
            lab += 1
            near = {tr[j] for j in range(max(0, s - tol), min(n, s + tol + 1))}
            good = p in near
            ok += good; okx += p == tr[s]
            if cur is not None and cur[0] == p and cur[2] == s - 1:
                cur[1].append(good); cur[2] = s
            else:
                cur = [p, [good], s]; spans.append(cur)
        # boundary error: each key change -> nearest predicted change (raw argmax, any confidence)
        pc = [s for s in range(1, n) if r['pred'][s] != r['pred'][s - 1] and r['pred'][s] and r['pred'][s - 1]]
        for s in range(1, n):
            if tr[s] and tr[s - 1] and tr[s] != tr[s - 1]:
                d = min((abs(x - s) for x in pc if r['pred'][x] == tr[s]), default=None)
                if d is not None and d <= 10:
                    bnd.append(d)
    sp_ok = sum(1 for sp in spans if sum(sp[1]) * 2 > len(sp[1]))
    return dict(keyed=keyed, labelled=lab, coverage=lab / max(keyed, 1), prec=ok / max(lab, 1), prec_exact=okx / max(lab, 1),
                wilson_sec=wilson_lb(ok, lab), spans=len(spans), span_prec=sp_ok / max(len(spans), 1),
                wilson_span=wilson_lb(sp_ok, len(spans)), acc_all=ok / max(keyed, 1),
                bnd_med=float(np.median(bnd)) if bnd else float('nan'), bnd_found=len(bnd))

def cmd_eval(tag):
    recs = recordings()
    rows = []
    for f in sorted(glob.glob(f'{HERE}/out/pred/{tag}/*.json')):
        r = json.load(open(f))
        rows.append((recs[r['id']], r))
    st = opt('set')
    groups = sorted({r['set'] for _, r in rows}) if not st else [st]
    res = {}
    for gname in groups:
        sel = [(a, b) for a, b in rows if b['set'] == gname or b['form'] == gname]
        res[gname] = {}
        print(f'\n== {gname}: {len(sel)} recordings')
        print(' thr   keyed_s  labelled  cover  prec(+-2s) exact  WilsonLB  spans span_prec spanLB  acc_all  bnd_med(n)')
        for thr in (0.0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99):
            e = evaluate(sel, thr)
            res[gname][thr] = e
            print(f" {thr:4.2f} {e['keyed']:8d} {e['labelled']:8d} {e['coverage']:6.1%} {e['prec']:8.1%} {e['prec_exact']:7.1%} {e['wilson_sec']:7.1%}"
                  f" {e['spans']:6d} {e['span_prec']:7.1%} {e['wilson_span']:7.1%} {e['acc_all']:7.1%}  {e['bnd_med']:.0f} ({e['bnd_found']})")
        if opt('per'):
            for a, b in sel:
                e = evaluate([(a, b)], float(opt('per')))
                print(f"   {a['id'][:42]:42s} cover {e['coverage']:6.1%} prec {e['prec']:6.1%} acc_all {e['acc_all']:6.1%}")
    json.dump(res, open(f'{HERE}/out/pred/{tag}.eval.json', 'w'), indent=1)

def cmd_combine(out):
    """label.py combine <out> --a <tagA> --b <tagB>: keep a second's label only where both runs name the same
    pangti; confidence = min of the two."""
    A, Bt = opt('a'), opt('b')
    od = f'{HERE}/out/pred/{out}'; os.makedirs(od, exist_ok=True)
    for f in sorted(glob.glob(f'{HERE}/out/pred/{A}/*.json')):
        g = f'{HERE}/out/pred/{Bt}/' + os.path.basename(f)
        if not os.path.exists(g):
            continue
        a, b = json.load(open(f)), json.load(open(g))
        n = min(len(a['pred']), len(b['pred']))
        a['pred'] = [a['pred'][i] if a['pred'][i] == b['pred'][i] else 0 for i in range(n)]
        a['conf'] = [min(a['conf'][i], b['conf'][i]) for i in range(n)]
        a['model'] = f'agree({A},{Bt})'
        json.dump(a, open(f'{od}/' + os.path.basename(f), 'w'))

if __name__ == '__main__':
    sys.path.insert(0, HERE)
    {'run': cmd_run, 'eval': cmd_eval, 'combine': cmd_combine}[sys.argv[1]](sys.argv[2])
