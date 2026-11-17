// Day index for Strait 4D: one record per calendar day, joining every dataset the tool shows.
import { TSM } from '../../../shared/data/tsm.js';
import { LAYERS } from '../data/layers.js';
import { EXERCISES, ZONES, TIMELINE } from '../data/exercises.js';
import { RHETORIC } from '../data/rhetoric.js';

export { TSM, LAYERS, EXERCISES, ZONES, TIMELINE, RHETORIC };

export const DAY = 864e5;
export const FIRST = '2022-08-01';
export const LAST = TSM.asOf;
export const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
export const diffDays = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
export const nice = (d, y = true) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US',
  { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}), timeZone: 'UTC' });
export const weekday = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
export const mondayOf = d => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((w + 6) % 7)); };

export const METRICS = [
  { key: 'air', i: 1, name: 'PLA aircraft', short: 'Aircraft', from: '2022-08-06' },
  { key: 'adiz', i: 2, name: 'Aircraft entering the ADIZ or crossing the median line', short: 'ADIZ / median', from: '2022-08-07' },
  { key: 'plan', i: 3, name: 'PLAN ships', short: 'PLAN ships', from: '2024-08-13' },
  { key: 'off', i: 4, name: 'Official ships', short: 'Official ships', from: '2024-08-13' },
];
export const SECTORS = ['N', 'C', 'SW', 'SE', 'E', 'NE'];

const groupBy = (arr, key) => arr.reduce((m, x) => { const k = key(x); (m.get(k) || m.set(k, []).get(k)).push(x); return m; }, new Map());
const dailyBy = new Map(TSM.daily.map(r => [r[0], r]));
const sectorBy = new Map(LAYERS.sectors.map(r => [r[0], r]));
const ccgBy = groupBy(LAYERS.ccg, x => x.date);
const transitBy = groupBy(TSM.transits.map(t => ({ date: t[0], name: t[1], hull: t[2], cls: t[3], type: t[4], country: t[5] })), x => x.date);
// Cable dates with month precision ("2025-01") are shown on the first of the month and labelled as such.
const cableBy = groupBy(LAYERS.cables.map(c => ({ ...c, monthOnly: c.date.length === 7, day: c.date.length === 7 ? c.date + '-01' : c.date })), x => x.day);
const flagSrc = TSM.sources?.flags || {};
const transitSrc = { ...(TSM.sources?.transitsAdded || {}), ...(TSM.sources?.transitsCorrected || {}) };
export const transitUrl = t => { const u = transitSrc[`${t.date} ${t.name}`]; return u && u.startsWith('http') ? u : null; };

/** Exercise state on a date: active, announced (zones published, not yet in force) or within the replay window. */
export function exerciseOn(d) {
  for (const x of EXERCISES) {
    if (d >= x.start && d <= x.end) return { x, state: 'on', k: diffDays(d, x.start) };
    const z = ZONES[x.id];
    const ann = z ? z.zones.map(q => q.announced).sort()[0] : null;
    if (ann && d >= ann && d < x.start) return { x, state: 'announced', k: diffDays(d, x.start) };
  }
  return null;
}
export const zoneDays = z => (z.days ? z.days : null);
export function zoneState(z, d) {
  if (d < z.announced) return 'hidden';
  const on = z.days ? z.days.includes(d) : d >= z.from && d <= z.to;
  if (on) return 'on';
  const last = z.days ? z.days[z.days.length - 1] : z.to;
  return d > last ? 'done' : 'pending';
}

/* One record per day, FIRST..LAST. */
export const ALL = [];
for (let t = Date.parse(FIRST), end = Date.parse(LAST); t <= end; t += DAY) {
  const d = iso(t), r = dailyBy.get(d), s = sectorBy.get(d);
  ALL.push({
    d, i: ALL.length,
    v: { air: r ? r[1] : null, adiz: r ? r[2] : null, plan: r ? r[3] : null, off: r ? r[4] : null },
    flag: r ? r[5] || '' : '',
    flagUrls: flagSrc[d] || null,
    mnd: s ? s[1] : [], mask: s ? s[2] : 0, rare: s ? s[3] : '',
    ccg: ccgBy.get(d) || [], transits: transitBy.get(d) || [], cables: cableBy.get(d) || [],
  });
}
export const N = ALL.length;
export const indexOf = d => Math.max(0, Math.min(N - 1, diffDays(d, FIRST)));
export const hasSector = (day, s) => (day.mask & (1 << SECTORS.indexOf(s))) !== 0;

