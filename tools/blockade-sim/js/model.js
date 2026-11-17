// Day-by-day scenario model of a PRC quarantine or blockade of Taiwan.
// Units: arrivals and flows are shares of normal (1 = a normal day). Fuel stocks are days of normal use.
// Every parameter comes from data/params.js (sourced facts, or labelled assumptions the user can change).
import { MIX, POWER_SHARE, SECTORS, STOCKS, BASE, PARTNERS } from '../data/params.js';
import { TW_CABLES } from '../data/cables.js';

export const H = 180;
const FK = ['lng', 'coal', 'oil'];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const relax = (x, tgt, tau) => x + (tgt - x) * (1 - Math.exp(-1 / Math.max(0.5, tau)));

// Demand-side drawdown policies. Cuts are shares of each sector's normal power use (assumptions).
export const POLICY_CUTS = {
  normal: { cut: {}, fuel: {}, order: 'prorata' },
  conserve: { cut: { res: 0.10, svc: 0.10 }, fuel: { oil: 0.10 }, order: 'priority' },
  ration: { cut: { res: 0.15, svc: 0.30, ind: 0.40 }, fuel: { lng: 0.4, coal: 0.4, oil: 0.3 }, order: 'priority' },
};
const PRIORITY = ['ess', 'energy', 'chips', 'res', 'svc', 'ind'];

function allocate(supply, demand, order) {
  const got = {};
  let left = supply;
  if (order === 'prorata') {
    // Essential services first, everyone else shares the shortfall equally.
    got.ess = Math.min(demand.ess, left); left -= got.ess;
    const rest = SECTORS.filter(s => s.k !== 'ess');
    const want = rest.reduce((a, s) => a + demand[s.k], 0);
    const r = want > 0 ? Math.min(1, left / want) : 1;
    rest.forEach(s => { got[s.k] = demand[s.k] * r; });
  } else {
    PRIORITY.forEach(k => { got[k] = Math.max(0, Math.min(demand[k], left)); left -= got[k]; });
  }
  return Object.fromEntries(SECTORS.map(s => [s.k, demand[s.k] > 0 ? clamp(got[s.k] / demand[s.k]) : 1]));
}

/** Which international cables are out of service once the chosen landing areas are cut. */
export function cutCables(areas) {
  const set = new Set(areas);
  return TW_CABLES.filter(c => {
    if (c.intl) return c.areas.length > 0 && c.areas.every(a => set.has(a));
    return set.has('outlying');
  });
}

/**
 * cfg: scenario (see state.js). A: resolved assumption values keyed as in data/params.js ASSUME.
 * Returns daily series plus summary events.
 */
