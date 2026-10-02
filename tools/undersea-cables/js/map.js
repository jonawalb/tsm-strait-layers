// Cable map: basemap, regional and Taiwan cables, landing points, island status, zoom/pan, hover and click.
import { createProjection, el, escapeHtml } from '../../../shared/js/mapkit.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { CABLES, REGIONAL, LANDINGS } from '../data/cables.js';
import { ISLANDS, inService } from './network.js';

export const PROJ = createProjection({ lon0: 96, lon1: 160, lat0: -8, lat1: 38, width: 1000 });
const { W, H, project, line } = PROJ;
export const VIEWS = {
  region: [96, -8, 160, 38],
  taiwan: [116.9, 21.5, 123.3, 26.9],
  outer: [117.9, 22.8, 121.2, 26.6],
  matsu: [119.72, 25.87, 120.62, 26.45],
};
const MAXZ = 60;
// Label offsets [dx, dy, anchor] for Taiwanese landing points, to keep neighbours apart.
const L = [-7, 3.5, 'end'];
const LABEL_AT = {
  'guningtou-taiwan': [-6, -5, 'end'], 'lake-ci-taiwan': L, 'jincheng-township-taiwan': [-6, 11, 'end'],
  'xiju-taiwan': L, 'nangan-taiwan': L, 'pa-li-taiwan': [-7, 1, 'end'], 'yuanli-taiwan': L, 'budai-taiwan': L,
  'tainan-taiwan': L, 'taoyuan-taiwan': L, 'xiyu-township-taiwan': [-6, -4, 'end'], 'magong-taiwan': [7, 9, 'start'],
  'huxi-township-taiwan': [7, -3, 'start'], 'fangshan-taiwan': L, 'beigan-taiwan': [6, -4, 'start'],
};

