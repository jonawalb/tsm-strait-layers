// Small SVG line charts shared by the timeline tabs and the evidence panels.
import { el, svgPoint } from '../../../shared/js/mapkit.js';

const PAD = { l: 46, r: 12, t: 12, b: 24 };

/** Match the viewBox to the rendered width so text keeps its real size. */
function size(svg, h) {
  const W = Math.max(300, Math.round(svg.clientWidth || svg.parentElement.clientWidth || 800));
  svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
  svg.setAttribute('height', h);
  return W;
}

/**
 * Draw a line chart.
 * opt: { n (points), h, yMax, yMin, yTicks [values], yFmt, xTicks [[i,label]], series: [{ v: [], col, label, dash, area, w }],
 *        band: [i0, i1] shaded span, marks: [[i, label]], day, onDay(i) }
 */
export function lineChart(svg, opt) {
  const h = opt.h || 200;
  const W = size(svg, h);
  svg.replaceChildren();
  const n = opt.n, yMin = opt.yMin ?? 0, yMax = opt.yMax;
  const x = i => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - (Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * (h - PAD.t - PAD.b);
  if (opt.band) el('rect', { x: x(opt.band[0]), y: PAD.t, width: Math.max(0, x(opt.band[1]) - x(opt.band[0])), height: h - PAD.t - PAD.b, class: 'band' }, svg);
  const ax = el('g', { class: 'tsm-axis' }, svg);
  (opt.yTicks || []).forEach(v => {
    el('line', { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), class: 'grid' }, ax);
    el('text', { x: PAD.l - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, ax, opt.yFmt ? opt.yFmt(v) : String(v));
  });
  (opt.xTicks || []).forEach(([i, lab]) => {
    el('line', { x1: x(i), x2: x(i), y1: h - PAD.b, y2: h - PAD.b + 4 }, ax);
    el('text', { x: x(i), y: h - 7, 'text-anchor': 'middle' }, ax, lab);
  });
  (opt.marks || []).forEach(([i, lab]) => {
    if (i == null) return;
    const g = el('g', { class: 'mark' }, svg);
    el('line', { x1: x(i), x2: x(i), y1: PAD.t, y2: h - PAD.b }, g);
    el('text', { x: x(i) + 3, y: PAD.t + 9 }, g, lab);
  });
  opt.series.forEach(s => {
    const pts = s.v.map((v, i) => (v == null ? null : [x(i), y(v)]));
    let d = '', pen = false;
    pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); pen = true; });
    if (s.area) {
      const first = pts.find(Boolean), last = [...pts].reverse().find(Boolean);
      if (first) el('path', { d: `${d}L${last[0].toFixed(1)} ${y(yMin)}L${first[0].toFixed(1)} ${y(yMin)}Z`, class: 'area', fill: s.col }, svg);
    }
    el('path', { d, class: 'ln' + (s.dash ? ' dash' : ''), stroke: s.col, 'stroke-width': s.w || 2 }, svg);
  });
  if (opt.day != null) {
    const g = el('g', { class: 'cursor' }, svg);
    el('line', { x1: x(opt.day), x2: x(opt.day), y1: PAD.t, y2: h - PAD.b }, g);
  }
  if (opt.onDay) {
    const pick = e => {
      const [px] = svgPoint(svg, e);
      opt.onDay(Math.round(Math.max(0, Math.min(n - 1, (px - PAD.l) / (W - PAD.l - PAD.r) * (n - 1)))));
    };
    svg.onpointerdown = e => { pick(e); svg.setPointerCapture(e.pointerId); svg.onpointermove = pick; };
    svg.onpointerup = () => { svg.onpointermove = null; };
  }
}

/** Legend items as HTML. */
export const legend = items => items.map(i => `<li><i class="sw${i.dash ? ' dash' : ''}" style="--c:${i.col}"></i>${i.label}</li>`).join('');

/** Day ticks for a 180-day horizon. */
export const dayTicks = n => [0, 30, 60, 90, 120, 150, 179].filter(i => i < n).map(i => [i, i === 0 ? 'Day 0' : String(i)]);
