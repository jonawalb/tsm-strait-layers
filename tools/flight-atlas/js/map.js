// Sector heat map: Taiwan's ADIZ split into approximate, labelled sectors, shaded by entry days.
import { createProjection, drawBasemap, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { SECTORS, SECTOR_INFO } from './data.js';

export function createMap(svg, { onPick, onHover }) {
  const proj = createProjection({ lon0: 117.4, lon1: 123.7, lat0: 20.6, lat1: 27.4, width: 900 });
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 1 });
  const land = root.querySelector('.tsm-land');
  const secG = el('g', { class: 'sectors' });
  root.insertBefore(secG, land);
  el('path', { d: proj.line(ADIZ, true), class: 'adiz-ring' }, root);
  el('text', { x: proj.project([118.1, 21.3])[0], y: proj.project([118.1, 21.3])[1], class: 't-sea' }, root, 'ADIZ (TSM ring)');
  el('text', { x: proj.project([120.35, 27.1])[0], y: proj.project([120.35, 27.1])[1], class: 't-sea' }, root, 'Sector lines are approximate');
  const labG = el('g', { class: 'sec-labels' }, root);

  const shapes = {}, labels = {};
  SECTORS.forEach(s => {
    const info = SECTOR_INFO[s];
    const p = el('path', { d: proj.line(info.poly, true), class: 'sector', tabindex: 0, role: 'button', 'data-s': s }, secG);
    p.addEventListener('click', () => onPick(s));
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s); } });
    p.addEventListener('pointerenter', e => onHover(s, e));
    p.addEventListener('pointermove', e => onHover(s, e));
    p.addEventListener('pointerleave', () => onHover(null));
    p.addEventListener('focus', e => onHover(s, e));
    p.addEventListener('blur', () => onHover(null));
    shapes[s] = p;
    const [x, y] = proj.project(info.label);
    const g = el('g', { transform: `translate(${x} ${y})` }, labG);
    const name = el('text', { class: 'sec-name', 'text-anchor': 'middle', y: -4 }, g, info.name);
    const val = el('text', { class: 'sec-val', 'text-anchor': 'middle', y: 16 }, g, '');
    labels[s] = { name, val };
  });

  function update(agg, { metric, selected, highlight }) {
    const base = metric === 'share' ? Math.max(1, agg.entryDays) : Math.max(1, ...SECTORS.map(s => agg.sec[s]));
    SECTORS.forEach(s => {
      const v = agg.sec[s];
      const t = v / base;
      const p = shapes[s];
      p.style.setProperty('--t', v ? (0.12 + 0.78 * Math.sqrt(t)).toFixed(3) : 0);
      p.classList.toggle('sel', s === selected);
      p.classList.toggle('lit', !!highlight && highlight.includes(s));
      p.setAttribute('aria-label', `${SECTOR_INFO[s].name} ADIZ: ${v} day${v === 1 ? '' : 's'} with reported entries`);
      p.setAttribute('aria-pressed', s === selected);
      labels[s].val.textContent = metric === 'share'
        ? (agg.entryDays ? `${Math.round(100 * v / agg.entryDays)}%` : '–')
        : `${v.toLocaleString('en-US')} d`;
    });
  }
  return { update, proj };
}
