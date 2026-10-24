"""hmm.py: frame-level pangti HMM over independent CTC emissions (2026-10-23, GAB independent-aligner feasibility).

Graph: one CTC chain per candidate pangti (blank, c1, blank, c2, ..., cL, blank) plus one filler state
(music / alaap / talk / anything that is not a pangti). A chain is entered at its start (free) or at a word start
(partial, penalised) and left at its end (free) or at a word end (partial, penalised), so a kirtani singing half
a pangti and repeating it is allowed; a word is never cut. Between chains: repeat same pangti, next pangti, back
to rahao, any other pangti, to / from filler, each with its own log penalty. Kirtan repeats and returns to rahao,
so nothing is monotonic.

Output: per-frame posterior of each pangti and of filler (forward-backward, checkpointed so memory stays small).
"""
import math
import numpy as np
from numba import njit

NEG = -1e30


@njit(cache=True, fastmath=False)
def _lae(a, b):
    if a < b:
        a, b = b, a
    if b <= NEG / 2:
        return a
    return a + math.log1p(math.exp(b - a))


@njit(cache=True)
def _fwd_step(prev, cur, Et, efill, lab, pk, skip, entp, exitp, starts, ends, J, j_fill, j_from, K, F, cbon):
    # exit score per pangti
    X = np.full(K, NEG)
    for s in range(F):
        if exitp[s] > NEG / 2 and prev[s] > NEG / 2:
            X[pk[s]] = _lae(X[pk[s]], prev[s] + exitp[s])
    N = np.full(K, NEG)
    fin = prev[F]
    for k in range(K):
        if X[k] <= NEG / 2:
            continue
        fin = _lae(fin, X[k] + j_fill)
        for k2 in range(K):
            N[k2] = _lae(N[k2], X[k] + J[k, k2])
    if prev[F] > NEG / 2:
        for k2 in range(K):
            N[k2] = _lae(N[k2], prev[F] + j_from)
    for k in range(K):
        for s in range(starts[k], ends[k]):
            w = NEG
            if s > starts[k]:
                w = prev[s - 1]
            if skip[s]:
                w = _lae(w, prev[s - 2])
            if entp[s] > NEG / 2:
                w = _lae(w, N[k] + entp[s])
            v = _lae(prev[s], w + cbon[s])
            cur[s] = v + Et[lab[s]]
    cur[F] = fin + efill


@njit(cache=True)
def _bwd_step(nxt, cur, En, efill_n, lab, pk, skip, entp, exitp, starts, ends, J, j_fill, j_from, K, F, cbon):
    # nxt = beta_{t+1}; cur = beta_t; En = emissions at t+1
    em = np.empty(F + 1)
    for s in range(F):
        em[s] = nxt[s] + En[lab[s]]
    em[F] = nxt[F] + efill_n
    em2 = np.empty(F)
    for s in range(F):
        em2[s] = em[s] + cbon[s]
    B = np.full(K, NEG)
    for s in range(F):
        if entp[s] > NEG / 2:
            B[pk[s]] = _lae(B[pk[s]], entp[s] + em2[s])
    Ball = NEG
    for k in range(K):
        Ball = _lae(Ball, B[k])
    Y = np.full(K, NEG)
    for k in range(K):
        y = j_fill + em[F]
        for k2 in range(K):
            if B[k2] > NEG / 2:
                y = _lae(y, J[k, k2] + B[k2])
        Y[k] = y
    for k in range(K):
        e = ends[k]
        for s in range(starts[k], e):
            v = em[s]
            if s + 1 < e:
                v = _lae(v, em2[s + 1])
            if s + 2 < e and skip[s + 2]:
                v = _lae(v, em2[s + 2])
            if exitp[s] > NEG / 2:
                v = _lae(v, exitp[s] + Y[k])
            cur[s] = v
    cur[F] = _lae(em[F], j_from + Ball)


