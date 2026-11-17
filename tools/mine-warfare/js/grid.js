// SVG seascape: the grid, mines, searched cells, lanes, MCM assets and landing craft.
import { el } from '../../../shared/js/mapkit.js';
import { GRID } from '../data/params.js';
import { idx, rowOf, colOf, rand, laneCols } from './model.js';

export const CELL = 40, TOP = 52, BEACH = 100;
export const W = GRID.cols * CELL, H = TOP + GRID.rows * CELL + BEACH;
const cx = c => c * CELL + CELL / 2, cy = r => TOP + r * CELL + CELL / 2;

export function createGrid(svg, { onPaint, onHover }) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const g = {};
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'mw-sea' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: TOP, class: 'mw-stage' }, svg);
  el('text', { x: 12, y: 32, class: 'mw-zone' }, svg, 'PLA transport area');
  const land = el('g', {}, svg);
  el('path', { d: beachPath(), class: 'mw-land' }, land);
  el('text', { x: W - 12, y: H - 12, 'text-anchor': 'end', class: 'mw-zone' }, land, 'Landing area (generic, notional)');
  const lines = el('g', { class: 'mw-gridlines' }, svg);
  for (let c = 1; c < GRID.cols; c++) el('line', { x1: c * CELL, y1: TOP, x2: c * CELL, y2: TOP + GRID.rows * CELL }, lines);
  for (let r = 0; r <= GRID.rows; r++) el('line', { x1: 0, y1: TOP + r * CELL, x2: W, y2: TOP + r * CELL }, lines);
  const scale = el('g', { class: 'mw-scale' }, svg);
  el('line', { x1: W - 12 - 4 * CELL, y1: 36, x2: W - 12, y2: 36 }, scale);
  el('text', { x: W - 12 - 2 * CELL, y: 28, 'text-anchor': 'middle' }, scale, '2 km (notional)');
  ['swept', 'lanes', 'mines', 'mcm', 'craft', 'cursor'].forEach(k => { g[k] = el('g', { class: 'mw-' + k }, svg); });
  const cursor = el('rect', { width: CELL, height: CELL, class: 'mw-cur', visibility: 'hidden' }, g.cursor);

  // ---- Painting with pointer and keyboard --------------------------------------
  let painting = null, kb = { c: 0, r: 0, on: false };
  const cellAt = e => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const x = (e.clientX - r.left) / r.width * vb.width, y = (e.clientY - r.top) / r.height * vb.height - TOP;
    if (x < 0 || y < 0 || x >= W || y >= GRID.rows * CELL) return null;
    return idx(Math.floor(x / CELL), Math.floor(y / CELL));
  };
  svg.addEventListener('pointerdown', e => {
    const i = cellAt(e); if (i == null) return;
    painting = onPaint(i, null); svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    const i = cellAt(e);
    if (painting != null && i != null) onPaint(i, painting);
    showCursor(i, e.pointerType !== 'touch');
    onHover(i, e);
  });
  const end = () => { painting = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', () => { showCursor(null); onHover(null); });
  svg.addEventListener('keydown', e => {
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mv) { kb.c = Math.max(0, Math.min(GRID.cols - 1, kb.c + mv[0])); kb.r = Math.max(0, Math.min(GRID.rows - 1, kb.r + mv[1])); }
    else if (e.key === ' ' || e.key === 'Enter') onPaint(idx(kb.c, kb.r), null);
    else return;
    e.preventDefault(); kb.on = true; showCursor(idx(kb.c, kb.r), true); onHover(idx(kb.c, kb.r), null);
  });
  svg.addEventListener('blur', () => { kb.on = false; showCursor(null); });
  function showCursor(i, show = true) {
    if (i == null || !show) { cursor.setAttribute('visibility', 'hidden'); return; }
    cursor.setAttribute('x', colOf(i) * CELL); cursor.setAttribute('y', TOP + rowOf(i) * CELL); cursor.setAttribute('visibility', 'visible');
  }

  // ---- Drawing -----------------------------------------------------------------
  function drawField(S, ev, swept, res, hour) {
    g.swept.replaceChildren(); g.lanes.replaceChildren(); g.mines.replaceChildren();
    for (let i = 0; i < swept.length; i++) if (swept[i]) el('rect', { x: colOf(i) * CELL, y: TOP + rowOf(i) * CELL, width: CELL, height: CELL }, g.swept);
    if (S.strat === 'lanes') {
      laneCols(S.lanes).forEach((l, j) => {
        el('rect', { x: l * CELL + 1, y: TOP + 1, width: 2 * CELL - 2, height: GRID.rows * CELL - 2, class: 'mw-lane' }, g.lanes);
        el('text', { x: l * CELL + CELL, y: TOP - 8, 'text-anchor': 'middle', class: 'mw-lane-t' }, g.lanes, `Lane ${j + 1}`);
      });
    }
    for (let i = 0; i < S.mines.length; i++) {
      const m = S.mines[i]; if (!m) continue;
      const gone = swept[i] && rand(i * 7 + 3) >= res[i]; // one seeded draw: neutralized or missed
      drawMine(g.mines, colOf(i), rowOf(i), m, gone ? 'gone' : swept[i] ? 'missed' : 'live');
    }
    g.mines.dataset.hour = hour;
  }

  function drawMcm(order, n, S) {
    g.mcm.replaceChildren();
    if (!n || n >= order.length) return;
    const front = order.slice(Math.max(0, n - 4), n);
    const k = Math.min(front.length, 1 + Math.round((S.assets.v + S.assets.h + S.assets.u) / 6));
    front.slice(-k).forEach((i, j) => {
      const x = cx(colOf(i)), y = cy(rowOf(i));
      const kind = ['v', 'h', 'u'].filter(a => S.assets[a] > 0)[j % 3] || 'v';
      if (kind === 'h') { el('circle', { cx: x, cy: y - 6, r: 6, class: 'mw-heli' }, g.mcm); el('line', { x1: x, y1: y, x2: x, y2: y + 12, class: 'mw-tow' }, g.mcm); }
      else if (kind === 'u') el('ellipse', { cx: x, cy: y, rx: 8, ry: 4, class: 'mw-uuv' }, g.mcm);
      else el('path', { d: `M${x - 13} ${y - 4}h22l5 4l-5 4h-22z`, class: 'mw-ship' }, g.mcm);
    });
  }

  /** craft: [{ c, y, hit }] where y is in grid rows (-1 = staging, rows = beach). */
  function drawCraft(craft) {
    g.craft.replaceChildren();
    for (const k of craft) {
      const x = cx(k.c) + k.dx, y = TOP + (k.y + 0.5) * CELL;
      if (k.hit) {
        el('circle', { cx: x, cy: y, r: 16, class: 'mw-burst' }, g.craft);
        el('rect', { x: x - 5, y: y - 8, width: 10, height: 16, rx: 2, class: 'mw-craft sunk', transform: `rotate(35 ${x} ${y})` }, g.craft);
      } else el('rect', { x: x - 5, y: y - 8, width: 10, height: 16, rx: 2, class: 'mw-craft' }, g.craft);
    }
  }

  return { drawField, drawMcm, drawCraft, svg };
}

