// Projection and geodesy helpers. The projection constants must match scripts/build_geo.py.
export const LON0 = 110, LON1 = 134, LAT0 = 16, LAT1 = 33, W = 1000;
const COS = Math.cos(24.5 * Math.PI / 180);
const K = W / ((LON1 - LON0) * COS);
export const H = Math.round((LAT1 - LAT0) * K);

export const project = ([lon, lat]) => [(lon - LON0) * K * COS, (LAT1 - lat) * K];
export const unproject = (x, y) => [x / (K * COS) + LON0, LAT1 - y / K];

const RE = 6371;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

export function distKm(a, b) {
  const dp = rad(b[1] - a[1]), dl = rad(b[0] - a[0]);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dl / 2) ** 2;
  return 2 * RE * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function destination([lon, lat], bearing, km) {
  const d = km / RE, t = rad(bearing), p1 = rad(lat), l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(l2), deg(p2)];
}

export function circlePath(center, km, step = 2) {
  let s = '';
  for (let b = 0; b <= 360; b += step) {
    const [x, y] = project(destination(center, b, km));
    s += (b ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return s + 'Z';
}

export const linePath = pts => 'M' + pts.map(p => project(p).map(v => v.toFixed(1)).join(' ')).join('L');

/** Cumulative km along a polyline of [lon,lat] points. */
export function routeLengths(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + distKm(pts[i - 1], pts[i]));
  return L;
}

/** Point at fraction t (0..1) of a polyline, by distance. */
export function along(pts, t) {
  const L = routeLengths(pts), d = Math.max(0, Math.min(1, t)) * L[L.length - 1];
  for (let i = 1; i < pts.length; i++) {
    if (d <= L[i]) {
      const f = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
      return [pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])];
    }
  }
  return pts[pts.length - 1];
}

export const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element. Attribute values that use CSS variables go through style so they resolve. */
export function el(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) {
    const v = String(attrs[k]);
    if (v.startsWith('var(')) e.style.setProperty(k, v);
    else e.setAttribute(k, v);
  }
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export const fmt = n => Math.round(n).toLocaleString('en-US');
export const listText = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
