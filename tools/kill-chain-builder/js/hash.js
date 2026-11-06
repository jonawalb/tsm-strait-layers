// Shareable board state in the URL hash.
// #t=cv&d=1200&s=30&e=0&n=sat~40~110,oth~40~270,aew~40~430~900&l=0.3,1.3&k=1
// n: type~x~y[~distance][~variant] per node (index = position in list); l: from.to links; k: knocked-out indices.
import { TYPES, TARGETS } from '../data/catalog.js';

export function writeHash(S) {
  const idx = new Map(S.nodes.map((n, i) => [n.id, i]));
  const q = new URLSearchParams({ t: S.sc.target, d: S.sc.D, s: S.sc.kt, e: S.sc.emcon ? 1 : 0 });
  q.set('n', S.nodes.map(n => [n.type, Math.round(n.x), Math.round(n.y), n.dist ?? '', n.v ?? ''].join('~').replace(/~+$/, '')).join(','));
  q.set('l', S.links.map(([a, b]) => `${idx.get(a)}.${idx.get(b)}`).join(','));
  if (S.dead.size) q.set('k', [...S.dead].map(id => idx.get(id)).join(','));
  history.replaceState(null, '', '#' + q.toString().replace(/%7E/g, '~').replace(/%2C/g, ','));
}

/** Returns a board description or null if the hash does not hold one. */
export function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (!q.has('n') || !TARGETS[q.get('t')]) return null;
  const num = (k, lo, hi, dflt) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; };
  const t = TARGETS[q.get('t')];
  const sc = { target: q.get('t'), D: num('d', 20, 3000, t.D), kt: num('s', 0, 40, t.kt), emcon: q.get('e') === '1' };
  const nodes = [];
  for (const tok of (q.get('n') || '').split(',').filter(Boolean)) {
    const [type, x, y, dist, v] = tok.split('~');
    if (!TYPES[type]) return null;
    const n = { type, x: +x || 0, y: +y || 0 };
    if (dist !== undefined && dist !== '' && Number.isFinite(+dist)) n.dist = +dist;
    if (v && TYPES[type].variants && TYPES[type].variants[v]) n.v = v;
    nodes.push(n);
  }
  const ok = i => Number.isInteger(i) && i >= 0 && i < nodes.length;
  const links = (q.get('l') || '').split(',').filter(Boolean).map(s => s.split('.').map(Number)).filter(([a, b]) => ok(a) && ok(b) && a !== b);
  const dead = (q.get('k') || '').split(',').filter(Boolean).map(Number).filter(ok);
  return { sc, nodes, links, dead };
}
