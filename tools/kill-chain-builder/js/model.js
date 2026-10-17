// Kill chain evaluation. Pure functions, no DOM, so it can be tested under Node.
// A graph is { nodes: [{id, type, dist?, v?}], links: [[fromId, toId]], dead: Set<id> }.
// A scenario is { target: key, D: km, kt: knots, emcon: bool }.
import { TYPES, TARGETS, FIX_SIGMA, TRACK_UPDATE, SPACE_DIST, EMCON_EMIT } from '../data/catalog.js';

export const STEPS = ['Find', 'Fix', 'Track', 'Target', 'Engage', 'Assess'];
const KT_KM_MIN = 1.852 / 60;
const PATH_CAP = 4000;

export const typeOf = n => TYPES[n.type];
export const reachOf = n => { const t = typeOf(n); return (t.variants && n.v && t.variants[n.v]) ? t.variants[n.v].reach : t.reach; };

/** Distance from a node to the target. Land-based nodes sit on the home coast, D km away. */
export function distOf(n, sc) {
  const t = typeOf(n);
  if (t.space) return SPACE_DIST;
  if (t.fwd) return Math.min(sc.D, n.dist ?? t.dist0);
  return sc.D;
}

export function signature(sc) {
  const s = { ...TARGETS[sc.target].sig };
  if (sc.emcon) s.emit = Math.min(s.emit, EMCON_EMIT);
  return s;
}

/** Detection check for one sensor. Returns { ok, range, ch, why }. */
export function detect(n, sc) {
  const t = typeOf(n), sig = signature(sc), d = distOf(n, sc);
  let best = { ok: false, range: 0, ch: null, d };
  for (const ch in t.ch) {
    const s = sig[ch] || 0;
    if (s <= 0) continue;
    const r = t.ch[ch] * Math.pow(s, ch === 'radar' ? 0.25 : 0.5);
    if (r > best.range) best = { ok: false, range: r, ch, d };
  }
  if (t.rmin && d < t.rmin) return { ...best, ok: false, skip: true };
  best.ok = best.range >= d;
  return best;
}

const fixQuality = t => t.sigma <= FIX_SIGMA;
const trackQuality = t => t.update <= TRACK_UPDATE;

function adjacency(g) {
  const out = new Map(g.nodes.map(n => [n.id, []]));
  for (const [a, b] of g.links) if (out.has(a) && out.has(b)) out.get(a).push(b);
  return out;
}

/** Cheapest relay route (sum of relay minutes of intermediate nodes) from src to every node. */
function relayRoutes(g, byId, out, alive, src) {
  const dist = new Map([[src, 0]]), todo = [src];
  while (todo.length) {
    todo.sort((a, b) => dist.get(a) - dist.get(b));
    const u = todo.shift();
    for (const v of out.get(u)) {
      if (!alive(v)) continue;
      const tv = typeOf(byId.get(v));
      const cost = dist.get(u) + (tv.cat === 'c2' ? tv.relay : 0);
      if (!dist.has(v) || cost < dist.get(v)) { dist.set(v, cost); todo.push(v); }
    }
  }
  return dist;
}

/** Every simple path from a sensor through C2 nodes to a shooter, over live nodes. */
export function enumeratePaths(g, alive) {
  const byId = new Map(g.nodes.map(n => [n.id, n])), out = adjacency(g), paths = [];
  const walk = (id, path, seen) => {
    if (paths.length >= PATH_CAP) return;
    for (const nx of out.get(id)) {
      if (!alive(nx) || seen.has(nx)) continue;
      const c = typeOf(byId.get(nx)).cat;
      if (c === 'shooter') paths.push([...path, nx]);
      else if (c === 'c2') { seen.add(nx); walk(nx, [...path, nx], seen); seen.delete(nx); }
    }
  };
  for (const n of g.nodes) if (alive(n.id) && typeOf(n).cat === 'sensor') walk(n.id, [n.id], new Set([n.id]));
  return { paths, byId, out, truncated: paths.length >= PATH_CAP };
}

