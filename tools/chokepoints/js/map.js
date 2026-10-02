// Map for the Chokepoint Dashboard: land, sea lanes, chokepoint markers, routes and animated ships.
import { createProjection, el, along, routeLengths, circlePath } from '../../../shared/js/mapkit.js';
import { LAND } from '../data/land.js';
import { NODES, EDGES } from '../data/lanes.js';
import { CHOKEPOINTS, HORMUZ } from '../data/chokepoints.js';
import { PLACES } from '../data/voyages.js';

export const VIEWS = { region: [44, -16, 150, 46], east: [104, -12, 146, 44], all: [44, -47, 168, 47] };
const TAIWAN = [121.0, 23.7];
const END_LABEL = { RT: [0, -12, 'middle'], SHA: [-9, -6, 'end'], BUS: [-9, -6, 'end'], KHH: [-9, 12, 'end'], PHE: [9, 12, 'start'] };

export function createMap(svg, tip, { onToggle, onFocus }) {
  const proj = createProjection({ lon0: 44, lon1: 168, lat0: -47, lat1: 47, width: 1000 });
  const { W, H, project } = proj;
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, class: 'cp-sea' }, root);
  const grat = el('g', { class: 'cp-grat' }, root);
  for (let lon = 50; lon <= 165; lon += 10) { const [x] = project([lon, 0]); el('line', { x1: x, y1: 0, x2: x, y2: H }, grat); }
  for (let lat = -40; lat <= 40; lat += 10) { const [, y] = project([0, lat]); el('line', { x1: 0, y1: y, x2: W, y2: y }, grat); }
  const zone = el('g', { class: 'cp-zone' }, root);
  el('path', { d: circlePath(proj, TAIWAN, 420), class: 'cp-zone-p' }, zone);
  const [zx, zy] = project([TAIWAN[0] + 2.2, TAIWAN[1] + 4.3]);
  el('text', { x: zx, y: zy, class: 'cp-zone-t' }, zone, 'Taiwan contingency (illustrative)');
  el('path', { d: proj.path(LAND), class: 'cp-land', 'fill-rule': 'evenodd' }, root);

  const lanes = el('g', { class: 'cp-lanes' }, root);
  EDGES.forEach(([a, b]) => el('path', { d: proj.line([NODES[a], NODES[b]]), class: 'cp-lane' }, lanes));
  const ghost = el('path', { class: 'cp-ghost' }, root);
  const halo = el('path', { class: 'cp-route-halo' }, root);
  const line = el('path', { class: 'cp-route' }, root);
  const ends = el('g', {}, root);
  const ships = el('g', { class: 'cp-ships' }, root);
  const marks = el('g', {}, root);

  // Hormuz: context only, never closed in this tool
  { const [x, y] = project(HORMUZ.at);
    el('circle', { cx: x, cy: y, r: 4, class: 'cp-hormuz' }, marks);
    el('text', { x: x + 6, y: y + 14, class: 'cp-mark-t cp-muted' }, marks, 'Hormuz'); }

  const markers = {};
  CHOKEPOINTS.forEach(c => {
    const [x, y] = project(c.at);
    const g = el('g', { class: 'cp-mark', tabindex: 0, role: 'button', 'data-id': c.id, transform: `translate(${x} ${y})` }, marks);
    const inner = el('g', { class: 'cp-mark-in' }, g);
    el('circle', { r: 13, class: 'cp-hit' }, inner);
    el('circle', { r: 7, class: 'cp-dot' }, inner);
    el('path', { d: 'M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5', class: 'cp-x' }, inner);
    const [dx, dy] = c.label;
    el('text', { x: dx * 11, y: dy * 14 + 4, class: 'cp-mark-t', 'text-anchor': dx < 0 ? 'end' : 'start' }, inner, c.short);
    g.setAttribute('aria-label', `${c.name}: press to close or reopen`);
    const act = () => onToggle(c.id);
    g.addEventListener('click', act);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    g.addEventListener('pointerenter', e => { onFocus(c.id); showTip(e, c); });
    g.addEventListener('pointermove', e => showTip(e, c));
    g.addEventListener('pointerleave', () => { tip.hidden = true; });
    g.addEventListener('focus', () => onFocus(c.id));
    markers[c.id] = g;
  });
  function showTip(e, c) {
    const r = svg.parentElement.getBoundingClientRect();
    tip.innerHTML = `<b>${c.name}</b><br>${c.facts[0][0]}: ${c.facts[0][1]}<br><span class="fine">Click to ${markers[c.id].dataset.closed === '1' ? 'reopen' : 'close'}</span>`;
    tip.hidden = false;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, x + 14)) + 'px';
    tip.style.top = (y + 14) + 'px';
  }

  // View box
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let vb = [0, 0, W, H], anim = 0;
  const setVB = v => { vb = v; svg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' ')); svg.style.setProperty('--z', zd().toFixed(3)); place(); };
  // Narrow screens draw the 1000-unit map small; grow markers and labels up to 1.9x so they stay legible.
  function zd() { return (W / vb[2]) / Math.max(1, Math.min(1.9, 700 / (svg.clientWidth || W))); }
  const toVB = ([lon0, lat0, lon1, lat1], aspect) => {
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1, lat0]);
    let w = Math.max(x1 - x0, (y1 - y0) * aspect), h = w / aspect;
    if (w > W) { w = W; h = w / aspect; }
    if (h > H) { h = H; w = h * aspect; }
    const x = Math.max(0, Math.min(W - w, (x0 + x1) / 2 - w / 2)), y = Math.max(0, Math.min(H - h, (y0 + y1) / 2 - h / 2));
    return [x, y, w, h];
  };
  const goTo = t => {
    cancelAnimationFrame(anim);
    if (reduce.matches) return setVB(t);
    const f = vb.slice();
    let t0 = null;
    const step = now => { t0 ??= now; const k = Math.min(1, (now - t0) / 700), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; setVB(f.map((v, i) => v + (t[i] - v) * e)); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
    clearTimeout(snap); snap = setTimeout(() => { cancelAnimationFrame(anim); setVB(t); }, 900); // land on the target even if frames are throttled
  };
  let snap = 0;
  const ASPECT = W / H;
  svg.style.aspectRatio = `${ASPECT}`;
  function place() {
    const z = zd();
    Object.values(markers).forEach(g => { g.querySelector('.cp-mark-in').setAttribute('transform', `scale(${(1 / z).toFixed(3)})`); });
    ends.querySelectorAll('.cp-end').forEach(g => g.firstChild.setAttribute('transform', `scale(${(1 / z).toFixed(3)})`));
  }

  // Ships
  let shipAnim = 0, shipPts = null;
  const SHIPS = 5;
  const shipEls = Array.from({ length: SHIPS }, () => el('path', { d: 'M5 0L-4 3.5L-2.5 0L-4 -3.5Z', class: 'cp-ship' }, ships));
  function animateShips(pts) {
    cancelAnimationFrame(shipAnim);
    shipPts = pts;
    if (!pts) { shipEls.forEach(s => s.style.display = 'none'); return; }
    const L = routeLengths(pts), total = L[L.length - 1];
    const periodMs = Math.max(9000, total / 2.2);
    const draw = now => {
      const z = zd();
      shipEls.forEach((s, i) => {
        const t = reduce.matches ? (i + 0.5) / SHIPS : ((now / periodMs) + i / SHIPS) % 1;
        const p = along(pts, t), q = along(pts, Math.min(1, t + 0.004));
        const [x, y] = project(p), [x2, y2] = project(q);
        const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
        s.style.display = '';
        s.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(0)}) scale(${(2.2 / z).toFixed(3)})`);
      });
      if (!reduce.matches) shipAnim = requestAnimationFrame(draw);
    };
    shipAnim = requestAnimationFrame(draw);
  }

  if ('ResizeObserver' in window) new ResizeObserver(() => setVB(vb)).observe(svg);
  return {
    W, H,
    view(box) { goTo(toVB(box, ASPECT)); },
    fit(pts) {
      const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
      const lon0 = Math.min(...lons), lon1 = Math.max(...lons), lat0 = Math.min(...lats), lat1 = Math.max(...lats);
      const pl = Math.max(4, (lon1 - lon0) * 0.1), pa = Math.max(4, (lat1 - lat0) * 0.12);
      goTo(toVB([lon0 - pl, lat0 - pa, lon1 + pl, lat1 + pa], ASPECT));
    },
    draw({ cur, base, from, to, closed, onRoute, focus, twClosed }) {
      ghost.setAttribute('d', base && cur && base.km + 1 < cur.km ? proj.line(base.pts) : '');
      const d = cur ? proj.line(cur.pts) : '';
      line.setAttribute('d', d); halo.setAttribute('d', d);
      zone.classList.toggle('on', twClosed);
      ends.innerHTML = '';
      [[from, 'o'], [to, 'd']].forEach(([id, k]) => {
        const [x, y] = project(NODES[id]);
        const g = el('g', { class: 'cp-end cp-end-' + k, transform: `translate(${x} ${y})` }, ends);
        const inner = el('g', {}, g);
        el('circle', { r: 6 }, inner);
        const [lx, ly, anc] = END_LABEL[id] || [9, -8, 'start'];
        el('text', { x: lx, y: ly, class: 'cp-end-t', 'text-anchor': anc }, inner, PLACES[id]);
      });
      Object.entries(markers).forEach(([id, g]) => {
        g.dataset.closed = closed.has(id) ? '1' : '0';
        g.dataset.on = onRoute.includes(id) ? '1' : '0';
        g.dataset.focus = focus === id ? '1' : '0';
        g.setAttribute('aria-pressed', String(closed.has(id)));
      });
      place();
      animateShips(cur ? cur.pts : null);
    },
  };
}
