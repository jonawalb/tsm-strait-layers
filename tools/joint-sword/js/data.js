// Data access: exercises, TSM daily counts, exercise windows and compare series.
import { TSM } from '../../../shared/data/tsm.js';
import { EXERCISES } from '../data/exercises.js';
import { ZONES, TIMELINE, NOTES, SOURCE_ALT } from '../data/annotations.js';

export { EXERCISES, ZONES, TIMELINE, NOTES, SOURCE_ALT };
export const DAY = 86400000, PRE = 7, POST = 7, BASE = 30;
export const AS_OF = TSM.asOf;
export const METRICS = {
  air: { i: 1, name: 'PLA aircraft', short: 'Aircraft', unit: 'aircraft', from: '2022-08-06' },
  adiz: { i: 2, name: 'ADIZ entries', short: 'ADIZ', unit: 'entries', from: '2022-08-07' },
  plan: { i: 3, name: 'PLAN ships', short: 'PLAN ships', unit: 'ships', from: '2024-08-13' },
  off: { i: 4, name: 'Official ships', short: 'Official', unit: 'ships', from: '2024-08-13' },
};

const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
export const diffDays = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
export const nice = (d, y = true) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US',
  { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}), timeZone: 'UTC' });
export const dayLabel = k => (k === 0 ? 'Day 0' : `Day ${k > 0 ? '+' : '−'}${Math.abs(k)}`);

const byDate = new Map(TSM.daily.map(r => [r[0], r]));
export const val = (d, m) => { const r = byDate.get(d); return r && r[METRICS[m].i] != null ? r[METRICS[m].i] : null; };
export const flagOf = d => (byDate.get(d) || [])[5] || '';
export const byId = id => EXERCISES.find(x => x.id === id) || null;

/** Day offsets for an exercise: from start−7 to end+7, relative to the first exercise day. */
export function windowOf(x) {
  const len = diffDays(x.end, x.start);
  const ks = [];
  for (let k = -PRE; k <= len + POST; k++) ks.push(k);
  return ks.map(k => {
    const d = addDays(x.start, k);
    return { k, d, during: k >= 0 && k <= len, flag: flagOf(d),
      v: Object.fromEntries(Object.keys(METRICS).map(m => [m, val(d, m)])) };
  });
}

export function coverage(x, m = 'air') {
  const w = windowOf(x), have = w.filter(d => d.v[m] != null).length;
  return { have, total: w.length, none: have === 0, partial: have > 0 && have < w.length };
}

/** Prior-30-day mean (days −37..−8, i.e. the 30 days before the window) for normalizing compare curves. */
export function priorMean(x, m = 'air') {
  const vs = [];
  for (let k = PRE + BASE; k > PRE; k--) { const v = val(addDays(x.start, -k), m); if (v != null) vs.push(v); }
  return vs.length >= 10 ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}

/** Zones active on date d (validity inclusive). */
export const zoneOn = (z, d) => (z.days ? z.days.includes(d) : d >= z.from && d <= z.to);
/** 'hidden' before the notice, 'pending' announced but not yet in force, 'on', or 'done'. */
export function zoneState(z, d) {
  if (d < z.announced) return 'hidden';
  if (zoneOn(z, d)) return 'on';
  const last = z.days ? z.days[z.days.length - 1] : z.to;
  return d > last ? 'done' : 'pending';
}
export const activeZones = (id, d) => (ZONES[id]?.zones || []).filter(z => zoneOn(z, d));
export const timelineOf = id => (TIMELINE[id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
