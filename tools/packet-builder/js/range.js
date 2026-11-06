// Date-range presets and their URL-hash tokens.
//   '7d'                      last 7 days of TSM data
//   'm:2026-08'               one calendar month
//   'ex:justice-mission-2025:3'  a listed exercise, padded by 0, 3 or 7 days each side
//   'c:2026-08-01:2026-08-31' custom
import { TSM } from '../../../shared/data/tsm.js';
import { EXERCISES } from '../../joint-sword/data/exercises.js';
import { addDays, monthEnd, monthName, fmtDate, spanDays } from './util.js';

export const AS_OF = TSM.asOf;
export const MIN_DATE = '2020-01-01';
export const MAX_SPAN = 366;
export const PADS = [0, 3, 7];

/** Months with TSM daily data, newest first. */
export const MONTHS = (() => {
  const out = [];
  let ym = AS_OF.slice(0, 7);
  while (ym >= '2022-08') {
    out.push(ym);
    const [y, m] = ym.split('-').map(Number);
    ym = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }
  return out;
})();

export const EX_LIST = EXERCISES.slice().sort((a, b) => b.start.localeCompare(a.start));

/** The opening state: the latest complete month. */
export function defaultRange() {
  const ym = AS_OF.slice(0, 7);
  return { kind: 'm', m: monthEnd(ym) === AS_OF ? ym : MONTHS[1] };
}

export function parseRange(tok) {
  const p = String(tok || '').split(':');
  if (p[0] === '7d') return { kind: '7d' };
  if (p[0] === 'm' && MONTHS.includes(p[1])) return { kind: 'm', m: p[1] };
  if (p[0] === 'ex' && EXERCISES.some(e => e.id === p[1])) return { kind: 'ex', id: p[1], pad: PADS.includes(+p[2]) ? +p[2] : 3 };
  if (p[0] === 'c' && /^\d{4}-\d\d-\d\d$/.test(p[1]) && /^\d{4}-\d\d-\d\d$/.test(p[2])) return { kind: 'c', from: p[1], to: p[2] };
  return null;
}

export function rangeToken(r) {
  if (r.kind === '7d') return '7d';
  if (r.kind === 'm') return `m:${r.m}`;
  if (r.kind === 'ex') return `ex:${r.id}:${r.pad}`;
  return `c:${r.from}:${r.to}`;
}

/** Resolve a range spec to concrete dates and labels. */
export function resolve(r) {
  if (r.kind === '7d') {
    const from = addDays(AS_OF, -6);
    return { from, to: AS_OF, title: 'The last seven days', kicker: `Seven days to ${fmtDate(AS_OF)}`, file: `last-7-days-${AS_OF}` };
  }
  if (r.kind === 'm') {
    const end = monthEnd(r.m), to = end > AS_OF ? AS_OF : end;
    return { from: `${r.m}-01`, to, title: monthName(r.m), kicker: to < end ? `Month to date, through ${fmtDate(to)}` : 'Monthly packet', file: r.m };
  }
  if (r.kind === 'ex') {
    const ex = EXERCISES.find(e => e.id === r.id);
    let to = addDays(ex.end, r.pad);
    if (to > AS_OF) to = AS_OF;
    return { from: addDays(ex.start, -r.pad), to, title: ex.short, exercise: ex,
      kicker: r.pad ? `Exercise window, listed dates plus ${r.pad} days each side` : 'Exercise window, listed dates only', file: ex.id };
  }
  let { from, to } = r;
  if (from > to) [from, to] = [to, from];
  if (to > AS_OF) to = AS_OF;
  if (from < MIN_DATE) from = MIN_DATE;
  if (spanDays(from, to) > MAX_SPAN) from = addDays(to, -(MAX_SPAN - 1));
  return { from, to, title: 'Custom range', kicker: 'Custom date range', file: `${from}_${to}` };
}

/** The period of equal length that ends the day before `from`. */
export function priorPeriod(from, to) {
  const n = spanDays(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1), n };
}