export function createMap(svg, tip, handlers) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, class: 'tsm-sea' }, root);
  const g = {};
  for (const k of ['grat', 'land', 'regional', 'cables', 'segs', 'hits', 'lps', 'islands', 'labels']) g[k] = el('g', { class: 'g-' + k }, root);

  for (let lon = 100; lon <= 160; lon += 10) {
    const [x] = project([lon, 0]);
    el('line', { x1: x, y1: 0, x2: x, y2: H, class: 'grat' }, g.grat);
  }
  for (let lat = 0; lat <= 30; lat += 10) {
    const [, y] = project([0, lat]);
    el('line', { x1: 0, y1: y, x2: W, y2: y, class: 'grat' }, g.grat);
  }
  el('path', { d: PROJ.path(LAND_INDOPAC), class: 'tsm-land', 'fill-rule': 'evenodd' }, g.land);
  el('path', { d: PROJ.path(LAND_TAIWAN), class: 'tsm-land tw-land', 'fill-rule': 'evenodd' }, g.land);

  const regional = REGIONAL.map(r => el('path', { d: r.geom.map(s => line(s)).join(''), class: 'reg' }, g.regional));
  regional.forEach((p, i) => bindHover(p, () => regionalTip(REGIONAL[i])));

  // Taiwan cables. International cables are one path; domestic cables are drawn per segment so each can be cut.
  const cablePaths = {}, segPaths = {}, hitFor = new Map();
  for (const c of CABLES) {
    if (c.domestic) {
      for (const u of c.units) {
        const d = line(u.geom);
        segPaths[u.id] = el('path', { d, class: 'cab dom', 'data-cable': c.id }, g.segs);
        const hit = el('path', { d, class: 'hit', 'data-unit': u.id }, g.hits);
        hitFor.set(hit, c);
        bindHover(hit, () => cableTip(c, u), () => handlers.onCable(c.id, u.id));
      }
    } else {
      const d = c.geom.map(s => line(s)).join('');
      cablePaths[c.id] = el('path', { d, class: 'cab ' + (c.prcOnly ? 'prc' : 'intl'), 'data-cable': c.id }, g.cables);
      const hit = el('path', { d, class: 'hit' }, g.hits);
      hitFor.set(hit, c);
      bindHover(hit, () => cableTip(c), () => handlers.onCable(c.id));
    }
  }

  // Landing points (scaled with zoom so they stay the same size on screen)
  const lpMarks = {};
  for (const l of LANDINGS) {
    const [x, y] = project([l.lon, l.lat]);
    const m = el('g', { class: 'lp' + (l.country === 'Taiwan' ? ' tw' : ''), 'data-x': x, 'data-y': y }, g.lps);
    el('circle', { r: l.country === 'Taiwan' ? 4.2 : 2.6, class: 'lp-dot' }, m);
    el('path', { d: 'M-4 -4L4 4M4 -4L-4 4', class: 'lp-x' }, m);
    if (l.country === 'Taiwan') {
      const [dx, dy, anchor] = LABEL_AT[l.id] || [7, 3.5, 'start'];
      el('text', { x: dx, y: dy, class: 't-lp', 'text-anchor': anchor }, m, l.name.replace(/ Township$/, ''));
    }
    bindHover(m, () => lpTip(l));
    lpMarks[l.id] = m;
  }

  // Island status halos
  const islandMarks = {};
  for (const i of ISLANDS) {
    if (i.id === 'taiwan') continue;
    const [x, y] = project(i.label);
    const m = el('g', { class: 'isl', 'data-x': x, 'data-y': y }, g.islands);
    el('circle', { r: 13, class: 'isl-ring' }, m);
    islandMarks[i.id] = m;
  }
  const edgeLabels = [['To the U.S. →', [159.4, 19.2], 'end'], ['To Singapore and Southeast Asia', [98, 2.4], 'start']];
  edgeLabels.forEach(([t, p, a]) => { const [x, y] = project(p); el('text', { x, y, class: 't-edge', 'text-anchor': a }, g.labels, t); });

  function bindHover(node, html, click) {
    node.addEventListener('pointerenter', e => { tip.innerHTML = html(); tip.hidden = false; moveTip(e); node.classList.add('hover'); handlers.onHover?.(node.dataset.cable || null); });
    node.addEventListener('pointermove', moveTip);
    node.addEventListener('pointerleave', () => { tip.hidden = true; node.classList.remove('hover'); handlers.onHover?.(null); });
    if (click) node.addEventListener('click', e => { if (!dragged) click(e); });
  }
  function moveTip(e) {
    const box = svg.parentElement.getBoundingClientRect();
    let x = e.clientX - box.left + 14, y = e.clientY - box.top + 14;
    if (x + 290 > box.width) x = Math.max(4, e.clientX - box.left - 290);
    if (y + 140 > box.height) y = Math.max(4, e.clientY - box.top - 140);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const cableTip = (c, u) => `<b>${escapeHtml(c.name)}</b>${u ? `<br><span class="muted">Segment ${escapeHtml(u.label)}</span>` : ''}
    <br>${c.planned ? 'Planned, RFS ' : 'Ready for service '}${escapeHtml(c.rfs || c.rfsYear)}${c.length ? ' · ' + escapeHtml(c.length) : ''}
    <br><span class="muted">${escapeHtml(c.owners || 'Owners not listed')}</span><br><i class="muted">Click for details</i>`;
  const regionalTip = r => `<b>${escapeHtml(r.name)}</b><br><span class="muted">Passes near Taiwan, no Taiwan landing${r.rfsYear ? ' · RFS ' + r.rfsYear : ''}</span>`;
  const lpTip = l => `<b>${escapeHtml(l.name)}</b>, ${escapeHtml(l.country)}<br><span class="muted">${CABLES.filter(c => c.lps.includes(l.id)).map(c => escapeHtml(c.name)).join('<br>')}</span>`;

  // Zoom and pan (viewBox), same approach as Strait Layers
  const vb = { x: 0, y: 0, w: W, h: H };
  let dragged = false;
  const applyVB = () => {
    vb.w = Math.max(W / MAXZ, Math.min(W, vb.w)); vb.h = vb.w * H / W;
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vb.h, vb.y));
    svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
    const z = W / vb.w;
    svg.style.setProperty('--z', z.toFixed(3));
    svg.dataset.zoom = z > 14 ? 'close' : z > 3.5 ? 'mid' : 'far';
    const s = (Math.max(1, 0.75 * W / (svg.clientWidth || W)) / z).toFixed(4);
    for (const m of [...Object.values(lpMarks), ...Object.values(islandMarks)]) m.setAttribute('transform', `translate(${m.dataset.x} ${m.dataset.y}) scale(${s})`);
    g.labels.querySelectorAll('.t-edge').forEach(t => t.setAttribute('font-size', (11 / z).toFixed(3)));
  };
  const toMap = e => { const r = svg.getBoundingClientRect(); return [vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.h]; };
  const zoomAt = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const nw = Math.max(W / MAXZ, Math.min(W, vb.w / f)), k = nw / vb.w;
    vb.x = cx - (cx - vb.x) * k; vb.y = cy - (cy - vb.y) * k; vb.w = nw; applyVB();
  };
  const zoomTo = name => {
    const [lon0, lat0, lon1, lat1] = VIEWS[name] || VIEWS.taiwan;
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1, lat0]);
    const w = Math.max(x1 - x0, (y1 - y0) * W / H);
    vb.w = w; vb.x = (x0 + x1) / 2 - w / 2; vb.y = (y0 + y1) / 2 - (w * H / W) / 2; applyVB();
  };
  const pointers = new Map();
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, e);
    dragged = false;
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
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomAt(vb.w / (drag.pinch.w * drag.pinch.d / d), ...toMap({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }));
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

  zoomTo('taiwan');
  addEventListener('resize', () => applyVB());

  return {
    zoomTo, zoomIn: () => zoomAt(1.6), zoomOut: () => zoomAt(1 / 1.6),
    render(S, R) {
      const cut = S.cut;
      for (const c of CABLES) {
        const on = inService(c, S.year, S.planned);
        const paths = c.domestic ? c.units.map(u => segPaths[u.id]) : [cablePaths[c.id]];
        paths.forEach((p, k) => {
          const u = c.domestic ? c.units[k] : null;
          const isCut = c.domestic ? cut.has(u.id) : c.units.every(x => cut.has(x.id));
          p.classList.toggle('hidden', !on);
          p.classList.toggle('cut', on && isCut);
          p.classList.toggle('partial', on && !c.domestic && !isCut && c.units.some(x => cut.has(x.id)));
          p.classList.toggle('sel', S.sel === c.id);
        });
      }
      hitFor.forEach((c, h) => { h.style.display = inService(c, S.year, S.planned) ? '' : 'none'; });
      regional.forEach((p, i) => p.classList.toggle('hidden', !S.regional || (REGIONAL[i].planned && !S.planned) || (REGIONAL[i].rfsYear || 0) > S.year));
      for (const l of R.lps) {
        const m = lpMarks[l.id];
        m.classList.toggle('dark', l.dark);
        m.classList.toggle('unused', l.total === 0);
      }
      for (const i of R.islands) if (islandMarks[i.id]) islandMarks[i.id].dataset.s = i.status;
    },
    highlight(id) {
      svg.querySelectorAll('.cab').forEach(p => p.classList.toggle('hl', !!id && p.dataset.cable === id));
      svg.classList.toggle('has-hl', !!id);
    },
  };
}
