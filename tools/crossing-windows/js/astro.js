// Sun and moon positions: low-precision formulas as used in SunCalc (Vladimir Agafonkin, BSD-2-Clause,
// https://github.com/mourner/suncalc), after Meeus, Astronomical Algorithms. Good to a few minutes for
// sunrise/sunset and about 1% for moon illumination, which is all this tool needs.
// Tide prediction from the fitted harmonic constants in data/tides.js.
import { EPOCH, SPEEDS, PORTS } from '../data/tides.js';

export { PORTS };
const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
const toDays = date => date.valueOf() / dayMs - 0.5 + J1970 - J2000;
const fromJulian = j => new Date((j + 0.5 - J1970) * dayMs);
const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const decl = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const meanAnomaly = d => rad * (357.5291 + 0.98560028 * d);
const eclLon = M => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
function sunCoords(d) { const L = eclLon(meanAnomaly(d)); return { dec: decl(L, 0), ra: ra(L, 0) }; }

const J0 = 0.0009;
const transit = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const approx = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;

/** Sunrise, sunset and nautical dusk/dawn (sun 12 degrees below horizon) for the local day containing date. */
export function sunTimes(date, lat, lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(date);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = approx(0, lw, n), M = meanAnomaly(ds), L = eclLon(M), dec = decl(L, 0), noon = transit(ds, M, L);
  const at = h => {
    const w = Math.acos((Math.sin(h * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const set = transit(approx(w, lw, n), M, L);
    return [fromJulian(noon - (set - noon)), fromJulian(set)];
  };
  const [rise, set] = at(-0.833), [dawn, dusk] = at(-12);
  return { rise, set, dawn, dusk, noon: fromJulian(noon) };
}

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  return { ra: ra(l, b), dec: decl(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

/** Illuminated fraction (0-1) and phase (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter). */
export function moonIllum(date) {
  const d = toDays(date), s = sunCoords(d), m = moonCoords(d), sd = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sd * Math.sin(phi), m.dist - sd * Math.cos(phi));
  const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
}

export function phaseName(p) {
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return names[Math.round(p * 8) % 8];
}

const T_EPOCH = Date.parse(EPOCH);
/** Predicted tide height (m, relative to the fitted mean) at a port for a Date. */
export function tideAt(port, date) {
  const P = PORTS[port], t = (date - T_EPOCH) / 36e5;
  let h = 0;
  for (const k in P.c) { const [A, g] = P.c[k]; h += A * Math.cos(rad * (SPEEDS[k] * t - g)); }
  return h;
}

/** Hourly tide series and daily high/low range from t0 for n hours. */
export function tideSeries(port, t0, hours) {
  const out = [];
  for (let i = 0; i <= hours * 4; i++) { const t = new Date(+t0 + i * 9e5); out.push([t, tideAt(port, t)]); }
  return out;
}
