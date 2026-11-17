// Event-window chart (single event) and aggregate chart (U.S. vs. no-U.S. events).
import { el } from '../../../shared/js/mapkit.js';
import { OFFSETS, METRICS, nice } from './events.js';

const W = 1000, L = 56, R = 14;
const BW = (W - L - R) / OFFSETS.length;
const xOf = k => L + (k - OFFSETS[0]) * BW;          // left edge of day k's band
const xc = k => xOf(k) + BW / 2;
const f1 = v => (v == null ? 'n/a' : (Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1)));
const sgn = v => (v == null ? 'n/a' : Number(f1(Math.abs(v))) === 0 ? '±0' : (v > 0 ? '+' : '−') + f1(Math.abs(v)));
export const fmtDev = (v, unit) => (v == null ? 'n/a' : sgn(v) + (unit === 'pct' ? '%' : ''));

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const nTicks = v => (Math.round(v / 10 ** Math.floor(Math.log10(v))) === 2 ? 4 : 5);
function yAxis(g, y, lo, hi, x0, ticks = 4, suffix = '') {
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (hi - lo) * i / ticks, yy = y(v);
    el('line', { x1: x0, x2: W - R, y1: yy, y2: yy, class: 'gridl' }, g);
    el('text', { x: x0 - 6, y: yy + 4, class: 'ax', 'text-anchor': 'end' }, g, (Math.round(v * 10) / 10) + suffix);
  }
}
function xAxis(g, y, labelDate) {
  OFFSETS.forEach(k => {
    const t = k === 0 ? 'Day 0' : (k > 0 ? '+' : '−') + Math.abs(k);
    el('text', { x: xc(k), y, class: 'ax' + (k === 0 ? ' ax0' : ''), 'text-anchor': 'middle' }, g, t);
  });
  if (labelDate) el('text', { x: xc(0), y: y + 15, class: 'ax', 'text-anchor': 'middle' }, g, labelDate);
}
function hoverBands(g, onHover, top, bottom) {
  OFFSETS.forEach(k => {
    const r = el('rect', { x: xOf(k), y: top, width: BW, height: bottom - top, class: 'hov', 'data-k': k }, g);
    r.addEventListener('pointerenter', () => onHover(k));
    r.addEventListener('click', () => onHover(k, true));
  });
  g.addEventListener('pointerleave', () => onHover(null));
}

