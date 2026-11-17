// Aggregations over TSM daily activity, CCG incidents and allied transits for the Strait Snapshot schema.
import { TSM } from '../../../shared/data/tsm.js';
import { REPORTS } from '../data/reports.js';

export const AS_OF = TSM.asOf;
export const DAILY = TSM.daily;
export const BY_DATE = new Map(DAILY.map(r => [r[0], r]));
// CCG incidents, with the Coast Guard Administration corrections applied upstream in scripts/build_data.py (fix_ccg).
export const CCG = TSM.ccg;
export const TRANSITS = TSM.transits;
export { REPORTS };

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON = MONTH_NAMES.map(m => m.slice(0, 3));
export const pad = n => String(n).padStart(2, '0');
export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const nice = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const niceY = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Months offered in the selector: January 2026 through the as-of month. */
export const MONTHS = [];
for (let m = 1; m <= Number(AS_OF.slice(5, 7)); m++) MONTHS.push(`2026-${pad(m)}`);

export const CCG_LOCS = [
  { key: 'Kinmen', label: 'Kinmen', color: 'var(--c2)' },
  { key: 'Dongsha', label: 'Dongsha (Pratas)', color: 'var(--c3)' },
  { key: 'Taiwan', label: 'Southwest of Taiwan', color: 'var(--c5)' },
  { key: 'Taiping Island', label: 'Taiping Island', color: 'var(--c4)' },
  { key: 'Penghu', label: 'Penghu', color: 'var(--c6)' },
  { key: 'East of Taiwan', label: 'East of Taiwan', color: 'var(--c1)' },
];

/** All calendar days of a month, with the TSM row if one exists. */
export function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = ym === AS_OF.slice(0, 7) ? Number(AS_OF.slice(8)) : daysIn(y, m);
  const out = [];
  for (let d = 1; d <= last; d++) {
    const date = `${ym}-${pad(d)}`;
    out.push({ date, row: BY_DATE.get(date) || null });
  }
  return out;
}

/** Summary of one month. Aircraft sums use only reported days; `days` counts them. */
export function monthStats(ym) {
  const [y, m] = ym.split('-').map(Number);
  const rows = DAILY.filter(r => r[0].startsWith(ym));
  const air = rows.filter(r => r[1] != null);
  const sum = (a, i) => a.reduce((s, r) => s + r[i], 0);
  const withShips = rows.filter(r => r[3] != null);
  const total = sum(air, 1);
  const adiz = rows.some(r => r[2] != null) ? sum(rows.filter(r => r[2] != null), 2) : null;
  const peak = air.reduce((p, r) => (r[1] > (p?.[1] ?? -1) ? r : p), null);
  const planPeak = withShips.reduce((p, r) => (r[3] > (p?.[3] ?? -1) ? r : p), null);
  return {
    ym, y, m, name: MONTH_NAMES[m - 1],
    calendarDays: daysIn(y, m), days: air.length,
    partial: ym === AS_OF.slice(0, 7) && Number(AS_OF.slice(8)) < daysIn(y, m),
    total, perDay: air.length ? total / air.length : null,
    adiz, adizShare: adiz != null && total ? adiz / total : null,
    planAvg: withShips.length ? sum(withShips, 3) / withShips.length : null,
    planPeak, official: withShips.length ? sum(withShips, 4) : null,
    officialPerDay: withShips.length ? sum(withShips, 4) / withShips.length : null,
    peak, zero: air.filter(r => r[1] === 0).map(r => r[0]),
    jcrp: rows.filter(r => String(r[5] ?? '').includes('J')).map(r => r[0]),
    ldf: rows.filter(r => String(r[5] ?? '').includes('L')).map(r => r[0]),
    ccg: CCG.filter(c => c[0].startsWith(ym)),
    transits: TRANSITS.filter(t => t[0].startsWith(ym)),
  };
}

export const prevYm = ym => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
};
export const yearAgo = (ym, k = 1) => `${Number(ym.slice(0, 4)) - k}${ym.slice(4)}`;

/** Monthly aircraft totals for a year, with coverage. Months with no data are null. */
export function yearSeries(y, lastMonth = 12) {
  const out = [];
  for (let m = 1; m <= lastMonth; m++) {
    const ym = `${y}-${pad(m)}`;
    if (ym > AS_OF.slice(0, 7)) break;
    const s = monthStats(ym);
    out.push(s.days ? s : { ym, y, m, name: MONTH_NAMES[m - 1], days: 0, calendarDays: daysIn(y, m), total: null });
  }
  return out;
}

/** Percent change, or null if not computable. */
export const pct = (a, b) => (a == null || b == null || b === 0 ? null : (a - b) / b * 100);
