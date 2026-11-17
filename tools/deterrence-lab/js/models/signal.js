// Module B: costly signaling by tying hands or sinking costs.
// A two-type version of the comparison in Fearon (1997), JCR 41(1):68-90, doi:10.1177/0022002797041001004.
// Pure functions, no DOM.
//
// Sender S values the stake at vR = 1 (resolute) or vI < c (irresolute); war costs S an amount c <= 1.
// Prior Pr(resolute) = p. S chooses to signal or stay silent. Then R pushes or backs off.
//   R backs off          -> S keeps the stake: v_t
//   R pushes, S fights   -> v_t - c
//   R pushes, S quits    -> 0
// Sinking costs: a signal costs k up front, paid whatever happens.
// Tying hands: a signal is free, but S pays a if it quits after being pushed.
// R's payoff: back off 0; push and S quits +1; push and S fights -cR.
// R's cost cR is private, uniform on [-L, H], so a share P0 = L / (L + H) of receivers want war anyway (cR < 0).
// R pushes iff cR < (1 - phi) / phi, where phi = Pr(S fights | what R saw).

export const B_DEFAULTS = { tech: 'sunk', k: 0.3, p: 0.35, vI: 0.35, c: 0.7, P0: 0.1, H: 2 };
export const V_R = 1;
const EPS = 1e-9;

export const B_CLASSES = {
  sep: { label: 'Separating', col: '--c3', short: 'Only the resolute type signals. The signal reveals the type.' },
  semi: { label: 'Semi-separating', col: '--c2', short: 'The irresolute type signals some of the time. The signal is partly informative.' },
  pool: { label: 'Pooling on the signal', col: '--c5', short: 'Both types signal. R learns nothing about type.' },
  commit: { label: 'Commitment', col: '--c1', short: 'Hands are tied so tightly that both types would fight. Every signaler follows through.' },
  silent: { label: 'No signal', col: '--c7', short: 'The signal costs too much to be worth sending.' },
};

/** Pr(R pushes | phi). */
export function pushProb(P, phi) {
  const L = P.P0 * P.H / (1 - P.P0);
  if (phi <= EPS) return 1;
  const x = (1 - phi) / phi;
  return Math.max(0, Math.min(1, (x + L) / (L + P.H)));
}

/** Inverse: the phi at which R pushes with probability pi (pi in (P0, 1)). */
export function phiFor(P, pi) {
  const L = P.P0 * P.H / (1 - P.P0);
  const x = pi * (L + P.H) - L;
  return x <= 0 ? 1 : 1 / (1 + x);
}

export const committed = (P, a) => P.tech === 'tied' && a >= P.c - P.vI - EPS;

/** Payoff to a signaling type when R pushes with probability pi. */
export function sendPay(P, t, pi, size) {
  const v = t === 'r' ? V_R : P.vI;
  if (P.tech === 'sunk') return (t === 'r' ? v - pi * P.c : (1 - pi) * v) - size;
  if (t === 'r' || committed(P, size)) return v - pi * P.c;
  return (1 - pi) * v - pi * size;
}
/** Payoff when silent and R pushes with probability pi. */
const silentPay = (P, t, pi) => t === 'r' ? V_R - pi * P.c : (1 - pi) * P.vI;

/**
 * Equilibria for signal size s (k for sunk, a for tied). Resolute signals whenever anyone does.
 * Returns list ordered from most to least informative. Each: { cls, sR, sI, phi, pi, post, piSilent, ic }.
 */
export function solveSignal(P, s) {
  const out = [], fI = committed(P, s) ? 1 : 0, P0 = pushProb(P, 1);
  const rOK = pi => sendPay(P, 'r', pi, s) >= silentPay(P, 'r', 1) - EPS; // silence => pushed for sure
  // Separating: only resolute signals, phi = 1.
  if (rOK(P0) && sendPay(P, 'i', P0, s) <= EPS) out.push(mk('sep', 1, 0, 1, P0));
  // Semi-separating: irresolute indifferent between signaling and silence (payoff 0).
  if (!fI) {
    const piStar = P.tech === 'sunk' ? 1 - s / P.vI : P.vI / (P.vI + s);
    if (piStar > P0 + EPS && piStar < 1 - EPS) {
      const phi = phiFor(P, piStar);
      const sI = P.p * (1 - phi) / ((1 - P.p) * phi);
      if (sI > EPS && sI < 1 - EPS && rOK(piStar)) out.push(mk('semi', 1, sI, phi, piStar));
    }
  }
  // Pooling on the signal.
  {
    const phi = P.p + (1 - P.p) * fI, pi = pushProb(P, phi);
    if (rOK(pi) && sendPay(P, 'i', pi, s) >= -EPS) out.push(mk(fI ? 'commit' : 'pool', 1, 1, phi, pi));
  }
  // Silent pooling, supported by the belief that a signaler will not fight. Check the Intuitive Criterion.
  {
    const pi = pushProb(P, P.p);
    const uI = silentPay(P, 'i', pi), uR = silentPay(P, 'r', pi);
    const devI = sendPay(P, 'i', P0, s), devR = sendPay(P, 'r', P0, s);
    const iOut = devI < uI - EPS;
    const failsIC = iOut && devR > uR + EPS;
    const e = mk('silent', 0, 0, null, null);
    e.piSilent = pi; e.ic = !failsIC;
    out.push(e);
  }
  return out.map(e => withOutcomes(P, e, s, fI));

  function mk(cls, sR, sI, phi, pi) {
    const post = sR + sI > 0 ? P.p * sR / (P.p * sR + (1 - P.p) * sI) : null;
    return { cls, sR, sI, phi, pi, post, piSilent: 1, ic: true };
  }
}

function withOutcomes(P, e, s, fI) {
  const wR = P.p * e.sR, wI = (1 - P.p) * e.sI;
  const silR = P.p * (1 - e.sR);
  const pi = e.pi ?? 0, piS = e.cls === 'silent' ? e.piSilent : 1;
  const pWar = (wR + wI * fI) * pi + silR * piS;
  const pBluffCalled = wI * (1 - fI) * pi;
  const cost = P.tech === 'sunk' ? (wR + wI) * s : pBluffCalled * s;
  const uR = e.cls === 'silent' ? silentPay(P, 'r', piS) : sendPay(P, 'r', pi, s);
  const uI = e.cls === 'silent' ? silentPay(P, 'i', piS) : (e.sI > 0 ? sendPay(P, 'i', pi, s) : 0);
  return { ...e, pWar, pBluffCalled, cost, uR, uI, uAvg: P.p * uR + (1 - P.p) * uI, pSignal: wR + wI };
}

/** The reported equilibrium: the most informative one; silence only if nothing else exists. */
export function mainSignal(P, s) {
  const all = solveSignal(P, s);
  return { eq: all[0], all };
}

/** Smallest signal size at which no signaler would ever back down (Fearon's "no bluffing"). */
export function noBluffSize(P) {
  if (P.tech === 'sunk') return (1 - pushProb(P, 1)) * P.vI;
  const P0 = pushProb(P, 1);
  // Tied: either irresolute prefers silence at phi = 1, or it is committed.
  const sepA = P0 > EPS ? P.vI * (1 - P0) / P0 : Infinity;
  return Math.min(sepA, P.c - P.vI);
}

export const maxSize = P => P.tech === 'sunk' ? Math.max(1.2, P.c * 1.4) : Math.max(1.2, (P.c - P.vI) * 1.6);