/** Single-event window: counts with baseline band (top), deviation from baseline (bottom). */
export function drawSingle(svg, a, { unit, to, focus, onHover }) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} 430`);
  const g = el('g', {}, svg);
  const T0 = 22, T1 = 238, B0 = 286, B1 = 388;
  const M = METRICS[a.m];
  // top scale
  const vmax = Math.max(...a.days.map(d => d.v ?? 0), a.b.mean + (a.b.sd || 0));
  const top = niceMax(vmax * 1.08);
  const y = v => T1 - (v / top) * (T1 - T0);
  // summary window shading
  el('rect', { x: xOf(0), y: T0 - 14, width: (to + 1) * BW, height: B1 - T0 + 14, class: 'sumwin' }, g);
  el('text', { x: xOf(0) + 4, y: T0 - 4, class: 'ax sumlab' }, g, `Summary window, day 0 to +${to}`);
  // exercise days
  a.days.filter(d => d.ex.length).forEach(d => el('rect', { x: xOf(d.k), y: T0, width: BW, height: B1 - T0, class: 'exday' }, g));
  yAxis(g, y, 0, top, L, nTicks(top));
  el('text', { x: 6, y: T0 - 12, class: 'ax' }, g, M.unit);
  // baseline band
  if (a.b.sd != null) {
    const lo = Math.max(0, a.b.mean - a.b.sd), hi = a.b.mean + a.b.sd;
    el('rect', { x: L, y: y(hi), width: W - L - R, height: y(lo) - y(hi), class: 'band' }, g);
  }
  // bars
  a.days.forEach(d => {
    const x = xOf(d.k) + BW * 0.18, w = BW * 0.64;
    if (d.v == null) { el('text', { x: xc(d.k), y: T1 - 6, class: 'ax nodata', 'text-anchor': 'middle' }, g, 'no data'); return; }
    el('rect', { x, y: y(d.v), width: w, height: Math.max(0.5, T1 - y(d.v)), class: 'bar' + (d.k === 0 ? ' bar0' : '') + (focus === d.k ? ' focus' : '') }, g);
    if (String(d.flag ?? '').includes('J')) el('text', { x: xc(d.k), y: y(d.v) - 5, class: 'jmark', 'text-anchor': 'middle' }, g, 'J');
    if (d.others.length) el('path', { d: `M${xc(d.k) - 6} ${T1 + 14}l6 -9l6 9z`, class: 'tmark' }, g);
  });
  const yb = y(a.b.mean);
  el('line', { x1: L, x2: W - R, y1: yb, y2: yb, class: 'baseline' }, g);
  el('text', { x: W - R - 4, y: yb - 6, class: 'ax blab', 'text-anchor': 'end' }, g, `baseline ${f1(a.b.mean)}`);
  el('line', { x1: L, x2: W - R, y1: T1, y2: T1, class: 'axis' }, g);
  // bottom: deviation
  const devs = a.days.map(d => (unit === 'pct' ? d.pct : d.dev)).filter(v => v != null);
  let hiD = Math.max(0.5, ...devs) * 1.05, loD = Math.max(0.5, ...devs.map(v => -v)) * 1.05;
  hiD = niceMax(Math.max(hiD, loD / 3)); loD = niceMax(Math.max(loD, hiD / 3));
  const yd = v => B0 + (hiD - v) / (hiD + loD) * (B1 - B0);
  yAxis(g, yd, -loD, hiD, L, 1, unit === 'pct' ? '%' : '');
  el('text', { x: L - 6, y: yd(0) + 4, class: 'ax', 'text-anchor': 'end' }, g, '0');
  el('text', { x: 6, y: B0 - 8, class: 'ax' }, g, unit === 'pct' ? '% vs. baseline' : 'vs. baseline');
  a.days.forEach(d => {
    const v = unit === 'pct' ? d.pct : d.dev; if (v == null) return;
    const y0 = yd(0), y1 = yd(v);
    el('rect', { x: xOf(d.k) + BW * 0.18, y: Math.min(y0, y1), width: BW * 0.64, height: Math.max(0.5, Math.abs(y1 - y0)), class: v >= 0 ? 'dev up' : 'dev down' }, g);
  });
  el('line', { x1: L, x2: W - R, y1: yd(0), y2: yd(0), class: 'axis' }, g);
  el('line', { x1: xc(0), x2: xc(0), y1: T0, y2: B1, class: 'day0' }, g);
  xAxis(g, B1 + 22, nice(a.e.date));
  hoverBands(g, onHover, T0, B1);
}

/** Aggregate: mean deviation with 95% bootstrap bands per group (top), per-event summaries (bottom). */
export function drawAggregate(svg, agg, { showEvents, onHover, onPick }) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} 470`);
  const g = el('g', {}, svg);
  const T0 = 22, T1 = 250, S0 = 318, S1 = 430;
  const { unit } = agg, suffix = unit === 'pct' ? '%' : '';
  const groups = [['us', agg.us, '--us'], ['ally', agg.ally, '--accent']];
  const pick = d => (unit === 'pct' ? d.pct : d.dev);
  let vals = [];
  groups.forEach(([, G]) => { G.mean.forEach(v => v != null && vals.push(v)); G.ci.forEach(c => c && vals.push(...c)); });
  const ext = niceMax(Math.max(1, ...vals.map(Math.abs)) * (showEvents ? 1.8 : 1.1));
  const y = v => (T0 + T1) / 2 - v / ext * (T1 - T0) / 2;
  el('rect', { x: xOf(0), y: T0 - 14, width: (agg.to + 1) * BW, height: T1 - T0 + 14, class: 'sumwin' }, g);
  el('text', { x: xOf(0) + 4, y: T0 - 4, class: 'ax sumlab' }, g, `Summary window, day 0 to +${agg.to}`);
  yAxis(g, y, -ext, ext, L, 4, suffix);
  el('text', { x: 6, y: T0 - 12, class: 'ax' }, g, unit === 'pct' ? '% vs. baseline' : `${METRICS[agg.m].unit} vs. baseline`);
  const clip = el('clipPath', { id: 'agg-clip' }, g);
  el('rect', { x: L, y: T0, width: W - L - R, height: T1 - T0 }, clip);
  const lines = el('g', { 'clip-path': 'url(#agg-clip)' }, g);
  const path = arr => {
    let d = '', pen = false;
    arr.forEach((v, j) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + xc(OFFSETS[j]).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
    return d;
  };
  if (showEvents) groups.forEach(([, G, col]) => G.events.forEach(a => el('path', { d: path(a.days.map(pick)), class: 'evline', stroke: `var(${col})` }, lines)));
  groups.forEach(([, G, col]) => {
    const ok = G.ci.map((c, j) => c && G.mean[j] != null);
    if (G.ci.some(Boolean)) {
      const up = [], dn = [];
      OFFSETS.forEach((k, j) => { if (ok[j]) { up.push([xc(k), y(G.ci[j][1])]); dn.unshift([xc(k), y(G.ci[j][0])]); } });
      el('path', { d: 'M' + up.concat(dn).map(p => p.map(v => v.toFixed(1)).join(' ')).join('L') + 'Z', class: 'ciband', fill: `var(${col})` }, lines);
    }
    el('path', { d: path(G.mean), class: 'meanline', stroke: `var(${col})` }, lines);
    G.mean.forEach((v, j) => v != null && el('circle', { cx: xc(OFFSETS[j]), cy: y(v), r: 3.2, fill: `var(${col})` }, lines));
  });
  el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), class: 'axis' }, g);
  el('line', { x1: xc(0), x2: xc(0), y1: T0, y2: T1, class: 'day0' }, g);
  xAxis(g, T1 + 18);
  hoverBands(g, onHover, T0, T1);
  // strip: one dot per event, its mean deviation over the summary window
  const sv = groups.flatMap(([, G]) => G.sums).filter(v => v != null);
  const sx = niceMax(Math.max(1, ...sv.map(Math.abs)));
  const X0 = 150, X1 = W - R - 10;
  const xs = v => X0 + (v + sx) / (2 * sx) * (X1 - X0);
  el('text', { x: 6, y: S0 - 12, class: 'ax' }, g, `Each event: mean ${unit === 'pct' ? '% ' : ''}deviation, day 0 to +${agg.to}. Click a dot to open it.`);
  for (let i = 0; i <= 4; i++) {
    const v = -sx + i * sx / 2, xx = xs(v);
    el('line', { x1: xx, x2: xx, y1: S0, y2: S1, class: i === 2 ? 'axis' : 'gridl' }, g);
    el('text', { x: xx, y: S1 + 16, class: 'ax', 'text-anchor': 'middle' }, g, (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + suffix);
  }
  groups.forEach(([k, G, col], gi) => {
    const yy = S0 + 26 + gi * 56;
    el('text', { x: 6, y: yy + 4, class: 'glab', fill: `var(${col})` }, g, `${k === 'us' ? 'U.S. ship present' : 'No U.S. ship'} (n=${G.n})`);
    if (G.sumCi) {
      el('line', { x1: xs(G.sumCi[0]), x2: xs(G.sumCi[1]), y1: yy + 16, y2: yy + 16, class: 'cibar', stroke: `var(${col})` }, g);
    }
    if (G.sumMean != null) el('path', { d: `M${xs(G.sumMean)} ${yy + 10}l5 6l-5 6l-5 -6z`, fill: `var(${col})` }, g);
    G.events.forEach((a, i) => {
      const v = G.sums[i]; if (v == null) return;
      const c = el('circle', { cx: xs(v), cy: yy - 6 + ((i % 3) - 1) * 5, r: 5.5, class: 'sdot', fill: `var(${col})`, tabindex: 0, role: 'button',
        'aria-label': `${nice(a.e.date)}: ${fmtDev(v, unit)}. Open this event.` }, g);
      el('title', {}, c, `${nice(a.e.date)} · ${a.e.ships.map(s => s.name).join(', ')} · ${fmtDev(v, unit)}`);
      c.addEventListener('click', () => onPick(a.e.id));
      c.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(a.e.id); } });
    });
  });
}
