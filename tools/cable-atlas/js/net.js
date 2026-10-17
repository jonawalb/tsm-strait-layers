// Network model for the redundancy calculator.
// Units are what you can cut:
//   branch   `${cable}@${landing}`  one study-area landing of a cable that lands in more than one country
//   segment  `${cable}:${a}~${b}`   one landing-to-landing stretch of a single-country cable
//   whole    `${cable}`             a single-country cable whose segments cannot be derived from the route
// Places: study-area islands (NODES; landings on one island are joined over land) and one external place
// per other country ('x:Japan', 'x:United States' ...). Japanese landings outside the Nansei islands are 'x:Japan'.
// An island counts as connected when it can reach any place outside its own region (Taiwan's islands,
// the Nansei islands, the Philippines). For Taiwan's islands a route that ends only in mainland China is
// reported separately.
import { CABLES, LANDINGS, NODES } from '../data/cables.js';
import { CAPACITY } from '../data/capacity.js';

export const LP = Object.fromEntries(LANDINGS.map(l => [l.id, l]));
export const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
export const CABLE = Object.fromEntries(CABLES.map(c => [c.id, c]));
export const REGIONS = [
  { id: 'taiwan', name: 'Taiwan', home: 'Taiwan' },
  { id: 'ryukyu', name: 'Nansei (Ryukyu) islands', home: 'Japan' },
  { id: 'philippines', name: 'Philippines', home: 'Philippines' },
];
const PRC = new Set(['China', 'Hong Kong', 'Macau']);
export const place = id => LP[id].node || 'x:' + LP[id].country;
export const regionOf = p => (NODE[p] ? NODE[p].region : null);
const PRC_OWNER = /China (Telecom|Unicom|Mobile)|China Telecommunications|CITIC|Shanghai Information/i;

export const UNITS = [];
for (const c of CABLES) {
  c.study = c.lps.filter(id => LP[id].node);
  c.regions = [...new Set(c.study.map(id => NODE[LP[id].node].region))];
  c.cap = CAPACITY[c.id] || null;
  c.prcOwner = PRC_OWNER.test(c.owners || '');
  // Lands in Taiwan, and every non-Taiwan landing is in the PRC: CSCN and TSE-1.
  c.prcOnly = c.countries.includes('Taiwan') && c.countries.length > 1 && c.countries.every(k => k === 'Taiwan' || PRC.has(k));
  c.units = [];
  const push = u => { u.cable = c; c.units.push(u); UNITS.push(u); };
  if (!c.domestic) {
    for (const lp of c.study) push({ id: `${c.id}@${lp}`, kind: 'branch', lp, label: LP[lp].name });
  } else if (c.segments) {
    for (const s of c.segments) push({ id: `${c.id}:${s.a}~${s.b}`, kind: 'seg', a: s.a, b: s.b, geom: s.geom,
      label: `${LP[s.a].name} – ${LP[s.b].name}` });
  } else {
    push({ id: c.id, kind: 'whole', label: 'whole cable' });
  }
}
export const UNIT = Object.fromEntries(UNITS.map(u => [u.id, u]));
export const inService = (c, year, planned) => c.planned ? planned : (c.rfsYear ?? 0) <= year;

/** Units touching any of the given landing points. */
export const unitsAt = ids => UNITS.filter(u => ids.includes(u.lp) || ids.includes(u.a) || ids.includes(u.b)
  || (u.kind === 'whole' && u.cable.lps.some(l => ids.includes(l)))).map(u => u.id);
export const unitsOfCable = id => CABLE[id].units.map(u => u.id);

/** Build the undirected multigraph of live links. Returns edges [a, b, cap, unitId] (mid-nodes for multi-landing cables). */
function buildEdges(live) {
  const edges = [];
  const byCable = new Map();
  for (const u of live) {
    if (!byCable.has(u.cable)) byCable.set(u.cable, []);
    byCable.get(u.cable).push(u);
  }
  for (const [c, us] of byCable) {
    if (!c.domestic) {
      const mid = 'c:' + c.id;
      for (const u of us) edges.push([place(u.lp), mid, 1, u.id]);
      for (const k of new Set(c.lps.filter(l => !LP[l].node).map(place))) edges.push([mid, k, 1e6, null]);
    } else if (c.segments) {
      for (const u of us) { const a = place(u.a), b = place(u.b); if (a !== b) edges.push([a, b, 1, u.id]); }
    } else {
      // Whole cable: split hub so the cable counts once in route counts.
      const i = 'w:' + c.id, o = 'v:' + c.id;
      edges.push([i, o, 1, us[0].id]);
      for (const p of new Set(c.lps.map(place))) { edges.push([p, i, 1e6, null]); edges.push([o, p, 1e6, null]); }
    }
  }
  return edges;
}

