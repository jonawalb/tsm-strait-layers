// Cross-tool deep links. Import from tools/<slug>/js/: '../../../shared/js/links.js'.
//   dayLink('2026-06-03')            -> '../day-in-the-strait/#d=2026-06-03' (null outside 2026-01-01..asOf)
//   exerciseLink('aug-2022')         -> '../joint-sword/#v=replay&x=aug-2022&d=0&m=air'
//   exerciseLink('aug-2022', date)   -> same, opened on that day of the exercise window
//   exerciseFor(date)                -> the exercise whose replay window (start-7 .. end+7) holds date, or null
//   linkHtml(href, text)             -> '<a class="xlink" href=...>text →</a>' or '' when href is null
// Each target tool reads these hash formats on load (day-in-the-strait/js/app.js, joint-sword/js/app.js).
import { TSM } from '../data/tsm.js';
import { EXERCISES } from '../../tools/joint-sword/data/exercises.js';
import { ALL_TOOLS } from './registry.js';

const DAY = 86400000, PRE = 7, POST = 7;
const DAY_START = '2026-01-01';
const diff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
// A site built from a promoted list (taiwanmonitor.com) drops unpublished tools from the registry: link only to published ones.
const published = slug => ALL_TOOLS.some(t => t.slug === slug && t.status === 'live');

/** Link to A Day in the Strait for one date, or null if that tool does not cover the date. */
export function dayLink(date) {
  if (!published('day-in-the-strait') || !okDate(date) || date < DAY_START || date > TSM.asOf) return null;
  return `../day-in-the-strait/#d=${date}`;
}

/** Link to Anatomy of an Exercise replaying one exercise, optionally at a given date inside its window. */
export function exerciseLink(id, date) {
  const x = EXERCISES.find(e => e.id === id);
  if (!x || !published('joint-sword')) return null;
  let k = 0;
  if (okDate(date)) k = Math.max(-PRE, Math.min(diff(x.end, x.start) + POST, diff(date, x.start)));
  return `../joint-sword/#v=replay&x=${encodeURIComponent(id)}&d=${k}&m=air`;
}

/** The exercise whose replay window (7 days either side) contains the date. Prefers one in progress. */
export function exerciseFor(date) {
  if (!okDate(date)) return null;
  const inside = EXERCISES.find(x => date >= x.start && date <= x.end);
  if (inside) return inside;
  return EXERCISES.find(x => date >= addDays(x.start, -PRE) && date <= addDays(x.end, POST)) || null;
}

/** Short anchor HTML for tooltips and cards. Returns '' when href is null. */
export function linkHtml(href, text) {
  if (!href) return '';
  return `<a class="xlink" href="${href}">${text} <span aria-hidden="true">→</span></a>`;
}

/** Both links that make sense for a date: the day view and any exercise around it. */
export function dateLinksHtml(date) {
  const x = exerciseFor(date);
  return [linkHtml(dayLink(date), 'See this day'), x ? linkHtml(exerciseLink(x.id, date), `Replay ${x.short}`) : '']
    .filter(Boolean).join(' ');
}
