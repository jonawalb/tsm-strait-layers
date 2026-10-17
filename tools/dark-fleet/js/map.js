// Map frame: SVG basemap and reference overlays, plus a canvas on top for fast track drawing.
import { createProjection, drawBasemap, el, svgPoint } from '../../../shared/js/mapkit.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { ZONE_GEOM } from '../data/zones.js';

// Taiwan MND's stated median-line endpoints (Taiwan News, 30 July 2019).
export const MEDIAN_LINE = [[122.0, 27.0], [118.0, 23.0]];

export const EXTENTS = {
  taiwan: { t: 'Taiwan', box: { lon0: 116.6, lon1: 124.9, lat0: 21.2, lat1: 27.3 }, land: LAND_TAIWAN, grat: 1 },
  region: { t: 'South China Sea', box: { lon0: 105, lon1: 127, lat0: 4, lat1: 30 }, land: LAND_INDOPAC, grat: 5 },
};

const PLACES = [
  { n: 'Taipei', p: [121.56, 25.04], ext: 'taiwan' }, { n: 'Kaohsiung', p: [120.3, 22.62], ext: 'taiwan' },
  { n: 'Hualien', p: [121.6, 23.98], ext: 'taiwan' }, { n: 'Kinmen', p: [118.32, 24.44], ext: 'taiwan' },
  { n: 'Matsu', p: [119.95, 26.16], ext: 'taiwan' }, { n: 'Penghu', p: [119.57, 23.57], ext: 'taiwan' },
  { n: 'Fujian', p: [118.4, 25.9], ext: 'taiwan', sea: false },
  { n: 'TAIWAN', p: [120.8, 23.7], ext: 'region' }, { n: 'Hong Kong', p: [114.17, 22.3], ext: 'region' },
  { n: 'Hainan', p: [109.7, 19.2], ext: 'region' }, { n: 'Spratly Islands', p: [114.5, 10.0], ext: 'region' },
  { n: 'Luzon', p: [121.0, 16.5], ext: 'region' }, { n: 'Paracel Is.', p: [111.9, 16.6], ext: 'region' },
];

export function createMap(svg, canvas) {
  let proj = null, ext = null, cur = null, landPath = null;
  const layers = {};

  function setExtent(key) {
    if (key === cur) { sizeCanvas(); return proj; }
    cur = key;
    ext = EXTENTS[key];
    proj = createProjection({ ...ext.box, width: 1000 });
    svg.innerHTML = '';
    const { root } = drawBasemap(svg, proj, ext.land, { gratStep: ext.grat });
    landPath = new Path2D(proj.path(ext.land)); // same land as drawn, used to hide gap connectors under it
    layers.zones = el('g', { class: 'zones' }, root);
    ZONE_GEOM.forEach(z => {
      el('path', { d: proj.path(z.rings), class: 'zone' + (z.id.includes('box') ? ' box' : ''), 'data-z': z.id }, layers.zones);
    });
    layers.adiz = el('g', {}, root);
    el('path', { d: proj.line(ADIZ, true), class: 'adiz' }, layers.adiz);
    const [ax, ay] = proj.project([118.35, 21.35]);
    el('text', { x: ax, y: ay, class: 't-ref' }, layers.adiz, 'Taiwan ADIZ');
    layers.median = el('g', {}, root);
    el('path', { d: proj.line(MEDIAN_LINE), class: 'median' }, layers.median);
    const [mx, my] = proj.project([119.25, 24.35]);
    if (key === 'taiwan') el('text', { x: mx, y: my, class: 't-ref', transform: `rotate(-45 ${mx} ${my})` }, layers.median, 'Median line');
    const pl = el('g', {}, root);
    PLACES.filter(p => p.ext === key).forEach(p => {
      const [x, y] = proj.project(p.p);
      el('text', { x, y, class: 't-place', 'text-anchor': 'middle' }, pl, p.n);
    });
    layers.top = el('g', {}, root);
    sizeCanvas();
    return proj;
  }

  function sizeCanvas() {
    const r = svg.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    const ctx = canvas.getContext('2d');
    const k = r.width / proj.W * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return { ctx, k: r.width / proj.W };
  }

  function show(opts) {
    layers.adiz.style.display = opts.adiz ? '' : 'none';
    layers.median.style.display = opts.median ? '' : 'none';
    layers.zones.style.display = opts.zones ? '' : 'none';
  }

  /** [lon, lat] under a pointer event. */
  const lonlat = e => proj.unproject(...svgPoint(svg, e));
  /** Screen pixels per SVG unit (for hit radii). */
  const scale = () => svg.getBoundingClientRect().width / proj.W;
  const inView = ([lon, lat]) => lon >= ext.box.lon0 && lon <= ext.box.lon1 && lat >= ext.box.lat0 && lat <= ext.box.lat1;

  return { setExtent, sizeCanvas, show, lonlat, scale, inView, get proj() { return proj; }, get top() { return layers.top; }, get landPath() { return landPath; } };
}

/** Read a CSS custom property from :root (so canvas colors follow light/dark mode). */
export const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
