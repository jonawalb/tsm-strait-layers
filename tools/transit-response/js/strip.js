// Event strip (all transit events 2017-2026 on a time axis) and the small Strait map.
import { el, createProjection, drawBasemap, along } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { EVENTS, METRICS, AS_OF, nice } from './events.js';
import { EXERCISES, COUNTRY, ROUTE, MEDIAN } from '../data/context.js';

const SW = 1000, SH = 84, SL = 12, SR = 12;
const T_START = Date.parse('2017-05-01'), T_END = Date.parse(AS_OF) + 40 * 864e5;
const sx = d => SL + (Date.parse(d) - T_START) / (T_END - T_START) * (SW - SL - SR);

/** Draw the strip. isOff(e) returns a reason string when e can't be analyzed. */
export function drawStrip(svg, { selected, isOff, metric, onPick }) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${SW} ${SH}`);
  const g = el('g', {}, svg);
  const from = METRICS[metric].from;
  el('rect', { x: sx(from), y: 8, width: sx(AS_OF) - sx(from), height: 50, class: 'cover' }, g);
  const narrow = sx(AS_OF) - sx(from) < 140;
  el('text', { x: narrow ? sx(from) - 5 : sx(from) + 4, y: 19, class: 'ax', 'text-anchor': narrow ? 'end' : 'start' }, g, `${METRICS[metric].short} data from here`);
  for (let yr = 2018; yr <= 2026; yr++) {
    const x = sx(`${yr}-01-01`);
    el('line', { x1: x, x2: x, y1: 8, y2: 62, class: 'gridl' }, g);
    el('text', { x: x + 3, y: 76, class: 'ax' }, g, String(yr));
  }
  EXERCISES.forEach(x => el('rect', { x: sx(x.from) - 1, y: 8, width: Math.max(2, sx(x.to) - sx(x.from) + 2), height: 50, class: 'exmark' }, g, null));
  EVENTS.forEach(e => {
    const off = isOff(e), x = sx(e.date);
    const c = el('circle', { cx: x, cy: 40 + (e.idx % 2 ? -8 : 0), r: selected === e.id ? 7 : 5,
      class: 'edot' + (off ? ' off' : '') + (selected === e.id ? ' sel' : ''), fill: off ? 'none' : `var(${e.us ? '--us' : '--accent'})`,
      stroke: off ? 'var(--faint)' : 'var(--panel)' }, g);
    el('title', {}, c, `${nice(e.date)} · ${e.ships.map(s => s.name).join(', ')}${off ? ' · ' + off : ''}`);
    c.addEventListener('click', () => onPick(e.id));
  });
}

// ---- Strait map --------------------------------------------------------------------
const proj = createProjection({ lon0: 117.2, lon1: 123.2, lat0: 21.3, lat1: 27.5, width: 520 });

export function drawMap(svg, e) {
  svg.innerHTML = '';
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 2 });
  el('path', { d: proj.line(MEDIAN), class: 'median' }, root);
  const [mx, my] = proj.project([121.35, 26.25]);
  el('text', { x: mx, y: my, class: 't-place', transform: `rotate(-47 ${mx} ${my})` }, root, 'median line');
  [['Taiwan', [120.75, 23.75]], ['Fujian', [117.9, 25.6]], ['Taiwan Strait', [119.1, 24.35]], ['Penghu', [119.35, 23.35]]].forEach(([t, p]) => {
    const [x, y] = proj.project(p);
    el('text', { x, y, class: t === 'Taiwan Strait' ? 't-sea' : 't-place', 'text-anchor': 'middle' }, root, t);
  });
  if (!e) return;
  el('path', { d: proj.line(ROUTE), class: 'route' }, root);
  const [ax, ay] = proj.project(ROUTE[ROUTE.length - 1]);
  el('text', { x: ax + 8, y: ay + 14, class: 't-place' }, root, 'schematic route*');
  const n = e.ships.length;
  e.ships.forEach((s, i) => {
    const t = 0.36 + (n > 1 ? (i / (n - 1) - 0.5) * 0.22 : 0);
    const p = along(ROUTE, t), [x, y] = proj.project(p);
    const col = `var(${(COUNTRY[s.country] || {}).col || '--ally'})`;
    const gg = el('g', { class: 'ship' }, root);
    el('ellipse', { cx: x, cy: y, rx: 10, ry: 4, fill: col, stroke: 'var(--panel)', 'stroke-width': 1.2, transform: `rotate(-52 ${x} ${y})` }, gg);
    el('text', { x: x + 12, y: y + 4, class: 't-label', fill: col }, gg, s.name);
  });
}