/* Rhetoric: weekly lanes keyed by Monday; per-day documents. */
export const LANES = RHETORIC.lanes.map(l => ({ ...l, byWeek: new Map(l.weeks.map(w => [w[0], w])) }));
export const W = { n: 1, k: 2, sal: 3, salz: 4, host: 5, hostz: 6, thr: 7, thrz: 8, esc: 9, escz: 10 };
export const docsOn = d => RHETORIC.days[d] || null;
export const RHET_METRICS = [
  { key: 'sal', z: 'salz', name: 'Taiwan salience', unit: 'share of records that mention Taiwan' },
  { key: 'host', z: 'hostz', name: 'Hostility toward Taiwan', unit: 'mean model score of sentences that mention Taiwan' },
  { key: 'esc', z: 'escz', name: 'Escalation balance', unit: 'escalation minus de-escalation, Taiwan sentences' },
];
/** Lane value range (5th-95th percentile) for colouring a metric. */
export function laneRange(lane, m) {
  const vs = lane.weeks.map(w => w[W[m]]).filter(v => v != null).sort((a, b) => a - b);
  if (!vs.length) return [0, 1];
  const q = p => vs[Math.min(vs.length - 1, Math.floor(p * vs.length))];
  const lo = q(0.05), hi = q(0.95);
  return hi > lo ? [lo, hi] : [lo, lo + 1e-6];
}

/* Anomalies: robust z against a trailing baseline (assumption parameters set by the user). */
export const ANOM = { window: 60, thr: 3 };
export function computeAnomalies() {
  const minN = Math.ceil(ANOM.window / 2);
  for (const m of METRICS) {
    const vals = ALL.map(a => a.v[m.key]);
    for (let i = 0; i < N; i++) {
      const x = vals[i];
      const day = ALL[i];
      day.z = day.z || {}; day.base = day.base || {};
      if (x == null) { day.z[m.key] = null; day.base[m.key] = null; continue; }
      const win = [];
      for (let j = Math.max(0, i - ANOM.window); j < i; j++) if (vals[j] != null) win.push(vals[j]);
      if (win.length < minN) { day.z[m.key] = null; day.base[m.key] = null; continue; }
      win.sort((a, b) => a - b);
      const med = win[win.length >> 1];
      const dev = win.map(v => Math.abs(v - med)).sort((a, b) => a - b);
      const mad = dev[dev.length >> 1];
      const sd = Math.max(1.4826 * mad, Math.sqrt(Math.max(med, 1)), 1);
      day.z[m.key] = (x - med) / sd;
      day.base[m.key] = { med, sd, n: win.length };
    }
  }
  for (const day of ALL) day.anom = METRICS.filter(m => day.z[m.key] != null && day.z[m.key] >= ANOM.thr).map(m => m.key);
}
computeAnomalies();
export const anomalyDays = () => ALL.filter(a => a.anom.length).map(a => a.i);

/* Gray-zone month lookup. */
const G = LAYERS.gray;
export const grayMonth = d => G.months.indexOf(d.slice(0, 7));
export const grayCells = mi => G.grid.filter(c => c[0] === mi);
export const grayTop = (mi, i, j) => (G.top[`${mi},${i},${j}`] || []).map(([mmsi, n]) => ({ mmsi, n, name: G.names[mmsi]?.[0] || '', hull: G.names[mmsi]?.[1] || '', force: G.names[mmsi]?.[2] || '' }));

/* AIS zone entries (live window only). */
export const AIS = LAYERS.ais;
export const aisOn = d => d >= AIS.from && d <= AIS.to;

/* Presets: exercises inside the TSM daily record, plus the AIS window. */
export const PRESETS = [
  ...EXERCISES.filter(x => x.end >= '2022-08-06').map(x => ({ id: x.id, label: x.short, when: x.when, from: addDays(x.start, -5),
    to: addDays(x.end, 8), focus: x.start, x })),
  { id: 'ais-2026-09', label: 'AIS window', when: 'Sept. 2026', from: AIS.from, to: AIS.to, focus: AIS.from, x: null },
];
