// Module A: a one-round crisis-bargaining game with audience costs.
// A two-type simplification of the mechanism in Fearon (1994), APSR 88(3):577-592, doi:10.2307/2944796.
// Pure functions, no DOM. Payoffs (S, R); the stake is worth 1 to each side and R holds it.
//   S quiet                 -> (0, 0)
//   S threatens, R concedes -> (1, -1)
//   R resists, S backs down -> (-a, 0)
//   R resists, S fights     -> (q - c_t, -q - cR)
// S's type t is resolute (war cost cL) with probability p, irresolute (war cost cH) otherwise.

export const A_DEFAULTS = { p: 0.3, a: 0.2, q: 0.5, cL: 0.2, cH: 0.9, cR: 0.8 };

export const A_CLASSES = {
  commit: { label: 'Commitment', col: '--c3', short: 'Both types would fight, so every threat is credible and R concedes.' },
  pool: { label: 'Pooling bluff', col: '--c5', short: 'Both types threaten and R concedes. The irresolute type bluffs and wins.' },
  semi: { label: 'Semi-separating', col: '--c2', short: 'The irresolute type sometimes bluffs, and R sometimes calls. War happens with positive probability.' },
  sep: { label: 'Separating, war', col: '--c4', short: 'Only the resolute type threatens and R resists anyway: every threat ends in war.' },
  quiet: { label: 'Deterred', col: '--c7', short: 'No type threatens. The status quo holds.' },
  war: { label: 'War', col: '--c6', short: 'Both types threaten, R resists, both fight.' },
};

const EPS = 1e-9;

/** Continuation value of type t if R resists: fight if q - c >= -a, otherwise back down. */
export function typeInfo(P) {
  const mk = (c, prior) => {
    const fight = P.q - c >= -P.a - EPS;
    return { c, prior, fight, r: fight ? P.q - c : -P.a };
  };
  return { L: mk(P.cL, P.p), H: mk(P.cH, 1 - P.p) };
}

/** R's cutoff: R concedes iff Pr(S fights | threat) >= muStar = 1 / (q + cR). */
export const muStar = P => 1 / (P.q + P.cR);

/** Expected payoff to R from resisting given belief mu that S fights (conceding gives -1). */
export const resistValue = (P, mu) => mu * (-P.q - P.cR);

/**
 * All perfect Bayesian equilibria of the game (generic parameters).
 * Each: { cls, sigma: {L, H} threat probabilities, rho: Pr(R resists | threat), mu: Pr(fight | threat) }.
 */
export function solveCrisis(P) {
  const T = typeInfo(P), ms = muStar(P), out = [];
  const mu = (sL, sH) => {
    const den = T.L.prior * sL + T.H.prior * sH;
    return den < EPS ? null : (T.L.prior * sL * +T.L.fight + T.H.prior * sH * +T.H.fight) / den;
  };
  // (i) R concedes for sure. Then every type threatens (1 > 0).
  const m0 = mu(1, 1);
  if (m0 != null && m0 >= ms - EPS) {
    const cls = T.H.fight && T.L.fight ? 'commit' : 'pool';
    out.push({ cls, sigma: { L: 1, H: 1 }, rho: 0, mu: m0 });
  }
  // (ii) R resists for sure. Type threatens iff its resisted payoff r > 0.
  const sL = T.L.r > EPS ? 1 : 0, sH = T.H.r > EPS ? 1 : 0;
  const m1 = mu(sL, sH);
  if (m1 == null) out.push({ cls: 'quiet', sigma: { L: 0, H: 0 }, rho: 1, mu: null, offPath: true });
  else if (m1 <= ms + EPS) out.push({ cls: sL && sH ? 'war' : 'sep', sigma: { L: sL, H: sH }, rho: 1, mu: m1 });
  // (iii) R mixes: needs mu = muStar in (0,1) and one type indifferent, (1 - rho) + rho * r = 0.
  if (ms < 1 - EPS) {
    for (const [t, s] of [['H', 'L'], ['L', 'H']]) {
      const Tt = T[t], Ts = T[s];
      if (Tt.r > EPS) continue;
      const rho = 1 / (1 - Tt.r);
      const sThreat = Ts.r > Tt.r + EPS ? 1 : 0;
      const A = Ts.prior * sThreat * +Ts.fight, B = Ts.prior * sThreat;
      const den = Tt.prior * (ms - +Tt.fight);
      if (Math.abs(den) < EPS) continue;
      const sig = (A - ms * B) / den;
      if (sig > EPS && sig < 1 - EPS) {
        const sigma = { [s]: sThreat, [t]: sig };
        out.push({ cls: 'semi', sigma, rho, mu: ms, mixer: t });
      }
    }
  }
  return out.map(e => ({ ...e, ...outcomes(T, e) }));
}

/** Outcome probabilities for an equilibrium. */
function outcomes(T, e) {
  let threat = 0, war = 0, back = 0, concede = 0;
  for (const t of ['L', 'H']) {
    const w = T[t].prior * e.sigma[t];
    threat += w; concede += w * (1 - e.rho);
    if (T[t].fight) war += w * e.rho; else back += w * e.rho;
  }
  return { pThreat: threat, pWar: war, pBack: back, pConcede: concede, pQuiet: 1 - threat };
}

/** The equilibrium the tool reports: unique for generic parameters; otherwise the first found. */
export function mainEq(P) {
  const all = solveCrisis(P);
  return { eq: all[0], all };
}

/** Closed-form boundaries used to annotate the region plot (valid when the resolute type is resolute, q > cL). */
export function boundaries(P) {
  return { aTie: P.cH - P.q, muStar: muStar(P) };
}
