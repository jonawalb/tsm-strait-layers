// Map of headquarters cities. Markers sit on the city, grouped when several units share one.
import { createProjection, el, distKm, escapeHtml } from '../../../shared/js/mapkit.js';
import { COUNTRIES_INDOPAC } from '../../../shared/data/countries-indopac.js';
import { COUNTRY, TAIPEI } from '../data/units.js';

const BOX = { lon0: 111, lon1: 141.5, lat0: 14.3, lat1: 36.2, width: 1000 };
const ISO = { CHN: 'PRC', TWN: 'ROC', JPN: 'JPN', PHL: 'PHL' };

export function createMap(svg, tip, units, { onPick }) {
  const proj = createProjection(BOX);
  svg.setAttribute('viewBox', `0 0 ${proj.W} ${proj.H}`);
  el('rect', { x: 0, y: 0, width: proj.W, height: proj.H, class: 'tsm-sea' }, svg);
  const land = el('g', {}, svg);
  const fills = {};
  COUNTRIES_INDOPAC.forEach(c => {
    const k = ISO[c.iso];
    const p = el('path', { d: proj.path(c.rings), class: `c-fill${k ? ' k-' + k : ''}`, 'fill-rule': 'evenodd' }, land);
    if (k) fills[k] = p;
  });
  const labels = el('g', {}, svg);
  [['CHINA', [114.5, 28.5]], ['TAIWAN', [121.1, 23.4]], ['JAPAN', [135.5, 35.2]], ['PHILIPPINES', [122.3, 14.2]]]
    .forEach(([t, ll]) => { const [x, y] = proj.project(ll); el('text', { x, y, class: 'c-label', 'text-anchor': 'middle' }, labels, t); });
  const tp = el('g', { class: 'taipei' }, svg);
  const [tx, ty] = proj.project(TAIPEI);
  el('circle', { cx: tx, cy: ty, r: 3 }, tp);
  el('text', { x: tx + 6, y: ty - 5 }, tp, 'Taipei');
  const overlay = el('g', {}, svg);
  const pinsG = el('g', {}, svg);

  // Offset units that share a city so each marker stays clickable.
  const byCity = {};
  units.forEach(u => { (byCity[u.ll.join()] ||= []).push(u); });
  const pins = {};
  units.forEach(u => {
    const group = byCity[u.ll.join()], i = group.indexOf(u), n = group.length;
    let [x, y] = proj.project(u.ll);
    if (n > 1) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; x += Math.cos(a) * 9; y += Math.sin(a) * 9; }
    const g = el('g', { class: `pin k-${u.country}`, tabindex: 0, role: 'button', 'aria-label': `${u.name}, headquarters ${u.hq}` }, pinsG);
    el('circle', { class: 'halo', cx: x, cy: y, r: 11 }, g);
    el('circle', { class: 'dot', cx: x, cy: y, r: 6.5 }, g);
    const lab = el('text', { x: x + 10, y: y + 4 }, g, u.short);
    lab.style.display = 'none';
    g.addEventListener('click', () => onPick(u.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(u.id); } });
    g.addEventListener('pointerenter', e => showTip(e, u));
    g.addEventListener('pointerleave', () => { tip.hidden = true; });
    g.addEventListener('focus', () => { lab.style.display = ''; });
    g.addEventListener('blur', () => { lab.style.display = 'none'; });
    pins[u.id] = { g, x, y, lab };
  });

  // Narrow screens draw the 1000-unit map small: grow pins and labels (up to 1.9x) so they stay legible.
  const disp = () => Math.max(1, Math.min(1.9, 700 / (svg.clientWidth || proj.W)));
  const setDisp = () => svg.style.setProperty('--d', disp().toFixed(3));
  setDisp();
  if ('ResizeObserver' in window) new ResizeObserver(setDisp).observe(svg);

  function showTip(e, u) {
    if (svg.dataset.quiz === '1') return;
    const r = svg.parentElement.getBoundingClientRect();
    tip.innerHTML = `<b>${escapeHtml(u.name)}</b><br><span class="fine">${COUNTRY[u.country].name} · HQ ${escapeHtml(u.hq)}</span>`;
    tip.hidden = false;
    tip.style.left = Math.max(4, Math.min(e.clientX - r.left + 12, r.width - tip.offsetWidth - 4)) + 'px';
    tip.style.top = (e.clientY - r.top + 12) + 'px';
  }

  return {
    filter(countries) {
      units.forEach(u => pins[u.id].g.classList.toggle('dim', !countries.has(u.country)));
      Object.entries(fills).forEach(([k, p]) => p.classList.toggle('on', countries.has(k)));
    },
    select(ids = [], { labels: showLabels = true } = {}) {
      Object.entries(pins).forEach(([id, p]) => {
        const k = ids.indexOf(id), on = k >= 0;
        p.g.classList.toggle('sel', on);
        p.lab.style.display = on && showLabels ? '' : 'none';
        p.lab.setAttribute('y', p.y + 4 + Math.max(0, k) * 15 * disp());
      });
    },
    quiz(id) {
      svg.dataset.quiz = id ? '1' : '';
      Object.entries(pins).forEach(([k, p]) => p.g.classList.toggle('quizq', k === id));
    },
    compare(a, b) {
      overlay.textContent = '';
      if (!a || !b) return null;
      const pa = pins[a.id], pb = pins[b.id];
      el('path', { class: 'cmp-line', d: `M${pa.x} ${pa.y}L${pb.x} ${pb.y}` }, overlay);
      const km = distKm(a.ll, b.ll);
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > 90) el('text', { class: 'cmp-label', x: (pa.x + pb.x) / 2 + 6, y: (pa.y + pb.y) / 2 - 6 }, overlay, `${Math.round(km).toLocaleString('en-US')} km`);
      return km;
    },
  };
}
