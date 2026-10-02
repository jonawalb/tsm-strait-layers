// SVG board: nodes, links, dragging, drawing links from ports, keyboard moves.
import { el, svgPoint, fmt } from '../../../shared/js/mapkit.js';
import { TYPES, CATS } from '../data/catalog.js';
import { distOf, reachOf } from './model.js';

export const BW = 960, BH = 540, NW = 176, NH = 58;
export const LANE_X = { sensor: 30, c2: 392, shooter: 770 };
const LANES = [['sensor', 0, 290], ['c2', 290, 670], ['shooter', 670, 960]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function subText(n, r, sc) {
  const t = TYPES[n.type];
  if (t.cat === 'sensor') {
    const d = r.det.get(n.id);
    if (d.skip) return `skip zone · ${fmt(d.d)} km`;
    return d.ok ? `sees it · ${fmt(d.d)} km` : `too far · ${fmt(d.range)}<${fmt(d.d)} km`;
  }
  if (t.cat === 'c2') return t.authority ? `decides in ${t.decide} min` : `relays in ${t.relay} min`;
  const dw = distOf(n, sc), reach = reachOf(n);
  return `${dw <= reach ? 'in range' : 'too far'} · ${fmt(dw)}/${fmt(reach)}`;
}

export function createBoard(svg, api) {
  const { S } = api;
  svg.setAttribute('viewBox', `0 0 ${BW} ${BH}`);
  let lastR = null, lastSpof = [];
  const anchorOut = n => [n.x + NW, n.y + NH / 2];
  const anchorIn = n => [n.x, n.y + NH / 2];
  const curve = (a, b) => {
    const dx = Math.max(40, Math.abs(b[0] - a[0]) / 2);
    return `M${a[0]} ${a[1]}C${a[0] + dx} ${a[1]} ${b[0] - dx} ${b[1]} ${b[0]} ${b[1]}`;
  };

  function render(r, spof, focusId = null) {
    lastR = r; lastSpof = spof;
    svg.replaceChildren();
    const defs = el('defs', {}, svg);
    for (const k of ['plain', 'hot']) {
      const m = el('marker', { id: 'kcb-arr-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
      el('path', { d: 'M0 0L10 5L0 10z', class: 'arr-' + k }, m);
    }
    const lanes = el('g', { class: 'lanes' }, svg);
    for (const [cat, x0, x1] of LANES) {
      el('rect', { x: x0 + 6, y: 6, width: x1 - x0 - 12, height: BH - 12, rx: 6, class: 'lane' }, lanes);
      el('text', { x: x0 + 18, y: BH - 16, class: 'lane-t' }, lanes, CATS[cat].name);
    }
    const best = r.best && r.best.closes ? r.best.p : [];
    const bestEdges = new Set(best.slice(1).map((id, i) => best[i] + '>' + id));
    const closeEdges = new Set();
    r.closing.forEach(e => e.p.slice(1).forEach((id, i) => closeEdges.add(e.p[i] + '>' + id)));
    const byId = new Map(S.nodes.map(n => [n.id, n]));
    const eg = el('g', { class: 'edges' }, svg);
    for (const [a, b] of S.links) {
      const na = byId.get(a), nb = byId.get(b);
      if (!na || !nb) continue;
      const k = a + '>' + b, hot = bestEdges.has(k);
      const cls = ['edge', hot ? 'best' : closeEdges.has(k) ? 'close' : '', S.dead.has(a) || S.dead.has(b) ? 'dead' : ''].join(' ');
      el('path', { d: curve(anchorOut(na), anchorIn(nb)), class: cls, 'data-a': a, 'data-b': b,
        'marker-end': `url(#kcb-arr-${hot ? 'hot' : 'plain'})` }, eg);
    }
    el('path', { class: 'edge temp', d: '' }, svg);
    const ng = el('g', { class: 'nodes' }, svg);
    const onBest = new Set(best);
    for (const n of S.nodes) {
      const t = TYPES[n.type], dead = S.dead.has(n.id);
      const g = el('g', { class: `node cat-${t.cat}${dead ? ' dead' : ''}${S.sel === n.id ? ' sel' : ''}${onBest.has(n.id) ? ' onbest' : ''}`,
        transform: `translate(${n.x} ${n.y})`, tabindex: 0, role: 'button', 'data-id': n.id,
        'aria-label': `${t.name}${dead ? ', knocked out' : ''}. ${subText(n, r, S.sc)}. Arrow keys move, Delete removes.` }, ng);
      el('rect', { width: NW, height: NH, rx: 5, class: 'body' }, g);
      el('rect', { width: 5, height: NH, class: 'stripe' }, g);
      el('text', { x: 14, y: 23, class: 'nm' }, g, (t.variants && n.v ? t.variants[n.v].tag : t.short));
      const st = el('text', { x: 14, y: 43, class: 'st' }, g, subText(n, r, S.sc));
      if (t.cat === 'sensor') st.classList.add(r.det.get(n.id).ok ? 'ok' : 'no');
      if (t.cat === 'shooter') st.classList.add(distOf(n, S.sc) <= reachOf(n) ? 'ok' : 'no');
      if (spof.includes(n.id)) {
        el('rect', { x: -4, y: -4, width: NW + 8, height: NH + 8, rx: 8, class: 'spof' }, g);
        el('text', { x: NW - 8, y: -8, class: 'spof-t', 'text-anchor': 'end' }, g, 'single point of failure');
      }
      if (dead) { el('path', { d: `M8 8L${NW - 8} ${NH - 8}M${NW - 8} 8L8 ${NH - 8}`, class: 'x' }, g); }
      if (t.cat !== 'shooter') el('circle', { cx: NW, cy: NH / 2, r: 8, class: 'port', 'data-port': n.id }, g);
      if (t.cat !== 'sensor') el('circle', { cx: 0, cy: NH / 2, r: 4, class: 'inport' }, g);
    }
    if (!S.nodes.length) el('text', { x: BW / 2, y: BH / 2, class: 'empty', 'text-anchor': 'middle' }, svg,
      'Drag a sensor, a command node and a shooter onto the board, then connect them.');
    if (focusId != null) { const f = svg.querySelector(`.node[data-id="${focusId}"]`); if (f) f.focus({ preventScroll: true }); }
  }

  function moveEdges(n) {
    svg.querySelectorAll(`.edge[data-a="${n.id}"], .edge[data-b="${n.id}"]`).forEach(p => {
      const a = S.nodes.find(m => m.id === +p.dataset.a), b = S.nodes.find(m => m.id === +p.dataset.b);
      p.setAttribute('d', curve(anchorOut(a), anchorIn(b)));
    });
  }

  let drag = null;
  svg.addEventListener('pointerdown', e => {
    const port = e.target.closest('[data-port]');
    const g = e.target.closest('.node');
    if (!g) return;
    const n = S.nodes.find(m => m.id === +g.dataset.id);
    const [px, py] = svgPoint(svg, e);
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    drag = port && !S.choose ? { mode: 'link', n, from: anchorOut(n) } : { mode: 'move', n, dx: px - n.x, dy: py - n.y, sx: px, sy: py, moved: false };
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const [px, py] = svgPoint(svg, e);
    if (drag.mode === 'link') {
      svg.querySelector('.edge.temp').setAttribute('d', curve(drag.from, [px, py]));
      return;
    }
    if (!drag.moved && Math.hypot(px - drag.sx, py - drag.sy) < 4) return;
    drag.moved = true;
    drag.n.x = Math.round(clamp(px - drag.dx, 0, BW - NW));
    drag.n.y = Math.round(clamp(py - drag.dy, 0, BH - NH));
    svg.querySelector(`.node[data-id="${drag.n.id}"]`).setAttribute('transform', `translate(${drag.n.x} ${drag.n.y})`);
    moveEdges(drag.n);
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'link') {
      const [px, py] = svgPoint(svg, e);
      const hit = S.nodes.find(m => px >= m.x && px <= m.x + NW && py >= m.y && py <= m.y + NH && m.id !== d.n.id);
      if (hit) api.link(d.n.id, hit.id); else api.update();
      return;
    }
    if (!d.moved) api.clickNode(d.n.id);
    else api.update();
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', () => { drag = null; api.update(); });

  svg.addEventListener('keydown', e => {
    const g = e.target.closest('.node');
    if (!g) return;
    const n = S.nodes.find(m => m.id === +g.dataset.id);
    const step = e.shiftKey ? 40 : 10;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) {
      e.preventDefault();
      n.x = clamp(n.x + mv[0], 0, BW - NW); n.y = clamp(n.y + mv[1], 0, BH - NH);
      api.update({ focus: n.id });
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api.clickNode(n.id, true); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); api.removeNode(n.id); }
  });

  /** Drop target for palette drags: returns board coordinates or null if the pointer is outside. */
  function boardPoint(e) {
    const r = svg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const [x, y] = svgPoint(svg, e);
    return [clamp(Math.round(x - NW / 2), 0, BW - NW), clamp(Math.round(y - NH / 2), 0, BH - NH)];
  }

  return { render, boardPoint, rerender: focusId => lastR && render(lastR, lastSpof, focusId) };
}

/** A free slot in the node's lane. */
export function freeSpot(nodes, cat) {
  const x = LANE_X[cat];
  for (let y = 24; y <= BH - NH - 20; y += 20) {
    if (!nodes.some(n => Math.abs(n.x - x) < NW && Math.abs(n.y - y) < NH + 8)) return [x, y];
  }
  return [x + 20, 24 + Math.round(Math.random() * (BH - NH - 48))];
}
