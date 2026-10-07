// Batch play: many seeded games of one plan, and same-seed comparisons of several plans.
import { createGame, step } from './model.js';

/** Play one full game with scripted orders for both sides. */
export function play(setup, seed, P, plaFn, rocFn) {
  const G = createGame(setup, seed, P);
  while (!G.over) step(G, plaFn(G), rocFn(G));
  return G;
}

/** n games on seeds base+1..base+n. Returns outcome shares and distributions. */
export function batch(setup, P, plaFn, rocFn, n = 1000, base = 0) {
  const out = { pla: 0, contested: 0, roc: 0, n, ashore: [], lostShips: [], lostTroops: [] };
  for (let i = 1; i <= n; i++) {
    const G = play(setup, base + i, P, plaFn, rocFn);
    const R = G.result;
    out[R.outcome]++;
    out.ashore.push(R.total);
    out.lostShips.push(R.stats.lostAmph + R.stats.lostFerry);
    out.lostTroops.push(R.stats.lostTroops);
  }
  for (const k of ['pla', 'contested', 'roc']) out[k] /= n;
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  out.medAshore = med(out.ashore); out.medLostShips = med(out.lostShips); out.medLostTroops = med(out.lostTroops);
  return out;
}
