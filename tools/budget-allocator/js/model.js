// Notional attack-through-layers model. Every coefficient here is illustrative; see the method section on the page.
// The page never shows a single run of it: range.js runs it many times across assumption ranges and reports spreads.
// The structure is the same for every country: an attacking force moves `geo.km` toward the defended coast or line
// at `geo.kmh`, through layers of the defender's fires. Categories fill fixed roles by id:
// ascm, drones, mines, strike, platforms (shooting layers), airdef, c4isr, ammo (enablers), other (not modeled).
import { ctx } from './ctx.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Capability level 0..1 after spending `bn` on top of the notional baseline, with diminishing returns. */
export function capability(c, bn) {
  if (c.id === 'other') return 0;
  return 1 - (1 - c.base) * Math.exp(-bn / c.k);
}

/**
 * Evaluate an allocation.
 * shares: {catId: fraction of total}, total: bn of local currency, sc: { supp: 0..0.9 suppression, warn: days of warning }
 * env: optional { cats, geo } to run with perturbed parameters instead of the active profile's.
 */
export function evaluate(shares, total, sc, env = ctx) {
  const CATS = env.cats, G = env.geo;
  const bn = Object.fromEntries(CATS.map(c => [c.id, (shares[c.id] || 0) * total]));
  const E = Object.fromEntries(CATS.map(c => [c.id, capability(c, bn[c.id])]));
  const supp = sc.supp;
  // Survival of the defender's forces after the attacker's opening suppression campaign.
  const surv = {
    mobile: clamp(1 - supp * (1 - 0.55 * E.c4isr) * (1 - 0.35 * E.airdef)),
    fixed: clamp(1 - supp * (1 - 0.6 * E.airdef)),
    platform: clamp(1 - 1.1 * supp * (1 - 0.35 * E.airdef)),
  };
  // Share of the planned minefield or obstacle belt laid before the assault: more warning, more laid.
  const laid = 1 - Math.exp(-sc.warn / 3.5);
  // Can the defender still find and track the attacking force? Resilient sensors and networks survive suppression better.
  const track = 0.55 + 0.45 * E.c4isr * (1 - 0.4 * supp);
  // Can shooters keep firing across successive waves?
  const sustain = 0.6 + 0.4 * E.ammo;

  const layers = CATS.filter(c => c.w > 0).map(c => {
    let st;
    if (c.id === 'mines') st = E.mines * laid;
    else if (c.id === 'drones') st = E.drones * surv.mobile * (0.5 + 0.5 * track) * sustain;
    else st = E[c.id] * surv[c.cls] * track * sustain;
    return { id: c.id, t: c.t, col: c.col, reach: c.reach, st, p: c.w * st, active: st >= 0.1 };
  });
  const engaged = 1 - layers.reduce((a, l) => a * (1 - l.p), 1);
  // Hours under fire: the stretch of the approach where the layers that reach it add up to real pressure.
  let covered = 0;
  for (let d = 0.5; d < G.km; d += 1) {
    if (layers.filter(l => l.reach >= d).reduce((a, l) => a + l.st, 0) >= 0.3) covered += 1;
  }
  const hours = G.km / G.kmh, fireHours = covered / G.kmh;
  const resilience = 100 * clamp(0.3 * E.c4isr + 0.25 * E.ammo + 0.2 * E.airdef + 0.25 * surv.mobile);
  return { bn, E, surv, laid, track, sustain, layers, engaged, hours, fireHours, covered, resilience, unscored: shares.other || 0 };
}
