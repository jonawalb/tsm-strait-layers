// Main map (Taiwan Strait and surroundings) plus a South China Sea inset for Taiping Island.
import { createProjection, drawBasemap, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { ADIZ } from '../../../shared/data/adiz.js';
import { INC, LOCS, LOC, jitter, nice, inWindow } from './model.js';

const STEP = 6.8;            // sunflower spacing in main-map units, shrunk for big clusters
const MAX_R = 58;            // largest cluster radius on the main map
const INSET = { x: 800, w: 200, lon0: 112.6, lon1: 122.4, lat0: 8.8, lat1: 23.4 };
const PLACES = [
  ['Taipei', 121.56, 25.04], ['Kaohsiung', 120.3, 22.63], ['Taichung', 120.68, 24.15], ['Hualien', 121.6, 23.98],
  ['Xiamen', 118.09, 24.48, 'end'], ['Fuzhou', 119.3, 26.08, 'end'], ['Shantou', 116.68, 23.35, 'end'],
  ['Green I.', 121.49, 22.66], ['Orchid I.', 121.55, 22.05],
];

export function createMap(svg, { onPick, onHover }) {
  const proj = createProjection({ lon0: 115.5, lon1: 123.5, lat0: 20, lat1: 26.8, width: 1000 });
  drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 2 });
  const adiz = el('path', { d: proj.line(ADIZ, true), class: 'adiz' }, svg);
  const lab = el('g', { class: 'places' }, svg);
  PLACES.forEach(([n, lon, lat, anchor]) => {
    const [x, y] = proj.project([lon, lat]);
    el('circle', { cx: x, cy: y, r: 2, class: 'town' }, lab);
    el('text', { x: anchor ? x - 6 : x + 6, y: y + 4, class: 't-place', 'text-anchor': anchor || 'start' }, lab, n);
  });
  el('text', { x: 90, y: 150, class: 't-country' }, lab, 'CHINA');
  el('text', { ...xy(proj, [120.62, 23.62]), class: 't-country', 'text-anchor': 'middle' }, lab, 'TAIWAN');
  el('text', { ...xy(proj, [119.55, 24.1]), class: 't-sea', 'text-anchor': 'middle' }, lab, 'Taiwan Strait');
  el('text', { ...xy(proj, [122.6, 26.55]), class: 't-sea', 'text-anchor': 'middle' }, lab, 'East China Sea');
  el('text', { ...xy(proj, [117.2, 21.6]), class: 't-sea', 'text-anchor': 'middle' }, lab, 'South China Sea');
  el('text', { ...xy(proj, [123.2, 24.1]), class: 't-sea', 'text-anchor': 'end' }, lab, 'Pacific');
  el('text', { ...xy(proj, [118.3, 21.75]), class: 't-adiz' }, lab, 'Taiwan ADIZ');

  // Inset: South China Sea, with Taiping Island.
  const ip = createProjection({ lon0: INSET.lon0, lon1: INSET.lon1, lat0: INSET.lat0, lat1: INSET.lat1, width: INSET.w });
  const iy = proj.H - ip.H;
  const ig = el('g', { transform: `translate(${INSET.x} ${iy})`, class: 'inset' }, svg);
  const cid = 'inset-clip';
  const defs = el('defs', {}, svg);
  const cp = el('clipPath', { id: cid }, defs);
  el('rect', { x: 0, y: 0, width: INSET.w, height: ip.H }, cp);
  const ib = el('g', { 'clip-path': `url(#${cid})` }, ig);
  el('rect', { x: 0, y: 0, width: INSET.w, height: ip.H, class: 'tsm-sea' }, ib);
  el('path', { d: ip.path(LAND_INDOPAC), class: 'tsm-land', 'fill-rule': 'evenodd' }, ib);
  const [bx0, by0] = ip.project([115.5, 26.8]), [bx1, by1] = ip.project([123.5, 20]);
  el('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, class: 'inset-box' }, ib);
  el('text', { x: 8, y: 18, class: 'inset-title' }, ib, 'South China Sea');
  el('text', { ...xy(ip, [114.36, 10.38], 0, 22), class: 't-place', 'text-anchor': 'middle' }, ib, 'Taiping I.');
  el('text', { ...xy(ip, [120.9, 14.6]), class: 't-place', 'text-anchor': 'middle' }, ib, 'Philippines');
  el('rect', { x: 0, y: 0, width: INSET.w, height: ip.H, class: 'inset-frame' }, ig);

  // Approximate-area rings and labels, one per location. Pins cluster around each location's anchor.
  const areas = el('g', { class: 'areas' }, svg);
  const pins = el('g', { class: 'pins' }, svg);
  const center = L => {
    if (!L.inset) return proj.project(L.anchor);
    const [x, y] = ip.project(L.anchor);
    return [x + INSET.x, y + iy];
  };
  const areaEls = {};
  LOCS.forEach(L => {
    const [cx, cy] = center(L);
    const g = el('g', { class: 'area' }, areas);
    g.style.setProperty('--lc', L.color);
    const ring = el('circle', { cx, cy, r: 12, class: 'area-ring' }, g);
    const t = el('text', { x: cx, y: cy, class: 'area-label', 'text-anchor': 'middle' }, g);
    t.textContent = L.short;
    const c = el('tspan', { class: 'area-n' }, t, '');
    areaEls[L.key] = { g, ring, t, c, cx, cy };
  });

  const pinEls = new Map();
  INC.forEach(i => {
    const L = LOC[i.loc];
    const g = el('g', { class: 'pin', tabindex: 0, role: 'button' }, pins);
    g.setAttribute('aria-label', `${nice(i.date)} ${L.label}, approximate position`);
    g.style.setProperty('--lc', L.color);
    el('circle', { r: 11, class: 'pulse' }, g);
    el('circle', { r: 5.2, class: 'dot' }, g);
    g.addEventListener('click', () => onPick(i.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i.id); } });
    g.addEventListener('pointerenter', e => onHover(i, e));
    g.addEventListener('pointerleave', () => onHover(null));
    g.addEventListener('focus', () => onHover(i, null, g));
    g.addEventListener('blur', () => onHover(null));
    pinEls.set(i.id, g);
  });

  /** Lay the pins of one window out around their anchors; positions stay fixed while the slider moves. */
  let laidOut = null;
  function layout(w) {
    const key = w.s + w.e;
    if (laidOut === key) return;
    laidOut = key;
    LOCS.forEach(L => {
      const list = INC.filter(i => i.loc === L.key && inWindow(i, w));
      const n = list.length;
      const step = L.inset ? 5 : Math.min(STEP, MAX_R / Math.sqrt(n + 0.6));
      const a = areaEls[L.key];
      list.forEach((i, k) => {
        const [dx, dy] = jitter(k, step);
        pinEls.get(i.id).setAttribute('transform', `translate(${(a.cx + dx).toFixed(1)} ${(a.cy + dy).toFixed(1)})`);
      });
      const r = step * Math.sqrt(Math.max(n, 1) + 0.6) + 9;
      a.ring.setAttribute('r', r.toFixed(1));
      a.t.setAttribute('y', L.up ? a.cy - r - 6 : a.cy + r + 14);
      a.g.classList.toggle('none', n === 0);
    });
  }

  function update({ w, date, on, sel, showAdiz, newDays = 10 }) {
    layout(w);
    adiz.style.display = showAdiz ? '' : 'none';
    const counts = {};
    INC.forEach(i => {
      const g = pinEls.get(i.id);
      const vis = inWindow(i, w) && i.date <= date && on.has(i.loc);
      g.classList.toggle('hidden', !vis);
      g.setAttribute('tabindex', vis ? 0 : -1);
      const age = (Date.parse(date) - Date.parse(i.date)) / 86400000;
      g.classList.toggle('new', vis && age <= newDays);
      g.classList.toggle('sel', i.id === sel);
      if (vis) counts[i.loc] = (counts[i.loc] || 0) + 1;
    });
    LOCS.forEach(L => {
      const n = counts[L.key] || 0;
      areaEls[L.key].g.classList.toggle('off', !on.has(L.key));
      areaEls[L.key].g.classList.toggle('empty', n === 0);
      areaEls[L.key].c.textContent = n ? ` ${n}` : '';
    });
    const s = pinEls.get(sel);
    if (s && !s.classList.contains('hidden')) pins.appendChild(s);
  }
  return { update, pinEl: id => pinEls.get(id) };
}

function xy(proj, p, dx = 0, dy = 0) {
  const [x, y] = proj.project(p);
  return { x: x + dx, y: y + dy };
}
