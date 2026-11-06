// One-at-a-time sensitivity: nudge each input down and up and see how far the headline metric moves.
import { simulate, leakersBy } from './model.js';
import { DOCTRINES } from '../data/threats.js';

const clone = S => JSON.parse(JSON.stringify(S));
const scaleInv = (keys, f) => S => { keys.forEach(k => { S.inv[k] = Math.round(S.inv[k] * f); }); };
const docStep = (cls, d) => S => {
  const i = DOCTRINES.findIndex(x => x.k === S.doc[cls]);
  const j = Math.max(0, Math.min(DOCTRINES.length - 1, i + d));
  S.doc[cls] = DOCTRINES[j].k;
};
const docLabel = (cls, d) => S => {
  const i = DOCTRINES.findIndex(x => x.k === S.doc[cls]);
  return DOCTRINES[Math.max(0, Math.min(DOCTRINES.length - 1, i + d))].n.toLowerCase();
};

// Each factor: lo/hi mutate a copy of the state; labels describe the two ends.
const pct = f => `${f > 1 ? '+' : ''}${Math.round((f - 1) * 100)}%`;
const F = 0.25;
const FACTORS = [
  { k: 'b', n: 'Ballistic missiles a day', lo: S => { S.salvo.b *= 1 - F; }, hi: S => { S.salvo.b *= 1 + F; }, ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'c', n: 'Cruise missiles a day', lo: S => { S.salvo.c *= 1 - F; }, hi: S => { S.salvo.c *= 1 + F; }, ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'd', n: 'Drones a day', lo: S => { S.salvo.d *= 1 - F; }, hi: S => { S.salvo.d *= 1 + F; }, ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'pac', n: 'Patriot PAC-3 stock', lo: scaleInv(['mse', 'cri'], 1 - F), hi: scaleInv(['mse', 'cri'], 1 + F), ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'tk3', n: 'Tien Kung III stock', lo: scaleInv(['tk3'], 1 - F), hi: scaleInv(['tk3'], 1 + F), ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'av', n: 'Share of stock able to fire', lo: S => { S.avail *= 1 - F; }, hi: S => { S.avail = Math.min(1, S.avail * (1 + F)); }, ll: pct(1 - F), hl: 'up to 100%' },
  { k: 'pkb', n: 'Kill chance vs ballistic', lo: S => { S.pk.b *= 1 - F; }, hi: S => { S.pk.b = Math.min(0.99, S.pk.b * (1 + F)); }, ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'pkc', n: 'Kill chance vs cruise', lo: S => { S.pk.c *= 1 - F; }, hi: S => { S.pk.c = Math.min(0.99, S.pk.c * (1 + F)); }, ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'docb', n: 'Shots per ballistic missile', lo: docStep('b', -1), hi: docStep('b', 1), ll: docLabel('b', -1), hl: docLabel('b', 1) },
  { k: 'nk', n: 'Drones stopped without missiles', lo: S => { S.nk *= 1 - F; }, hi: S => { S.nk = Math.min(1, S.nk * (1 + F)); }, ll: pct(1 - F), hl: pct(1 + F) },
  { k: 'prod', n: 'Tien Kung III production', lo: S => { S.prod = 0; }, hi: S => { S.prod = S.prod * 2 || 96; }, ll: 'stops', hl: S => (S.prod > 0 ? 'doubles' : '96/yr') },
];

export const METRICS = [
  { k: 'dry', n: 'Ballistic defense dry day', unit: 'days', better: 'later' },
  { k: 'leak30', n: 'Leakers in first 30 days', unit: 'leakers', better: 'fewer' },
];

export function metric(sim, m) {
  if (m === 'leak30') return leakersBy(sim, 30);
  return sim.bmdDryF ?? sim.H + 1;
}

/** Returns base value and factors sorted by swing, each with lo/hi metric values. */
export function tornado(S, m) {
  const base = metric(simulate(S), m);
  const rows = FACTORS.map(f => {
    const a = clone(S); f.lo(a);
    const b = clone(S); f.hi(b);
    return { k: f.k, n: f.n, ll: typeof f.ll === 'function' ? f.ll(S) : f.ll, hl: typeof f.hl === 'function' ? f.hl(S) : f.hl,
      lo: metric(simulate(a), m), hi: metric(simulate(b), m) };
  });
  rows.forEach(r => { r.swing = Math.abs(r.hi - r.lo); });
  rows.sort((x, y) => y.swing - x.swing);
  return { base, rows };
}
