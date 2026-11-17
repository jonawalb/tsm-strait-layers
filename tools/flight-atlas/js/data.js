// Day records, JCRP flags and aggregation helpers for the Flight-Path Atlas.
import { DAYS, META } from '../data/days.js';
import { SECTOR_INFO } from '../data/sectors.js';
import { TSM } from '../../../shared/data/tsm.js';

export { META, SECTOR_INFO };
export const SECTORS = META.sectors;              // ['N','C','SW','SE','E','NE']
export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FLAG = new Map(TSM.daily.map(r => [r[0], r[5] || '']));
export const FLAG_RANGE = [TSM.daily.find(r => r[5])?.[0], TSM.asOf];

/* One object per calendar day from the first report to the last, so the timeline has no holes. */
const byDate = new Map(DAYS.map(r => [r[0], r]));
const NOTEXT = new Set(META.noText);
const MS = 864e5;
const toDate = s => new Date(s + 'T00:00:00Z');
export const iso = t => new Date(t).toISOString().slice(0, 10);

export const ALL = [];
for (let t = toDate(META.first).getTime(), end = toDate(META.last).getTime(); t <= end; t += MS) {
  const d = iso(t), r = byDate.get(d);
  const flag = FLAG.get(d) || '';
  ALL.push({
    d, i: ALL.length,
    ids: r ? r[1] : [],
    total: r ? r[2] : null,
    entered: r ? r[3] : null,
    mask: r ? r[4] : 0,
    rare: r ? r[5] : '',
    era: r ? r[6] : (d >= META.firstDaily ? 2 : d >= META.firstAround ? 1 : 0),
    daily: d >= META.firstDaily,
    report: !!r,
    notext: NOTEXT.has(d),
    jcrp: flag.includes('J'),
    ldf: flag.includes('L'),
  });
}
export const indexOf = d => {
  const i = Math.round((toDate(d) - toDate(META.first)) / MS);
  return Math.max(0, Math.min(ALL.length - 1, i));
};
export const has = (day, s) => (day.mask & (1 << SECTORS.indexOf(s))) !== 0;

/* Aggregate an inclusive index range. */
export function aggregate(i0, i1, { jcrpOnly = false } = {}) {
  const a = { days: 0, reports: 0, noText: 0, entryDays: 0, entered: 0, total: 0, jcrp: 0, sec: {}, secCount: {}, rare: {} };
  SECTORS.forEach(s => { a.sec[s] = 0; a.secCount[s] = 0; });
  for (let i = i0; i <= i1; i++) {
    const day = ALL[i];
    if (jcrpOnly && !day.jcrp) continue;
    a.days++;
    if (day.jcrp) a.jcrp++;
    if (!day.report) continue;
    a.reports++;
    if (day.notext) a.noText++;
    a.total += day.total || 0;
    a.entered += day.entered || 0;
    if (day.mask) a.entryDays++;
    SECTORS.forEach(s => { if (has(day, s)) { a.sec[s]++; a.secCount[s] += day.entered || 0; } });
    for (const c of (day.rare.match(/NW|W|S/g) || [])) a.rare[c] = (a.rare[c] || 0) + 1;
  }
  return a;
}

/* Month and year buckets: days with an entry into each sector. */
function bucket(keyFn) {
  const m = new Map();
  for (const day of ALL) {
    const k = keyFn(day.d);
    if (!m.has(k)) m.set(k, { k, i0: day.i, i1: day.i });
    m.get(k).i1 = day.i;
  }
  return [...m.values()].map(b => ({ ...b, agg: aggregate(b.i0, b.i1) }));
}
export const MONTHS = bucket(d => d.slice(0, 7));
export const YEARS = bucket(d => d.slice(0, 4));

export const nice = d => { const [y, m, dd] = d.split('-'); return `${MONTH_ABBR[+m - 1]} ${+dd}, ${y}`; };
export const niceShort = d => { const [, m, dd] = d.split('-'); return `${MONTH_ABBR[+m - 1]} ${+dd}`; };
export const monthName = k => { const [y, m] = k.split('-'); return `${MONTH_ABBR[+m - 1]} ${y}`; };
export const reportUrl = id => META.reportUrl + id;
export const addDays = (d, n) => iso(toDate(d).getTime() + n * MS);
export const addMonths = (d, n) => {
  const t = toDate(d); t.setUTCMonth(t.getUTCMonth() + n); return iso(t.getTime());
};

/* Report text, loaded per year on demand. */
const textCache = {};
export async function reportText(day) {
  const years = [...new Set([day.d.slice(0, 4), addDays(day.d, 1).slice(0, 4)])];
  const out = [];
  for (const y of years) {
    if (!textCache[y]) {
      try { textCache[y] = (await import(`../data/text-${y}.js`)).TEXT; } catch { textCache[y] = {}; }
    }
  }
  for (const id of day.ids) {
    const t = years.map(y => textCache[y][id]).find(Boolean);
    out.push({ id, text: t || '' });
  }
  return out;
}