function drawMine(parent, c, r, type, state) {
  const x = cx(c), y = cy(r);
  const gm = el('g', { class: `mw-mine t${type} ${state}` }, parent);
  if (type === 1) {
    el('line', { x1: x, y1: y + 3, x2: x, y2: y + 15, class: 'mw-cable' }, gm);
    el('rect', { x: x - 4, y: y + 14, width: 8, height: 3 }, gm);
    for (const a of [0, 45, 90, 135]) {
      const t = a * Math.PI / 180;
      el('line', { x1: x - Math.cos(t) * 10.5, y1: y - 3 - Math.sin(t) * 10.5, x2: x + Math.cos(t) * 10.5, y2: y - 3 + Math.sin(t) * 10.5, class: 'mw-horn' }, gm);
    }
    el('circle', { cx: x, cy: y - 3, r: 8 }, gm);
  } else {
    el('path', { d: `M${x - 11} ${y + 12}a11 9 0 0 1 22 0z` }, gm);
    el('line', { x1: x - 14, y1: y + 12, x2: x + 14, y2: y + 12, class: 'mw-seabed' }, gm);
  }
  if (state === 'gone') el('path', { d: `M${x - 8} ${y - 8}l16 16M${x + 8} ${y - 8}l-16 16`, class: 'mw-x' }, gm);
}

function beachPath() {
  const y0 = TOP + GRID.rows * CELL + 14;
  let d = `M0 ${H}L0 ${y0}`;
  for (let x = 0; x <= W; x += 40) d += `L${x} ${y0 + Math.sin(x / 90) * 5}`;
  return d + `L${W} ${H}Z`;
}
