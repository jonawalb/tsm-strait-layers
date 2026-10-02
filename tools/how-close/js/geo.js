// Geometry and the numbers behind the result card.
import { createProjection, distKm, destination } from '../../../shared/js/mapkit.js';
import { CITIES } from '../data/cities.js';
import { CHN, CHN_PTS } from '../data/world.js';

export const SEAM = -30;
export const TAIPEI = [121.568, 25.036];           // Natural Earth populated places
export const PINGTAN = [119.78, 25.50];            // Pingtan Island, Fujian: the part of the PRC closest to Taiwan
export const STRAIT_KM = 126;                      // Pingtan Island to the Hsinchu coast, measured on Natural Earth 10m land
export const JET_KMH = 850;                        // notional airliner cruise speed
export const CLASSES = [                           // Arms Control Association range classes
  { id: 'SRBM', name: 'Short-range', lo: 0, hi: 1000 },
  { id: 'MRBM', name: 'Medium-range', lo: 1000, hi: 3000 },
  { id: 'IRBM', name: 'Intermediate-range', lo: 3000, hi: 5500 },
  { id: 'ICBM', name: 'Intercontinental', lo: 5500, hi: 20100 },
];

export const norm = lon => ((lon - SEAM) % 360 + 360) % 360 + SEAM;

/** Pacific-centred equirectangular projection; longitudes are wrapped into the -30..330 window. */
export function makeProjection(width = 1000) {
  const P = createProjection({ lon0: SEAM, lon1: SEAM + 360, lat0: -58, lat1: 80, width });
  const project = ([lon, lat]) => P.project([norm(lon), lat]);
  const line = (pts, close = false) => {
    let d = '', prev = null;
    for (const p of pts) {
      const q = project(p);
      const jump = prev && Math.abs(q[0] - prev[0]) > P.W / 2;
      d += (!prev || jump ? 'M' : 'L') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
      prev = q;
    }
    return d + (close ? 'Z' : '');
  };
  return { ...P, project, line, path: rings => rings.map(r => line(r, true)).join('') };
}

/** Points along the great circle from a to b. */
export function greatCircle(a, b, n = 96) {
  const r = Math.PI / 180, toV = ([lo, la]) => [Math.cos(la * r) * Math.cos(lo * r), Math.cos(la * r) * Math.sin(lo * r), Math.sin(la * r)];
  const A = toV(a), B = toV(b);
  const w = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  if (w < 1e-9) return [a, b];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
    const v = [0, 1, 2].map(k => s1 * A[k] + s2 * B[k]);
    pts.push([Math.atan2(v[1], v[0]) / r, Math.atan2(v[2], Math.hypot(v[0], v[1])) / r]);
  }
  return pts;
}

export function ringCircle(center, km, step = 4) {
  const pts = [];
  for (let b = 0; b <= 360; b += step) pts.push(destination(center, b, km));
  return pts;
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inPRC = p => CHN.some(r => inRing([norm(p[0]), p[1]], r));

/** Nearest vertex of the PRC outline (Natural Earth 50m, ~5 km spacing). */
export function nearestPRC(p) {
  let best = Infinity, at = null;
  for (const q of CHN_PTS) {
    const d = distKm(p, q);
    if (d < best) { best = d; at = q; }
  }
  return { km: best, at };
}

export const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const cityKey = c => slug(c[0]) + '--' + slug(c[1]);
export const cityObj = c => ({ name: c[0], country: c[1], lon: c[2], lat: c[3], pop: c[4], ascii: c[5] || c[0] });

export function nearestCity(p, filter = () => true) {
  let best = Infinity, city = null;
  for (const c of CITIES) {
    if (!filter(c)) continue;
    const d = distKm(p, [c[2], c[3]]);
    if (d < best) { best = d; city = c; }
  }
  return { km: best, city };
}

/** A pair of real cities about STRAIT_KM apart, as close to the chosen point as possible. */
export function comparePair(p, target = STRAIT_KM, tol = 10) {
  const near = CITIES.map(c => ({ c, d: distKm(p, [c[2], c[3]]) })).filter(o => o.d < 2500).sort((a, b) => a.d - b.d).slice(0, 160);
  let best = null;
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const a = near[i], b = near[j];
      const d = distKm([a.c[2], a.c[3]], [b.c[2], b.c[3]]);
      if (Math.abs(d - target) > tol) continue;
      // Prefer pairs near the chosen place, then bigger cities, then a closer match.
      const score = Math.min(a.d, b.d) / 150 + Math.abs(d - target) / 8 - Math.log10(a.c[4] + 1) * 0.35 - Math.log10(b.c[4] + 1) * 0.35;
      if (!best || score < best.score) best = { a: a.c, b: b.c, d, score };
    }
  }
  return best;
}

// Natural Earth lists the Hong Kong and Macau SARs as separate countries; both are PRC territory.
const PRC_NAMES = new Set(['China', 'Hong Kong S.A.R.', 'Macau S.A.R']);

export function summarize(point) {
  const p = [point.lon, point.lat];
  const toTaipei = distKm(p, TAIPEI), toPingtan = distKm(p, PINGTAN);
  const inside = inPRC(p) || (!point.custom && PRC_NAMES.has(point.country));
  const prc = inside ? { km: 0, at: p } : nearestPRC(p);
  const prcNear = prc.at ? nearestCity(prc.at, c => c[1] === 'China') : null;
  const cls = CLASSES.find(c => toTaipei < c.hi) || CLASSES[CLASSES.length - 1];
  return { p, toTaipei, toPingtan, prc, prcNear, inside, cls, jetH: toTaipei / JET_KMH, ratio: toTaipei / STRAIT_KM };
}

export function fmtHours(h) {
  if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min';
  const H = Math.floor(h), M = Math.round((h - H) * 60);
  return M === 60 ? `${H + 1} h` : `${H} h${M ? ' ' + M + ' min' : ''}`;
}
