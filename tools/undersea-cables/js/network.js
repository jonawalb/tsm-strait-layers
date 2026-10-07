// Connectivity model for the cut simulator.
// Units are the things you can cut:
//   international branch  `${cableId}@${landingId}`  one Taiwanese landing of a cable that also lands abroad
//   domestic segment      `${cableId}:${a}~${b}`     one landing-to-landing stretch of a Taiwan-only cable
// Islands are graph nodes; landing points on the same island are assumed joined over land.
// Two external nodes: WORLD (any foreign landing outside the PRC-only case) and PRC (cables whose only
// foreign landings are in mainland China or Hong Kong).
import { CABLES, LANDINGS } from '../data/cables.js';

export const LP = Object.fromEntries(LANDINGS.map(l => [l.id, l]));
export const ISLANDS = [
  { id: 'taiwan', name: 'Taiwan (main island)', short: 'Taiwan', label: [121.0, 23.7] },
  { id: 'penghu', name: 'Penghu', short: 'Penghu', label: [119.58, 23.57] },
  { id: 'kinmen', name: 'Kinmen', short: 'Kinmen', label: [118.38, 24.45] },
  { id: 'nangan', name: 'Nangan (Matsu)', short: 'Nangan', label: [119.94, 26.16] },
  { id: 'beigan', name: 'Beigan (Matsu)', short: 'Beigan', label: [119.99, 26.23] },
  { id: 'dongyin', name: 'Dongyin (Matsu)', short: 'Dongyin', label: [120.49, 26.37] },
  { id: 'juguang', name: 'Juguang (Matsu)', short: 'Juguang', label: [119.94, 25.97] },
];
const PRC = new Set(['China']);

export const UNITS = [];
for (const c of CABLES) {
  c.prcOnly = !c.domestic && c.countries.filter(k => k !== 'Taiwan').every(k => PRC.has(k));
  c.twLps = c.lps.filter(id => LP[id]?.country === 'Taiwan');
  c.units = [];
  if (c.domestic) {
    for (const s of c.segments) {
      const u = { id: `${c.id}:${s.a}~${s.b}`, cable: c, kind: 'dom', a: s.a, b: s.b, geom: s.geom,
        label: `${LP[s.a].name} – ${LP[s.b].name}` };
      c.units.push(u); UNITS.push(u);
    }
  } else {
    for (const lp of c.twLps) {
      const u = { id: `${c.id}@${lp}`, cable: c, kind: 'intl', lp, label: LP[lp].name };
      c.units.push(u); UNITS.push(u);
    }
  }
}
export const UNIT = Object.fromEntries(UNITS.map(u => [u.id, u]));

/** Cables in service in `year`; planned systems count only when `planned` is on. */
export const inService = (c, year, planned) => (c.rfsYear ?? 0) <= year && (!c.planned || planned);

/**
 * Evaluate the network. opts: { year, planned, cut:Set<unitId>, prcCounts:boolean }
 * Returns per-island status, per-landing status and headline counts.
 */