/** Evaluate one path. Returns step flags, a time breakdown, and the position error at impact. */
function evalPath(p, ctx) {
  const { byId, sc, det, trackers, v, tgt } = ctx;
  const s = byId.get(p[0]), w = byId.get(p[p.length - 1]);
  const ts = typeOf(s), tw = typeOf(w), mids = p.slice(1, -1).map(id => byId.get(id));
  const segs = [{ k: 'wait', label: `Wait for ${ts.short} look`, min: ts.update / 2, node: s.id },
    { k: 'proc', label: `${ts.short} report`, min: ts.proc, node: s.id }];
  let auth = null;
  for (const m of mids) {
    const tm = typeOf(m);
    if (!auth && tm.authority) { auth = m; segs.push({ k: 'decide', label: `${tm.short} decides`, min: tm.decide, node: m.id }); }
    else segs.push({ k: 'relay', label: `${tm.short} relays`, min: tm.relay, node: m.id });
  }
  if (!auth && tw.authority) { auth = w; segs.push({ k: 'decide', label: `${tw.short} decides`, min: tw.decide, node: w.id }); }
  const dw = distOf(w, sc), reach = reachOf(w);
  const flight = dw / tw.speed + tw.over;
  segs.push({ k: 'launch', label: `${tw.short} launches`, min: tw.launch, node: w.id });
  segs.push({ k: 'flight', label: 'Weapon flight', min: flight, node: w.id });
  const total = segs.reduce((a, b) => a + b.min, 0);
  const fixAge = total - segs[0].min; // position data age at impact, counted from the detection
  let err = ts.sigma + v * fixAge, src = { id: s.id, kind: 'fix', age: fixAge, sigma: ts.sigma };
  for (const t of trackers) {
    const route = t.routes.get(w.id);
    if (route == null) continue;
    const tt = typeOf(t.n);
    const age = tt.update / 2 + tt.proc + route + (tw.mid ? 0 : tw.launch + flight);
    const e = tt.sigma + v * age;
    if (e < err - 1e-9) { err = e; src = { id: t.n.id, kind: tw.mid ? 'mid' : 'track', age, sigma: tt.sigma }; }
  }
  const ok = {
    find: det.get(s.id).ok,
    fix: det.get(s.id).ok && fixQuality(ts),
    track: err <= tw.basket && total <= tgt.dwell,
    target: !!auth,
    engage: dw <= reach && !(tw.ships && !tgt.ship),
  };
  let progress = 0;
  for (const k of ['find', 'fix', 'track', 'target', 'engage']) { if (!ok[k]) break; progress++; }
  return { p, ok, progress, closes: progress === 5, segs, total, err, basket: tw.basket, src, auth: auth && auth.id,
    dw, reach, dwell: tgt.dwell, sensor: s.id, shooter: w.id };
}

/** Evaluate the whole board. */
export function evaluate(g, sc) {
  const dead = g.dead || new Set();
  const alive = id => !dead.has(id);
  const tgt = TARGETS[sc.target], v = sc.kt * KT_KM_MIN;
  const { paths, byId, out, truncated } = enumeratePaths(g, alive);
  const det = new Map(), sensors = g.nodes.filter(n => typeOf(n).cat === 'sensor');
  for (const n of sensors) det.set(n.id, detect(n, sc));
  const seeing = sensors.filter(n => alive(n.id) && det.get(n.id).ok);
  const trackers = seeing.filter(n => trackQuality(typeOf(n)))
    .map(n => ({ n, routes: relayRoutes(g, byId, out, alive, n.id) }));
  const ctx = { byId, sc, det, trackers, v, tgt };
  const evals = paths.map(p => evalPath(p, ctx));
  const closing = evals.filter(e => e.closes);
  const rank = (a, b) => (b.progress - a.progress) || (a.err / a.basket - b.err / b.basket) || (a.total - b.total);
  const best = closing.length ? [...closing].sort((a, b) => a.total - b.total)[0] : [...evals].sort(rank)[0] || null;
  const steps = STEPS.map((_, i) => i < 5 ? !!best && best.progress > i : false);
  if (!best || !best.p) steps[0] = seeing.length > 0;
  // Assess: a live damage-capable sensor that sees the target and can report to the deciding node or the shooter.
  let assessBy = null;
  if (best && best.closes) {
    for (const n of seeing) {
      if (!typeOf(n).assess) continue;
      const r = relayRoutes(g, byId, out, alive, n.id);
      if (n.id === best.sensor || r.has(best.auth) || r.has(best.shooter)) { assessBy = n.id; break; }
    }
    steps[5] = assessBy != null;
  }
  return { evals, closing, best, steps, det, seeing: seeing.map(n => n.id), assessBy, truncated,
    disjoint: closing.length ? disjointPaths(closing) : 0, v };
}

