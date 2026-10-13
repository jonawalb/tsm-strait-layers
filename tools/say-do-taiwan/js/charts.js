// SVG charts: aligned series, lead-lag correlation, event study, distributed-lag coefficients.
// Shared verbatim by say-do-taiwan and say-do-global. Colours come from CSS classes (tokens only).
import { fmt, per } from './labels.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, parent, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}
const clear = svg => { while (svg.firstChild) svg.removeChild(svg.firstChild); };
const nice = (lo, hi) => {
  if (!(hi > lo)) { hi = lo + 1; }
  const step = 10 ** Math.floor(Math.log10((hi - lo) / 3));
  const s = [1, 2, 5, 10].map(m => m * step).find(x => (hi - lo) / x <= 5) || step * 10;
  return { lo: Math.floor(lo / s) * s, hi: Math.ceil(hi / s) * s, step: s };
};
const ticks = (n) => { const out = []; for (let v = n.lo; v <= n.hi + n.step / 2; v += n.step) out.push(+v.toFixed(10)); return out; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function yAxis(g, n, y, x0, x1, fmtv = v => String(v)) {
  for (const v of ticks(n)) {
    el('line', { x1: x0, x2: x1, y1: y(v), y2: y(v), class: v === 0 ? 'zero' : 'gridl' }, g);
    el('text', { x: x0 - 6, y: y(v) + 4, class: 'ax', 'text-anchor': 'end' }, g, fmtv(v));
  }
}

/** Aligned rhetoric (top) and behaviour (bottom) panels over the analysed window. */
export function drawSeries(svg, o, onHover) {
  clear(svg);
  const W = 900, H = 340, L = 56, R = 12, top1 = 32, h1 = 120, top2 = 192, h2 = 112;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const n = o.dates.length;
  if (!n) return;
  const x = i => L + (n === 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const bw = Math.max(1, (W - L - R) / n * 0.8);
  const rv = o.rhet.filter(v => v != null), bv = o.beh.filter(v => v != null);
  const nr = nice(Math.min(0, ...rv), Math.max(...rv, 0.01));
  const nb = nice(Math.min(0, ...bv), Math.max(...bv, 1));
  const yr = v => top1 + h1 - ((v - nr.lo) / (nr.hi - nr.lo)) * h1;
  const yb = v => top2 + h2 - ((v - nb.lo) / (nb.hi - nb.lo)) * h2;
  const g = el('g', {}, svg);
  el('text', { x: L, y: 13, class: 'plab' }, g, o.rLabel);
  el('text', { x: L, y: top2 - 9, class: 'plab' }, g, o.bLabel);
  yAxis(g, nr, yr, L, W - R, v => o.rFmt(v));
  yAxis(g, nb, yb, L, W - R, v => String(Math.round(v * 100) / 100));
  // spikes: vertical bands behind both panels
  for (const s of o.spikes) {
    const i = s.i;
    el('rect', { x: x(i) - 3, y: top1, width: 6, height: top2 + h2 - top1, class: 'spk' + (s.key === o.sel ? ' sel' : '') }, g);
  }
  // behaviour bars
  const bars = el('g', { class: 'bbars' }, g);
  o.beh.forEach((v, i) => { if (v != null && v !== 0) el('rect', { x: x(i) - bw / 2, y: Math.min(yb(v), yb(0)), width: bw, height: Math.abs(yb(v) - yb(0)) }, bars); });
  // rhetoric line with gaps
  let d = '', pen = false;
  o.rhet.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yr(v).toFixed(1)}`; pen = true; });
  el('path', { d, class: 'rline' }, g);
  if (o.res === 'day') o.rhet.forEach((v, i) => { if (v != null) el('circle', { cx: x(i), cy: yr(v), r: 1.2, class: 'rdot' }, g); });
  for (const s of o.spikes) el('path', { d: `M${x(s.i)},${top1 - 2}l-5,-7h10z`, class: 'spkm' + (s.key === o.sel ? ' sel' : '') }, g);
  // time axis
  const span = (Date.parse(o.dates[n - 1]) - Date.parse(o.dates[0])) / 864e5;
  let last = '';
  o.dates.forEach((dt, i) => {
    const yy = dt.slice(0, 4), mm = +dt.slice(5, 7);
    const key = span > 900 ? yy : span > 300 ? `${yy}-${Math.floor((mm - 1) / 3)}` : `${yy}-${mm}`;
    if (key === last) return;
    last = key;
    if (i === 0 && n > 30) return;
    el('line', { x1: x(i), x2: x(i), y1: top2 + h2, y2: top2 + h2 + 5, class: 'axis' }, g);
    el('text', { x: x(i), y: H - 6, class: 'ax', 'text-anchor': 'middle' }, g, span > 900 ? yy : `${MONTHS[mm - 1]}${mm === 1 || i < 3 ? ' ' + yy : ''}`);
  });
  // hover layer
  const hov = el('rect', { x: L, y: top1, width: W - L - R, height: top2 + h2 - top1, class: 'hovl' }, g);
  const cross = el('line', { y1: top1, y2: top2 + h2, class: 'cross', visibility: 'hidden' }, g);
  const pick = ev => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return Math.max(0, Math.min(n - 1, Math.round(((p.x - L) / (W - L - R)) * (n - 1))));
  };
  hov.addEventListener('mousemove', ev => { const i = pick(ev); cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible'); onHover(i); });
  hov.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); onHover(-1); });
  hov.addEventListener('click', ev => onHover(pick(ev), true));
  // Keyboard: focus the chart, arrows step through periods, Enter opens a spike's evidence.
  let ki = -1;
  const kshow = i => { ki = Math.max(0, Math.min(n - 1, i)); cross.setAttribute('x1', x(ki)); cross.setAttribute('x2', x(ki)); cross.setAttribute('visibility', 'visible'); onHover(ki); };
  svg.setAttribute('tabindex', '0');
  svg.onkeydown = ev => {
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 10, PageDown: -10, Home: -1e9, End: 1e9 }[ev.key];
    if (step != null) { ev.preventDefault(); kshow(ki < 0 ? n - 1 : ki + step); }
    else if (ev.key === 'Enter' && ki >= 0) { ev.preventDefault(); onHover(ki, true); }
  };
  svg.onblur = () => { cross.setAttribute('visibility', 'hidden'); };
}

/** Cross-correlation r_k for k = -K..K with bootstrap CIs. */
export function drawCCF(svg, c, res) {
  clear(svg);
  const W = 440, H = 220, L = 54, R = 10, T = 16, B = 34;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (!c || !c.r || !c.r.length) {
    el('text', { x: W / 2, y: H / 2, class: 'ax msg', 'text-anchor': 'middle' }, svg, (c && c.why) || 'Not tested for this pair.');
    return;
  }
  const K = (c.r.length - 1) / 2;
  const vals = [...c.r, ...c.lo, ...c.hi].filter(v => v != null);
  const m = Math.max(0.2, ...vals.map(Math.abs));
  const n = nice(-m, m);
  const x = k => L + ((k + K + 0.5) / (2 * K + 1)) * (W - L - R);
  const y = v => T + (1 - (v - n.lo) / (n.hi - n.lo)) * (H - T - B);
  const g = el('g', {}, svg);
  el('rect', { x: x(0.5), y: T, width: x(K + 0.5) - x(0.5), height: H - T - B, class: 'leadzone' }, g);
  yAxis(g, n, y, L, W - R, v => v.toFixed(1));
  const bw = (W - L - R) / (2 * K + 1) * 0.62;
  c.r.forEach((v, i) => {
    const k = i - K;
    if (v == null) return;
    el('rect', { x: x(k) - bw / 2, y: Math.min(y(v), y(0)), width: bw, height: Math.abs(y(v) - y(0)),
      class: 'ccfbar' + (k > 0 ? ' lead' : k < 0 ? ' back' : ' same') + (k === c.k ? ' best' : '') }, g);
    if (c.lo[i] != null) el('line', { x1: x(k), x2: x(k), y1: y(c.lo[i]), y2: y(c.hi[i]), class: 'whisk' }, g);
  });
  for (let k = -K; k <= K; k += K > 10 ? 7 : 2) el('text', { x: x(k), y: H - B + 14, class: 'ax', 'text-anchor': 'middle' }, g, k > 0 ? '+' + k : String(k));
  el('text', { x: x(-K / 2), y: H - 4, class: 'ax', 'text-anchor': 'middle' }, g, '← behaviour leads');
  el('text', { x: x(K / 2), y: H - 4, class: 'ax', 'text-anchor': 'middle' }, g, 'rhetoric leads →');
}

/** Mean abnormal behaviour around spikes, t = -h..h, with bootstrap band. */
export function drawES(svg, e, P, res, unit) {
  clear(svg);
  const W = 440, H = 220, L = 56, R = 10, T = 16, B = 34;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const g = el('g', {}, svg);
  if (!e || e.ab == null) {
    el('text', { x: W / 2, y: H / 2, class: 'ax msg', 'text-anchor': 'middle' }, g, (e && e.why) || 'No usable spikes in this window.');
    return;
  }
  const h = P.h, Hh = P.H;
  const vals = [...e.ab, ...e.lo, ...e.hi].filter(v => v != null);
  const n = nice(Math.min(0, ...vals), Math.max(0, ...vals));
  const x = t => L + ((t + h) / (2 * h)) * (W - L - R);
  const y = v => T + (1 - (v - n.lo) / (n.hi - n.lo)) * (H - T - B);
  el('rect', { x: x(-Hh) , y: T, width: x(-1) - x(-Hh), height: H - T - B, class: 'prezone' }, g);
  el('rect', { x: x(1), y: T, width: x(Hh) - x(1), height: H - T - B, class: 'postzone' }, g);
  yAxis(g, n, y, L, W - R, v => String(Math.round(v * 100) / 100));
  let band = '';
  e.hi.forEach((v, i) => { band += `${i ? 'L' : 'M'}${x(i - h)},${y(v ?? 0)}`; });
  for (let i = e.lo.length - 1; i >= 0; i--) band += `L${x(i - h)},${y(e.lo[i] ?? 0)}`;
  el('path', { d: band + 'Z', class: 'esband' }, g);
  el('line', { x1: x(0), x2: x(0), y1: T, y2: H - B, class: 'day0' }, g);
  el('path', { d: e.ab.map((v, i) => `${i ? 'L' : 'M'}${x(i - h)},${y(v ?? 0)}`).join(''), class: 'esline' }, g);
  e.ab.forEach((v, i) => el('circle', { cx: x(i - h), cy: y(v ?? 0), r: 2.2, class: 'esdot' }, g));
  for (let t = -h; t <= h; t += h > 10 ? 7 : 2) el('text', { x: x(t), y: H - B + 14, class: 'ax', 'text-anchor': 'middle' }, g, t > 0 ? '+' + t : String(t));
  el('text', { x: x(-Hh / 2 - 0.5), y: T + 12, class: 'ax zl', 'text-anchor': 'middle' }, g, 'before');
  el('text', { x: x(Hh / 2 + 0.5), y: T + 12, class: 'ax zl', 'text-anchor': 'middle' }, g, 'after');
  el('text', { x: L + (W - L - R) / 2, y: H - 4, class: 'ax', 'text-anchor': 'middle' }, g, `${per(res)}s from spike`);
}

/** Distributed-lag coefficients b_0..b_L with 95% HAC intervals. */
export function drawDL(svg, d, res) {
  clear(svg);
  const W = 440, H = 220, L = 54, R = 10, T = 16, B = 34;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const g = el('g', {}, svg);
  if (!d || d.b == null) {
    el('text', { x: W / 2, y: H / 2, class: 'ax msg', 'text-anchor': 'middle' }, g, (d && d.why) || 'Model not estimable.');
    return;
  }
  const lo = d.b.map((b, i) => b - 1.96 * d.se[i]), hi = d.b.map((b, i) => b + 1.96 * d.se[i]);
  const m = Math.max(0.1, ...lo.map(Math.abs), ...hi.map(Math.abs));
  const n = nice(-m, m);
  const Lg = d.b.length - 1;
  const x = k => L + ((k + 0.5) / (Lg + 1)) * (W - L - R);
  const y = v => T + (1 - (v - n.lo) / (n.hi - n.lo)) * (H - T - B);
  yAxis(g, n, y, L, W - R, v => v.toFixed(2));
  d.b.forEach((b, k) => {
    el('line', { x1: x(k), x2: x(k), y1: y(lo[k]), y2: y(hi[k]), class: 'whisk' + (k === 0 ? ' b0' : '') }, g);
    el('circle', { cx: x(k), cy: y(b), r: 4, class: 'coef' + (k === 0 ? ' b0' : '') }, g);
    el('text', { x: x(k), y: H - B + 14, class: 'ax', 'text-anchor': 'middle' }, g, k === 0 ? 'same' : `−${k}`);
  });
  el('text', { x: L + (W - L - R) / 2, y: H - 4, class: 'ax', 'text-anchor': 'middle' }, g, `rhetoric lag (${per(res)}s)`);
}

export { fmt };
