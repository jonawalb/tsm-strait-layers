// Scripted plans for both sides: the computer opponent, the comparison plans in the review, and the
// balance check. Each returns the orders for the current turn from the game state.
import { ZONES, ZONE_KEYS, LIFT } from '../data/params.js';
import { seaAt, defAt, busiest } from './model.js';

// ---------- PLA plans ----------

/** Split n groups between the main and second zone. */
function split(n, share, zones) {
  const [a, b] = zones;
  if (!b) return { [a]: n };
  const m = Math.round(n * share);
  return { [a]: m, [b]: n - m };
}

/**
 * Build PLA orders from fractions: amph and ferry = share of ready groups sent; mainShare = share to the main zone;
 * ferryRule: 'always' | 'calm' (only in slight seas or to a held port) | 'port' (only once a port is held).
 */
export function plaOrders(G, { amph = 1, ferry = 1, mainShare = 1, ferryRule = 'always', strike = 'even', port = true }) {
  const zones = G.setup.zones.filter(Boolean);
  const nA = Math.round(G.ready.amph * amph);
  let nF = Math.round(G.ready.ferry * ferry);
  const sa = split(nA, mainShare, zones), sf = split(nF, mainShare, zones);
  const send = {};
  for (const z of zones) {
    let f = sf[z] || 0;
    const sea = seaAt(G, G.t + 1, z);
    const portOk = G.port[z] !== 'roc';
    if (ferryRule === 'port' && !portOk) f = 0;
    if (ferryRule === 'calm' && !portOk && sea.b > 0) f = 0;
    send[z] = { amph: sa[z] || 0, ferry: f };
  }
  const portOrders = Object.fromEntries(zones.map(z => [z, port]));
  return { send, strike, port: portOrders };
}

/** Doctrinal plan: hunt launchers first, hold the ferries until a port is taken, push for the port. */
export function plaDoctrine(G) {
  const alive = G.launchers.filter(L => L.alive && L.ammo > 0).length;
  const strike = G.t < 2 || alive > 6 ? 'hunt' : 'cut';
  return plaOrders(G, { amph: 1, ferry: 1, mainShare: G.setup.zones[1] ? 0.7 : 1, ferryRule: 'port', strike, port: true });
}

/** Naive plan: everything sails every turn, ferries to open beaches, strikes spread thin, no port assault. */
export function plaNaive(G) {
  return plaOrders(G, { amph: 1, ferry: 1, mainShare: 0.5, ferryRule: 'always', strike: 'even', port: false });
}

/** A recorded player plan: per-turn fractions, replayed on another seed (orders that no longer fit are clamped). */
export function plaRecorded(rec) {
  return G => plaOrders(G, rec[G.t] || rec[rec.length - 1] || {});
}

export const PLA_SETUPS = {
  doctrine: { month: 3, wait: 'calm', zones: ['central', null], us: true, prep: 'hunt' },
  naive: { month: 9, wait: 0, zones: ['north', 'south'], us: true, prep: 'even' },
};

// ---------- Taiwan plans ----------

/** Doctrine for Taiwan: fire at every wave, rush reserves to the biggest lodgment, counterattack early. */
export function rocDoctrine(G, { caRatio = 1.1, keepNorth = true, fire = 1 } = {}) {
  const hot = busiest(G);
  const moves = {};
  let kept = false;
  for (const r of G.reserves) {
    if (keepNorth && hot !== 'north' && r.dest === 'north' && !kept) { kept = true; continue; }
    moves[r.id] = hot;
  }
  const ca = {};
  for (const z of ZONE_KEYS) {
    const A = G.ashore[z];
    if (A <= 0) continue;
    ca[z] = defAt(G, z) >= caRatio * A * G.P.support;
  }
  return { fire, moves, ca, mobTo: hot };
}

/** Passive defense: hold positions, never counterattack. */
export function rocPassive(G) {
  return { fire: 1, moves: {}, ca: {}, mobTo: busiest(G) };
}

/** A recorded Taiwan plan, replayed by turn. */
export function rocRecorded(rec) {
  return G => rec[G.t] || rocDoctrine(G);
}

export const ROC_SETUP = { mines: { north: 0.6, central: 0.4, south: 0.2 }, demo: 0.5, forward: 0.5 };

/** Label helper for the zones a plan used. */
export const zoneList = zones => zones.filter(Boolean).map(z => ZONES[z].area).join(' + ');
export { LIFT };
