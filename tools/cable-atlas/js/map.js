// Atlas map: basemap, context and study cables, landing sites, incident and repair-base markers, zoom and pan.
import { createProjection, el, escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { LAND_INDOPAC } from '../../../shared/data/land-indopac.js';
import { LAND } from '../data/land.js';
import { CABLES, CONTEXT, LANDINGS } from '../data/cables.js';
import { INCIDENTS } from '../data/incidents.js';
import { SHIPS } from '../data/repair.js';
import { LP, NODE, inService } from './net.js';
import { fmtTbps } from './util.js';

export const PROJ = createProjection({ lon0: 98, lon1: 152, lat0: -6, lat1: 40, width: 1000 });
const { W, H, project, line } = PROJ;
export const VIEWS = {
  fic: { name: 'First Island Chain', box: [113.5, 5.5, 133.5, 31] },
  taiwan: { name: 'Taiwan', box: [117.6, 21.6, 123.4, 26.7] },
  outer: { name: 'Outlying islands', box: [117.9, 22.9, 121.2, 26.6] },
  matsu: { name: 'Matsu', box: [119.7, 25.86, 121.0, 26.55] },
  ryukyu: { name: 'Nansei islands', box: [122.6, 23.6, 131.6, 27.4] },
  philippines: { name: 'Philippines', box: [116.5, 5.5, 127.5, 19.5] },
  wide: { name: 'Wide', box: [98, -6, 152, 40] },
};
const MAXZ = 70;
// Label offsets [dx, dy, anchor] where neighbouring landing towns would collide.
const LABEL_AT = { 'pa-li-taiwan': [-9, 8, 'end'], 'tanshui-taiwan': [9, -4, 'start'], 'lake-ci-taiwan': [-8, 10, 'end'],
  'guningtou-taiwan': [-8, -4, 'end'], 'jincheng-township-taiwan': [-8, 12, 'end'], 'xiyu-township-taiwan': [-8, -4, 'end'],
  'magong-taiwan': [8, 10, 'start'], 'dawu-taiwan': [9, -2, 'start'], 'fangshan-taiwan': [-9, 6, 'end'], 'nangan-taiwan': [-8, 4, 'end'],
  'yaese-japan': [9, 10, 'start'], 'itoman-japan': [-9, 8, 'end'], 'komesu-japan': [-9, 14, 'end'], 'luna-philippines': [9, -4, 'start'],
  'bauang-philippines': [-9, 8, 'end'], 'la-union-philippines': [9, 10, 'start'], 'batangas-philippines': [-9, 4, 'end'] };
const REGION_CLASS = { taiwan: 'tw', ryukyu: 'ry', philippines: 'ph' };
export const cableClass = c => c.prcOnly ? 'prc' : (REGION_CLASS[['taiwan', 'ryukyu', 'philippines'].find(r => c.regions.includes(r))] || 'ctx')
  + (c.domestic ? ' dom' : '');

export function createMap(svg, tip, on) {
  const root = el('g', {}, svg);
  el('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, class: 'tsm-sea' }, root);
  const g = {};
  for (const k of ['grat', 'land', 'ctx', 'cables', 'hits', 'ships', 'inc', 'lps', 'labels']) g[k] = el('g', { class: 'g-' + k }, root);
  for (let lon = 100; lon <= 150; lon += 5) { const [x] = project([lon, 0]); el('line', { x1: x, y1: 0, x2: x, y2: H, class: 'grat' }, g.grat); }
  for (let lat = -5; lat <= 40; lat += 5) { const [, y] = project([0, lat]); el('line', { x1: 0, y1: y, x2: W, y2: y, class: 'grat' }, g.grat); }
  el('path', { d: PROJ.path(LAND_INDOPAC), class: 'tsm-land', 'fill-rule': 'evenodd' }, g.land);
  el('path', { d: PROJ.path(LAND), class: 'tsm-land detail', 'fill-rule': 'evenodd' }, g.land);
  CONTEXT.forEach(c => el('path', { d: c.geom.map(s => line(s)).join(''), class: 'ctx' }, g.ctx));

  // Study cables: multi-country cables as one path; single-country cables per segment when derived.
  const paths = [], hitFor = new Map();
  for (const c of CABLES) {
    const cls = 'cab ' + cableClass(c);
    const pieces = c.segments ? c.units.map(u => [u, line(u.geom)]) : [[null, c.geom.map(s => line(s)).join('')]];
    for (const [u, d] of pieces) {
      const p = el('path', { d, class: cls, 'data-cable': c.id }, g.cables);
      p._c = c; p._u = u; paths.push(p);
      const hit = el('path', { d, class: 'hit', 'data-cable': c.id }, g.hits);
      hitFor.set(hit, p);
      bind(hit, () => cableTip(c, u), () => on.cable(c.id, u && u.id));
    }
  }

  // Landing sites in the study area, sized by the international systems that land there.
  const lpMarks = {};
  for (const l of LANDINGS.filter(l => l.node)) {
    const [x, y] = project([l.lon, l.lat]);
    const intl = CABLES.filter(c => !c.domestic && c.lps.includes(l.id)).length;
    const m = el('g', { class: `lp r-${NODE[l.node].region}${intl ? ' intl' : ''}`, 'data-x': x, 'data-y': y, ...(intl || NODE[l.node].region === 'taiwan' ? { tabindex: 0 } : {}), role: 'button',
      'aria-label': `${l.name}, ${NODE[l.node].name}: landing site dossier` }, g.lps);
    el('circle', { r: intl ? 3.6 + 1.1 * Math.min(intl, 9) : 2.8, class: 'lp-dot' }, m);
    el('circle', { r: (intl ? 3.6 + 1.1 * Math.min(intl, 9) : 2.8) + 4, class: 'lp-sel' }, m);
    el('path', { d: 'M-4 -4L4 4M4 -4L-4 4', class: 'lp-x' }, m);
    const [dx, dy, anchor] = LABEL_AT[l.id] || [9, 4, 'start'];
    if (intl || NODE[l.node].region === 'taiwan') el('text', { x: dx, y: dy, 'text-anchor': anchor, class: 't-lp' + (intl ? ' big' : '') }, m, l.name.replace(/ Township$/, ''));
    bind(m, () => lpTip(l), () => on.landing(l.id));
    m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.landing(l.id); } });
    lpMarks[l.id] = m;
  }

  // Incident markers (approximate, at the reported area) and repair-ship bases.
  const incMarks = {};
  for (const i of INCIDENTS.filter(i => i.lon != null)) {
    const [x, y] = project([i.lon, i.lat]);
    const m = el('g', { class: 'inc-m c-' + i.cause, 'data-x': x, 'data-y': y, tabindex: 0, role: 'button', 'aria-label': `Incident: ${i.title}` }, g.inc);
    el('path', { d: 'M0 -7L7 0L0 7L-7 0Z' }, m);
    bind(m, () => `<b>${esc(i.dateLabel)}</b><br>${esc(i.title)}<br><i class="muted">Approximate location · click for the record</i>`, () => on.incident(i.id));
    m.addEventListener('keydown', e => { if (e.key === 'Enter') on.incident(i.id); });
    incMarks[i.id] = m;
  }
  const bases = new Map();
  for (const s of SHIPS.filter(s => s.base_lon != null)) {
    const k = s.base_port;
    if (!bases.has(k)) bases.set(k, { port: k, lon: s.base_lon, lat: s.base_lat, ships: [] });
    bases.get(k).ships.push(s);
  }
  const shipMarks = [];
  for (const b of bases.values()) {
    const [x, y] = project([b.lon, b.lat]);
    const m = el('g', { class: 'ship-m', 'data-x': x, 'data-y': y, tabindex: 0, role: 'img', 'aria-label': `Repair-ship base: ${b.port}: ${b.ships.map(s => s.name).join(', ')}. Home port, not a live position.` }, g.ships);
    el('rect', { x: -5, y: -5, width: 10, height: 10, rx: 1.5 }, m);
    el('path', { d: 'M0 -3V3M-3 1.2Q0 4 3 1.2', class: 'anchor' }, m);
    bind(m, () => `<b>Repair-ship base: ${esc(b.port)}</b><br>${b.ships.map(s => esc(s.name) + ' <span class="muted">(' + esc(s.operator) + ')</span>').join('<br>')}<br><i class="muted">Home port, not a live position</i>`);
    shipMarks.push(m);
  }

  function bind(node, html, click) {
    node.addEventListener('pointerenter', e => { tip.innerHTML = html(); tip.hidden = false; move(e); node.classList.add('hover'); on.hover?.(node.dataset.cable || null); });
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', () => { tip.hidden = true; node.classList.remove('hover'); on.hover?.(null); });
    if (click) node.addEventListener('click', e => { if (!dragged) click(e); });
    // Keyboard users get the same tooltip on focus.
    node.addEventListener('focus', () => { tip.innerHTML = html(); tip.hidden = false; const r = node.getBoundingClientRect(); move({ clientX: r.right, clientY: r.bottom }); });
    node.addEventListener('blur', () => { tip.hidden = true; });
  }
  function move(e) {
    const box = svg.parentElement.getBoundingClientRect();
    let x = e.clientX - box.left + 14, y = e.clientY - box.top + 14;
    if (x + 300 > box.width) x = Math.max(4, e.clientX - box.left - 300);
    if (y + 150 > box.height) y = Math.max(4, e.clientY - box.top - 150);
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  }
  const capLine = c => c.cap && c.cap.tbps != null ? `Design capacity ${fmtTbps(c.cap.tbps)}` : 'Capacity not published';
  const cableTip = (c, u) => `<b>${esc(c.name)}</b>${u ? `<br><span class="muted">Segment ${esc(u.label)}</span>` : ''}
    <br>${c.planned ? 'Planned, RFS ' : 'RFS '}${esc(c.rfs || c.rfsYear || 'n/a')}${c.length ? ' · ' + esc(c.length) : ''}<br>${capLine(c)}
    <br><span class="muted">${esc(c.countries.join(', '))}</span><br><i class="muted">Click for details${on.cutMode() ? ' (cut mode: click cuts)' : ''}</i>`;
  const lpTip = l => {
    const cs = CABLES.filter(c => c.lps.includes(l.id));
    return `<b>${esc(l.name)}</b> · ${esc(NODE[l.node].name)}<br><span class="muted">${cs.map(c => esc(c.name)).join('<br>')}</span><br><i class="muted">Click for the site dossier</i>`;
  };

  // Zoom and pan through the viewBox; the visible aspect follows the container.
  const vb = { x: 0, y: 0, w: W, h: H };
  let dragged = false, aspect = 0.7;
  const fitAspect = () => { aspect = innerWidth < 640 ? 1.05 : 0.68; svg.style.aspectRatio = `1000 / ${Math.round(1000 * aspect)}`; };
  const apply = () => {
    vb.w = Math.max(W / MAXZ, Math.min(W, vb.w)); vb.h = vb.w * aspect;
    if (vb.h > H) { vb.h = H; vb.w = H / aspect; }
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vb.h, vb.y));
    svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
    const z = W / vb.w;
    svg.dataset.zoom = z > 18 ? 'close' : z > 5 ? 'mid' : 'far';
    const s = (Math.max(1, W / (svg.clientWidth || W)) / z).toFixed(4);
    for (const m of [...Object.values(lpMarks), ...Object.values(incMarks), ...shipMarks]) m.setAttribute('transform', `translate(${m.dataset.x} ${m.dataset.y}) scale(${s})`);
  };
  const toMap = e => { const r = svg.getBoundingClientRect(); return [vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.h]; };
  const zoomAt = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const nw = Math.max(W / MAXZ, Math.min(W, vb.w / f)), k = nw / vb.w;
    vb.x = cx - (cx - vb.x) * k; vb.y = cy - (cy - vb.y) * k; vb.w = nw; apply();
  };
  const fit = ([lon0, lat0, lon1, lat1]) => {
    const [x0, y0] = project([lon0, lat1]), [x1, y1] = project([lon1, lat0]);
    const w = Math.max(x1 - x0, (y1 - y0) / aspect);
    vb.w = w; vb.x = (x0 + x1) / 2 - w / 2; vb.y = (y0 + y1) / 2 - w * aspect / 2; apply();
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
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomAt(vb.w / (drag.pinch.w * drag.pinch.d / d), ...toMap({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }));
      return;
    }
    if (dragged) {
      const r = svg.getBoundingClientRect();
      vb.x = drag.vb.x - dx / r.width * vb.w; vb.y = drag.vb.y - dy / r.height * vb.h; apply();
      svg.classList.add('panning');
    }
  });
  const end = e => { pointers.delete(e.pointerId); if (!pointers.size) { drag = null; svg.classList.remove('panning'); } };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.01), ...toMap(e)); }, { passive: false });
  fitAspect();
  addEventListener('resize', () => { const c = [vb.x + vb.w / 2, vb.y + vb.h / 2]; fitAspect(); vb.x = c[0] - vb.w / 2; vb.y = c[1] - vb.w * aspect / 2; apply(); });

  return {
    zoomTo: v => fit((VIEWS[v] || VIEWS.fic).box),
    zoomToPoint: (lon, lat, span = 2.2) => fit([lon - span, lat - span * 0.7, lon + span, lat + span * 0.7]),
    zoomIn: () => zoomAt(1.6), zoomOut: () => zoomAt(1 / 1.6),
    render(S, R) {
      const live = R.live;
      for (const p of paths) {
        const c = p._c, on = inService(c, S.year, S.planned);
        const units = p._u ? [p._u] : c.units;
        const cut = units.length > 0 && units.every(u => !live.has(u.id));
        p.classList.toggle('hidden', !on);
        p.classList.toggle('cut', on && cut);
        p.classList.toggle('partial', on && !cut && units.some(u => !live.has(u.id)));
        p.classList.toggle('sel', S.sel === 'c:' + c.id);
      }
      hitFor.forEach((p, h) => { h.style.display = p.classList.contains('hidden') ? 'none' : ''; });
      g.ctx.style.display = S.ctx ? '' : 'none';
      g.inc.style.display = S.inc ? '' : 'none';
      g.ships.style.display = S.ships ? '' : 'none';
      for (const reg of R.regions) for (const l of reg.lps) {
        const m = lpMarks[l.id];
        m.classList.toggle('dark', l.dark); m.classList.toggle('unused', l.total === 0);
        m.classList.toggle('sel', S.sel === 'l:' + l.id);
      }
      for (const [id, m] of Object.entries(incMarks)) m.classList.toggle('sel', S.sel === 'i:' + id);
    },
    highlight(id) {
      svg.querySelectorAll('.cab').forEach(p => p.classList.toggle('hl', !!id && p.dataset.cable === id));
      svg.classList.toggle('has-hl', !!id);
    },
    project,
  };
}
