// Data model: Kinmen incidents, sectors, hull tokens, clock times, AIS fixes and the official waters polygons.
import { KINMEN_INC } from '../data/incidents.js';
import { AIS_KINMEN } from '../data/ais.js';
import { WATERS } from '../data/waters.js';

export { AIS_KINMEN as AIS, WATERS };
const DAY = 86400000;
export const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const nice = d => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
export const niceLong = d => `${MON_L[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
export const monthName = (ym, long) => `${(long ? MON_L : MON)[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

/** Sectors: [key, label, anchor]. Anchors are drawing points, not positions. */
export const SECTORS = KINMEN_INC.sectors.map(([key, label, anchor, short]) => ({ key, label, anchor, short }));
export const AREA_NOTE = KINMEN_INC.note, AREA_EXAMPLES = KINMEN_INC.examples;
export const SECTOR = Object.fromEntries(SECTORS.map(s => [s.key, s]));

/** A CCG hull as the tracker writes it: 145xx or 146xx. Other tokens are kept for the record but not counted. */
export const isCcgHull = h => /^14[56]\d\d$/.test(h);
export const INC = KINMEN_INC.rows.map((r, k) => ({
  ...r, k, ym: r.date.slice(0, 7), year: r.date.slice(0, 4),
  ccg: r.hulls.filter(isCcgHull), odd: r.hulls.filter(h => !isCcgHull(h)),
}));
INC.forEach(i => { i.hEntry = i.tEntry ? Number(i.tEntry.slice(0, 2)) : null; i.hFirst = i.tFirst ? Number(i.tFirst.slice(0, 2)) : null; });

export const START = '2024-06-01';
export const END = '2026-09-28';
export const YEARS = ['2024', '2025', '2026'];
export function windowOf(y) {
  if (!YEARS.includes(y)) return { y: 'all', s: START, e: END };
  return { y, s: `${y}-01-01` < START ? START : `${y}-01-01`, e: `${y}-12-31` > END ? END : `${y}-12-31` };
}
export const inWindow = (i, w) => i.date >= w.s && i.date <= w.e;

export function monthsOf(w) {
  const out = [];
  let y = +w.s.slice(0, 4), m = +w.s.slice(5, 7);
  while (`${y}-${String(m).padStart(2, '0')}` <= w.e.slice(0, 7)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m === 12 ? (y++, m = 1) : m++; }
  return out;
}
export const monthEnd = ym => iso(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0));

/** AIS fixes with parsed times; AIS_START is the first day of the live window. */
export const FIXES = AIS_KINMEN.fixes.map(([mmsi, t, lon, lat, sog, zone]) => ({ mmsi, t, date: t.slice(0, 10), lon, lat, sog, zone, v: AIS_KINMEN.vessels[mmsi] }));
export const AIS_START = AIS_KINMEN.t0.slice(0, 10);

/** Shared filter: in window, on or before the scrubber date, sector on. */
export const shown = (i, S) => inWindow(i, S.w) && i.date <= S.date && i.sec.some(s => S.sectors.has(s));

/** Hull frequency among the given incidents. */
export function hullCounts(list) {
  const c = new Map();
  list.forEach(i => new Set(i.ccg).forEach(h => c.set(h, (c.get(h) || 0) + 1)));
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
