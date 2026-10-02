// Map of the Strait: three generalized landing zones, schematic crossing lanes, ships afloat, lodgments, ports.
import { createProjection, drawBasemap, el } from '../../../shared/js/mapkit.js';
import { LAND_TAIWAN } from '../../../shared/data/land-taiwan.js';
import { BOX, ZONE_BOX, ZONE_LABEL, ZONE_FROM, PORTS, CITIES } from '../data/geo.js';
import { ZONES, ZONE_KEYS, LIFT } from '../data/params.js';
import { BANDS } from './weather.js';

const taiwanRing = [...LAND_TAIWAN].sort((a, b) => b.length - a.length)[1];
const r1 = v => Math.round(v * 10) / 10;

/** Coastline points of Taiwan inside a zone's box, in ring order. */
function coast(z) {
  const [a0, b0, a1, b1] = ZONE_BOX[z];
  return taiwanRing.filter(([x, y]) => x >= a0 && x <= a1 && y >= b0 && y <= b1);
}

export function createMap(svg, tip, { onZone }) {
  const proj = createProjection(BOX);
  const P = ll => proj.project(ll);
  const { root } = drawBasemap(svg, proj, LAND_TAIWAN, { gratStep: 1 });
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const full = svg.getAttribute('viewBox');
  const [cx0, cy0] = P([118.55, 25.75]), [cx1, cy1] = P([122.0, 22.5]);
  const crop = `${cx0} ${cy0} ${cx1 - cx0} ${cy1 - cy0}`;
  const small = matchMedia('(max-width: 640px)');
  const fit = () => { svg.setAttribute('viewBox', small.matches ? crop : full); svg.classList.toggle('sl-small', small.matches); };
  fit(); small.addEventListener('change', fit);

  const defs = el('defs', {}, svg);
  const mk = el('marker', { id: 'sl-head', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', class: 'sl-headfill' }, mk);

  const lab = el('g', { class: 'sl-labels' }, root);
  const txt = (ll, cls, s) => { const [x, y] = P(ll); return el('text', { x, y, class: cls }, lab, s); };
  txt([120.72, 23.55], 'sl-big', 'TAIWAN');
  txt([117.85, 25.55], 'sl-big', 'FUJIAN');
  txt([118.95, 23.75], 't-sea', 'Taiwan Strait');
  for (const c of CITIES) {
    const [x, y] = P(c.ll);
    el('circle', { cx: x, cy: y, r: c.big ? 3.2 : 2.2, class: 'sl-city' }, lab);
    el('text', { x: x + 5, y: y - 4, class: 't-place sl-place' }, lab, c.t);
  }

  const lanes = el('g', {}, root);
  const zonesG = el('g', {}, root);
  const layer = el('g', {}, root);
  const nodes = {};
  for (const z of ZONE_KEYS) {
    const pts = coast(z);
    const d = proj.line(pts);
    const g = el('g', { class: 'sl-zone', 'data-zone': z, tabindex: 0, role: 'button' }, zonesG);
    el('path', { d, class: 'sl-zone-hit' }, g);
    const line = el('path', { d, class: 'sl-zone-line' }, g);
    const mid = pts[Math.floor(pts.length / 2)];
    const [fx, fy] = P(ZONE_FROM[z]), [mx, my] = P(mid);
    const lane = el('path', { d: `M${fx} ${fy}L${mx - (mx - fx) * 0.06} ${my - (my - fy) * 0.06}`, class: 'sl-lane', 'marker-end': 'url(#sl-head)' }, lanes);
    const [lx, ly] = P(ZONE_LABEL[z]);
    const lg = el('g', { class: 'sl-zlab' }, g);
    const t1 = el('text', { x: lx, y: ly, class: 'sl-zname' }, lg, ZONES[z].t);
    const t2 = el('text', { x: lx, y: ly + 15, class: 'sl-zarea' }, lg, ZONES[z].area);
    const t3 = el('text', { x: lx, y: ly + 30, class: 'sl-zsea' }, lg, '');
    const [px, py] = P(PORTS[z].ll);
    const port = el('rect', { x: px - 5, y: py - 5, width: 10, height: 10, class: 'sl-port' }, zonesG);
    const act = () => onZone?.(z);
    g.addEventListener('click', act);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    for (const n of [g, port]) {
      n.addEventListener('pointerenter', e => show(e, zoneTip(z)));
      n.addEventListener('pointermove', move);
      n.addEventListener('pointerleave', () => { tip.hidden = true; });
    }
    nodes[z] = { g, line, lane, t3, mid: [mx, my], from: [fx, fy], port, t1, t2, portAt: [px, py] };
  }

  let last = null;
  function zoneTip(z) {
    const Z = ZONES[z];
    let s = `<b>${Z.t}</b><span class="tt-d">${Z.area} · crossing about ${Z.km} km</span>${Z.near}.`;
    if (last?.G) {
      const G = last.G, sea = last.sea?.[z];
      s += `<span class="tt-d">${sea ? `Seas ${sea.m ?? '?'} m, ${BANDS[sea.b].t.toLowerCase()}` : ''}</span>`;
      s += `<span class="tt-d">PLA ashore ${r1(G.ashore[z])} · Taiwan ${r1(last.def[z])} points</span>`;
      s += `<span class="tt-d">${PORTS[z].t}: ${portWord(G.port[z])} · mines ${Math.round(G.mines[z] * 100)}%</span>`;
    } else s += `<span class="tt-d">${PORTS[z].t}. Click to choose this zone.</span>`;
    return s;
  }
  function show(e, html) { tip.innerHTML = html; tip.hidden = false; move(e); }
  function move(e) {
    const box = svg.parentElement.getBoundingClientRect();
    tip.style.left = Math.max(4, Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 6)) + 'px';
    tip.style.top = Math.max(4, Math.min(e.clientY - box.top + 14, box.height - tip.offsetHeight - 6)) + 'px';
  }

  /** view: { zones: [main, second], G (game or null), def: {z: pts}, sea: {z: {m,b}} } */
  function draw(view) {
    last = view;
    layer.replaceChildren();
    const chosen = view.zones || [];
    for (const z of ZONE_KEYS) {
      const n = nodes[z], role = chosen[0] === z ? 'main' : chosen[1] === z ? 'second' : '';
      n.g.dataset.role = role;
      n.lane.dataset.role = role;
      n.g.setAttribute('aria-label', `${ZONES[z].t}, ${ZONES[z].area}${role ? `, ${role === 'main' ? 'main landing' : 'second landing'}` : ''}`);
      n.g.setAttribute('aria-pressed', String(!!role));
      const sea = view.sea?.[z];
      n.t3.textContent = sea ? `Seas ${sea.m ?? '?'} m, ${BANDS[sea.b].short}` : '';
      n.t3.dataset.b = sea ? sea.b : '';
      const G = view.G;
      n.port.dataset.s = G ? G.port[z] : 'roc';
      if (!G) continue;
      // Ships waiting offshore: amphibious groups as dots, ferries as squares, along the end of the lane.
      const q = G.queue[z];
      const [mx, my] = n.mid, [fx, fy] = n.from;
      const dx = mx - fx, dy = my - fy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const items = [...Array(q.amph).fill('a'), ...Array(q.ferry).fill('f')];
      items.forEach((k, i) => {
        const row = Math.floor(i / 8), col = i % 8;
        const x = mx - ux * (26 + row * 9) + (-uy) * (col - 3.5) * 8, y = my - uy * (26 + row * 9) + ux * (col - 3.5) * 8;
        if (k === 'a') el('circle', { cx: x, cy: y, r: 3.2, class: 'sl-ship' }, layer);
        else el('rect', { x: x - 3.2, y: y - 3.2, width: 6.4, height: 6.4, class: 'sl-ferry' }, layer);
      });
      // Lodgment: PLA and Taiwan strength bars at the zone.
      const A = G.ashore[z], D = view.def[z];
      if (A > 0 || chosen.includes(z)) {
        const bx = mx + 12, by = my - 4, s = 2.2;
        el('rect', { x: bx, y: by - Math.min(80, A * s), width: 9, height: Math.min(80, A * s), class: 'sl-barA' }, layer);
        el('rect', { x: bx + 11, y: by - Math.min(80, D * s), width: 9, height: Math.min(80, D * s), class: 'sl-barD' }, layer);
        el('text', { x: bx - 1, y: by + 13, class: 'sl-barT' }, layer, `${Math.round(A)} v ${Math.round(D)}`);
      }
    }
  }
  /** Zone geometry for the motion layer (js/fx.js): lane start, coast midpoint, port. */
  const geom = z => ({ from: nodes[z].from, mid: nodes[z].mid, port: nodes[z].portAt });
  return { draw, geom };
}

export const portWord = s => (s === 'pla' ? 'held by the PLA' : s === 'wrecked' ? 'taken but wrecked' : 'held by Taiwan');
export { LIFT };
