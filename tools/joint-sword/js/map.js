// Map: Taiwan basemap, ADIZ, median line and officially published exercise zones.
import { el, createProjection, drawBasemap, circlePath } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { ZONES, zoneState } from './data.js';

const MEDIAN = [[122.0, 27.0], [118.0, 23.0]];
export const proj = createProjection({ lon0: 117.1, lon1: 124.3, lat0: 20.55, lat1: 27.35, width: 760 });

export function createMap(svg) {
  svg.innerHTML = '';
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 1 });
  el('path', { d: proj.line(ADIZ, true), class: 'adiz' }, root);
  const [ax, ay] = proj.project([123.08, 26.6]);
  el('text', { x: ax, y: ay, class: 't-place' }, root, 'Taiwan ADIZ');
  el('path', { d: proj.line(MEDIAN), class: 'median' }, root);
  const [mx, my] = proj.project([121.25, 26.45]);
  el('text', { x: mx, y: my, class: 't-place', transform: `rotate(-47 ${mx} ${my})` }, root, 'median line');
  [['TAIWAN', [120.9, 23.75], 't-big'], ['FUJIAN', [117.6, 25.9], 't-big'], ['Taiwan Strait', [119.3, 24.2], 't-sea'],
    ['Philippine Sea', [123.4, 22.2], 't-sea'], ['East China Sea', [122.4, 27.55], 't-sea'], ['Bashi Channel', [120.9, 21.35], 't-sea']]
    .forEach(([t, p, c]) => { const [x, y] = proj.project(p); el('text', { x, y, class: c, 'text-anchor': 'middle' }, root, t); });
  [['Kinmen', [118.35, 24.44]], ['Matsu', [119.95, 26.16]], ['Penghu', [119.58, 23.57]], ['Taipei', [121.52, 25.04]], ['Kaohsiung', [120.3, 22.62]]]
    .forEach(([t, p]) => {
      const [x, y] = proj.project(p);
      el('circle', { cx: x, cy: y, r: 2.6, class: 'place' }, root);
      el('text', { x: x + 6, y: y + 4, class: 't-place' }, root, t);
    });
  const zg = el('g', { class: 'zones' }, root);
  const msg = el('g', { class: 'maptag' }, root);
  return { root, zg, msg };
}

/** Draw zones for exercise id. Zones valid on `date` are "active"; others are outlined as "announced". */
export function drawZones(map, id, date) {
  map.zg.innerHTML = ''; map.msg.innerHTML = '';
  const Z = ZONES[id];
  if (!Z || !Z.zones.length) {
    const t = el('text', { x: proj.W / 2, y: 26, class: 'nozone', 'text-anchor': 'middle' }, map.msg,
      'No officially published zone coordinates found. Announced areas are described in the panel.');
    return t;
  }
  let shown = 0;
  Z.zones.forEach(z => {
    const st = zoneState(z, date);
    if (st === 'hidden') return;
    shown++;
    const c = centroid(z.pts);
    el('path', { d: proj.line(z.pts, true), class: 'zone ' + st }, map.zg);
    if (z.mark) el('path', { d: circlePath(proj, c, 9), class: 'zone mark ' + st }, map.zg);
    const [x, y] = proj.project(c);
    const dy = z.mark ? -16 : 4;
    el('text', { x, y: y + dy, class: 'zlab ' + st, 'text-anchor': 'middle' }, map.zg, z.label);
  });
  if (!shown) el('text', { x: proj.W / 2, y: 26, class: 'nozone', 'text-anchor': 'middle' }, map.msg,
    `Zones not yet announced on this day (first notice ${Z.zones.map(z => z.announced).sort()[0]}).`);
  return null;
}

function centroid(pts) {
  const p = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
  return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
}
