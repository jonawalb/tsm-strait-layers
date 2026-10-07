// Map: schematic shipping flows into Taiwan's ports and through the Strait, the enforcement zone,
// TeleGeography cable routes (cut / repaired) and a schematic repair-ship track.
import { createProjection, drawBasemap, el, escapeHtml } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { PORTWATCH } from '../data/portwatch.js';
import { TW_CABLES, TW_LANDINGS } from '../data/cables.js';
import { LANES, SPURS, REPAIR_TRACK, ZONES } from '../data/lanes.js';

const proj = createProjection({ lon0: 116.4, lon1: 124.6, lat0: 20.3, lat1: 27.4, width: 1000 });
let svg, tip, layers = {}, flows = [], raf = 0, motion = true;
const PORTS = PORTWATCH.ports.filter(p => p.calls > 0.05);

export function mountMap(svgEl, tipEl) {
  svg = svgEl; tip = tipEl;
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 2 });
  const lab = (lonlat, text, cls = 't-sea') => { const [x, y] = proj.project(lonlat); el('text', { x, y, class: cls, 'text-anchor': 'middle' }, root, text); };
  lab([118.2, 24.0], 'Taiwan Strait'); lab([123.4, 22.0], 'Philippine Sea'); lab([119.6, 21.0], 'South China Sea'); lab([121.0, 21.3], 'Bashi Channel');
  lab([117.9, 26.3], 'Fujian', 't-place'); lab([120.9, 23.5], 'Taiwan', 't-place');
  layers.zone = el('g', { class: 'zone' }, root);
  layers.cables = el('g', { class: 'cables' }, root);
  layers.lanes = el('g', { class: 'lanes' }, root);
  layers.ports = el('g', { class: 'ports' }, root);
  layers.ship = el('g', { class: 'repair' }, root);

  ZONES.forEach(z => {
    const [cx, cy] = proj.project(z.c), [ex] = proj.project([z.c[0] + z.rx, z.c[1]]), [, ey] = proj.project([z.c[0], z.c[1] - z.ry]);
    z.node = el('ellipse', { cx, cy, rx: ex - cx, ry: ey - cy, class: 'zone-' + z.k }, layers.zone);
  });

  TW_CABLES.forEach(c => {
    const g = el('g', { class: 'cable', 'data-id': c.id }, layers.cables);
    c.geom.forEach(line => el('path', { d: proj.line(line) }, g));
    c.node = g;
    g.addEventListener('pointerenter', e => show(e, `<b>${escapeHtml(c.name)}</b><span class="tt-d">${c.intl ? 'International' : 'Domestic'} · RFS ${escapeHtml(c.rfs || 'n/a')}</span><span class="tt-d">${escapeHtml((c.owners || '').slice(0, 120))}</span>`));
    g.addEventListener('pointerleave', hide);
  });
  Object.entries(TW_LANDINGS).forEach(([id, ll]) => {
    const [x, y] = proj.project(ll);
    el('rect', { x: x - 3, y: y - 3, width: 6, height: 6, class: 'landing' }, layers.cables);
  });

  flows = [];
  LANES.forEach(l => {
    const p = el('path', { d: proj.line(l.pts), class: 'flow ' + l.k }, layers.lanes);
    flows.push({ node: p, kind: l.k, speed: 1 });
  });
  SPURS.forEach(s => {
    const port = PORTS.find(p => p.id === s.port);
    if (!port) return;
    const p = el('path', { d: proj.line([...s.pts, [port.lon, port.lat]]), class: 'flow spur' }, layers.lanes);
    flows.push({ node: p, kind: 'spur', port, speed: 1 });
  });
  PORTS.forEach(p => {
    const [x, y] = proj.project([p.lon, p.lat]);
    const r = 3 + Math.sqrt(p.impShare) * 1.3;
    const c = el('circle', { cx: x, cy: y, r, class: 'port' + (/LNG/.test(p.name) ? ' lng' : ''), tabindex: 0, role: 'img',
      'aria-label': `${p.name}: ${p.impShare}% of Taiwan's maritime imports` }, layers.ports);
    p.node = c;
    const html = () => `<b>${escapeHtml(p.name)}</b><span class="tt-d">${p.impShare}% of maritime imports · ${p.calls.toFixed(1)} calls a day (PortWatch, last 12 months)</span><span class="tt-d">${p.now != null ? 'This day in the scenario: ' + p.now.toFixed(1) + ' calls' : ''}</span>`;
    c.addEventListener('pointerenter', e => show(e, html()));
    c.addEventListener('focus', () => show(null, html(), [x, y]));
    c.addEventListener('pointerleave', hide); c.addEventListener('blur', hide);
    if (p.impShare >= 4 || /Hualien|Suao/.test(p.name)) {
      const right = p.lon > 121.2;
      el('text', { x: x + (right ? 8 : -8), y: y + 3.5, class: 't-label', 'text-anchor': right ? 'start' : 'end' }, layers.ports, p.name.replace(' Terminal', ''));
    }
  });
  layers.shipDot = el('g', { class: 'ship', visibility: 'hidden' }, layers.ship);
  el('path', { d: 'M-7 3 L7 3 L5 -1 L-5 -1 Z M-1 -1 L-1 -6 L2 -6 L2 -1', class: 'hull' }, layers.shipDot);
  layers.shipPath = el('path', { d: proj.line(REPAIR_TRACK), class: 'track' }, layers.ship);

  motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (motion) loop();
}

