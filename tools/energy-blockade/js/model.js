// Daily stock-and-flow model of Taiwan's fuel stocks and power grid under a blockade.
// Units: a fuel's "day" is one day of its normal (pre-blockade) total consumption.
// Grid output is a share of normal daily generation (1 = normal).
import { MIX, POWER_SHARE, SECTORS, POLICIES, MEASURES, NOTIONAL } from '../data/baseline.js';

const FK = ['lng', 'coal', 'oil'];

/** Sector demand after demand-reduction measures, and fuel cuts outside the power sector. */
export function demandProfile(measures) {
  const cut = Object.fromEntries(SECTORS.map(s => [s.k, 0]));
  const fuelCut = { lng: 0, coal: 0, oil: 0 };
  let gen = 0;
  MEASURES.forEach(m => {
    if (!measures[m.k]) return;
    Object.entries(m.cut || {}).forEach(([k, v]) => { cut[k] = 1 - (1 - cut[k]) * (1 - v); });
    Object.entries(m.fuel || {}).forEach(([k, v]) => { fuelCut[k] = 1 - (1 - fuelCut[k]) * (1 - v); });
    gen += m.gen || 0;
  });
  const demand = Object.fromEntries(SECTORS.map(s => [s.k, s.share * (1 - cut[s.k])]));
  const total = Object.values(demand).reduce((a, b) => a + b, 0);
  return { demand, total, fuelCut, backup: gen };
}

/** Split available power across sectors in the policy's priority order. Returns served share per sector. */
export function allocate(supply, demand, policyKey) {
  const pol = POLICIES.find(p => p.k === policyKey) || POLICIES[0];
  const got = Object.fromEntries(SECTORS.map(s => [s.k, 0]));
  let left = supply;
  for (const [k, part] of pol.tiers) {
    const want = demand[k] * part;
    const give = Math.max(0, Math.min(want, left));
    got[k] += give; left -= give;
  }
  return Object.fromEntries(SECTORS.map(s => [s.k, demand[s.k] > 0 ? Math.min(1, got[s.k] / demand[s.k]) : 1]));
}

/**
 * Run the model.
 * cfg: { sev (0-100), dur (days), stock: {lng,coal,oil}, policy, measures: {k: bool} }
 */
export function simulate(cfg) {
  const H = NOTIONAL.horizon, sev = cfg.sev / 100;
  const prof = demandProfile(cfg.measures);
  const stock = { ...cfg.stock };
  const cap0 = { ...cfg.stock };
  const days = [];
  const runout = { lng: null, coal: null, oil: null };
  const dark = Object.fromEntries(SECTORS.map(s => [s.k, null]));
  // generation produced per fuel-day burned in power
  const yieldPer = { lng: MIX.gas / POWER_SHARE.lng, coal: MIX.coal / POWER_SHARE.coal, oil: MIX.oil / POWER_SHARE.oil };
  const nonPower = k => (1 - POWER_SHARE[k]) * (1 - prof.fuelCut[k]);

  for (let t = 0; t < H; t++) {
    const blockaded = t < cfg.dur;
    const inflow = blockaded ? 1 - sev : 1 + NOTIONAL.restock;
    // fuel available today for all uses: stock plus arrivals
    const avail = Object.fromEntries(FK.map(k => [k, stock[k] + inflow]));
    // Power fuel gets priority over other uses once stocks are gone (CSIS module logic).
    const need = prof.total;
    let rest = Math.max(0, need - MIX.renew * NOTIONAL.renewAvail);
    const gen = { renew: Math.min(need, MIX.renew * NOTIONAL.renewAvail), coal: 0, gas: 0, oil: 0, backup: 0 };
    const burn = { lng: 0, coal: 0, oil: 0 };
    const dispatch = (fk, gk, cap, per) => {
      const g = Math.min(cap, rest, avail[fk] * per);
      gen[gk] += g; rest -= g;
      const f = g / per; burn[fk] += f; avail[fk] -= f;
    };
    dispatch('coal', 'coal', MIX.coal, yieldPer.coal);   // coal first to stretch LNG
    dispatch('lng', 'gas', MIX.gas, yieldPer.lng);
    dispatch('oil', 'oil', MIX.oil, yieldPer.oil);
    if (prof.backup > 0) dispatch('oil', 'backup', prof.backup, 1 / NOTIONAL.oilGenBurn);
    // non-power uses take what is left
    const other = {};
    FK.forEach(k => { other[k] = Math.min(nonPower(k), avail[k]); avail[k] -= other[k]; });
    FK.forEach(k => {
      stock[k] = Math.min(Math.max(cap0[k], 0), Math.max(0, avail[k]));
      if (runout[k] == null && blockaded && stock[k] <= 1e-6 && cap0[k] > 0) runout[k] = t;
    });
    const supply = gen.renew + gen.coal + gen.gas + gen.oil + gen.backup;
    const served = allocate(supply, prof.demand, cfg.policy);
    SECTORS.forEach(s => { if (dark[s.k] == null && served[s.k] < NOTIONAL.dark) dark[s.k] = t; });
    days.push({ t, blockaded, stock: { ...stock }, gen, supply, demand: need, served,
      otherFuel: FK.reduce((o, k) => ({ ...o, [k]: nonPower(k) > 0 ? other[k] / nonPower(k) : 1 }), {}) });
  }
  const minDay = days.reduce((a, d) => (d.supply / d.demand < a.supply / a.demand ? d : a), days[0]);
  return { days, runout, dark, prof, minDay, cap0 };
}

/** Fraction of normal (pre-blockade) demand, for readouts. */
export const pct = v => Math.round(v * 100) + '%';
