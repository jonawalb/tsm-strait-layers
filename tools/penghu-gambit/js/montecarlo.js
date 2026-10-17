// Monte Carlo: replay one setup many times with seeded dice, then test which levers move the result.
import { playGame } from './model.js';
import { MENU } from '../data/params.js';

export const RUNS = 1000;

/** Seed for run i of a batch: spreads consecutive runs across the generator's state space. */
const runSeed = (seed, i) => (Math.imul(seed ^ 0x9E3779B9, 2654435761) + Math.imul(i + 1, 40503)) >>> 0;

/** Play `n` games. Returns outcome shares, capture-turn histogram and average statistics. */
export function monteCarlo(cfg, P, seed, n = RUNS) {
  const out = { pla: 0, roc: 0, stale: 0, n, wonAt: new Array(cfg.turns + 1).fill(0), sunk: 0, mined: 0, downed: 0, droneHits: 0, strikeKills: 0 };
  for (let i = 0; i < n; i++) {
    const g = playGame(cfg, P, runSeed(seed, i), false);
    out[g.outcome]++;
    if (g.wonAt) out.wonAt[g.wonAt]++;
    for (const k of ['sunk', 'mined', 'downed', 'droneHits', 'strikeKills']) out[k] += g.stats[k];
  }
  for (const k of ['sunk', 'mined', 'downed', 'droneHits', 'strikeKills']) out[k] /= n;
  return out;
}

const clone = cfg => ({ ...cfg, roc: { ...cfg.roc, mines: { ...cfg.roc.mines } }, pla: { ...cfg.pla } });

/**
 * One-at-a-time sensitivity. Each variant changes one lever by one step and replays the same seeds
 * (common random numbers), so the difference reflects the lever and not the dice.
 */
export function drivers(cfg, P, seed, base, n = RUNS) {
  const V = [];
  const push = (t, side, f) => { const c = clone(cfg); if (f(c) === false) return; V.push({ t, side, c }); };
  for (const m of MENU) {
    if (cfg.roc[m.k] < m.max) push(`+1 ${m.one}`, 'roc', c => { c.roc[m.k]++; });
    if (cfg.roc[m.k] > 0) push(`−1 ${m.one}`, 'roc', c => { c.roc[m.k]--; });
  }
  if (cfg.pla.plan === 'assault') {
    const s = cfg.pla.sector;
    push(cfg.roc.mines[s] ? 'Remove mines from the landing sector' : 'Mine the landing sector', 'roc', c => { c.roc.mines[s] = !c.roc.mines[s]; });
    push(cfg.roc.demo ? 'No demolition plan' : 'Add demolition plan', 'roc', c => { c.roc.demo = !c.roc.demo; });
  }
  push(cfg.roc.harden ? 'No hardening' : 'Add hardening', 'roc', c => { c.roc.harden = !c.roc.harden; });
  if (cfg.pla.plan === 'assault') {
    if (cfg.pla.strikes < 3) push('PLA: one more strike turn', 'pla', c => { c.pla.strikes++; });
    if (cfg.pla.strikes > 0) push('PLA: one fewer strike turn', 'pla', c => { c.pla.strikes--; });
    if (cfg.pla.lift < 6) push('PLA: one more landing group per wave', 'pla', c => { c.pla.lift++; });
    if (cfg.pla.lift > 2) push('PLA: one fewer landing group per wave', 'pla', c => { c.pla.lift--; });
    push(cfg.pla.offload ? 'PLA: full offload rate' : 'PLA: Falklands offload rate', 'pla', c => { c.pla.offload = !c.pla.offload; });
  }
  return V.map(v => {
    const r = monteCarlo(v.c, P, seed, n);
    return { t: v.t, side: v.side, d: (r.pla - base.pla) / n, dRoc: (r.roc - base.roc) / n };
  }).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}
