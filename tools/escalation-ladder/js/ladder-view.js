// Kahn-style ladder: rungs light up to the current level; a trace on the left shows the climb step by step.
import { el } from '../../../shared/js/mapkit.js';
import { RUNGS, THRESHOLDS } from '../data/ladder.js';

const W = 300, TOP = 14, RH = 42, H = TOP + RUNGS.length * RH + 10;
const TRACE_X0 = 8, TRACE_X1 = 56, RAIL_L = 66, RAIL_R = W - 6;
const yOf = n => TOP + (RUNGS.length - n) * RH + RH / 2;

export function drawLadder(svg, { current, peak, rungs = [], compare = null }) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  // rails
  el('line', { x1: RAIL_L, y1: TOP - 6, x2: RAIL_L, y2: H - 6, class: 'rail' }, svg);
  el('line', { x1: RAIL_R, y1: TOP - 6, x2: RAIL_R, y2: H - 6, class: 'rail' }, svg);
  RUNGS.forEach(r => {
    const y = yOf(r.n);
    const lit = r.n <= current;
    const g = el('g', { class: `rung${lit ? ' lit' : ''}${r.n === current ? ' cur' : ''}${r.n <= peak && !lit ? ' past' : ''}`, 'data-n': r.n }, svg);
    el('rect', { x: RAIL_L + 3, y: y - RH / 2 + 7, width: RAIL_R - RAIL_L - 6, height: RH - 14, rx: 3,
      style: lit ? `fill-opacity:${(0.18 + 0.72 * r.n / RUNGS.length).toFixed(2)}` : '' }, g);
    el('text', { x: RAIL_L + 12, y: y + 1, class: 'rn' }, g, String(r.n));
    el('text', { x: RAIL_L + 32, y: y + 1, class: 'rl' }, g, r.name);
    el('title', {}, g, `${r.n}. ${r.name}: ${r.hint}`);
  });
  THRESHOLDS.forEach(t => {
    const y = yOf(t.after) - RH / 2;
    const tw = t.label.length * 6.2 + 8;
    el('line', { x1: RAIL_L - 4, y1: y, x2: RAIL_R - 6 - tw, y2: y, class: 'thresh' }, svg);
    el('text', { x: RAIL_R - 6, y: y + 3.5, class: 'thresh-t', 'text-anchor': 'end' }, svg, t.label);
  });
  // climb traces: compare path (if any) then current path
  const trace = (list, cls) => {
    if (!list.length) return;
    const n = list.length;
    const x = i => n === 1 ? (TRACE_X0 + TRACE_X1) / 2 : TRACE_X0 + (TRACE_X1 - TRACE_X0) * i / (n - 1);
    el('path', { d: 'M' + list.map((r, i) => `${x(i).toFixed(1)} ${yOf(r).toFixed(1)}`).join('L'), class: `trace ${cls}` }, svg);
    list.forEach((r, i) => el('circle', { cx: x(i), cy: yOf(r), r: i === n - 1 ? 4.5 : 3, class: `tdot ${cls}` }, svg));
  };
  if (compare) trace(compare, 'cmp');
  trace(rungs, 'cur');
  el('text', { x: (TRACE_X0 + TRACE_X1) / 2, y: H - 1, class: 'trace-t', 'text-anchor': 'middle' }, svg, 'your climb');
}
