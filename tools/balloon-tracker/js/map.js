// Map of computed balloon positions (approximate) with their reference points and bearing lines.
import { createProjection, drawBasemap, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { REFS, SIGHTINGS, seasonOf, nice, cap } from './data.js';

export function createMap(svg, { onPick, onHover }) {
  const proj = createProjection({ lon0: 117.6, lon1: 123.2, lat0: 21.7, lat1: 27.4, width: 900 });
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 1 });
  el('text', { x: proj.project([118.0, 22.3])[0], y: proj.project([118.0, 22.3])[1], class: 't-sea' }, root, 'Taiwan Strait');
  const lines = el('g', { class: 'brg-lines' }, root);
  const refG = el('g', { class: 'refs' }, root);
  const dots = el('g', { class: 'dots' }, root);

  Object.entries(REFS).filter(([name]) => SIGHTINGS.some(s => s.ref === name)).forEach(([name, r]) => {
    const [x, y] = proj.project(r.ll);
    const g = el('g', { class: 'ref', 'data-ref': name }, refG);
    el('circle', { cx: x, cy: y, r: 3.5 }, g);
    el('text', { x: x + 6, y: y + 4 }, g, name);
  });

  const marks = new Map();
  SIGHTINGS.forEach(s => {
    if (!s.ll) return;
    const [x, y] = proj.project(s.ll);
    const c = el('circle', { cx: x, cy: y, r: 6, class: 'dot', tabindex: 0, role: 'button',
      'aria-label': `${nice(s.d)}: ${s.nm} nautical miles ${s.brg} of ${s.ref}` }, dots);
    c.addEventListener('click', () => onPick(s));
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s); } });
    c.addEventListener('pointerenter', e => onHover(s, e));
    c.addEventListener('pointerleave', () => onHover(null));
    c.addEventListener('focus', e => onHover(s, e));
    c.addEventListener('blur', () => onHover(null));
    marks.set(s.key, c);
  });

  function update({ season, selKey, dayD }) {
    lines.replaceChildren();
    SIGHTINGS.forEach(s => {
      const c = marks.get(s.key);
      if (!c) return;
      const on = !season || seasonOf(s.d) === season;
      c.classList.toggle('off', !on);
      c.classList.toggle('day', s.d === dayD);
      c.classList.toggle('sel', s.key === selKey);
      c.setAttribute('tabindex', on ? 0 : -1);
      if (s.key === selKey || (s.d === dayD && on)) {
        const a = proj.project(REFS[s.ref].ll), b = proj.project(s.ll);
        el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: s.key === selKey ? 'sel' : '' }, lines);
        if (s.key === selKey) {
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          el('text', { x: mx, y: my - 6, class: 'brg-t', 'text-anchor': 'middle' }, lines, `${s.nm} nm ${cap(s.brg)}`);
        }
      }
    });
    const sel = marks.get(selKey);
    if (sel) dots.appendChild(sel);
  }
  return { update };
}
