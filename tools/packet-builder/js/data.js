// Computes every packet section from the site's own data modules. Nothing here is invented:
// each figure is a count or sum over rows that already exist in the imported modules.
import { TSM } from '../../../shared/data/tsm.js';
import { INCIDENTS, TRACKER } from '../../ccg-grayzone/data/incidents.js';
import { EXERCISES } from '../../joint-sword/data/exercises.js';
import { TIMELINE, NOTES, SOURCE_ALT } from '../../joint-sword/data/annotations.js';
import { addDays, spanDays } from './util.js';
import { priorPeriod } from './range.js';

const BY_DATE = new Map(TSM.daily.map(r => [r[0], r]));
export const DAILY_FIRST = TSM.daily[0][0];
export const METRICS = [
  { key: 'air', i: 1, label: 'PLA aircraft', unit: 'aircraft', note: 'Aircraft MND reported around Taiwan' },
  { key: 'adiz', i: 2, label: 'Median line or ADIZ', unit: 'aircraft', note: 'Of those, aircraft that crossed the median line or entered the ADIZ' },
  { key: 'plan', i: 3, label: 'PLAN ship-days', unit: 'ship-days', note: 'Sum of daily PLA Navy ship counts' },
  { key: 'off', i: 4, label: 'Official ship-days', unit: 'ship-days', note: 'Sum of daily counts of other PRC government ships' },
];
// TSM's transit tracker is thin between these dates: one row (2025-11-05) between 2025-09-12 and 2026-01-16.
const TRANSIT_GAP = ['2025-09-13', '2026-01-15'];

/** Collects every source used in a packet, grouped by section, de-duplicated by URL. */
export class Sources {
  constructor() { this.groups = new Map(); this.seen = new Set(); }
  add(group, label, url) {
    if (!url || this.seen.has(group + url)) return;
    this.seen.add(group + url);
    if (!this.groups.has(group)) this.groups.set(group, []);
    this.groups.get(group).push({ label, url });
  }
}

export function dateList(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function aggregate(from, to) {
  const days = dateList(from, to), m = {};
  for (const M of METRICS) {
    let total = 0, n = 0;
    for (const d of days) { const v = BY_DATE.get(d)?.[M.i]; if (v != null) { total += v; n++; } }
    m[M.key] = { total, n, days: days.length, avg: n ? total / n : null };
  }
  const flagged = f => days.filter(d => (BY_DATE.get(d)?.[5] || '').includes(f));
  m.jcrp = flagged('J');
  m.lrf = flagged('L');
  let peak = null;
  for (const d of days) { const v = BY_DATE.get(d)?.[1]; if (v != null && (!peak || v > peak.v)) peak = { d, v }; }
  m.peak = peak;
  return m;
}

/** Summary numbers for the range and the equal-length period before it. */
export function summary(R, src) {
  const P = priorPeriod(R.from, R.to);
  const now = aggregate(R.from, R.to), prior = aggregate(P.from, P.to);
  src.add('Daily activity', 'Taiwan Ministry of National Defense, daily PLA activity reports (list)', 'https://www.mnd.gov.tw/en/news/plaactlist');
  for (const d of dateList(R.from, R.to)) {
    const u = TSM.sources.dailyOverrides[d];
    if (u) src.add('Daily activity', `MND daily report for the window starting ${d}`, u);
    const f = TSM.sources.flags[d];
    if (f?.J) src.add('Daily activity', `MND release: joint combat readiness patrol, ${d}`, f.J);
    if (f?.L) src.add('Daily activity', `MND release: long-range flight, ${d}`, f.L);
  }
  return { now, prior, P, n: spanDays(R.from, R.to) };
}

/** One object per day for the chart. */
export function chartDays(R, ccgRows, transitRows) {
  const exDays = new Set();
  for (const e of EXERCISES) for (const d of dateList(e.start, e.end)) exDays.add(d);
  const ccgN = count(ccgRows.map(r => r.date)), trN = count(transitRows.map(r => r[0]));
  return dateList(R.from, R.to).map(d => {
    const r = BY_DATE.get(d);
    return { d, air: r?.[1] ?? null, adiz: r?.[2] ?? null, plan: r?.[3] ?? null, off: r?.[4] ?? null,
      flag: r?.[5] || '', ex: exDays.has(d), ccg: ccgN[d] || 0, tr: trN[d] || 0 };
  });
}

const count = arr => arr.reduce((o, k) => (o[k] = (o[k] || 0) + 1, o), {});

/** China Coast Guard incidents in range, from the CCG Gray-Zone Map data module. */
export function ccg(R, src) {
  const rows = INCIDENTS.filter(x => x.date >= R.from && x.date <= R.to);
  for (const x of rows) for (const c of x.cites) src.add('China Coast Guard incidents', c.label, c.url);
  if (rows.length) src.add('China Coast Guard incidents', 'Taiwan Coast Guard Administration (releases compiled in the TSM tracker)', 'https://www.cga.gov.tw/');
  const covered = !(R.to < TRACKER.first || R.from > TRACKER.last);
  return { rows, byLoc: count(rows.map(x => x.loc)), tracker: TRACKER, covered,
    partial: covered && (R.from < TRACKER.first || R.to > TRACKER.last) };
}

/** Allied Taiwan Strait transits in range, from shared/data/tsm.js. */
export function transits(R, src) {
  const rows = TSM.transits.filter(t => t[0] >= R.from && t[0] <= R.to);
  for (const t of rows) {
    const u = TSM.sources.transitsAdded[`${t[0]} ${t[1]}`];
    if (u) src.add('Allied transits', `${t[1]}, ${t[0]}`, u);
  }
  const gap = !(R.to < TRANSIT_GAP[0] || R.from > TRANSIT_GAP[1]);
  return { rows, gap, byCountry: count(rows.map(t => t[5])) };
}

const alt = u => SOURCE_ALT[u] || u;

/** Listed PLA exercises overlapping the range, with their statements timeline. */
export function exercises(R, src) {
  const rows = EXERCISES.filter(e => !(e.end < R.from || e.start > R.to)).map(e => ({
    ...e, timeline: TIMELINE[e.id] || [], note: NOTES[e.id] || '', links: e.sources.map(alt),
  }));
  for (const e of rows) {
    e.links.forEach(u => src.add('Exercises', `${e.short}: event-list source`, u));
    e.timeline.forEach(t => src.add('Exercises', `${e.short}: ${t.label}, ${t.date}`, t.url));
  }
  const before = EXERCISES.filter(e => e.end < R.from).sort((a, b) => b.end.localeCompare(a.end))[0] || null;
  return { rows, before };
}
