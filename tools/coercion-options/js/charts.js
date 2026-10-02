// Radar chart for the selected option (others as faint outlines) and a bar chart comparing all options on one axis.
import { el } from '../../../shared/js/mapkit.js';
import { OPTIONS, AXES } from '../data/options.js';

export const OPT_COLOR = { gray: 'var(--c7)', quarantine: 'var(--ccg)', blockade: 'var(--c2)', seizure: 'var(--c5)', invasion: 'var(--prc)' };

const R = 96, CX = 190, CY = 140;
const pt = (i, v) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / AXES.length;
  return [CX + Math.cos(a) * R * v / 10, CY + Math.sin(a) * R * v / 10];
};
const poly = s => AXES.map((ax, i) => pt(i, s[ax.id]).map(n => n.toFixed(1)).join(',')).join(' ');

export function drawRadar(svg, { scores, base, sel, showAll, axis, onAxis }) {
  svg.setAttribute('viewBox', '0 0 380 280');
  svg.replaceChildren();
  [2, 4, 6, 8, 10].forEach(v => el('polygon', { points: AXES.map((_, i) => pt(i, v).join(',')).join(' '), class: 'r-grid' + (v === 10 ? ' outer' : '') }, svg));
  AXES.forEach((ax, i) => {
    const [x, y] = pt(i, 10);
    el('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'r-spoke' }, svg);
  });
  if (showAll) OPTIONS.filter(o => o.id !== sel).forEach(o =>
    el('polygon', { points: poly(scores[o.id]), class: 'r-other', style: `stroke:${OPT_COLOR[o.id]}` }, svg));
  el('polygon', { points: poly(base[sel]), class: 'r-base' }, svg);
  el('polygon', { points: poly(scores[sel]), class: 'r-sel', style: `stroke:${OPT_COLOR[sel]};fill:${OPT_COLOR[sel]}` }, svg);
  AXES.forEach((ax, i) => {
    const [x, y] = pt(i, scores[sel][ax.id]);
    el('circle', { cx: x, cy: y, r: 3.5, class: 'r-dot', style: `fill:${OPT_COLOR[sel]}` }, svg);
  });
  // Axis labels act as buttons choosing the axis for the bar chart
  AXES.forEach((ax, i) => {
    const [x, y] = pt(i, 12.1);
    const anchor = Math.abs(x - CX) < 8 ? 'middle' : x > CX ? 'start' : 'end';
    const g = el('g', { class: 'r-lab' + (ax.id === axis ? ' on' : ''), tabindex: 0, role: 'button', 'aria-pressed': ax.id === axis, 'aria-label': `Compare all options on ${ax.name}` }, svg);
    el('text', { x, y: y + 4, 'text-anchor': anchor }, g, ax.short);
    el('text', { x, y: y + 17, 'text-anchor': anchor, class: 'r-val' }, g, scores[sel][ax.id].toFixed(1));
    g.addEventListener('click', () => onAxis(ax.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAxis(ax.id); } });
  });
}

export function drawBars(svg, { scores, base, sel, axis, onPick }) {
  const W = 360, rowH = 30, L = 112, H = OPTIONS.length * rowH + 22;
  const x = v => L + (W - L - 34) * v / 10;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  [0, 5, 10].forEach(v => {
    el('line', { x1: x(v), x2: x(v), y1: 0, y2: H - 18, class: 'b-grid' }, svg);
    el('text', { x: x(v), y: H - 5, class: 'b-ax', 'text-anchor': 'middle' }, svg, String(v));
  });
  OPTIONS.forEach((o, k) => {
    const y = k * rowH;
    const v = scores[o.id][axis], b = base[o.id][axis];
    const g = el('g', { class: 'b-row' + (o.id === sel ? ' on' : ''), tabindex: 0, role: 'button', 'aria-label': `${o.name}: ${v.toFixed(1)} of 10. Select this option.` }, svg);
    el('text', { x: L - 8, y: y + rowH / 2 + 4, 'text-anchor': 'end', class: 'b-name' }, g, o.short);
    el('rect', { x: x(0), y: y + 7, width: Math.max(0, x(v) - x(0)), height: rowH - 14, rx: 2, style: `fill:${OPT_COLOR[o.id]}`, class: 'b-bar' }, g);
    el('line', { x1: x(b), x2: x(b), y1: y + 4, y2: y + rowH - 4, class: 'b-base' }, g);
    el('text', { x: x(v) + 5, y: y + rowH / 2 + 4, class: 'b-ax' }, g, v.toFixed(1));
    g.addEventListener('click', () => onPick(o.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o.id); } });
  });
}