export function simulate(cfg, A) {
  const dur = cfg.dur, sev = cfg.sev / 100, quarantine = cfg.mode === 'q';
  const stock0 = { ...(STOCKS.find(s => s.k === cfg.stk) || STOCKS[0]).v };
  const pol = POLICY_CUTS[cfg.pol] || POLICY_CUTS.normal;
  const demand = Object.fromEntries(SECTORS.map(s => [s.k, s.share * (1 - (pol.cut[s.k] || 0))]));
  const need = Object.values(demand).reduce((a, b) => a + b, 0);
  const nonPower = k => (1 - POWER_SHARE[k]) * (1 - (pol.fuel[k] || 0));
  const yieldPer = { lng: MIX.gas / POWER_SHARE.lng, coal: MIX.coal / POWER_SHARE.coal, oil: MIX.oil / POWER_SHARE.oil };
  const floor = { lng: cfg.floor || 0, coal: 0, oil: 0 };

  const stock = { ...stock0 };
  let avoid = 0, prem = A.premBase, recov = 1, lastDark = -1;
  const sentHist = [], boardHist = [];
  const days = [];
  const ev = { runout: { lng: null, coal: null, oil: null }, gridHalf: null, listed: null, noCover: null, chipsDown: null };

  for (let t = 0; t < H; t++) {
    const on = t < dur;
    // --- insurer state and commercial avoidance (share of owners who will not send a ship)
    let tgt = 0, premT = A.premBase, state = 'normal';
    if (on) {
      state = 'hold'; tgt = A.avoidHold; premT = A.premHold;
      if (cfg.ins !== 'hold' && t >= A.listLag) { state = 'listed'; tgt = A.avoidList; premT = A.premList; }
      if (cfg.ins === 'withdrawn' && t >= A.listLag + A.noticeDays) { state = 'withdrawn'; tgt = A.avoidWd; premT = A.premPeak; }
      if (!quarantine) tgt = Math.max(tgt, A.avoidBlockadeFloor);
      if (cfg.fac && t >= A.facLag) { tgt *= 1 - A.facCut; if (state === 'withdrawn') premT = A.premList; }
      if (cfg.esc === 'allied' && t >= A.convoyLag) tgt *= 1 - A.escAvoidCut;
    }
    avoid = relax(avoid, tgt, tgt > avoid ? A.tauUp : A.tauDown);
    prem = relax(prem, premT, premT > prem ? A.tauUp / 2 : A.tauDown);
    if (state === 'listed' && ev.listed == null) ev.listed = t;
    if (state === 'withdrawn' && ev.noCover == null && !cfg.fac) ev.noCover = t;

    // --- physical interdiction, reduced by escorts
    let esc = 0;
    if (cfg.esc === 'tw') esc = A.escTw;
    if (cfg.esc === 'allied') esc = A.escTw + (A.escAllied - A.escTw) * clamp((t - A.convoyLag) / 7 + 1);
    const stop = on ? sev * (1 - esc) : 0;

    // --- arrivals (share of normal cargo reaching Taiwan's ports today)
    const sent = 1 - avoid;
    sentHist[t] = sent; boardHist[t] = quarantine ? stop : 0;
    let arrive;
    if (quarantine) {
      const d = Math.round(A.qDelay), tl = t - d;
      const late = tl >= 0 ? sentHist[tl] * boardHist[tl] * (1 - A.qTurnback) : 0;
      arrive = sent * (1 - stop) + late;
    } else arrive = sent * (1 - stop);

    // --- fuel stocks and power
    const avail = {};
    FK.forEach(k => {
      const room = stock[k] < stock0[k];
      avail[k] = stock[k] + arrive * (!on && room ? 1 + A.restock : 1);
    });
    const gen = { renew: Math.min(need, MIX.renew), coal: 0, gas: 0, oil: 0 };
    let rest = Math.max(0, need - gen.renew);
    const burn = (fk, gk) => {
      const usable = Math.max(0, avail[fk] - (on ? floor[fk] : 0));
      const g = Math.min(MIX[gk], rest, usable * yieldPer[fk]);
      gen[gk] += g; rest -= g; avail[fk] -= g / yieldPer[fk];
    };
    burn('coal', 'coal'); burn('lng', 'gas'); burn('oil', 'oil');
    FK.forEach(k => {
      avail[k] -= Math.min(nonPower(k), Math.max(0, avail[k] - (on ? floor[k] : 0)));
      stock[k] = Math.min(Math.max(stock0[k], stock[k]), Math.max(0, avail[k]));
      if (on && ev.runout[k] == null && stock[k] <= floor[k] + 0.05 && stock0[k] > floor[k]) ev.runout[k] = t;
    });
    const supply = gen.renew + gen.coal + gen.gas + gen.oil;
    const served = allocate(supply, demand, pol.order);
    const gridShare = supply / 1; // share of normal (pre-crisis) demand that is met
    if (ev.gridHalf == null && on && gridShare < 0.5) ev.gridHalf = t;

    // --- chip output: power to fabs, with a restart lag after any cut
    const fabPower = served.chips;
    if (fabPower < A.fabMin) { lastDark = t; recov = 0; }
    else if (recov < 1) recov = Math.min(1, recov + 1 / Math.max(1, A.fabRestart));
    const chips = fabPower < A.fabMin ? fabPower * A.fabPartial : Math.min(fabPower, recov);
    if (ev.chipsDown == null && chips < 0.5) ev.chipsDown = t;
    const air = cfg.air ? arrive : 1;
    const icExp = BASE.icExportDay * chips * air;
    const otherExp = BASE.otherExportDay * arrive * served.ind;

    // --- shipping
    const divert = on ? (quarantine ? A.divertQ : A.divertB) : 0;
    days.push({
      t, on, state, avoid, prem, stop, arrive,
      stock: { ...stock }, gen, supply, grid: gridShare, need, served,
      chips, icExp, otherExp,
      calls: BASE.callsDay * arrive,
      strait: BASE.straitDay * (1 - divert), divert,
    });
  }

  // --- cables: cut on day 1, repaired by a limited repair fleet
  const cut = cutCables(cfg.cab || []);
  const access = cfg.rep === 'peace' ? 1 : cfg.rep === 'escorted' ? 1 + A.escortRepairDelay : Math.max(1, dur);
  let shipsFree = Array.from({ length: Math.max(1, Math.round(A.repairShips)) }, () => access + A.mobilize);
  const repairs = cut.map(c => {
    shipsFree.sort((a, b) => a - b);
    const start = shipsFree[0], done = start + A.repairWork;
    shipsFree[0] = done;
    return { id: c.id, name: c.name, intl: c.intl, cut: 1, start, done };
  });
  const intlTotal = TW_CABLES.filter(c => c.intl).length;
  days.forEach(d => {
    const down = repairs.filter(r => r.intl && d.t >= r.cut && d.t < r.done).length;
    d.cablesUp = (intlTotal - down) / intlTotal;
    d.outlyingCut = repairs.some(r => !r.intl && d.t >= r.cut && d.t < r.done);
  });

  // --- totals
  const lost = days.reduce((a, d) => a + (BASE.icExportDay - d.icExp) + (BASE.otherExportDay - d.otherExp), 0);
  const lostIc = days.reduce((a, d) => a + (BASE.icExportDay - d.icExp), 0);
  const partners = PARTNERS.map(p => ({ ...p, lost: lost * p.share }));
  const minGrid = days.reduce((a, d) => (d.grid < a.grid ? d : a), days[0]);
  const peakPrem = days.reduce((a, d) => Math.max(a, d.prem), 0);
  return { cfg, A, days, ev, repairs, lost, lostIc, partners, minGrid, peakPrem, stock0, intlTotal, mobilize: A.mobilize };
}
