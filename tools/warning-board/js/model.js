// Aggregation model for the warning board. All weights, overlaps and thresholds are NOTIONAL teaching values.
import { INDICATORS, DOMAINS } from '../data/indicators.js';

export const VAL = [0, 0.5, 1];                       // not observed, ambiguous, observed
export const EXO = { high: 0.8, some: 0.4, low: 0.1 };  // share of the signal an exercise could also explain
export const TIMING = {
  days: { name: 'Days', f: 0.75, text: 'The signals appeared within a few days.' },
  weeks: { name: 'Weeks', f: 1, text: 'The signals have built over several weeks.' },
  months: { name: 'Months', f: 1.1, text: 'The signals have persisted for months.' },
};

export const BANDS = [
  { id: 0, name: 'Routine baseline', s: 'good', short: 'Routine' },
  { id: 1, name: 'Elevated activity', s: 'good', short: 'Elevated' },
  { id: 2, name: 'Exercise-consistent pattern', s: 'warn', short: 'Exercise-like' },
  { id: 3, name: 'Beyond an exercise', s: 'warn', short: 'Anomalous' },
  { id: 4, name: 'Strategic warning', s: 'bad', short: 'Warning' },
];

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

/** states: { id: 0|1|2 }. Returns every number the board displays. */
export function assess(states, timing = 'weeks') {
  const v = i => VAL[states[i.id] || 0];
  const domains = DOMAINS.map(d => {
    const list = INDICATORS.filter(i => i.d === d.id);
    const score = sum(list, i => i.w * v(i)) / sum(list, i => i.w);
    return { ...d, score, lit: list.filter(i => states[i.id]).length, n: list.length };
  });
  const S = sum(INDICATORS, i => i.w * v(i)) / sum(INDICATORS, i => i.w);
  const D = sum(INDICATORS, i => i.w * v(i) * (1 - EXO[i.ex])) / sum(INDICATORS, i => i.w * (1 - EXO[i.ex]));
  const litW = sum(INDICATORS, i => i.w * v(i));
  const exShare = litW ? sum(INDICATORS, i => i.w * v(i) * EXO[i.ex]) / litW : 0;
  const breadth = domains.filter(d => d.score >= 0.35).length;
  const tf = TIMING[timing].f;
  const Dt = Math.min(1, D * tf);
  let band = 0;
  if (S >= 0.22) band = 1;
  if (S >= 0.25 && exShare >= 0.4 && Dt < 0.3) band = 2;
  if (Dt >= 0.3) band = 3;
  if (Dt >= 0.45 && breadth >= 4) band = 4;
  if (band === 4 && timing === 'days') band = 3;
  // Discriminating indicators currently lit, strongest first
  const keys = INDICATORS.filter(i => states[i.id])
    .map(i => ({ i, k: i.w * v(i) * (1 - EXO[i.ex]) }))
    .sort((a, b) => b.k - a.k);
  const discriminating = keys.filter(x => EXO[x.i.ex] <= 0.4 && x.i.w >= 2).map(x => x.i);
  const exerciseTypical = INDICATORS.filter(i => states[i.id] && i.ex === 'high');
  const longLead = INDICATORS.filter(i => states[i.id] === 2 && i.lead !== 'days' && i.w >= 2);
  return { domains, S, D, Dt, exShare, breadth, band: BANDS[band], discriminating, exerciseTypical, longLead,
    lit: INDICATORS.filter(i => states[i.id]).length, observed: INDICATORS.filter(i => states[i.id] === 2).length };
}
