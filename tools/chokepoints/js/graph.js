// Shortest route over the hand-drawn sea-lane graph, skipping edges through closed chokepoints.
import { distKm } from '../../../shared/js/mapkit.js';
import { NODES, EDGES } from '../data/lanes.js';

const ADJ = new Map();
for (const [a, b, tag] of EDGES) {
  const km = distKm(NODES[a], NODES[b]);
  for (const [x, y] of [[a, b], [b, a]]) {
    if (!ADJ.has(x)) ADJ.set(x, []);
    ADJ.get(x).push({ to: y, km, tag });
  }
}

/** Dijkstra. Returns { nodes, pts, km, tags } or null when the destination cannot be reached. */
export function route(from, to, closed = new Set()) {
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  const open = [from];
  while (open.length) {
    open.sort((a, b) => dist.get(a) - dist.get(b));
    const u = open.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const e of ADJ.get(u) || []) {
      if (e.tag && closed.has(e.tag)) continue;
      const d = dist.get(u) + e.km;
      if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); prev.set(e.to, { u, tag: e.tag }); open.push(e.to); }
    }
  }
  if (!dist.has(to)) return null;
  const nodes = [to], tags = [];
  for (let n = to; prev.has(n); n = prev.get(n).u) {
    const p = prev.get(n);
    nodes.unshift(p.u);
    if (p.tag && !tags.includes(p.tag)) tags.unshift(p.tag);
  }
  return { nodes, pts: nodes.map(n => NODES[n]), km: dist.get(to), tags };
}

export const KM_PER_NM = 1.852;
export const days = (km, knots) => km / KM_PER_NM / knots / 24;