/**
 * Node-disjoint closing paths. First a max-flow bound (Menger): split every node into in/out with
 * capacity 1, connect a super-source to each closing sensor and each closing shooter to a super-sink,
 * using only links that appear on some closing path. Then decompose the flow and check that each
 * route found is itself a closing path. If one is not, fall back to an exact search over closing paths.
 */
export function disjointPaths(closing) {
  const nodes = new Set(), edges = new Set();
  for (const e of closing) { e.p.forEach(id => nodes.add(id)); for (let i = 1; i < e.p.length; i++) edges.add(e.p[i - 1] + '>' + e.p[i]); }
  const ids = [...nodes], ix = new Map(ids.map((id, i) => [id, i])), N = ids.length * 2 + 2, S = N - 2, T = N - 1;
  const cap = Array.from({ length: N }, () => new Map());
  const add = (a, b, c) => { cap[a].set(b, (cap[a].get(b) || 0) + c); if (!cap[b].has(a)) cap[b].set(a, 0); };
  ids.forEach((id, i) => add(2 * i, 2 * i + 1, 1));
  for (const k of edges) { const [a, b] = k.split('>').map(Number); add(2 * ix.get(a) + 1, 2 * ix.get(b), 1); }
  const srcs = new Set(closing.map(e => e.sensor)), sinks = new Set(closing.map(e => e.shooter));
  srcs.forEach(id => add(S, 2 * ix.get(id), 1));
  sinks.forEach(id => add(2 * ix.get(id) + 1, T, 1));
  let flow = 0;
  for (;;) { // Edmonds-Karp
    const prev = new Array(N).fill(-1); prev[S] = S; const q = [S];
    while (q.length && prev[T] < 0) { const u = q.shift(); for (const [v, c] of cap[u]) if (c > 0 && prev[v] < 0) { prev[v] = u; q.push(v); } }
    if (prev[T] < 0) break;
    for (let v = T; v !== S; v = prev[v]) { const u = prev[v]; cap[u].set(v, cap[u].get(v) - 1); cap[v].set(u, cap[v].get(u) + 1); }
    flow++;
  }
  // Decompose: follow saturated split-out -> split-in arcs from each used source.
  const key = p => p.join('-'), closingKeys = new Set(closing.map(e => key(e.p)));
  let allClose = true;
  for (const sid of srcs) {
    if (cap[S].get(2 * ix.get(sid)) !== 0) continue;
    const route = [sid]; let cur = sid, guard = 0;
    while (!sinks.has(cur)) {
      const outNode = 2 * ix.get(cur) + 1;
      const nxt = ids.find(id => edges.has(cur + '>' + id) && cap[outNode].get(2 * ix.get(id)) === 0);
      if (nxt == null || ++guard > 50) break;
      route.push(nxt); cur = nxt;
    }
    if (!closingKeys.has(key(route))) allClose = false;
  }
  return allClose ? flow : exactPacking(closing);
}

function exactPacking(closing) {
  const P = closing.slice(0, 300).map(e => new Set(e.p)).sort((a, b) => a.size - b.size);
  let best = 0;
  const go = (i, used, k) => {
    if (k + (P.length - i) <= best) return;
    if (i === P.length) { best = Math.max(best, k); return; }
    if ([...P[i]].every(id => !used.has(id))) { const u2 = new Set(used); P[i].forEach(id => u2.add(id)); go(i + 1, u2, k + 1); }
    go(i + 1, used, k);
  };
  go(0, new Set(), 0);
  return best;
}

/** Nodes whose loss alone leaves no closing path (evaluated with the node removed). */
export function singlePoints(g, sc) {
  const base = evaluate(g, sc);
  if (!base.closing.length) return [];
  const dead = g.dead || new Set();
  return g.nodes.filter(n => !dead.has(n.id))
    .filter(n => evaluate({ ...g, dead: new Set([...dead, n.id]) }, sc).closing.length === 0).map(n => n.id);
}
