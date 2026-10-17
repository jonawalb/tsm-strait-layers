// Island-chain map: basemap, chains, reach rings, launch areas, sites, measure tool, zoom and pan.
import { createProjection, el, circlePath, distKm, fmt, destination } from '../../../shared/js/mapkit.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { SITES, LAYERS } from '../data/sites.js';
import { MISSILES, LAUNCH, CHAINS } from '../data/pla.js';
import { PRC_RINGS, TWN_RINGS } from './model.js';

export const BOXES = { region: [99, -16, 160, 44], taiwan: [115, 17, 133, 31], guam: [120, 5, 150, 30], luzon: [114, 6, 132, 27], near: [110, 8, 142, 40] };
const SHAPES = { us: 'M0 -4.6A4.6 4.6 0 1 1 0 4.6A4.6 4.6 0 1 1 0 -4.6Z', jp: 'M-4 -4H4V4H-4Z', ph: 'M0 -5.4L5.4 0L0 5.4L-5.4 0Z', au: 'M0 -5.2L5 3.8H-5Z' };
const LAYER_COL = Object.fromEntries(LAYERS.map(l => [l.id, l.col]));

export function createMap(svg, tip, h) {
  const proj = createProjection({ lon0: 99, lon1: 160, lat0: -16, lat1: 44, width: 1000 });
  const { W, H, project, unproject } = proj;
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, class: 'ic-sea' }, root);
  const grat = el('g', { class: 'ic-grat' }, root);
  for (let lon = 100; lon <= 160; lon += 10) { const [x] = project([lon, 0]); el('line', { x1: x, y1: 0, x2: x, y2: H }, grat); el('text', { x: x + 3, y: H - 5 }, grat, lon + '°E'); }
  for (let lat = -10; lat <= 40; lat += 10) { const [, y] = project([0, lat]); el('line', { x1: 0, y1: y, x2: W, y2: y }, grat); el('text', { x: 4, y: y - 3 }, grat, `${Math.abs(lat)}°${lat < 0 ? 'S' : lat ? 'N' : ''}`); }
  const g = {};
  for (const k of ['rings', 'land', 'ringt', 'chains', 'launch', 'sites', 'measure']) g[k] = el('g', { class: 'g-' + k }, root);
  el('path', { d: proj.path(LAND_INDOPAC), class: 'ic-land', 'fill-rule': 'evenodd' }, g.land);
  el('path', { d: proj.path(PRC_RINGS), class: 'ic-prc' }, g.land);
  el('path', { d: proj.path(TWN_RINGS), class: 'ic-roc' }, g.land);
  [['CHINA', 112, 31], ['TAIWAN', 121.0, 23.6, -72], ['PHILIPPINE SEA', 132, 18], ['SOUTH CHINA SEA', 114, 13], ['JAPAN', 136.5, 36.6, -35], ['AUSTRALIA', 133, -20]].forEach(([n, lon, lat, rot]) => {
    const [x, y] = project([lon, lat]);
    el('text', { x, y, class: n === n.toUpperCase() && !n.includes('SEA') ? 'ic-big' : 'ic-seat', 'text-anchor': 'middle', transform: rot ? `rotate(${rot} ${x} ${y})` : '' }, g.land, n);
  });

  // Island chains
  const chainEls = CHAINS.map(c => {
    const grp = el('g', { class: 'ic-chain ic-' + c.id }, g.chains);
    el('path', { d: proj.line(c.pts), class: 'ic-chain-p' }, grp);
    const [x, y] = project(c.lbl);
    el('text', { x, y, class: 'ic-chain-t', 'text-anchor': 'middle', transform: `rotate(${c.rot} ${x} ${y})` }, grp, c.n + ' (conceptual)');
    return grp;
  });

  // Launch areas
  const launchEls = {};
  LAUNCH.forEach(l => {
    const [x, y] = project(l.c);
    const grp = el('g', { class: 'ic-launch', 'data-id': l.id, transform: `translate(${x} ${y})` }, g.launch);
    const inner = el('g', {}, grp);
    el('path', { d: 'M0 -5L4.6 3.5H-4.6Z', class: 'ic-launch-s' }, inner);
    el('text', { x: 0, y: 14, class: 'ic-launch-t', 'text-anchor': 'middle' }, inner, l.n.replace(' (inland)', ''));
    grp.addEventListener('click', e => { e.stopPropagation(); h.onLaunch(l.id); });
    launchEls[l.id] = grp;
  });

  // Sites
  const siteEls = {};
  SITES.forEach(s => {
    const [x, y] = project(s.c);
    const grp = el('g', { class: 'ic-site', 'data-layer': s.layer, 'data-id': s.id, tabindex: 0, role: 'button', 'aria-label': `${s.n}, ${s.where}`, transform: `translate(${x} ${y})` }, g.sites);
    const inner = el('g', {}, grp);
    el('circle', { r: 11, class: 'ic-hit' }, inner);
    el('path', { d: SHAPES[s.layer], class: 'ic-site-s', fill: `var(${LAYER_COL[s.layer]})` }, inner);
    const side = s.side || 1;
    el('text', { x: side * 8, y: 4 + (s.dy || 0) * 9, class: 'ic-site-t', 'text-anchor': side > 0 ? 'start' : 'end', fill: `var(${LAYER_COL[s.layer]})` }, inner, s.short);
    const pick = () => h.onSite(s.id);
    grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    grp.addEventListener('pointerenter', e => showTip(e, s));
    grp.addEventListener('pointermove', e => showTip(e, s));
    grp.addEventListener('pointerleave', () => { tip.hidden = true; });
    siteEls[s.id] = grp;
  });
  function showTip(e, s) {
    const r = svg.parentElement.getBoundingClientRect();
    tip.innerHTML = `<b>${s.n}</b><br>${s.where}<br><span class="fine">${s.d}</span>`;
    tip.hidden = false;
    tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, e.clientX - r.left + 14)) + 'px';
    tip.style.top = (e.clientY - r.top + 14) + 'px';
  }

  // Viewport
  const vb = { x: 0, y: 0, w: W };
  // On narrow screens the SVG is drawn smaller than its 1000-unit width; grow labels and markers
  // (up to 1.9x in map units) so they stay legible. Display only: positions and distances are unchanged.
  const disp = () => Math.max(1, Math.min(1.9, 700 / (svg.clientWidth || W)));
  const scaleEls = () => {
    const d = disp(), z = W / vb.w, k = (d / z).toFixed(3);
    svg.style.setProperty('--z', (z / d).toFixed(3));
    for (const grp of [...Object.values(siteEls), ...Object.values(launchEls)]) grp.firstChild.setAttribute('transform', `scale(${k})`);
    SITES.forEach(s => siteEls[s.id].classList.toggle('lbl-off', (s.minZ || 1) > z * 1.05 && !siteEls[s.id].classList.contains('sel')));
  };
  const apply = () => {
    vb.w = Math.max(W / 8, Math.min(W, vb.w));
    const vh = vb.w * H / W;
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vh, vb.y));
    svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vh.toFixed(1)}`);
    scaleEls();
  };
  const zoomAt = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.w * H / W / 2) => {
    const nw = Math.max(W / 8, Math.min(W, vb.w / f)), k = nw / vb.w;
    vb.x = cx - (cx - vb.x) * k; vb.y = cy - (cy - vb.y) * k; vb.w = nw; apply();
  };
  const zoomBox = ([lon0, lat0, lon1, lat1]) => {
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1, lat0]);
    vb.w = Math.max(x1 - x0, (y1 - y0) * W / H); vb.x = (x0 + x1) / 2 - vb.w / 2; vb.y = (y0 + y1) / 2 - vb.w * H / W / 2; apply();
  };
  const toMap = e => { const r = svg.getBoundingClientRect(); return [vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.w * H / W]; };
  let drag = null;
  const pts = new Map();
  svg.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, e);
    drag = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false, site: e.target.closest?.('.ic-site')?.dataset.id, pinch: null };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; drag.pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), w: vb.w }; }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (drag.pinch && pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomAt(vb.w / (drag.pinch.w * drag.pinch.d / d), ...toMap({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 })); drag.moved = true; return;
    }
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.hypot(dx, dy) > 4) { drag.moved = true; if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId); }
    if (drag.moved && vb.w < W) { const r = svg.getBoundingClientRect(); vb.x = drag.vx - dx / r.width * vb.w; vb.y = drag.vy - dy / r.width * vb.w; apply(); svg.classList.add('panning'); }
  });
  const end = e => {
    pts.delete(e.pointerId);
    if (drag && !drag.moved && !drag.pinch && e.type === 'pointerup') {
      if (drag.site) h.onSite(drag.site); else h.onClick(unproject(...toMap(e)));
    }
    if (!pts.size) { drag = null; svg.classList.remove('panning'); }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.01), ...toMap(e)); }, { passive: false });

  apply();
  if ('ResizeObserver' in window) new ResizeObserver(scaleEls).observe(svg);
  return {
    zoomIn: () => zoomAt(1.6), zoomOut: () => zoomAt(1 / 1.6), zoomBox,
    draw({ site, reach, ring, ringSites, layers, chains, mode }) {
      g.rings.innerHTML = ''; g.ringt.innerHTML = '';
      chainEls.forEach(c => c.style.display = chains ? '' : 'none');
      SITES.forEach(s => {
        const e = siteEls[s.id];
        e.style.display = layers.has(s.layer) ? '' : 'none';
        e.classList.toggle('sel', mode === 'site' && site === s.id);
        e.classList.toggle('hit-in', mode === 'ring' && ringSites.has(s.id));
        e.classList.toggle('dim', mode === 'ring' && !ringSites.has(s.id));
      });
      LAUNCH.forEach(l => {
        const e = launchEls[l.id];
        const inReach = mode === 'site' && reach && reach.launch.find(x => x.id === l.id).by.length;
        e.classList.toggle('reach', !!inReach);
        e.classList.toggle('sel', mode === 'ring' && ring.launch === l.id);
      });
      if (mode === 'site' && site) {
        const s = SITES.find(x => x.id === site);
        [...MISSILES].reverse().forEach(m => {
          el('path', { d: circlePath(proj, s.c, m.r, 2), class: 'ic-ring', stroke: `var(${m.col})`, fill: `var(${m.col})` }, g.rings);
          const b = { df15: 0, df21d: 330, df21: 25, df26: 300 }[m.id] ?? 0;
          const [x, y] = project(destination(s.c, b, m.r));
          const vh = vb.w * H / W;
          if (y > vb.y + 30 && y < vb.y + vh - 10 && x > vb.x + 40 && x < vb.x + vb.w - 40) el('text', { x, y: y - 4, class: 'ic-ring-t', 'text-anchor': 'middle', fill: `var(${m.col})` }, g.ringt, `${m.name} ${m.rng}`);
        });
        const [x, y] = project(reach.prc.at), [sx, sy] = project(s.c);
        el('line', { x1: sx, y1: sy, x2: x, y2: y, class: 'ic-prc-line' }, g.rings);
      }
      if (mode === 'ring') {
        const l = LAUNCH.find(x => x.id === ring.launch), m = MISSILES.find(x => x.id === ring.missile);
        el('path', { d: circlePath(proj, l.c, m.r, 2), class: 'ic-ring ic-ring-pla', stroke: `var(${m.col})`, fill: `var(${m.col})` }, g.rings);
        if (m.rIn) el('path', { d: circlePath(proj, l.c, m.rIn, 2), class: 'ic-ring-in', stroke: `var(${m.col})` }, g.rings);
      }
      scaleEls();
    },
    drawMeasure(p) {
      g.measure.innerHTML = '';
      p.forEach(q => { const [x, y] = project(q); el('circle', { cx: x, cy: y, r: 4, class: 'ic-m-pt' }, g.measure); });
      if (p.length < 2) return;
      el('path', { d: proj.line(p), class: 'ic-m-line' }, g.measure);
      const km = distKm(p[0], p[1]);
      const [x, y] = project([(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]);
      el('text', { x, y: y - 8, class: 'ic-m-t', 'text-anchor': 'middle' }, g.measure, `${fmt(km)} km · ${fmt(km / 1.852)} nm`);
    },
  };
}
