// Case model: parses dates, derives tier, status and age, filters and sorts. Two tiers, never summed without a label:
// 'contracted' (LOA signed, not fully delivered) and 'nna' (notified to Congress, no signed LOA).
import { CASES, GONE, AS_OF, TOTALS } from '../data/cases.js';

export const CATS = ['Traditional', 'Asymmetric', 'Munitions'];
export const TIERS = ['contracted', 'nna'];
export const TIER = {
  contracted: { name: 'Contracted', long: 'Contracted backlog', help: 'LOA signed, not fully delivered' },
  nna: { name: 'Notified, not accepted', long: 'Notified, not accepted', help: 'Notified to Congress, no signed LOA' },
};
export const ASOF = parseD(AS_OF);
export { TOTALS, AS_OF };
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const DAY = 86400000;

/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> Date. Year-only dates land mid-year, month-only mid-month; `end` takes the last day. */
export function parseD(s, end = false) {
  const [y, m, d] = s.split('-').map(Number);
  if (!m) return end ? new Date(Date.UTC(y, 11, 31)) : new Date(Date.UTC(y, 6, 1));
  if (!d) return end ? new Date(Date.UTC(y, m, 0)) : new Date(Date.UTC(y, m - 1, 15));
  return new Date(Date.UTC(y, m - 1, d));
}

/** Human date at the precision the source gave. */
export function fmtD(s) {
  const [y, m, d] = s.split('-').map(Number);
  if (!m) return String(y);
  if (!d) return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const trim = n => n.toFixed(2).replace(/\.?0+$/, '');
export const fmtM = m => m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${trim(m)}M`;
export const fmtB = m => `$${(m / 1000).toFixed(2)}B`;
export const years = (a, b) => (b - a) / (365.25 * DAY);
export function fmtAge(y) {
  const whole = Math.floor(y), mo = Math.round((y - whole) * 12);
  const yy = mo === 12 ? whole + 1 : whole, mm = mo === 12 ? 0 : mo;
  return yy ? `${yy} yr${mm ? ` ${mm} mo` : ''}` : `${mm} mo`;
}

function build(c, gone) {
  const nD = parseD(c.notified);
  const endD = gone ? parseD(c.left, true) : ASOF;
  const ms = c.ms.map(x => ({ ...x, date: parseD(x.d) }));
  const tiers = c.tiers.map(x => ({ ...x, date: parseD(x.d) }));
  const delivery = ms.find(x => x.m === 'delivery') || null;
  let state = c.tier === 'contracted' ? (c.partial ? 'delivering' : 'contracted') : 'nna';
  if (gone) state = 'gone';
  return { ...c, gone, nD, endD, ms, tiers, delivery, state, age: years(nD, endD) };
}

export const OPEN = CASES.map(c => build(c, false));
export const LEFT = GONE.map(c => build(c, true));
export const ALL = [...OPEN, ...LEFT];
export const byKey = Object.fromEntries(ALL.map(c => [c.key, c]));

export const STATUSES = [
  { id: 'all', label: 'Both tiers', test: c => !c.gone },
  { id: 'contracted', label: 'Contracted (LOA signed)', test: c => !c.gone && c.tier === 'contracted' },
  { id: 'nna', label: 'Notified, not accepted', test: c => !c.gone && c.tier === 'nna' },
  { id: 'old', label: 'Waiting 5+ years', test: c => !c.gone && c.age >= 5 },
];

export function visible(S) {
  const st = STATUSES.find(s => s.id === S.status) || STATUSES[0];
  const open = OPEN.filter(c => S.cats.has(c.cat) && st.test(c));
  const left = S.gone ? LEFT.filter(c => S.cats.has(c.cat)) : [];
  const sorters = {
    tier: (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || b.m - a.m,
    age: (a, b) => b.age - a.age || b.m - a.m,
    value: (a, b) => b.m - a.m,
    new: (a, b) => b.nD - a.nD || b.m - a.m,
  };
  const f = sorters[S.sort] || sorters.tier;
  return [...open.sort(f), ...left.sort((a, b) => b.endD - a.endD)];
}

export function summary() {
  const t = Object.fromEntries(TIERS.map(k => [k, OPEN.filter(c => c.tier === k)]));
  const sum = a => a.reduce((s, c) => s + c.m, 0);
  return {
    totals: TOTALS, n: OPEN.length,
    nTier: Object.fromEntries(TIERS.map(k => [k, t[k].length])),
    biggest: OPEN.reduce((a, b) => (b.m > a.m ? b : a)),
    oldest: OPEN.reduce((a, b) => (b.age > a.age ? b : a)),
    byCat: Object.fromEntries(CATS.map(k => [k, sum(OPEN.filter(c => c.cat === k))])),
    nCat: Object.fromEntries(CATS.map(k => [k, OPEN.filter(c => c.cat === k).length])),
  };
}
