// Real historical sea states. Each game draws one start date in the chosen month from 30 years of ERA5
// daily maximum significant wave height (1996-2025) and plays that week's actual seas.
import { DAY0, OFFSET, SEA, CLIM } from '../data/seastate.js';
import { uni } from './rng.js';

const T0 = Date.parse(DAY0 + 'T00:00:00Z');
const N = SEA.c.wave.length;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const Y0 = +DAY0.slice(0, 4);
export const NYEARS = 30;
export { CLIM };

/** WMO sea-state bands the game uses: 0 = calm to slight (<= 1.25 m), 1 = moderate (to 2.5 m), 2 = rough. */
export const BANDS = [
  { k: 0, short: 'slight', t: 'Slight or calmer', s: 'sea state 3 or less, waves up to 1.25 m' },
  { k: 1, short: 'moderate', t: 'Moderate', s: 'sea state 4, waves 1.25 to 2.5 m' },
  { k: 2, short: 'rough', t: 'Rough', s: 'sea state 5 or more, waves over 2.5 m' },
];
export const band = m => (m == null ? 1 : m <= 1.25 ? 0 : m <= 2.5 ? 1 : 2);

/** Wave height in metres at point p ('n', 'c', 's') on day index i, or null if missing. */
export function wave(p, i) {
  if (i < 0 || i >= N) return null;
  const c = SEA[p].wave.charCodeAt(i) - OFFSET;
  return c < 0 ? null : c / 10;
}

const dayIndex = (y, m, d) => Math.round((Date.UTC(y, m, d) - T0) / 864e5);
export const dateOf = i => new Date(T0 + i * 864e5);
export const fmtDate = i => { const d = dateOf(i); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`; };

/**
 * Start day for a game in month m (0-11): a keyed draw of year and day. Days start..start+6 all exist
 * (up to 3 days of waiting plus D-day to D+3).
 */
export function drawStart(seed, m) {
  const yi = Math.floor(uni(seed, 'wx-year') * NYEARS);
  const y = Y0 + yi;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = 1 + Math.floor(uni(seed, 'wx-day') * dim);
  return Math.min(N - 8, dayIndex(y, m, d));
}

/** Sea state for a day index at each game point. */
export function seas(i) {
  return { n: wave('n', i), c: wave('c', i), s: wave('s', i) };
}

/** First day in start..start+3 whose sea at point p is slight or calmer; else the calmest of the four. */
export function firstCalm(start, p) {
  let best = 0, bestH = Infinity;
  for (let k = 0; k <= 3; k++) {
    const h = wave(p, start + k);
    if (h != null && h <= 1.25) return k;
    if (h != null && h < bestH) { bestH = h; best = k; }
  }
  return best;
}
