// Data model: incidents, location categories, approximate anchors, year windows and derived "firsts".
import { INCIDENTS, TRACKER } from '../data/incidents.js';

const DAY = 86400000;
export const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export const nice = (d, opt = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { ...opt, timeZone: 'UTC' });
export const niceLong = d => nice(d, { month: 'long', day: 'numeric', year: 'numeric' });
export { TRACKER };

/** The tracker begins in June 2024; the timeline ends on the tracker version date. */
export const START = TRACKER.first.slice(0, 7) + '-01';
export const AS_OF = TRACKER.version > TRACKER.last ? TRACKER.version : TRACKER.last;
export const YEARS = [...new Set(INCIDENTS.map(i => i.date.slice(0, 4)))].sort();
/** A view window: 'all' or one year, clipped to the tracker's coverage. */
export function windowOf(y) {
  if (!YEARS.includes(y)) return { y: 'all', s: START, e: AS_OF };
  const s = `${y}-01-01` < START ? START : `${y}-01-01`;
  const e = `${y}-12-31` > AS_OF ? AS_OF : `${y}-12-31`;
  return { y, s, e };
}

/**
 * Location categories as recorded in the TSM tracker. Anchors are approximate reference points
 * for drawing only (island or sea-area centers), not incident positions.
 */
export const LOCS = [
  { key: 'Kinmen', label: 'Kinmen', short: 'Kinmen', anchor: [118.37, 24.36], color: 'var(--c2)',
    where: 'Restricted and prohibited waters around the Kinmen islands, a few kilometers off Xiamen.' },
  { key: 'Dongsha', label: 'Dongsha (Pratas)', short: 'Dongsha', anchor: [116.72, 20.7], color: 'var(--c3)', up: true,
    where: 'Restricted waters around Dongsha (Pratas) Island in the northern South China Sea.' },
  { key: 'East of Taiwan', label: 'East of Taiwan', short: 'East', anchor: [122.45, 23.05], color: 'var(--c1)',
    where: 'Pacific waters east of Taiwan. Tracker descriptions put ships 43 to 151 nautical miles off Hualien, Green Island and Orchid Island.' },
  { key: 'Taiwan', label: 'Southwest of Taiwan', short: 'SW Taiwan', anchor: [120.45, 21.6], color: 'var(--c5)', up: true,
    where: 'The approaches southwest of Taiwan\'s southern tip (tracker: 30 nm southwest of Eluanbi).' },
  { key: 'Penghu', label: 'Penghu', short: 'Penghu', anchor: [119.2, 23.45], color: 'var(--c6)',
    where: 'Waters around the Penghu islands in the middle of the Strait. The tracker also files a 2024 fishing-boat detention off Shenhu, Fujian, under Penghu.' },
  { key: 'Matsu', label: 'Matsu', short: 'Matsu', anchor: [119.93, 26.16], color: 'var(--c7)',
    where: 'Restricted waters around the Matsu islands off Fuzhou.' },
  { key: 'Wuqiu', label: 'Wuqiu', short: 'Wuqiu', anchor: [119.45, 24.99], color: 'var(--prc)',
    where: 'Restricted waters around Wuqiu, a small island group between Kinmen and Matsu (tracker spelling: Wuqui).' },
  { key: 'North of Taiwan', label: 'North of Taiwan', short: 'North', anchor: [121.35, 26.1], color: 'var(--c8)',
    where: 'Waters north and northwest of Taiwan. Tracker descriptions put ships 42 to 58 nautical miles off Fugui Cape and Pengjia Islet.' },
  { key: 'Several areas', label: 'Several areas at once', short: 'Several', anchor: [122.95, 25.15], color: 'var(--muted)',
    where: 'Rows the tracker records for several areas at once, all on PLA exercise days. There is no single position, so these pins sit at a label point off northeast Taiwan.' },
  { key: 'Taiping Island', label: 'Taiping Island (Spratlys)', short: 'Taiping', anchor: [114.36, 10.38], color: 'var(--c4)', inset: true, up: true,
    where: 'Taiping (Itu Aba) Island in the Spratlys, about 1,500 km southwest of Kaohsiung. Shown in the inset.' },
];
export const LOC = Object.fromEntries(LOCS.map(l => [l.key, l]));

