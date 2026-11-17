// Range model: runs the notional model (model.js) across wide ranges of assumptions nobody can pin down
// and reports only the spread of results. There is no single answer, verdict or "chance of winning" on the page.
// The same fixed set of draws is used for every plan, so differences between plans come from the plans, not noise.
import { ctx } from './ctx.js';
import { evaluate } from './model.js';

const N = 200;
// Each assumption is drawn uniformly between lo and hi. Multipliers apply to every category's notional parameter.
export const ASSUMPTIONS = [
  { id: 'supp', t: 'Strength of the opening strikes', lo: 0.2, hi: 0.8, f: v => `${Math.round(v * 100)}% of unprotected forces destroyed` },
  { id: 'warn', t: 'Warning before the assault', lo: 2, hi: 10, f: v => `${Math.round(v)} days` },
  { id: 'k', t: 'How much capability the money buys', lo: 0.5, hi: 2, f: v => `scale ×${v.toFixed(2)}` },
  { id: 'base', t: 'Capability already in hand', lo: 0.6, hi: 1.4, f: v => `baselines ×${v.toFixed(2)}` },
  { id: 'w', t: 'How much of the force each layer can reach', lo: 0.6, hi: 1.4, f: v => `max shares ×${v.toFixed(2)}` },
  { id: 'speed', t: 'Attacker speed', lo: 0.75, hi: 1.5, f: v => `speed ×${v.toFixed(2)}` },
];
const mid = a => (a.lo + a.hi) / 2;

export const METRICS = [
  { id: 'engaged', t: 'Force engaged', s: 'share of the attacking force that comes under effective attack', get: r => r.engaged },
  { id: 'fire', t: 'Approach under fire', s: 'share of the approach inside at least one working layer of fires', get: r => r.covered / r.km },
  { id: 'shooters', t: 'Shooters left', s: 'share of launchers and platforms that survive the opening strikes', get: r => mobileWeighted(r) },
  { id: 'res', t: 'Resilience', s: 'how well the force keeps working after it is hit, 0 to 100', get: r => r.resilience / 100 },
];

/** Share of all shooting capability (mobile launchers and platforms) still alive, weighted by what was bought. */
function mobileWeighted(e) {
  const m = e.E.ascm + e.E.drones + e.E.strike, p = e.E.platforms;
  return (m * e.surv.mobile + p * e.surv.platform) / (m + p || 1);
}

function rng(seed) { // mulberry32: fixed seed, so the same plan always shows the same ranges
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DRAWS = (() => { const r = rng(20261003); return Array.from({ length: N }, () => Object.fromEntries(ASSUMPTIONS.map(a => [a.id, a.lo + (a.hi - a.lo) * r()]))); })();
const MIDS = Object.fromEntries(ASSUMPTIONS.map(a => [a.id, mid(a)]));

function run(shares, total, d) {
  const env = {
    cats: ctx.cats.map(c => ({ ...c, k: c.k * d.k, base: Math.min(0.9, c.base * d.base), w: Math.min(1, c.w * d.w) })),
    geo: { ...ctx.geo, kmh: ctx.geo.kmh * d.speed },
  };
  const r = evaluate(shares, total, { supp: d.supp, warn: d.warn }, env);
  r.km = ctx.geo.km;
  return r;
}

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

/** Spread of each metric across all draws: lo/hi = 10th/90th percentile, min/max = full range. */
export function ranges(shares, total) {
  const runs = DRAWS.map(d => run(shares, total, d));
  return Object.fromEntries(METRICS.map(m => {
    const v = runs.map(m.get).sort((a, b) => a - b);
    return [m.id, { lo: q(v, 0.1), hi: q(v, 0.9), min: v[0], max: v[v.length - 1] }];
  }));
}

/** How far each assumption alone moves "force engaged" (others held at the middle of their ranges). */
export function drivers(shares, total, metric = METRICS[0]) {
  return ASSUMPTIONS.map(a => {
    const lo = metric.get(run(shares, total, { ...MIDS, [a.id]: a.lo }));
    const hi = metric.get(run(shares, total, { ...MIDS, [a.id]: a.hi }));
    return { ...a, swing: Math.abs(hi - lo) };
  }).sort((x, y) => y.swing - x.swing);
}

/** Force engaged with every assumption at the middle of its range; used only to compare the size of two effects. */
export const midValue = (shares, total, metric = METRICS[0]) => metric.get(run(shares, total, MIDS));
