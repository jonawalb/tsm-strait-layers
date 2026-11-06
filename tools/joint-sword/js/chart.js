// Day-by-day activity chart for one exercise (scrubbable) and the compare overlay.
import { el, svgPoint } from '../../../shared/js/mapkit.js';
import { METRICS, dayLabel, nice } from './data.js';

const W = 1000, L = 50, R = 14;
function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const nTicks = v => (Math.round(v / 10 ** Math.floor(Math.log10(v))) === 2 ? 4 : 5);
function yAxis(g, y, top, suffix = '') {
  const n = nTicks(top);
  for (let i = 0; i <= n; i++) {
    const v = top * i / n, yy = y(v);
    el('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'gridl' }, g);
    el('text', { x: L - 6, y: yy + 4, class: 'ax', 'text-anchor': 'end' }, g, (Math.round(v * 10) / 10) + suffix);
  }
}

/**
 * One exercise. win: windowOf(x). m: metric. cur: current offset k. onScrub(k) on drag/click.
 * Exercise days are shaded; days with no TSM data are marked.
 */
export function drawDays(svg, win, { m, cur, onScrub }) {
  svg.innerHTML = '';
  const H = 250, T0 = 18, T1 = 206;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const g = el('g', {}, svg);
  const n = win.length, bw = (W - L - R) / n;
  const xOf = i => L + i * bw, xc = i => xOf(i) + bw / 2;
  const vals = win.map(d => d.v[m]);
  const top = niceMax(Math.max(10, ...vals.filter(v => v != null)) * 1.08);
  const y = v => T1 - v / top * (T1 - T0);
  win.forEach((d, i) => d.during && el('rect', { x: xOf(i), y: T0 - 6, width: bw, height: T1 - T0 + 6, class: 'exday' }, g));
  yAxis(g, y, top);
  el('text', { x: 4, y: 11, class: 'ax' }, g, METRICS[m].unit);
  win.forEach((d, i) => {
    const v = d.v[m];
    if (v == null) {
      el('rect', { x: xOf(i) + bw * 0.2, y: T1 - 26, width: bw * 0.6, height: 26, class: 'nodata' }, g);
      return;
    }
    el('rect', { x: xOf(i) + bw * 0.2, y: y(v), width: bw * 0.6, height: Math.max(0.5, T1 - y(v)), class: 'bar' + (d.k === cur ? ' cur' : '') + (d.during ? ' dur' : '') }, g);
    if (bw > 30 || d.k === cur) el('text', { x: xc(i), y: y(v) - 5, class: 'vlab' + (d.k === cur ? ' cur' : ''), 'text-anchor': 'middle' }, g, v);
  });
  el('line', { x1: L, x2: W - R, y1: T1, y2: T1, class: 'axis' }, g);
  win.forEach((d, i) => {
    if (n > 20 && d.k % 2 && d.k !== cur) return;
    el('text', { x: xc(i), y: T1 + 17, class: 'ax' + (d.k === 0 ? ' ax0' : ''), 'text-anchor': 'middle' }, g, d.k === 0 ? '0' : (d.k > 0 ? '+' : '−') + Math.abs(d.k));
  });
  const ci = win.findIndex(d => d.k === cur);
  if (ci >= 0) {
    el('line', { x1: xc(ci), x2: xc(ci), y1: T0 - 8, y2: T1 + 4, class: 'cursor' }, g);
    el('text', { x: Math.min(W - 80, Math.max(L + 40, xc(ci))), y: H - 6, class: 'ax curlab', 'text-anchor': 'middle' }, g, nice(win[ci].d));
  }
  const hit = el('rect', { x: L, y: 0, width: W - L - R, height: H, class: 'hit' }, g);
  const pick = e => { const [px] = svgPoint(svg, e); const i = Math.max(0, Math.min(n - 1, Math.floor((px - L) / bw))); onScrub(win[i].k); };
  hit.addEventListener('pointerdown', e => { hit.setPointerCapture(e.pointerId); pick(e); });
  hit.addEventListener('pointermove', e => { if (e.buttons) pick(e); });
}

/**
 * Compare: series = [{ x, pts: [{k, v}], col }] aligned on day 0 = first exercise day.
 * norm: values are multiples of the prior-30-day mean.
 */
export function drawCompare(svg, series, { norm, cur, onHover, kMin, kMax }) {
  svg.innerHTML = '';
  const H = 330, T0 = 18, T1 = 290;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const g = el('g', {}, svg);
  const span = kMax - kMin;
  const x = k => L + (k - kMin) / span * (W - L - R);
  const all = series.flatMap(s => s.pts.map(p => p.v)).filter(v => v != null);
  const top = niceMax(Math.max(norm ? 2 : 10, ...all) * 1.08);
  const y = v => T1 - v / top * (T1 - T0);
  el('rect', { x: x(0), y: T0, width: Math.max(2, x(1) - x(0)), height: T1 - T0, class: 'exday' }, g);
  yAxis(g, y, top, norm ? '×' : '');
  el('text', { x: 4, y: 11, class: 'ax' }, g, norm ? 'multiple of prior 30-day mean' : 'aircraft');
  if (norm) { el('line', { x1: L, x2: W - R, y1: y(1), y2: y(1), class: 'baseline' }, g); el('text', { x: W - R - 4, y: y(1) - 5, class: 'ax', 'text-anchor': 'end' }, g, '1× = usual level'); }
  for (let k = kMin; k <= kMax; k++) {
    if (span > 20 && k % 2) continue;
    el('text', { x: x(k), y: T1 + 18, class: 'ax' + (k === 0 ? ' ax0' : ''), 'text-anchor': 'middle' }, g, k === 0 ? 'Day 0' : (k > 0 ? '+' : '−') + Math.abs(k));
  }
  el('line', { x1: L, x2: W - R, y1: T1, y2: T1, class: 'axis' }, g);
  series.forEach(s => {
    let d = '', pen = false;
    s.pts.forEach(p => { if (p.v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(p.k).toFixed(1) + ' ' + y(p.v).toFixed(1); pen = true; });
    el('path', { d, class: 'cline', stroke: `var(${s.col})` }, g);
    s.pts.forEach(p => p.v != null && el('circle', { cx: x(p.k), cy: y(p.v), r: p.k === cur ? 5 : 2.8, fill: `var(${s.col})` }, g));
  });
  if (cur != null) el('line', { x1: x(cur), x2: x(cur), y1: T0, y2: T1, class: 'cursor' }, g);
  const hit = el('rect', { x: L, y: 0, width: W - L - R, height: H, class: 'hit' }, g);
  const pick = e => { const [px] = svgPoint(svg, e); onHover(Math.max(kMin, Math.min(kMax, Math.round(kMin + (px - L) / (W - L - R) * span)))); };
  hit.addEventListener('pointermove', pick);
  hit.addEventListener('pointerdown', pick);
}

export const dayText = k => dayLabel(k);