export const INC = INCIDENTS.map(i => ({ ...i, ym: i.date.slice(0, 7), year: i.date.slice(0, 4) }));
export const inWindow = (i, w) => i.date >= w.s && i.date <= w.e;

/** Deterministic sunflower jitter so pins at the same anchor don't stack. */
const GOLDEN = 137.508 * Math.PI / 180;
export const jitter = (k, step) => {
  const r = step * Math.sqrt(k + 0.6), a = k * GOLDEN;
  return [r * Math.cos(a), r * Math.sin(a)];
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (ym, long = false) => `${(long ? MON_LONG : MON)[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const monthShort = ym => MON[Number(ym.slice(5, 7)) - 1];
const nextYm = ym => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
/** Month keys ('YYYY-MM') from window start to window end. */
export function monthsOf(w) {
  const out = [];
  for (let k = w.s.slice(0, 7); k <= w.e.slice(0, 7); k = nextYm(k)) out.push(k);
  return out;
}
export const monthEnd = ym => iso(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0));

/** Monthly counts by location for incidents in the window, on or before `upTo`, respecting a filter. */
export function monthly(w, upTo, on) {
  const rows = monthsOf(w).map(ym => ({ ym, c: Object.fromEntries(LOCS.map(l => [l.key, 0])) }));
  const at = Object.fromEntries(rows.map(r => [r.ym, r.c]));
  INC.forEach(i => { if (inWindow(i, w) && i.date <= upTo && on.has(i.loc) && at[i.ym]) at[i.ym][i.loc]++; });
  return rows;
}

/** Firsts computed from the whole record: first incident at each location, major incidents, and patterns. */
export function computeFirsts() {
  const out = [];
  const seen = new Set();
  INC.forEach(i => {
    if (seen.has(i.loc)) return;
    seen.add(i.loc);
    const L = LOC[i.loc];
    out.push({ date: i.date, id: i.id, loc: i.loc,
      title: out.length === 0 ? `Tracker begins: ${L.label}` : `First at ${L.label}`,
      text: (i.flags.length ? `[${i.flags.map(f => f.label).join('; ')}] ` : '') + (i.desc || i.timeline || 'No description recorded.') });
  });
  const majors = new Set();
  INC.forEach(i => {
    const name = i.major.replace(/\s+Day \d+$/, '');
    if (!name || majors.has(name) || out.some(f => f.id === i.id)) return;
    majors.add(name);
    out.push({ date: i.date, id: i.id, loc: i.loc, title: `Major incident: ${name}`,
      text: `Filed by the tracker as a major incident. ${i.desc || ''}${i.vessels ? ` Vessels: ${i.vessels}` : ''}`.trim() });
  });
  // First month in which incidents were recorded at four or more locations.
  const byMonth = {};
  INC.forEach(i => (byMonth[i.ym] ??= new Set()).add(i.loc));
  const wide = Object.keys(byMonth).sort().find(k => byMonth[k].size >= 4);
  if (wide) {
    const last = INC.filter(i => i.ym === wide).at(-1);
    out.push({ date: last.date, id: last.id, loc: null,
      title: `${monthName(wide, true)}: ${byMonth[wide].size} locations in one month`,
      text: `The first month with incidents recorded at ${byMonth[wide].size} different locations: ${[...byMonth[wide]].map(k => LOC[k].label).join(', ')}.` });
  }
  // First time a location outside Kinmen and Dongsha saw incidents in three consecutive months.
  for (const L of LOCS.filter(l => l.key !== 'Kinmen' && l.key !== 'Dongsha')) {
    const months = [...new Set(INC.filter(i => i.loc === L.key).map(i => i.ym))].sort();
    const run = months.find(m => months.includes(nextYm(m)) && months.includes(nextYm(nextYm(m))));
    if (!run) continue;
    const m3 = nextYm(nextYm(run));
    const third = INC.find(i => i.loc === L.key && i.ym === m3);
    out.push({ date: third.date, id: third.id, loc: L.key,
      title: `${L.label}: a third straight month`,
      text: `Incidents recorded ${L.key === 'East of Taiwan' ? 'east of Taiwan' : 'at ' + L.label} in ${[run, nextYm(run), m3].map(k => monthName(k, true)).join(', ')}.` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Split the vessel field into display tokens (hull numbers or names), as recorded. */
export const vesselTokens = v => (v || '').split(/,\s*/).map(s => s.trim()).filter(Boolean);
