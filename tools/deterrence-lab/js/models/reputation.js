// Module C: salami tactics and a reputation for resolve.
// The finite-horizon reputation game of Kreps and Wilson (1982), JET 27(2):253-279,
// doi:10.1016/0022-0531(82)90030-8, resolving Selten's (1978) chain-store paradox. Pure functions, no DOM.
//
// A defender faces a sequence of N probes ("slices"), each by a challenger who moves once.
// Stage index k = number of probes left, including the current one (k = N ... 1).
// Challenger: stay out 0; probe and defender accommodates b; probe and defender resists b - 1 (0 < b < 1).
// Weak defender: no probe a (> 1); accommodate 0; resist -1. Tough defender always resists.
// Prior Pr(tough) = p0.
// Equilibrium (Kreps-Wilson):
//   Challenger at k: probes if p_k < b^k, stays out if p_k > b^k, stays out w.p. 1/a if p_k = b^k.
//   Weak defender at k after a probe: k = 1 accommodates; k > 1 resists if p_k >= b^(k-1),
//     otherwise resists w.p. beta = (1 - b^(k-1)) p_k / ((1 - p_k) b^(k-1)).
//   Beliefs: no probe -> p_{k-1} = p_k; probe resisted -> max(b^(k-1), p_k); accommodated -> 0.

export const C_DEFAULTS = { N: 10, p0: 0.05, b: 0.6, a: 2, weak: 1, seed: 7 };
const EPS = 1e-12;

const near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));

/** Challenger's probe probability at stage k with reputation p. */
export function probeProb(P, k, p) {
  const t = P.b ** k;
  if (near(p, t)) return 1 - 1 / P.a;
  return p < t ? 1 : 0;
}

/** Weak defender's resist probability at stage k with reputation p (after a probe). */
export function resistProb(P, k, p) {
  if (k <= 1) return 0;
  const t = P.b ** (k - 1);
  if (p >= t - EPS) return 1;
  return (1 - t) * p / ((1 - p) * t);
}

/** Posterior after a resisted probe. */
export const afterResist = (P, k, p) => Math.max(P.b ** (k - 1), p);

/** First stage (largest k) at which the challenger probes with positive probability on the path of play. */
export function firstProbeStage(P) {
  // With p = p0 constant until the first probe, probing starts when b^k >= p0, i.e. k <= ln p0 / ln b.
  if (P.p0 <= 0) return P.N;
  return Math.min(P.N, Math.floor(Math.log(P.p0) / Math.log(P.b) + 1e-9));
}

/**
 * Exact expectations by recursion over (k, p) for a defender of the given type.
 * Returns { probes, resisted, accommodated, deterred, payoff } in expectation over N stages.
 */
export function expectations(P, weak) {
  const memo = new Map();
  const go = (k, p) => {
    if (k === 0) return [0, 0, 0, 0, 0];
    const key = k + ':' + p.toPrecision(12);
    if (memo.has(key)) return memo.get(key);
    const e = probeProb(P, k, p);
    const out = [0, 0, 0, 0, 0];
    const add = (w, v, now) => { for (let i = 0; i < 5; i++) out[i] += w * (v[i] + now[i]); };
    // Stay out: reputation unchanged.
    if (e < 1) add(1 - e, go(k - 1, p), [0, 0, 0, 1, weak ? P.a : 0]);
    if (e > 0) {
      const f = weak ? resistProb(P, k, p) : 1;
      if (f > 0) add(e * f, go(k - 1, afterResist(P, k, p)), [1, 1, 0, 0, weak ? -1 : 0]);
      if (f < 1) add(e * (1 - f), go(k - 1, 0), [1, 0, 1, 0, 0]);
    }
    memo.set(key, out);
    return out;
  };
  const [probes, resisted, accommodated, deterred, payoff] = go(P.N, P.p0);
  return { probes, resisted, accommodated, deterred, payoff };
}

/** Mulberry32 seeded RNG so a shared link replays the same history. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One simulated history. Each step: { k, p, probe, resist, pNext, pProbe, pResist }. */
export function simulate(P) {
  const r = rng(P.seed), steps = [];
  let p = P.p0;
  for (let k = P.N; k >= 1; k--) {
    const pProbe = probeProb(P, k, p);
    const probe = r() < pProbe;
    let resist = null, pResist = null, pNext = p;
    if (probe) {
      pResist = P.weak ? resistProb(P, k, p) : 1;
      resist = r() < pResist;
      pNext = resist ? (P.weak ? afterResist(P, k, p) : afterResist(P, k, p)) : 0;
    }
    steps.push({ k, p, probe, resist, pNext, pProbe, pResist });
    p = pNext;
  }
  return steps;
}