function show(e, html, at) {
  tip.innerHTML = html; tip.hidden = false;
  const box = svg.getBoundingClientRect(), wrap = svg.parentElement.getBoundingClientRect();
  let x, y;
  if (e) { x = e.clientX - wrap.left; y = e.clientY - wrap.top; }
  else { x = at[0] / proj.W * box.width + (box.left - wrap.left); y = at[1] / proj.H * box.height + (box.top - wrap.top); }
  tip.style.left = Math.min(x + 12, wrap.width - tip.offsetWidth - 6) + 'px';
  tip.style.top = (y + 14) + 'px';
}
function hide() { tip.hidden = true; }

let offset = 0;
function loop() {
  cancelAnimationFrame(raf);
  const step = () => {
    if (!document.hidden) {
      offset -= 0.6;
      flows.forEach(f => { if (f.speed > 0.01) f.node.style.strokeDashoffset = (offset * f.speed).toFixed(1); });
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

/** Update the map for one day of a simulation. */
export function updateMap(sim, day) {
  const d = sim.days[day], cfg = sim.cfg;
  ZONES.forEach(z => z.node.classList.toggle('on', d.on && z.k === (cfg.mode === 'q' ? 'q' : 'b')));
  flows.forEach(f => {
    let share;
    if (f.kind === 'through') share = d.strait / PORTWATCH.chokeBase.taiwan.total;
    else if (f.kind === 'divert') share = d.divert;
    else { share = d.arrive; f.port.now = f.port.calls * d.arrive; }
    const base = f.kind === 'spur' ? 1 + Math.sqrt(f.port.calls) * 0.9 : 7;
    f.node.style.strokeWidth = Math.max(0, base * share).toFixed(2);
    f.node.style.opacity = share < 0.02 ? 0 : 1;
    f.speed = share;
  });
  PORTS.forEach(p => p.node.classList.toggle('dim', d.arrive < 0.5));
  const down = new Set(sim.repairs.filter(r => day >= r.cut && day < r.done).map(r => r.id));
  const fixed = new Set(sim.repairs.filter(r => day >= r.done).map(r => r.id));
  TW_CABLES.forEach(c => { c.node.classList.toggle('cut', down.has(c.id)); c.node.classList.toggle('fixed', fixed.has(c.id)); });
  // repair ship: sails in during mobilization, then sits at the landing area while it works
  const active = sim.repairs.find(r => day >= r.start - sim.mobilize && day < r.done);
  if (active) {
    const len = layers.shipPath.getTotalLength();
    const prog = Math.max(0, Math.min(1, (day - (active.start - sim.mobilize)) / Math.max(1, sim.mobilize)));
    const pt = layers.shipPath.getPointAtLength(prog * len);
    layers.shipDot.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    layers.shipDot.setAttribute('visibility', 'visible');
    layers.shipPath.classList.add('on');
  } else { layers.shipDot.setAttribute('visibility', 'hidden'); layers.shipPath.classList.remove('on'); }
}