@njit(cache=True)
def _posteriors(E, efill, lab, pk, skip, entp, exitp, starts, ends, J, j_fill, j_from, K, init, block, cbon):
    T = E.shape[0]
    F = lab.shape[0]
    S = F + 1
    nb = (T + block - 1) // block
    ck = np.empty((nb, S))
    a = np.empty(S)
    for s in range(F):
        a[s] = init[s] + E[0, lab[s]] if init[s] > NEG / 2 else NEG
    a[F] = math.log(0.5) + efill[0]
    b = np.empty(S)
    for t in range(T):
        if t % block == 0:
            ck[t // block] = a
        if t + 1 < T:
            _fwd_step(a, b, E[t + 1], efill[t + 1], lab, pk, skip, entp, exitp, starts, ends, J, j_fill, j_from, K, F, cbon)
            a, b = b, a
    logZ = NEG
    for s in range(S):
        logZ = _lae(logZ, a[s])
    post = np.zeros((T, K + 1), dtype=np.float32)
    beta = np.zeros(S)
    tmp = np.empty(S)
    blk = np.empty((block, S))
    for bi in range(nb - 1, -1, -1):
        t0 = bi * block
        t1 = min(T, t0 + block)
        blk[0] = ck[bi]
        for t in range(t0 + 1, t1):
            _fwd_step(blk[t - 1 - t0], blk[t - t0], E[t], efill[t], lab, pk, skip, entp, exitp, starts, ends, J, j_fill, j_from, K, F, cbon)
        for t in range(t1 - 1, t0 - 1, -1):
            if t < T - 1:
                _bwd_step(beta, tmp, E[t + 1], efill[t + 1], lab, pk, skip, entp, exitp, starts, ends, J, j_fill, j_from, K, F, cbon)
                beta, tmp = tmp, beta
            al = blk[t - t0]
            acc = np.full(K + 1, NEG)
            for s in range(F):
                acc[pk[s]] = _lae(acc[pk[s]], al[s] + beta[s])
            acc[K] = al[F] + beta[F]
            for k in range(K + 1):
                post[t, k] = math.exp(acc[k] - logZ) if acc[k] - logZ > -60 else 0.0
    return post, logZ


def build(pangtis, rahao, P):
    """pangtis: list of (token_ids list, word_index list). rahao: set of pangti indexes. P: params dict."""
    K = len(pangtis)
    lab, pk, skip, entp, exitp, starts, ends = [], [], [], [], [], [], []
    for k, (tok, wid) in enumerate(pangtis):
        st = len(lab)
        L = len(tok)
        nw = wid[-1] + 1 if L else 0
        ext = [0]
        for c in tok:
            ext += [c, 0]
        for i, c in enumerate(ext):
            lab.append(c); pk.append(k)
            skip.append(i >= 2 and c != 0 and c != ext[i - 2])
            entp.append(NEG); exitp.append(NEG)
        for i in range(L):
            w = wid[i]
            if i == 0 or wid[i - 1] != w:  # word start
                pen = 0.0 if w == 0 else P['partial']
                for s in (2 * i, 2 * i + 1):
                    entp[st + s] = max(entp[st + s], pen)
            if i == L - 1 or wid[i + 1] != w:  # word end
                pen = 0.0 if w == nw - 1 else P['partial']
                for s in (2 * i + 1, 2 * i + 2):
                    exitp[st + s] = max(exitp[st + s], pen)
        starts.append(st); ends.append(len(lab))
    J = np.full((K, K), P['any'])
    for k in range(K):
        for r in rahao:
            J[k, r] = max(J[k, r], P['rahao'])
        if k + 1 < K:
            J[k, k + 1] = max(J[k, k + 1], P['next'])
        J[k, k] = max(J[k, k], P['repeat'])
    init = np.array([e if e > NEG / 2 else NEG for e in entp]) - math.log(max(K, 1))
    return dict(lab=np.array(lab, np.int64), pk=np.array(pk, np.int64), skip=np.array(skip, np.bool_),
                entp=np.array(entp, np.float64), exitp=np.array(exitp, np.float64),
                starts=np.array(starts, np.int64), ends=np.array(ends, np.int64), J=J, K=K, init=init)


def posteriors(E, g, P, block=1000):
    E = np.array(E, dtype=np.float64) * P.get('scale', 1.0)
    E[:, 0] -= P.get('blank', 0.0)
    efill = E.max(1) - P['gamma']
    return _posteriors(E, efill, g['lab'], g['pk'], g['skip'], g['entp'], g['exitp'], g['starts'], g['ends'],
                       g['J'], float(P['fill']), float(P['from_fill']), g['K'], g['init'], block,
                       np.where(g['lab'] != 0, float(P.get('cb', 0.0)), 0.0))