/** Evaluate the network for { year, planned, cut:Set }. */
export function evaluate({ year, planned, cut }) {
  const active = c => inService(c, year, planned);
  const live = UNITS.filter(u => active(u.cable) && !cut.has(u.id));
  const edges = buildEdges(live);
  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  }
  const isPlace = p => !p.startsWith('c:') && !p.startsWith('w:') && !p.startsWith('v:');
  const outside = (p, reg) => isPlace(p) && regionOf(p) !== reg;
  const reach = (start, reg) => {
    const seen = new Set([start]), q = [start], hits = new Set();
    while (q.length) {
      const n = q.shift();
      if (n !== start && outside(n, reg)) { hits.add(n); continue; }
      for (const m of adj.get(n) || []) if (!seen.has(m)) { seen.add(m); q.push(m); }
    }
    return hits;
  };
  const nodes = NODES.map(n => {
    const hits = reach(n.id, n.region);
    const nonPrc = [...hits].filter(h => !PRC.has(h.slice(2)));
    const world = nonPrc.length > 0, prc = hits.size > nonPrc.length;
    const status = world ? 'good' : prc ? 'warn' : 'bad';
    const sinks = p => outside(p, n.region) && !PRC.has(p.slice(2));
    const routes = world ? maxflow(edges, n.id, sinks, p => outside(p, n.region)) : 0;
    const here = CABLES.filter(c => !c.domestic && active(c) && c.study.some(l => LP[l].node === n.id));
    const hereLive = here.filter(c => c.units.some(u => LP[u.lp].node === n.id && !cut.has(u.id)));
    return { ...n, world, prc, status, routes, intlTotal: here.length, intlLive: hereLive.length,
      capLive: sumCap(hereLive), capTotal: sumCap(here) };
  });
  const regions = REGIONS.map(r => {
    const intl = CABLES.filter(c => !c.domestic && active(c) && c.regions.includes(r.id));
    const alive = intl.filter(c => c.units.some(u => NODE[LP[u.lp].node].region === r.id && !cut.has(u.id)));
    const lps = LANDINGS.filter(l => l.node && NODE[l.node].region === r.id).map(l => {
      const us = UNITS.filter(u => active(u.cable) && (u.lp === l.id || u.a === l.id || u.b === l.id
        || (u.kind === 'whole' && u.cable.lps.includes(l.id))));
      const ok = us.filter(u => !cut.has(u.id));
      const intlUs = us.filter(u => u.kind === 'branch');
      return { id: l.id, total: us.length, alive: ok.length, intl: intlUs.length,
        intlAlive: intlUs.filter(u => !cut.has(u.id)).length, dark: us.length > 0 && ok.length === 0 };
    });
    const rn = nodes.filter(n => n.region === r.id);
    return { ...r, intlTotal: intl.length, intlLive: alive.length, capTotal: sumCap(intl), capLive: sumCap(alive),
      prcOnlyTotal: intl.filter(c => c.prcOnly).length, prcOnlyLive: alive.filter(c => c.prcOnly).length,
      lps, nodes: rn, cutOff: rn.filter(n => n.status !== 'good').length,
      sites: lps.filter(l => l.intl > 0).length, sitesLive: lps.filter(l => l.intlAlive > 0).length };
  });
  return { nodes, regions, live: new Set(live.map(u => u.id)) };
}

/** Sum of published design capacity (Tbps) over cables with a figure; also counts how many have one. */
export function sumCap(cables) {
  const known = cables.filter(c => c.cap && c.cap.tbps != null);
  return { tbps: known.reduce((s, c) => s + c.cap.tbps, 0), known: known.length, n: cables.length };
}

/** Edge-disjoint routes from src to any sink (each cable branch or segment worth one). */
function maxflow(edges, src, isSink, isStop) {
  const T = '__T', cap = new Map(), adj = new Map();
  const key = (a, b) => a + '|' + b;
  const add = (a, b, c) => {
    cap.set(key(a, b), (cap.get(key(a, b)) || 0) + c);
    if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  };
  const sinks = new Set();
  for (const [a, b, c] of edges) {
    const directed = a.startsWith('w:') || b.startsWith('w:') || a.startsWith('v:') || b.startsWith('v:');
    add(a, b, c); if (!directed) add(b, a, c);
    for (const p of [a, b]) if (p !== src && isSink(p)) sinks.add(p);
  }
  for (const s of sinks) add(s, T, 1e9);
  let flow = 0;
  for (let guard = 0; guard < 400; guard++) {
    const prev = new Map([[src, null]]), q = [src];
    while (q.length && !prev.has(T)) {
      const n = q.shift();
      if (n !== src && sinks.has(n)) { if ((cap.get(key(n, T)) || 0) > 0 && !prev.has(T)) prev.set(T, n); continue; }
      if (n !== src && isStop(n)) continue; // other regions and foreign places are endpoints, never transit
      for (const m of adj.get(n) || []) if (!prev.has(m) && (cap.get(key(n, m)) || 0) > 0) { prev.set(m, n); q.push(m); }
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
