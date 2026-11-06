// Interceptor Burn-down: day-by-day expected-value model of Taiwan's interceptor magazine under PRC salvos.
import { SYSTEMS, ORDER, PAC3 } from '../data/inventory.js';
import { THREATS, PRC_STOCK, DOCTRINES, NOTIONAL } from '../data/threats.js';

const DOC = Object.fromEntries(DOCTRINES.map(d => [d.k, d]));
export const BMD = SYSTEMS.filter(s => s.roles.includes('b')).map(s => s.k);

/** Systems a threat class may draw on under the current rules, in firing order. */
function shooters(cls, S) {
  let list = ORDER[cls];
  if (cls === 'c' && S.savePac) list = list.filter(k => !PAC3.has(k));
  if (cls === 'd') {
    if (S.dronePol === 'none') return [];
    if (S.dronePol === 'cheap') list = list.filter(k => k === 'nasams' || k === 'tk2');
    else if (S.savePac) list = list.filter(k => !PAC3.has(k));
  }
  return list;
}

/** Expected interceptors per engaged threat (e) and kill probability (p) for one system and threat class. */
export function shot(cls, sysKey, S) {
  const sys = SYSTEMS.find(s => s.k === sysKey);
  const pk = Math.min(0.99, S.pk[cls] * (cls === 'b' && sys.limB ? NOTIONAL.limB : 1));
  return DOC[S.doc[cls]].f(pk, NOTIONAL.look[cls]);
}

/**
 * Run the campaign. All quantities are expected values, so fractions are allowed.
 * Day 0 holds the starting magazine; salvos arrive on days 1..horizon.
 */
export function simulate(S) {
  const H = S.horizon || NOTIONAL.horizon;
  const stock = Object.fromEntries(SYSTEMS.map(s => [s.k, (S.inv[s.k] || 0) * S.avail]));
  const start = { ...stock };
  const prcLeft = { b: S.cap ? PRC_STOCK.b : Infinity, c: S.cap ? PRC_STOCK.c : Infinity, d: Infinity };
  const days = [{ t: 0, stock: { ...stock }, inc: { b: 0, c: 0, d: 0 }, kill: { b: 0, c: 0, d: 0 }, leak: { b: 0, c: 0, d: 0 }, fired: {} }];
  const dry = Object.fromEntries(SYSTEMS.map(s => [s.k, null]));
  const cum = { inc: 0, leak: 0, leakB: 0, fired: 0 };
  let bmdDry = null, bmdDryF = null, prevBmd = BMD.reduce((a, k) => a + stock[k], 0), prcOut = { b: null, c: null };
  const e0 = shot('b', 'mse', S).e;

  for (let t = 1; t <= H; t++) {
    const mult = t <= 3 ? S.surge : 1;
    const inc = {}, kill = {}, leak = {}, fired = {};
    for (const th of THREATS) {
      const want = S.salvo[th.k] * mult;
      const n = Math.min(want, prcLeft[th.k]);
      prcLeft[th.k] -= n;
      if (prcLeft[th.k] <= 0 && prcOut[th.k] === null && S.salvo[th.k] > 0 && th.k !== 'd') prcOut[th.k] = t;
      inc[th.k] = n;
      let left = n, k = 0, missed = 0;
      if (th.k === 'd') { k += left * S.nk; left -= left * S.nk; }
      for (const sk of shooters(th.k, S)) {
        if (left <= 1e-9) break;
        if (stock[sk] < 1e-6) continue;
        const { e, p } = shot(th.k, sk, S);
        const engaged = Math.min(left, stock[sk] / e);
        stock[sk] -= engaged * e;
        fired[sk] = (fired[sk] || 0) + engaged * e;
        k += engaged * p; missed += engaged * (1 - p); left -= engaged;
      }
      kill[th.k] = k; leak[th.k] = left + missed;
    }
    // Resupply arrives at the end of the day.
    if (S.prod > 0) stock.tk3 += S.prod / 365;
    if (S.us > 0) stock.mse += S.us / 7;
    for (const s of SYSTEMS) {
      if (dry[s.k] === null && start[s.k] >= 1 && stock[s.k] < 1) dry[s.k] = t;
    }
    const bmdLeft = BMD.reduce((a, k) => a + stock[k], 0);
    if (bmdDry === null && bmdLeft < e0 && S.salvo.b > 0) {
      bmdDry = t;
      // Fractional crossing, used by the sensitivity chart so small changes still show.
      bmdDryF = prevBmd > bmdLeft ? t - 1 + Math.min(1, Math.max(0, (prevBmd - e0) / (prevBmd - bmdLeft))) : t;
    }
    prevBmd = bmdLeft;
    cum.inc += inc.b + inc.c + inc.d;
    cum.leak += leak.b + leak.c + leak.d;
    cum.leakB += leak.b;
    cum.fired += Object.values(fired).reduce((a, b) => a + b, 0);
    days.push({ t, stock: { ...stock }, inc, kill, leak, fired, cum: { ...cum } });
  }
  const startTotal = Object.values(start).reduce((a, b) => a + b, 0);
  return { days, dry, bmdDry, bmdDryF, prcOut, start, startTotal, H, cum };
}

/** Leakers over the first n days. */
export function leakersBy(sim, n) {
  return sim.days.slice(1, n + 1).reduce((a, d) => a + d.leak.b + d.leak.c + d.leak.d, 0);
}