export function evaluate({ year, planned, cut, prcCounts }) {
  const live = UNITS.filter(u => inService(u.cable, year, planned) && !cut.has(u.id));
  const edges = [];            // [nodeA, nodeB, unitId]
  for (const u of live) {
    if (u.kind === 'dom') {
      const a = LP[u.a].island, b = LP[u.b].island;
      if (a !== b) edges.push([a, b, u.id]);
    } else {
      edges.push([LP[u.lp].island, u.cable.prcOnly ? 'PRC' : 'WORLD', u.id]);
    }
  }
  // External nodes are endpoints, never transit: traffic cannot hop from a PRC landing to a foreign one.
  const EXT = new Set(['WORLD', 'PRC']);
  const reach = start => {
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const n = q.shift();
      if (EXT.has(n) && n !== start) continue;
      for (const [a, b] of edges) {
        const m = a === n ? b : b === n ? a : null;
        if (m && !seen.has(m)) { seen.add(m); q.push(m); }
      }
    }
    return seen;
  };
  const fromWorld = reach('WORLD'), fromPrc = reach('PRC'), fromTaiwan = reach('taiwan');
  const islands = ISLANDS.map(i => {
    const touching = live.filter(u => u.kind === 'dom' ? [LP[u.a].island, LP[u.b].island].includes(i.id) && LP[u.a].island !== LP[u.b].island : LP[u.lp].island === i.id);
    const world = fromWorld.has(i.id), prc = fromPrc.has(i.id);
    const viaPrcOnly = !world && prc;
    const intl = world || (prcCounts && prc);
    const status = world ? 'good' : prc ? 'warn' : 'bad';
    const routes = maxflow(edges, i.id, prcCounts ? ['WORLD', 'PRC'] : ['WORLD']);
    return { ...i, world, prc, viaPrcOnly, intl, status, links: touching.length, routes,
      toTaiwan: i.id === 'taiwan' || fromTaiwan.has(i.id) };
  });
  const allIntl = CABLES.filter(c => !c.domestic && inService(c, year, planned));
  const liveIntl = allIntl.filter(c => c.units.some(u => !cut.has(u.id)));
  const lps = LANDINGS.filter(l => l.country === 'Taiwan').map(l => {
    const here = UNITS.filter(u => inService(u.cable, year, planned) && (u.lp === l.id || u.a === l.id || u.b === l.id));
    const alive = here.filter(u => !cut.has(u.id));
    return { ...l, total: here.length, alive: alive.length, dark: here.length > 0 && alive.length === 0 };
  });
  return {
    islands, lps, live,
    intlTotal: allIntl.length, intlLive: liveIntl.length,
    prcTotal: allIntl.filter(c => c.prcOnly).length, prcLive: liveIntl.filter(c => c.prcOnly).length,
    intlNonPrcTotal: allIntl.filter(c => !c.prcOnly).length, intlNonPrcLive: liveIntl.filter(c => !c.prcOnly).length,
  };
}

/** Edge-disjoint routes from `src` to any of `sinks`: how many more cuts isolate it (unit capacities). */
function maxflow(edges, src, sinks) {
  const T = '__T';
  const cap = new Map();
  const key = (a, b) => a + '|' + b;
  const add = (a, b, c) => cap.set(key(a, b), (cap.get(key(a, b)) || 0) + c);
  const adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  const ext = n => n === 'WORLD' || n === 'PRC';
  for (const [a, b] of edges) {
    if (ext(b) && !sinks.includes(b)) continue;
    add(a, b, 1); link(a, b);
    if (!ext(b)) { add(b, a, 1); link(b, a); }
  }
  for (const s of sinks) { add(s, T, 1e9); link(s, T); link(T, s); }
  let flow = 0;
  for (let guard = 0; guard < 200; guard++) {
    const prev = new Map([[src, null]]), q = [src];
    while (q.length && !prev.has(T)) {
      const n = q.shift();
      for (const m of adj.get(n) || []) {
        if (!prev.has(m) && (cap.get(key(n, m)) || 0) > 0) { prev.set(m, n); q.push(m); }
      }
    }
    if (!prev.has(T)) break;
    for (let v = T; prev.get(v) != null; v = prev.get(v)) {
      const u = prev.get(v);
      cap.set(key(u, v), cap.get(key(u, v)) - 1);
      cap.set(key(v, u), (cap.get(key(v, u)) || 0) + 1);
    }
    flow++;
  }
  return flow;
}

/** Units that touch any of the given landing points (a landing-point cut). */
export const unitsAt = lpIds => UNITS.filter(u => lpIds.includes(u.lp) || lpIds.includes(u.a) || lpIds.includes(u.b)).map(u => u.id);
/** Units that touch an island. */
export const unitsOnIsland = isl => UNITS.filter(u => u.kind === 'dom'
  ? (LP[u.a].island === isl) !== (LP[u.b].island === isl) : LP[u.lp].island === isl).map(u => u.id);
