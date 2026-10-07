// Strait map with a conceptual footprint for the selected option. Shapes are schematic, not real zones.
import { createProjection, drawBasemap, el, circlePath } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { PLACES, RING, CLOSURES, CROSSINGS, SEIZE } from '../data/zones.js';
import { OPT_COLOR } from './charts.js';

let proj, layer, labels;

export function initMap(svg) {
  proj = createProjection({ lon0: 115.8, lon1: 123.4, lat0: 20.2, lat1: 26.9, width: 640 });
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 2 });
  el('path', { d: proj.line(ADIZ, true), class: 'adiz' }, root);
  const [ax, ay] = proj.project([122.55, 21.35]);
  el('text', { x: ax, y: ay, class: 't-place adiz-t', 'text-anchor': 'middle' }, root, 'Taiwan ADIZ');
  layer = el('g', { class: 'footprint' }, root);
  labels = el('g', {}, root);
  Object.values(PLACES).forEach(p => {
    const [x, y] = proj.project(p.at);
    el('circle', { cx: x, cy: y, r: 2.6, class: 'place-dot' }, labels);
    el('text', { x: x + 5, y: y - 4, class: 't-label place-t' }, labels, p.name);
  });
  const lab = (t, at, cls = 't-sea') => { const [x, y] = proj.project(at); el('text', { x, y, class: cls, 'text-anchor': 'middle' }, root, t); };
  lab('TAIWAN STRAIT', [119.1, 23.0]);
  lab('Fujian', [117.6, 25.9], 't-place');
  lab('Taiwan', [121.0, 23.75], 't-place tw-t');
}

const ellipse = (c, rx, ry, k = 1) => {
  const pts = [];
  for (let a = 0; a <= 360; a += 6) {
    const t = a * Math.PI / 180;
    pts.push([c[0] + rx * k * Math.cos(t), c[1] + ry * k * Math.sin(t)]);
  }
  return proj.line(pts, true);
};
const onRing = (bearing, k) => {
  const t = (90 - bearing) * Math.PI / 180;
  return [RING.c[0] + RING.rx * k * Math.cos(t), RING.c[1] + RING.ry * k * Math.sin(t)];
};
const arrow = (a, b, cls, color) => {
  const [x1, y1] = proj.project(a), [x2, y2] = proj.project(b);
  el('line', { x1, y1, x2, y2, class: cls, style: `stroke:${color}`, 'marker-end': 'url(#co-arrow)' }, layer);
};

export function drawFootprint(id) {
  layer.replaceChildren();
  const col = OPT_COLOR[id];
  const P = PLACES;
  const blob = (at, km, cls) => el('path', { d: circlePath(proj, at, km), class: cls, style: `stroke:${col};fill:${col}` }, layer);
  if (id === 'gray') {
    [P.kinmen, P.matsu, P.penghu, P.pratas].forEach(p => blob(p.at, 22, 'fp-soft'));
    el('path', { d: proj.line(ADIZ, true), class: 'fp-adiz', style: `stroke:${col}` }, layer);
  }
  if (id === 'quarantine') {
    el('path', { d: ellipse(RING.c, RING.rx, RING.ry), class: 'fp-line', style: `stroke:${col}` }, layer);
    [P.keelung, P.taichung, P.kaohsiung].forEach(p => blob(p.at, 34, 'fp-zone'));
    blob(P.kinmen.at, 26, 'fp-zone');
  }
  if (id === 'blockade' || id === 'invasion') {
    el('path', { d: ellipse(RING.c, RING.rx, RING.ry, 1.08) + ellipse(RING.c, RING.rx, RING.ry, 0.86), class: 'fp-band', style: `fill:${col}`, 'fill-rule': 'evenodd' }, layer);
    CLOSURES.forEach(b => blob(onRing(b, 0.98), 30, 'fp-zone'));
  }
  if (id === 'invasion') CROSSINGS.forEach(([a, b]) => arrow(a, b, 'fp-arrow wide', col));
  if (id === 'seizure') {
    [P.kinmen, P.matsu, P.pratas].forEach(p => {
      blob(p.at, 14, 'fp-zone');
      const [x, y] = proj.project(p.at);
      el('circle', { cx: x, cy: y, r: 13, class: 'fp-target', style: `stroke:${col}` }, layer);
    });
    SEIZE.forEach(([a, b]) => arrow(a, b, 'fp-arrow', col));
  }
  document.getElementById('co-arrow-path').style.fill = col;
}
