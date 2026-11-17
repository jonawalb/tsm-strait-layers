// Compose one day's story from TSM daily totals, the CCG tracker and MND JCRP press releases.
import { TSM } from '../../../shared/data/tsm.js';
import { INCIDENTS } from '../data/incidents.js';
import { JCRP, pressUrl } from '../data/jcrp.js';

export const START = '2026-01-01';
export const AS_OF = TSM.asOf;
const DAY = 864e5, HOUR = 36e5;
export const BY_DATE = new Map(TSM.daily.map(r => [r[0], r]));
export const DAYS_2026 = TSM.daily.filter(r => r[0] >= START);
export const iso = t => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
const fmtDate = (d, o) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
export const longDate = d => fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export const shortDate = d => fmtDate(d, { month: 'long', day: 'numeric' });
export const tinyDate = d => fmtDate(d, { month: 'short', day: 'numeric' });

export const LOC_LABEL = { Kinmen: 'Kinmen', Dongsha: 'Dongsha (Pratas)', Penghu: 'Penghu', 'East of Taiwan': 'east of Taiwan', Taiwan: 'southwest of Taiwan', 'Taiping Island': 'Taiping Island' };
/** "at Kinmen", but "east of Taiwan" (directional labels take no "at"). */
export const atLoc = loc => (/ of /.test(LOC_LABEL[loc]) ? '' : 'at ') + LOC_LABEL[loc];

/**
 * MND's 24-hour reporting window behind TSM's row for date d, in "Taiwan-time" ms (UTC arithmetic on local clock values).
 * TSM rows are keyed to the window start (shared/data/tsm_sources.md): the row for d holds MND's report for
 * 6 a.m. d to 6 a.m. d+1, issued on the morning of d+1. (Before the 2026-09-28 rebuild, September rows were a day late.)
 */
export function mndWindow(d) {
  const startDay = d;
  const t0 = Date.parse(startDay + 'T06:00:00Z');
  return { t0, t1: t0 + 24 * HOUR, startDay, endDay: addDays(startDay, 1), reportDate: addDays(startDay, 1) };
}
const at = (d, hhmm) => Date.parse(`${d}T${hhmm}:00Z`);
export const clock = t => new Date(t).toISOString().slice(11, 16);

/** Everything the page shows for one TSM date. */
export function compose(d) {
  const row = BY_DATE.get(d) || [d, null, null, null, null, ''];
  const [, air, adiz, plan, official, flag] = row;
  const win = mndWindow(d);
  const near = [win.startDay, win.endDay];
  const events = [];
  // CCG tracker entries on either calendar day that the window touches.
  const ccg = INCIDENTS.filter(i => near.includes(i.date));
  ccg.forEach(i => i.times.forEach(t => {
    const ts = at(addDays(i.date, t.day), t.t);
    events.push({ ts, kind: 'ccg', loc: i.loc, title: `${cap(t.what)}`, where: LOC_LABEL[i.loc] || i.loc, inc: i });
  }));
  // MND JCRP press releases on those days.
  const jcrp = JCRP.filter(j => near.includes(j.date));
  jcrp.forEach(j => {
    events.push({ ts: at(j.date, j.start), kind: 'jcrp', title: `PLA aircraft begin a joint combat readiness patrol`, where: `${j.sorties} sorties, ${j.adiz} across the median line or into the ADIZ`, url: pressUrl(j.id, j.zh) });
    if (j.issued && j.issued !== j.start) events.push({ ts: at(j.date, j.issued), kind: 'mnd', title: 'Taiwan\'s defense ministry announces the patrol', where: 'MND press release', url: pressUrl(j.id, j.zh) });
  });
  events.sort((a, b) => a.ts - b.ts);
  events.forEach(e => { e.inWindow = e.ts >= win.t0 && e.ts < win.t1; });
  const incidents = INCIDENTS.filter(i => i.date === d);
  const transits = TSM.transits.filter(t => t[0] === d);
  const nearTransits = TSM.transits.filter(t => Math.abs(Date.parse(t[0]) - Date.parse(d)) <= 3 * DAY && t[0] !== d);
  return { d, row, air, adiz, plan, official, flag, win, events, incidents, transits, nearTransits, jcrp, rank: rank(air) };
}

function rank(air) {
  if (air == null) return null;
  const vals = DAYS_2026.map(r => r[1]).filter(v => v != null);
  const below = vals.filter(v => v < air).length;
  return { below, pct: Math.floor(below / vals.length * 100), avg: vals.reduce((a, b) => a + b, 0) / vals.length, max: Math.max(...vals), n: vals.length };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** Rank days by how much the data can say about them, for the suggestion chips. */
export function suggestions(n = 6) {
  const scored = DAYS_2026.map(r => {
    const d = r[0], c = compose(d);
    const timed = c.events.filter(e => e.inWindow).length;
    const s = (String(r[5] ?? '').includes('J') ? 3 : 0) + Math.min(timed, 5) + c.incidents.length * 1.5 + c.transits.length * 3 + c.nearTransits.length + (r[1] ?? 0) / 12;
    return { d, s, c };
  }).sort((a, b) => b.s - a.s);
  const out = [];
  scored.forEach(x => { if (out.length < n && !out.some(o => Math.abs(Date.parse(o.d) - Date.parse(x.d)) < 5 * DAY)) out.push(x); });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}

/** One-line summary of a day, for chips and the hero lede. */
export function summary(c) {
  const bits = [];
  if (c.air != null) bits.push(`${c.air} aircraft`);
  if (String(c.flag ?? '').includes('J')) bits.push('a joint combat readiness patrol');
  if (String(c.flag ?? '').includes('L')) bits.push('a long-distance flight');
  c.incidents.forEach(i => bits.push(`CCG ${atLoc(i.loc)}`));
  c.transits.forEach(t => bits.push(`${t[1]} transit`));
  return bits;
}
