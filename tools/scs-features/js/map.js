// South China Sea map: basemap, 200 nm buffers, nine-dash line, 12 nm rings, feature markers, zoom/pan.
import { createProjection, circlePath, el, escapeHtml } from '../../../shared/js/mapkit.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { FEATURES, OCCUPANTS, PCA_CLASS } from '../data/features.js';
import { BUFFERS } from '../data/buffers.js';
import { NINE_DASH } from '../data/ninedash.js';

export const PROJ = createProjection({ lon0: 101, lon1: 124, lat0: 2, lat1: 23.5, width: 1000 });
const { W, H, project, line } = PROJ;
export const VIEWS = {
  sea: [101, 2, 124, 23.5],
  spratly: [111.2, 6.9, 117.6, 12.1],
  paracel: [110.7, 15.3, 113.1, 17.4],
  shoals: [114.9, 8.9, 118.4, 15.6],
  thomas: [115.3, 9.35, 116.3, 10.15],
};
const MAXZ = 40;
const BUF_COL = { CHN: '--prc', TWN: '--roc', VNM: '--c1', PHL: '--ph', MYS: '--c6', BRN: '--c8', IDN: '--c7' };
const TOP = new Set(['fiery-cross-reef', 'subi-reef', 'mischief-reef', 'itu-aba-island', 'thitu-island', 'spratly-island', 'woody-island', 'scarborough-shoal', 'second-thomas-shoal', 'pratas-island', 'swallow-reef']);
const SEAS = [['South China Sea', [114.2, 13.6]], ['Spratly Islands', [114.4, 11.75]], ['Paracel Islands', [111.9, 17.55]], ['Gulf of Tonkin', [107.6, 19.9]], ['Sulu Sea', [120.4, 8.4]]];
const PLACES = [['VIETNAM', [106.4, 15.6]], ['PHILIPPINES', [121.6, 16.6]], ['CHINA', [112.8, 22.9]], ['Hainan', [109.7, 19.2]], ['Palawan', [118.2, 9.3]], ['Borneo', [114.8, 3.2]], ['TAIWAN', [121.0, 23.3]]];

