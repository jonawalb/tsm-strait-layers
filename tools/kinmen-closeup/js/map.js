// Kinmen map: Natural Earth 10m land, official restricted/prohibited waters, incident pins by sector, AIS fixes.
import { createProjection, drawBasemap, el, escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { LAND_KINMEN } from '../data/land.js';
import { WATERS, SECTORS, SECTOR, INC, FIXES, nice } from './model.js';

const [LON0, LAT0, LON1, LAT1] = [117.95, 24.2, 118.68, 24.66];
const GOLDEN = 137.508 * Math.PI / 180;
const jitter = (k, step) => { const r = step * Math.sqrt(k + 0.6), a = k * GOLDEN; return [r * Math.cos(a), r * Math.sin(a)]; };
const LABELS = [
  ['Kinmen', 118.37, 24.455, 't-isle'], ['Lieyu', 118.238, 24.43, 't-isle sm'], ['Xiamen', 118.09, 24.49, 't-cn'],
  ['CHINA', 118.03, 24.6, 't-country'], ['Taiwan Strait', 118.55, 24.23, 't-sea'],
];

export function createMap(svg, tip, { onPick, onHover }) {
  const proj = createProjection({ lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1, width: 1000 });
  drawBasemap(svg, proj, LAND_KINMEN, { gratStep: 0.1 });
  svg.querySelectorAll('.tsm-grat text').forEach(t => { t.textContent = t.textContent.replace(/[\d.]+/, v => (+v).toFixed(1)); });
  const P = p => proj.project(p);
  const V = WATERS.vertices;
  const ring = keys => proj.line(keys.map(k => V[k]), true);
  const wg = el('g', { class: 'waters' }, svg);
  const rPath = el('path', { d: ring(WATERS.restricted), class: 'w-restricted' }, wg);
  const pPath = el('path', { d: ring(WATERS.prohibited), class: 'w-prohibited' }, wg);
  const vg = el('g', { class: 'vertices' }, wg);
  Object.entries(V).forEach(([k, p]) => {
    const [x, y] = P(p);
    const unsure = WATERS.uncertain.includes(k);
    const c = el('circle', { cx: x, cy: y, r: 3.2, class: 'vx' + (unsure ? ' unsure' : ''), tabindex: 0 }, vg);
    const html = `<b>Boundary point ${k}</b><span class="tt-d">${dms(p[1], 'N')} ${dms(p[0], 'E')}</span>` +
      (unsure ? `<small>${(WATERS.uncertainNote || {})[k] || 'Seconds partly illegible on the source map'}</small>` : '<small>As printed on the MAC map</small>');
    c.addEventListener('pointerenter', e => show(html, e));
    c.addEventListener('focus', () => show(html, null, c));
    c.addEventListener('pointerleave', hide);
    c.addEventListener('blur', hide);
  });
  const lab = el('g', { class: 'labels' }, svg);
  LABELS.forEach(([t, lon, lat, c]) => { const [x, y] = P([lon, lat]); el('text', { x, y, class: c, 'text-anchor': 'middle' }, lab, t); });

  const secG = el('g', { class: 'sectors' }, svg);
  const secEls = {};
  SECTORS.forEach(s => {
    const [x, y] = P(s.anchor);
    const g = el('g', { class: 'sector' }, secG);
    const r = el('circle', { cx: x, cy: y, r: 20, class: 'sec-ring' }, g);
    const t = el('text', { x, y: y + 36, class: 'sec-lab', 'text-anchor': 'middle' }, g, '');
    secEls[s.key] = { g, r, t, x, y };
  });

  const aisG = el('g', { class: 'ais' }, svg);
  const fixEls = FIXES.map(f => {
    const [x, y] = P([f.lon, f.lat]);
    const e = el('rect', { x: x - 4, y: y - 4, width: 8, height: 8, class: 'fix' + (f.zone ? ' in' : ''), tabindex: 0 }, aisG);
    const html = `<b>${esc(f.v.name || 'MMSI ' + f.mmsi)}</b><span class="tt-d">MMSI ${f.mmsi}, PRC flag, force not attributed</span>` +
      `${f.t.replace('T', ' ').replace('Z', ' UTC')}${f.sog != null ? `, ${f.sog} kn` : ''}<small>${f.zone ? 'Inside the ' + f.zone + ' waters' : 'Outside the restricted waters'}</small>`;
    e.addEventListener('pointerenter', ev => show(html, ev));
    e.addEventListener('focus', () => show(html, null, e));
    e.addEventListener('pointerleave', hide);
    e.addEventListener('blur', hide);
    return e;
  });

  const pins = el('g', { class: 'pins' }, svg);
  const pinEls = new Map();
  INC.forEach(i => {
    const g = el('g', { class: 'pin', tabindex: 0, role: 'button' }, pins);
    g.setAttribute('aria-label', `${nice(i.date)}: ${i.desc}. Approximate area.`);
    el('circle', { r: 10, class: 'pulse' }, g);
    el('circle', { r: 5, class: 'dot' }, g);
    g.addEventListener('click', () => onPick(i.k));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i.k); } });
    g.addEventListener('pointerenter', e => onHover(i, e));
    g.addEventListener('pointerleave', () => onHover(null));
    g.addEventListener('focus', () => onHover(i, null, g));
    g.addEventListener('blur', () => onHover(null));
    pinEls.set(i.k, g);
  });

  /** Pins sit in the first sector their description names, spread in a fixed pattern. */
  let laid = null;
  function layout(w) {
    if (laid === w.s + w.e) return;
    laid = w.s + w.e;
    SECTORS.forEach(s => {
      const list = INC.filter(i => i.sec[0] === s.key && i.date >= w.s && i.date <= w.e);
      const step = Math.min(7.5, 46 / Math.sqrt(list.length + 0.6));
      const a = secEls[s.key];
      list.forEach((i, k) => { const [dx, dy] = jitter(k, step); pinEls.get(i.k).setAttribute('transform', `translate(${(a.x + dx).toFixed(1)} ${(a.y + dy).toFixed(1)})`); });
      const r = step * Math.sqrt(Math.max(list.length, 1) + 0.6) + 9;
      a.r.setAttribute('r', r.toFixed(1));
      a.t.setAttribute('y', (a.y + r + 14).toFixed(1));
    });
  }

  function update({ S, visible, hullSet }) {
    layout(S.w);
    rPath.style.display = S.waters ? '' : 'none';
    pPath.style.display = S.waters ? '' : 'none';
    vg.style.display = S.waters ? '' : 'none';
    const counts = {};
    INC.forEach(i => {
      const g = pinEls.get(i.k), vis = visible.has(i.k);
      g.classList.toggle('hidden', !vis);
      g.setAttribute('tabindex', vis ? 0 : -1);
      g.classList.toggle('new', vis && (Date.parse(S.date) - Date.parse(i.date)) / 864e5 <= 14);
      g.classList.toggle('sel', i.k === S.sel);
      g.classList.toggle('dim', vis && !!hullSet && !i.ccg.some(h => hullSet.has(h)));
      if (vis) counts[i.sec[0]] = (counts[i.sec[0]] || 0) + 1;
    });
    SECTORS.forEach(s => {
      const n = counts[s.key] || 0;
      secEls[s.key].t.textContent = `${s.short}${n ? ': ' + n : ''}`;
      secEls[s.key].g.classList.toggle('empty', !n);
      secEls[s.key].g.classList.toggle('off', !S.sectors.has(s.key));
    });
    const sel = pinEls.get(S.sel);
    if (sel && !sel.classList.contains('hidden')) pins.appendChild(sel);
    FIXES.forEach((f, k) => { fixEls[k].style.display = S.ais && f.date <= S.date ? '' : 'none'; });
  }

  function show(html, e, anchor) { tip.innerHTML = html; tip.hidden = false; place(tip, svg, e, anchor); }
  function hide() { tip.hidden = true; }
  return { update, show, hide };
}

function dms(v, h) {
  const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  return `${h}${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″`;
}

export function place(tip, svg, e, anchor) {
  const box = svg.parentElement.getBoundingClientRect();
  let x, y;
  if (e) { x = e.clientX - box.left; y = e.clientY - box.top; } else { const r = anchor.getBoundingClientRect(); x = r.left + r.width / 2 - box.left; y = r.top - box.top; }
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(box.width - w - 4, x + 14)) + 'px';
  tip.style.top = Math.max(4, y + h + 20 > box.height ? y - h - 12 : y + 14) + 'px';
}
export { SECTOR };
