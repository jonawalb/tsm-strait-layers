// Archive view: monthly density of watchlist CCG and militia vessel-days from Global Fishing Watch events.
import { ARCHIVE } from '../data/archive.js';
import { el } from '../../../shared/js/mapkit.js';

export const MONTHS = ARCHIVE.months;
export const AVESSELS = ARCHIVE.vessels;
const C = ARCHIVE.cell;
export const FORCE = [{ k: 'CCG', t: 'China Coast Guard', color: '--ccg' }, { k: 'PAFMM', t: 'Maritime militia', color: '--c5' }];

const cellBox = (i, j) => [[i * C, j * C], [(i + 1) * C, (j + 1) * C]];
const inBox = (i, j, b) => (i + 0.5) * C >= b.lon0 && (i + 0.5) * C <= b.lon1 && (j + 0.5) * C >= b.lat0 && (j + 0.5) * C <= b.lat1;

export function monthLabel(i) {
  const [y, m] = MONTHS[i].split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Totals per month and force inside a box: [[ccg, pafmm], ...]. */
export function monthlyTotals(box, span = 1) {
  const out = MONTHS.map(() => [0, 0]);
  ARCHIVE.grid.forEach(([m, i, j, f, n]) => { if (inBox(i, j, box)) out[m][f] += n; });
  return span > 1 ? out.map((_, m) => [0, 1].map(f => out.slice(Math.max(0, m - span + 1), m + 1).reduce((s, r) => s + r[f], 0))) : out;
}

function monthsIn(S) { return new Set(Array.from({ length: S.span }, (_, k) => S.month - k).filter(m => m >= 0)); }

/** Draw density squares for the selected month(s). Returns cells for hit-testing. */
export function drawArchive(ctx, proj, S, colors, k) {
  ctx.clearRect(0, 0, proj.W, proj.H);
  const ms = monthsIn(S), agg = new Map();
  ARCHIVE.grid.forEach(([m, i, j, f, n]) => {
    if (!ms.has(m) || !S.forces[FORCE[f].k]) return;
    const key = i + ',' + j;
    const a = agg.get(key) || { i, j, n: [0, 0] };
    a.n[f] += n; agg.set(key, a);
  });
  const cells = [...agg.values()];
  const max = Math.max(1, ...cells.map(c => c.n[0] + c.n[1]));
  cells.forEach(c => {
    const [[lon0, lat0], [lon1, lat1]] = cellBox(c.i, c.j);
    const [x0, y1] = proj.project([lon0, lat0]), [x1, y0] = proj.project([lon1, lat1]);
    const tot = c.n[0] + c.n[1];
    const a = 0.25 + 0.75 * Math.sqrt(tot / max);
    const f = c.n[0] >= c.n[1] ? 0 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = colors[f ? 'pafmm' : 'ccg'];
    ctx.fillRect(x0 + 0.6 / k, y0 + 0.6 / k, x1 - x0 - 1.2 / k, y1 - y0 - 1.2 / k);
    if (c.n[0] && c.n[1]) { ctx.globalAlpha = 1; ctx.strokeStyle = colors[f ? 'ccg' : 'pafmm']; ctx.lineWidth = 1.5 / k; ctx.strokeRect(x0 + 1.5 / k, y0 + 1.5 / k, x1 - x0 - 3 / k, y1 - y0 - 3 / k); }
    c.box = [x0, y0, x1, y1];
  });
  ctx.globalAlpha = 1;
  return { cells, max };
}

/** Vessels seen in cell (i, j) during the selected month(s). */
export function vesselsInCell(S, i, j) {
  const ms = monthsIn(S), by = new Map();
  ARCHIVE.vcell.forEach(([m, ci, cj, mmsi, n]) => {
    if (ms.has(m) && ci === i && cj === j) {
      const v = AVESSELS[mmsi];
      if (v && S.forces[v.force]) by.set(mmsi, (by.get(mmsi) || 0) + n);
    }
  });
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([mmsi, n]) => ({ mmsi, n, ...AVESSELS[mmsi] }));
}

/** Monthly stacked bars that double as the month scrubber. */
export function drawMonthChart(svg, S, box, onPick) {
  const W = Math.max(320, Math.round(svg.clientWidth || 900)), H = 110, L = 40, R = 8, T = 10, B = 22;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const tot = monthlyTotals(box);
  const vis = tot.map(r => (S.forces.CCG ? r[0] : 0) + (S.forces.PAFMM ? r[1] : 0));
  const max = Math.max(10, ...vis);
  const bw = (W - L - R) / MONTHS.length;
  const Y = v => T + (H - T - B) * (1 - v / max);
  [0, 0.5, 1].forEach(p => {
    el('line', { x1: L, x2: W - R, y1: Y(max * p), y2: Y(max * p), class: 'grid' }, svg);
    el('text', { x: L - 5, y: Y(max * p) + 4, 'text-anchor': 'end', class: 'axis-t' }, svg, Math.round(max * p));
  });
  const ms = monthsIn(S);
  tot.forEach((r, m) => {
    const x = L + m * bw;
    if (ms.has(m)) el('rect', { x, y: T - 6, width: bw, height: H - T - B + 6, class: 'mbar-sel' }, svg);
    let y = Y(0);
    [0, 1].forEach(f => {
      if (!S.forces[FORCE[f].k] || !r[f]) return;
      const h = Y(0) - Y(r[f]);
      el('rect', { x: x + 1, y: y - h, width: Math.max(1, bw - 2), height: h, fill: `var(${FORCE[f].color})`, class: 'mbar' }, svg);
      y -= h;
    });
    if (MONTHS[m].endsWith('-01')) el('text', { x: x + 2, y: H - 6, class: 'axis-t' }, svg, MONTHS[m].slice(0, 4));
  });
  el('text', { x: L, y: T - 1, class: 'axis-t' }, svg, 'vessel-days in view');
  const pick = e => {
    const r = svg.getBoundingClientRect();
    const m = Math.floor(((e.clientX - r.left) / r.width * W - L) / bw);
    if (m >= 0 && m < MONTHS.length) onPick(m);
  };
  let down = false;
  svg.onpointerdown = e => { down = true; svg.setPointerCapture(e.pointerId); pick(e); };
  svg.onpointermove = e => { if (down) pick(e); };
  svg.onpointerup = () => { down = false; };
  return tot;
}
