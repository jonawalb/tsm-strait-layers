// Case model: parses dates, derives status and age, filters and sorts.
import { CASES, GONE, AS_OF, TOTAL_M } from '../data/cases.js';

export const CATS = ['Traditional', 'Asymmetric', 'Munitions'];
export const ASOF = parseD(AS_OF);
export { TOTAL_M, AS_OF };
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const DAY = 86400000;

/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> Date. Year-only dates land mid-year, or at year end when `end`. */
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
  const ms = c.ms.map(x => ({ ...x, date: parseD(x.d, x.m === 'expect') }));
  const contract = ms.find(x => x.m === 'contract' && x.date <= ASOF) || null;
  const delivery = ms.find(x => x.m === 'delivery') || null;
  const expect = ms.filter(x => x.m === 'expect').pop() || null;
  const amended = ms.some(x => x.m === 'amend');
  let state = 'waiting';
  if (gone) state = 'gone';
  else if (c.partial) state = 'delivering';
  else if (contract) state = 'contracted';
  return { ...c, gone, nD, endD, ms, contract, delivery, expect, amended, state, age: years(nD, endD) };
}

export const OPEN = CASES.map(c => build(c, false));
export const LEFT = GONE.map(c => build(c, true));
export const ALL = [...OPEN, ...LEFT];
export const byKey = Object.fromEntries(ALL.map(c => [c.key, c]));

export const STATUSES = [
  { id: 'all', label: 'All open cases', test: c => !c.gone },
  { id: 'waiting', label: 'No contract or delivery found', test: c => c.state === 'waiting' },
  { id: 'contracted', label: 'Contract on record', test: c => c.state === 'contracted' },
  { id: 'delivering', label: 'Deliveries under way', test: c => c.state === 'delivering' },
  { id: 'amended', label: 'Amended by 36(b)(5)(C)', test: c => !c.gone && c.amended },
  { id: 'overdue', label: 'Waiting 5+ years', test: c => !c.gone && c.age >= 5 },
];

export function visible(S) {
  const st = STATUSES.find(s => s.id === S.status) || STATUSES[0];
  const open = OPEN.filter(c => S.cats.has(c.cat) && st.test(c));
  const left = S.gone ? LEFT.filter(c => S.cats.has(c.cat)) : [];
  const sorters = {
    age: (a, b) => b.age - a.age || b.m - a.m,
    value: (a, b) => b.m - a.m,
    new: (a, b) => b.nD - a.nD || b.m - a.m,
  };
  const f = sorters[S.sort] || sorters.age;
  return [...open.sort(f), ...left.sort((a, b) => b.endD - a.endD)];
}

export function summary() {
  const deliv = OPEN.filter(c => c.partial);
  const ages = OPEN.map(c => c.age).sort((a, b) => a - b);
  const med = ages.length % 2 ? ages[(ages.length - 1) / 2] : (ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2;
  const oldest = OPEN.reduce((a, b) => (b.age > a.age ? b : a));
  const biggest = OPEN.reduce((a, b) => (b.m > a.m ? b : a));
  return {
    total: TOTAL_M, n: OPEN.length,
    delivM: deliv.reduce((s, c) => s + c.m, 0), delivN: deliv.length, deliv,
    median: med, oldest, biggest,
    leftM: LEFT.reduce((s, c) => s + c.m, 0), leftN: LEFT.length,
    byCat: Object.fromEntries(CATS.map(k => [k, OPEN.filter(c => c.cat === k).reduce((s, c) => s + c.m, 0)])),
    nCat: Object.fromEntries(CATS.map(k => [k, OPEN.filter(c => c.cat === k).length])),
  };
}
