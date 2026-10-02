// Shared map toolkit for TSM tools: projection factory, geodesy, SVG helpers, basemap drawing.
// Import from a tool at tools/<slug>/: import { createProjection, drawLand } from '../../shared/js/mapkit.js';

export const NS = 'http://www.w3.org/2000/svg';
const RE = 6371;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

/**
 * Equirectangular projection for a lon/lat box, scaled to `width` SVG units.
 * Returns { W, H, project([lon,lat]) -> [x,y], unproject(x,y) -> [lon,lat], path(ringsOrLine, close) }.
 */
export function createProjection({ lon0, lon1, lat0, lat1, width = 1000 }) {
  const cos = Math.cos(rad((lat0 + lat1) / 2));
  const k = width / ((lon1 - lon0) * cos);
  const W = width, H = Math.round((lat1 - lat0) * k);
  const project = ([lon, lat]) => [(lon - lon0) * k * cos, (lat1 - lat) * k];
  const unproject = (x, y) => [x / (k * cos) + lon0, lat1 - y / k];
  const line = (pts, close = false) =>
    pts.length ? 'M' + pts.map(p => project(p).map(v => v.toFixed(1)).join(' ')).join('L') + (close ? 'Z' : '') : '';
  const path = rings => rings.map(r => line(r, true)).join('');
  return { W, H, project, unproject, line, path };
}

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

/** Geodesic circle as an SVG path in the given projection. */
export function circlePath(proj, center, km, step = 3) {
  const pts = [];
  for (let b = 0; b <= 360; b += step) pts.push(destination(center, b, km));
  return proj.line(pts, true);
}

/** Cumulative distance along a polyline and the point at fraction t. */
export function routeLengths(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + distKm(pts[i - 1], pts[i]));
  return L;
}
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

/** Create an SVG element. Values that start with var( are applied as inline style so CSS variables resolve. */
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

/**
 * Draw sea, graticule and land into an <svg>. Returns { root, proj } where root is a <g> to add layers to.
 * land: rings from shared/data/land-*.js.  gratStep: degrees between graticule lines (0 = none).
 */
export function drawBasemap(svg, proj, land, { gratStep = 5 } = {}) {
  svg.setAttribute('viewBox', `0 0 ${proj.W} ${proj.H}`);
  const root = el('g', {}, svg);
  el('rect', { x: 0, y: 0, width: proj.W, height: proj.H, class: 'tsm-sea' }, root);
  if (gratStep) {
    const g = el('g', { class: 'tsm-grat' }, root);
    const [lonA, latB] = proj.unproject(0, 0), [lonB, latA] = proj.unproject(proj.W, proj.H);
    for (let lon = Math.ceil(lonA / gratStep) * gratStep; lon <= lonB; lon += gratStep) {
      const [x] = proj.project([lon, 0]);
      el('line', { x1: x, y1: 0, x2: x, y2: proj.H }, g);
      el('text', { x: x + 3, y: proj.H - 5 }, g, `${lon}°E`);
    }
    for (let lat = Math.ceil(latA / gratStep) * gratStep; lat <= latB; lat += gratStep) {
      const [, y] = proj.project([0, lat]);
      el('line', { x1: 0, y1: y, x2: proj.W, y2: y }, g);
      el('text', { x: 4, y: y - 3 }, g, `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`);
    }
  }
  el('path', { d: proj.path(land), class: 'tsm-land', 'fill-rule': 'evenodd' }, root);
  return { root };
}

/** Pointer position on an <svg> in viewBox units (respects the current viewBox). */
export function svgPoint(svg, e) {
  const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
  return [vb.x + (e.clientX - r.left) / r.width * vb.width, vb.y + (e.clientY - r.top) / r.height * vb.height];
}

export const fmt = n => Math.round(n).toLocaleString('en-US');
export const listText = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
