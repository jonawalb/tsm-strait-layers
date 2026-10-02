// Shareable state in the URL hash.
// #a=2&s=2&m=1&r=2&k=1&d=1&mn=E&dm=1&hd=0&pl=assault&st=1&sc=E&lf=4&v=heli&of=0&t=8&seed=1683&v.pMine=0.2
import { MENU, SECTORS, VERTICAL, PROB } from '../data/params.js';

const KEYS = { ashm: 'a', shorad: 's', marines: 'm', reserves: 'r', stocks: 'k', drones: 'd' };

export function writeHash(cfg, P, seed, view) {
  const q = new URLSearchParams();
  for (const m of MENU) q.set(KEYS[m.k], cfg.roc[m.k]);
  q.set('mn', Object.keys(cfg.roc.mines).filter(k => cfg.roc.mines[k]).join(''));
  q.set('dm', cfg.roc.demo ? 1 : 0); q.set('hd', cfg.roc.harden ? 1 : 0);
  q.set('pl', cfg.pla.plan); q.set('st', cfg.pla.strikes); q.set('sc', cfg.pla.sector);
  q.set('lf', cfg.pla.lift); q.set('vt', cfg.pla.vertical); q.set('of', cfg.pla.offload ? 1 : 0);
  q.set('t', cfg.turns); q.set('seed', seed);
  if (view) q.set('turn', view);
  for (const p of PROB) if (P[p.k] !== p.v) q.set('p.' + p.k, P[p.k]);
  history.replaceState(null, '', '#' + q.toString());
}

/** Apply a hash onto defaults. Returns { cfg, P, seed, view } with every value clamped. */
export function readHash(cfg, P, seed) {
  const q = new URLSearchParams(location.hash.slice(1));
  if (![...q.keys()].length) return { cfg, P, seed, view: 0 };
  const num = (k, lo, hi, d) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  for (const m of MENU) cfg.roc[m.k] = Math.round(num(KEYS[m.k], 0, m.max, cfg.roc[m.k]));
  if (q.has('mn')) for (const k of Object.keys(SECTORS)) cfg.roc.mines[k] = (q.get('mn') || '').includes(k);
  if (q.has('dm')) cfg.roc.demo = q.get('dm') === '1';
  if (q.has('hd')) cfg.roc.harden = q.get('hd') === '1';
  if (['assault', 'blockade'].includes(q.get('pl'))) cfg.pla.plan = q.get('pl');
  cfg.pla.strikes = Math.round(num('st', 0, 3, cfg.pla.strikes));
  if (SECTORS[q.get('sc')]) cfg.pla.sector = q.get('sc');
  cfg.pla.lift = Math.round(num('lf', 2, 6, cfg.pla.lift));
  if (VERTICAL[q.get('vt')]) cfg.pla.vertical = q.get('vt');
  if (q.has('of')) cfg.pla.offload = q.get('of') === '1';
  cfg.turns = Math.round(num('t', 5, 8, cfg.turns));
  for (const p of PROB) if (q.has('p.' + p.k)) P[p.k] = num('p.' + p.k, p.min, p.max, p.v);
  return { cfg, P, seed: Math.round(num('seed', 1, 999999, seed)), view: Math.round(num('turn', 0, cfg.turns, 0)) };
}