export function createMap(svg, tip, handlers) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, class: 'tsm-sea' }, root);
  const g = {};
  for (const k of ['grat', 'eez', 'land', 'ndl', 'ts12', 'labels', 'feat', 'flabels']) g[k] = el('g', { class: 'g-' + k }, root);

  for (let lon = 105; lon <= 120; lon += 5) { const [x] = project([lon, 0]); el('line', { x1: x, y1: 0, x2: x, y2: H, class: 'grat' }, g.grat); el('text', { x: x + 3, y: H - 5, class: 't-grat' }, g.grat, lon + '°E'); }
  for (let lat = 5; lat <= 20; lat += 5) { const [, y] = project([0, lat]); el('line', { x1: 0, y1: y, x2: W, y2: y, class: 'grat' }, g.grat); el('text', { x: 4, y: y - 3, class: 't-grat' }, g.grat, lat + '°N'); }

  // 200 nm buffers: one translucent group per country so overlaps read as overlaps
  const eez = {};
  for (const b of BUFFERS) {
    const grp = el('g', { class: 'eez', 'data-iso': b.iso }, g.eez);
    el('path', { d: PROJ.path(b.rings), 'fill-rule': 'evenodd', fill: `var(${BUF_COL[b.iso]})`, stroke: `var(${BUF_COL[b.iso]})`, class: 'eez-a' }, grp);
    eez[b.iso] = grp;
    grp.addEventListener('pointerenter', e => { tip.innerHTML = `<b>${escapeHtml(b.name)}</b>: about 200 nm from its mainland and major-island coasts<br><span class="muted">Approximate, not a legal limit</span>`; tip.hidden = false; moveTip(e); });
    grp.addEventListener('pointermove', e => moveTip(e));
    grp.addEventListener('pointerleave', () => { tip.hidden = true; });
  }
  el('path', { d: PROJ.path(LAND_INDOPAC), class: 'tsm-land', 'fill-rule': 'evenodd' }, g.land);

  // Nine-dash line (only if data/ninedash.js provides sourced coordinates)
  if (NINE_DASH.dashes?.length) {
    NINE_DASH.dashes.forEach(d => el('path', { d: line(d), class: 'ndl' }, g.ndl));
    const [x, y] = project(NINE_DASH.label || NINE_DASH.dashes[0][0]);
    el('text', { x: x + 6, y, class: 't-ndl' }, g.ndl, 'Nine-dash line (approximate)');
  }

  // 12 nm rings
  const rings = {};
  for (const f of FEATURES) rings[f.id] = el('path', { d: circlePath(PROJ, [f.lon, f.lat], 22.224, 6), class: 'ts12', 'data-occ': f.occ }, g.ts12);

  SEAS.forEach(([t, p]) => { const [x, y] = project(p); el('text', { x, y, class: 't-sea', 'text-anchor': 'middle' }, g.labels, t); });
  PLACES.forEach(([t, p]) => { const [x, y] = project(p); el('text', { x, y, class: 't-place' + (t === t.toUpperCase() ? ' big' : ''), 'text-anchor': 'middle' }, g.labels, t); });

  // Features
  const marks = {};
  for (const f of FEATURES) {
    const [x, y] = project([f.lon, f.lat]);
    const m = el('g', { class: 'feat k-' + f.kind, 'data-occ': f.occ, 'data-x': x, 'data-y': y, tabindex: 0, role: 'button',
      'aria-label': `${f.name}, ${OCCUPANTS[f.occ].label}` }, g.feat);
    el('circle', { r: 11, class: 'feat-hit' }, m);
    if (f.kind === 'artificial') el('rect', { x: -5.5, y: -5.5, width: 11, height: 11, transform: 'rotate(45)', class: 'feat-sym', fill: `var(${OCCUPANTS[f.occ].col})` }, m);
    else if (f.kind === 'control') el('circle', { r: 5, class: 'feat-sym hollow', stroke: `var(${OCCUPANTS[f.occ].col})` }, m);
    else el('circle', { r: 4.2, class: 'feat-sym', fill: `var(${OCCUPANTS[f.occ].col})` }, m);
    el('text', { x: 8, y: 4, class: 't-feat' + (TOP.has(f.id) ? ' top' : '') }, m, f.name);
    m.addEventListener('pointerenter', e => { tip.innerHTML = tipHtml(f); tip.hidden = false; moveTip(e); });
    m.addEventListener('pointermove', moveTip);
    m.addEventListener('pointerleave', () => { tip.hidden = true; });
    m.addEventListener('click', () => { if (!dragged) handlers.onSelect(f.id); });
    m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlers.onSelect(f.id); } });
    marks[f.id] = m;
  }
  const tipHtml = f => `<b>${escapeHtml(f.name)}</b>${f.alt?.length ? `<br><span class="muted">${escapeHtml(f.alt.slice(0, 3).join(' · '))}</span>` : ''}
    <br><span class="dot" style="background:var(${OCCUPANTS[f.occ].col})"></span>${escapeHtml(OCCUPANTS[f.occ].label)}${f.pca ? ` · 2016 award: ${escapeHtml(PCA_CLASS[f.pca.cls])}` : ''}`;
  function moveTip(e) {
    const box = svg.parentElement.getBoundingClientRect();
    let x = e.clientX - box.left + 14, y = e.clientY - box.top + 14;
    if (x + 290 > box.width) x = Math.max(4, e.clientX - box.left - 290);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }

  // Zoom and pan
  const vb = { x: 0, y: 0, w: W, h: H };
  let dragged = false;
  const applyVB = () => {
    vb.w = Math.max(W / MAXZ, Math.min(W, vb.w)); vb.h = vb.w * H / W;
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vb.h, vb.y));
    svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
    const z = W / vb.w;
    svg.style.setProperty('--z', z.toFixed(3));
    svg.dataset.zoom = z > 6 ? 'close' : z > 2.2 ? 'mid' : 'far';
    const s = (Math.max(1, 0.75 * W / (svg.clientWidth || W)) / z).toFixed(4);
    for (const m of Object.values(marks)) m.setAttribute('transform', `translate(${m.dataset.x} ${m.dataset.y}) scale(${s})`);
    svg.style.setProperty('--s', s);
  };
  const toMap = e => { const r = svg.getBoundingClientRect(); return [vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.h]; };
  const zoomAt = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const nw = Math.max(W / MAXZ, Math.min(W, vb.w / f)), k = nw / vb.w;
    vb.x = cx - (cx - vb.x) * k; vb.y = cy - (cy - vb.y) * k; vb.w = nw; applyVB();
  };
  const zoomBox = ([lon0, lat0, lon1, lat1]) => {
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1, lat0]);
    const w = Math.max(x1 - x0, (y1 - y0) * W / H);
    vb.w = w; vb.x = (x0 + x1) / 2 - w / 2; vb.y = (y0 + y1) / 2 - (w * H / W) / 2; applyVB();
  };
  const pointers = new Map();
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, e); dragged = false;
    drag = { start: [e.clientX, e.clientY], vb: { ...vb }, pinch: null };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag.pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), w: vb.w }; }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    const dx = e.clientX - drag.start[0], dy = e.clientY - drag.start[1];
    if (Math.hypot(dx, dy) > 4 && !dragged) { dragged = true; svg.setPointerCapture(e.pointerId); tip.hidden = true; }
    if (drag.pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoomAt(vb.w / (drag.pinch.w * drag.pinch.d / Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), ...toMap({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }));
      return;
    }
    if (dragged && vb.w < W) {
      const r = svg.getBoundingClientRect();
      vb.x = drag.vb.x - dx / r.width * vb.w; vb.y = drag.vb.y - dy / r.height * vb.h; applyVB();
      svg.classList.add('panning');
    }
  });
  const end = e => { pointers.delete(e.pointerId); if (!pointers.size) { drag = null; svg.classList.remove('panning'); } };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.01), ...toMap(e)); }, { passive: false });
  addEventListener('resize', () => applyVB());
  applyVB();

  return {
    zoomTo: v => zoomBox(VIEWS[v] || VIEWS.sea),
    zoomToFeature: id => { const f = FEATURES.find(x => x.id === id); if (f) zoomBox([f.lon - 1.4, f.lat - 1.1, f.lon + 1.4, f.lat + 1.1]); },
    zoomIn: () => zoomAt(1.6), zoomOut: () => zoomAt(1 / 1.6),
    render(S) {
      for (const f of FEATURES) {
        const on = S.occ.has(f.occ);
        marks[f.id].classList.toggle('hidden', !on);
        marks[f.id].classList.toggle('sel', S.sel === f.id);
        marks[f.id].classList.toggle('flash', S.flash.includes(f.id));
        const r = rings[f.id];
        r.classList.toggle('hidden', !S.ts12 || !on);
        r.classList.toggle('lte', S.award && f.pca?.cls === 'lte');
      }
      g.eez.classList.toggle('hidden', !S.eez);
      g.ndl.classList.toggle('hidden', !S.ndl);
      svg.classList.toggle('award', S.award);
      g.feat.appendChild(marks[S.sel] || g.feat.lastChild);
    },
  };
}
