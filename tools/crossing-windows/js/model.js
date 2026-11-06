// Go-day model: which days pass every threshold, and how often by week, month and year.
import { DAY0, POINTS, STATIONS, TC } from '../data/climate.js';

export { POINTS, STATIONS, TC };
export const N_DAYS = POINTS.c.wind.length;
const T0 = Date.parse(DAY0 + 'T00:00:00Z');
export const YEAR0 = +DAY0.slice(0, 4);
export const YEARS = Array.from({ length: Math.round(N_DAYS / 365.2425) }, (_, i) => YEAR0 + i);
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Day index -> {y, m (0-11), doy (0-based), wk (0-51)}. Week 52 folds into week 51 (days 364-365). */
export const CAL = Array.from({ length: N_DAYS }, (_, i) => {
  const d = new Date(T0 + i * 864e5);
  const y = d.getUTCFullYear();
  const doy = Math.round((d - Date.UTC(y, 0, 1)) / 864e5);
  return { y, m: d.getUTCMonth(), doy, wk: Math.min(51, Math.floor(doy / 7)) };
});

/** Calendar dates covered by week wk (0-51) in year y. */
export function weekDates(wk, y) {
  const start = Date.UTC(y, 0, 1) + wk * 7 * 864e5;
  const len = wk === 51 ? (Date.UTC(y + 1, 0, 1) - start) / 864e5 : 7;
  return Array.from({ length: len }, (_, i) => new Date(start + i * 864e5));
}
export const fmtDay = d => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
/** Label for a week in a non-leap reference year. */
export const weekLabel = wk => { const ds = weekDates(wk, 2025); return `${fmtDay(ds[0])} to ${fmtDay(ds[ds.length - 1])}`; };

export const DEFAULTS = { p: 'c', h: 1.25, w: 21, n: 3, r: 500, fog: true, st: 'xiamen', wk: 14, yr: 2027, port: 'taichung' };

/** Which tests each day fails. Returns {go: Uint8Array, fail: {wave, wind, fog, tc}: Uint8Array}. */
export function evaluate(s) {
  const P = POINTS[s.p], fogS = s.fog ? STATIONS[s.st].fog : null;
  const hDm = s.h * 10 + 1e-6;
  const go = new Uint8Array(N_DAYS);
  const fail = { wave: new Uint8Array(N_DAYS), wind: new Uint8Array(N_DAYS), fog: new Uint8Array(N_DAYS), tc: new Uint8Array(N_DAYS) };
  for (let i = 0; i < N_DAYS; i++) {
    const fw = P.wave[i] > hDm, fwi = P.wind[i] > s.w;
    const ff = fogS ? fogS[i] === 1 : false;
    const ft = s.r > 0 && TC.dist[i] != null && TC.dist[i] <= s.r;
    fail.wave[i] = fw; fail.wind[i] = fwi; fail.fog[i] = ff; fail.tc[i] = ft;
    go[i] = !(fw || fwi || ff || ft);
  }
  return { go, fail };
}

/** open[i] = 1 when days i..i+n-1 are all go days (a window of n days opens on day i). */
export function windows(go, n) {
  const open = new Uint8Array(N_DAYS);
  let run = 0;
  for (let i = N_DAYS - 1; i >= 0; i--) {
    run = go[i] ? run + 1 : 0;
    open[i] = run >= n;
  }
  return open;
}

/** Aggregate a 0/1 array by week (52), month (12) and year x week grid. */
export function aggregate(open) {
  const wk = Array.from({ length: 52 }, () => [0, 0]);
  const mo = Array.from({ length: 12 }, () => [0, 0]);
  const grid = YEARS.map(() => Array.from({ length: 52 }, () => [0, 0]));
  for (let i = 0; i < N_DAYS; i++) {
    const c = CAL[i], v = open[i];
    wk[c.wk][0] += v; wk[c.wk][1]++;
    mo[c.m][0] += v; mo[c.m][1]++;
    const g = grid[c.y - YEAR0]; if (g) { g[c.wk][0] += v; g[c.wk][1]++; }
  }
  const f = ([a, b]) => (b ? a / b : null);
  return { week: wk.map(f), month: mo.map(f), grid: grid.map(r => r.map(f)) };
}

/** Best run of k consecutive weeks (wrapping the year end) by mean share. */
export function bestSpan(week, k = 4) {
  let best = { start: 0, v: -1 };
  for (let s = 0; s < 52; s++) {
    let t = 0;
    for (let j = 0; j < k; j++) t += week[(s + j) % 52];
    if (t / k > best.v) best = { start: s, v: t / k };
  }
  return best;
}

/** Share of day-years failing each test, for the days in week wk. */
export function weekFailShares(ev, wk) {
  const out = { wave: 0, wind: 0, fog: 0, tc: 0, go: 0, n: 0 };
  for (let i = 0; i < N_DAYS; i++) {
    if (CAL[i].wk !== wk) continue;
    out.n++; out.go += ev.go[i];
    for (const k of ['wave', 'wind', 'fog', 'tc']) out[k] += ev.fail[k][i];
  }
  for (const k of ['wave', 'wind', 'fog', 'tc', 'go']) out[k] /= out.n || 1;
  return out;
}

/** Percentiles of a series over the days of week wk. */
export function weekDist(series, wk, scale = 1) {
  const v = [];
  for (let i = 0; i < N_DAYS; i++) if (CAL[i].wk === wk && series[i] != null) v.push(series[i] * scale);
  v.sort((a, b) => a - b);
  const q = p => v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null;
  return { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), n: v.length };
}

/** Typhoon detail for week wk: share of years with a storm inside r km, and the storms. */
export function weekStorms(wk, r) {
  const years = new Set(), storms = new Map();
  for (let i = 0; i < N_DAYS; i++) {
    if (CAL[i].wk !== wk) continue;
    const d = TC.dist[i];
    if (d == null || d > r) continue;
    years.add(CAL[i].y);
    const name = TC.names[TC.who[i]];
    if (!storms.has(name) || storms.get(name) > d) storms.set(name, d);
  }
  return { share: years.size / YEARS.length, storms: [...storms].sort((a, b) => a[1] - b[1]) };
}

/** Fog-report share and station coverage for week wk. */
export function weekFog(st, wk) {
  const S = STATIONS[st];
  let fog = 0, n = 0;
  for (let i = 0; i < N_DAYS; i++) if (CAL[i].wk === wk && S.fog[i] != null) { n++; fog += S.fog[i]; }
  return { share: n ? fog / n : null, n };
}

/** For radius r: per week, share of years with a tropical storm inside r; and a year x week 0/1 grid. */
export function stormExposure(r) {
  const grid = YEARS.map(() => new Uint8Array(52));
  if (r > 0) for (let i = 0; i < N_DAYS; i++) {
    const d = TC.dist[i];
    if (d != null && d <= r && grid[CAL[i].y - YEAR0]) grid[CAL[i].y - YEAR0][CAL[i].wk] = 1;
  }
  const share = Array.from({ length: 52 }, (_, wk) => grid.reduce((a, row) => a + row[wk], 0) / YEARS.length);
  return { grid, share };
}
