// Balloon events from MND report text and TSM's sheet, grouped by winter season.
import { EVENTS, SHEET_ONLY, META, REFS } from '../data/balloons.js';

export { EVENTS, SHEET_ONLY, META, REFS };
export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* A season runs July to June, so one winter stays together: "2023–24". */
export const seasonOf = d => {
  const y = +d.slice(0, 4), m = +d.slice(5, 7);
  const a = m >= 7 ? y : y - 1;
  return `${a}–${String(a + 1).slice(2)}`;
};

/* Count per event: MND's stated number, else the positions listed, else the sheet. */
export const countOf = e => e.n ?? (e.s.length || e.sheet || 0);

export const SIGHTINGS = [];
EVENTS.forEach((e, ei) => e.s.forEach((s, k) => SIGHTINGS.push({ ...s, d: e.d, id: e.id, ei, k, key: `${e.d}-${k}` })));

const allDates = [...EVENTS.map(e => e.d), ...SHEET_ONLY.map(e => e.d)];
export const SEASONS = [...new Set(allDates.map(seasonOf))].sort();

export function seasonStats(season) {
  const ev = EVENTS.filter(e => !season || seasonOf(e.d) === season);
  const so = SHEET_ONLY.filter(e => !season || seasonOf(e.d) === season);
  const sg = SIGHTINGS.filter(s => !season || seasonOf(s.d) === season);
  return {
    reports: ev.length,
    balloons: ev.reduce((a, e) => a + countOf(e), 0),
    positioned: sg.length,
    sheetOnly: so.length,
    sheetOnlyBalloons: so.reduce((a, e) => a + e.n, 0),
    first: ev.length ? ev[0].d : null,
    last: ev.length ? ev.at(-1).d : null,
    peak: ev.reduce((p, e) => (!p || countOf(e) > countOf(p) ? e : p), null),
    ev, sg, so,
  };
}

export const nice = d => { const [y, m, dd] = d.split('-'); return `${MONTH_ABBR[+m - 1]} ${+dd}, ${y}`; };
export const reportUrl = id => META.reportUrl + id;
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtLL = ([lon, lat]) => `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;
