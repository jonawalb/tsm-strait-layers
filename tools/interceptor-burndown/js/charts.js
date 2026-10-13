// Burn-down area chart, leakers-per-day bars and the sensitivity tornado.
import { el, svgPoint } from '../../../shared/js/mapkit.js';
import { SYSTEMS } from '../data/inventory.js';
import { THREATS } from '../data/threats.js';

let W = 1000, N = 90;
const PAD = { l: 46, r: 14, t: 16, b: 26 };
const xOf = t => PAD.l + (t / N) * (W - PAD.l - PAD.r);
const tOf = x => Math.round(Math.max(0, Math.min(N, (x - PAD.l) / (W - PAD.l - PAD.r) * N)));
function fit(svg, n) { W = Math.max(300, Math.round(svg.clientWidth || svg.parentElement.clientWidth || 1000)); N = n; }
const ceilNice = v => { const st = nice(v / 4); return Math.ceil(v / st) * st; };
const nice = v => { const p = 10 ** Math.floor(Math.log10(Math.max(1, v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

function scrubbable(svg, onScrub) {
  if (svg._scrub) { svg._scrub.cb = onScrub; return; }
  svg._scrub = { cb: onScrub };
  let down = false;
  const go = e => svg._scrub.cb(tOf(svgPoint(svg, e)[0]));
  svg.addEventListener('pointerdown', e => { down = true; svg.setPointerCapture(e.pointerId); go(e); });
  svg.addEventListener('pointermove', e => { if (down) go(e); });
  svg.addEventListener('pointerup', () => { down = false; });
  svg.addEventListener('pointercancel', () => { down = false; });
}

function yAxis(g, H, max, yOf) {
  const step = nice(max / 4);
  for (let v = 0; v <= max + 1e-9; v += step) {
    el('line', { x1: PAD.l, x2: W - PAD.r, y1: yOf(v), y2: yOf(v), class: 'grid' }, g);
    el('text', { x: PAD.l - 6, y: yOf(v) + 4, class: 'ax-t', 'text-anchor': 'end' }, g, v >= 1000 ? (v / 1000) + 'k' : String(v));
  }
}
function xAxis(g, H) {
  const step = W < 600 ? 30 : 10;
  for (let t = 0; t <= N; t += step) {
    el('line', { x1: xOf(t), x2: xOf(t), y1: H - PAD.b, y2: H - PAD.b + 4, class: 'ax' }, g);
    el('text', { x: xOf(t), y: H - 8, class: 'ax-t', 'text-anchor': 'middle' }, g, t === 0 ? 'Day 0' : String(t));
  }
}
function cursor(g, H, day) {
  const x = xOf(day);
  el('line', { x1: x, x2: x, y1: PAD.t - 6, y2: H - PAD.b, class: 'cur' }, g);
  el('circle', { cx: x, cy: PAD.t - 6, r: 6, class: 'cur-h' }, g);
}

/** Stacked area of interceptors left, by system. */
export function drawBurn(svg, sim, day, onScrub) {
  fit(svg, sim.H);
  const H = W < 600 ? 240 : 300;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const g = el('g', {}, svg);
  const tot = d => SYSTEMS.reduce((a, s) => a + d.stock[s.k], 0);
  const max = ceilNice(Math.max(10, ...sim.days.map(tot)) * 1.02);
  const yOf = v => H - PAD.b - Math.min(max, v) / max * (H - PAD.t - PAD.b);
  yAxis(g, H, max, yOf);
  const base = sim.days.map(() => 0);
  const pt = (i, v) => `${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`;
  SYSTEMS.forEach(s => {
    const top = sim.days.map((d, i) => base[i] + d.stock[s.k]);
    if (top.every((v, i) => v - base[i] < 0.5)) return;
    const up = sim.days.map((d, i) => pt(i, top[i]));
    const dn = sim.days.map((d, i) => pt(i, base[i])).reverse();
    el('path', { d: `M${up.join('L')}L${dn.join('L')}Z`, class: 'area', fill: s.col }, g);
    top.forEach((v, i) => { base[i] = v; });
  });
  if (sim.bmdDry) {
    const x = xOf(sim.bmdDry);
    el('line', { x1: x, x2: x, y1: PAD.t, y2: H - PAD.b, class: 'drymark' }, g);
    el('text', { x: x + (x > W - 170 ? -6 : 6), y: PAD.t + 12, class: 'dry-t', 'text-anchor': x > W - 170 ? 'end' : 'start' }, g, `Ballistic defense dry, day ${sim.bmdDry}`);
  }
  xAxis(g, H);
  cursor(g, H, day);
  scrubbable(svg, onScrub);
}

/** Bars: threats that got through each day, stacked by type, over a faint bar of all incoming. */
export function drawLeak(svg, sim, day, onScrub) {
  fit(svg, sim.H);
  const H = W < 600 ? 190 : 220;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const g = el('g', {}, svg);
  const inc = d => d.inc.b + d.inc.c + d.inc.d;
  const max = ceilNice(Math.max(10, ...sim.days.map(inc)) * 1.02);
  const yOf = v => H - PAD.b - Math.min(max, v) / max * (H - PAD.t - PAD.b);
  yAxis(g, H, max, yOf);
  const bw = Math.max(1, (W - PAD.l - PAD.r) / N * 0.78);
  sim.days.slice(1).forEach(d => {
    const x = xOf(d.t) - bw / 2;
    el('rect', { x, y: yOf(inc(d)), width: bw, height: yOf(0) - yOf(inc(d)), class: 'incbar' }, g);
    let b = 0;
    THREATS.forEach(th => {
      const v = d.leak[th.k];
      if (v < 0.05) return;
      el('rect', { x, y: yOf(b + v), width: bw, height: yOf(b) - yOf(b + v), fill: th.col, class: 'leakbar' }, g);
      b += v;
    });
  });
  xAxis(g, H);
  cursor(g, H, day);
  scrubbable(svg, onScrub);
}

/** Horizontal tornado bars around the base value. */
export function drawTornado(svg, tor, metric, H0) {
  W = Math.max(300, Math.round(svg.clientWidth || svg.parentElement.clientWidth || 600));
  const narrow = W < 560;
  const rows = tor.rows.filter(r => r.swing > 0.05).slice(0, 8);
  const rowH = narrow ? 60 : 30, labW = narrow ? 0 : 210, top = 22;
  const H = top + Math.max(1, rows.length) * rowH + 24;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const g = el('g', {}, svg);
  const cap = v => (metric === 'dry' ? Math.min(v, H0 + 1) : v);
  const vals = rows.flatMap(r => [cap(r.lo), cap(r.hi)]).concat(cap(tor.base));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * (narrow ? 0.06 : 0.3);
  lo -= pad; hi += pad;
  const x0 = labW + 12, x1 = W - 14;
  const xs = v => x0 + (cap(v) - lo) / (hi - lo) * (x1 - x0);
  const fmt = v => (metric === 'dry' ? (v > H0 ? `past ${H0}` : `day ${v.toFixed(1)}`) : Math.round(v).toLocaleString());
  el('line', { x1: xs(tor.base), x2: xs(tor.base), y1: top - 6, y2: H - 20, class: 'basel' }, g);
  el('text', { x: xs(tor.base), y: top - 9, class: 'ax-t', 'text-anchor': 'middle' }, g, 'Now: ' + fmt(tor.base));
  if (!rows.length) el('text', { x: x0, y: top + 20, class: 'row-t' }, g, 'No single input moves this result by much.');
  rows.forEach((r, i) => {
    const y = top + i * rowH + (narrow ? 16 : 4);
    if (narrow) {
      el('text', { x: 2, y: y - 4, class: 'row-t' }, g, r.n);
      el('text', { x: 2, y: y + 32, class: 'tb-t' }, g, `${r.ll}: ${fmt(r.lo)} · ${r.hl}: ${fmt(r.hi)}`);
    }
    else el('text', { x: labW, y: y + 13, class: 'row-t', 'text-anchor': 'end' }, g, r.n);
    [['lo', r.lo, r.ll], ['hi', r.hi, r.hl]].forEach(([side, v, lab]) => {
      const a = xs(tor.base), b = xs(v);
      const good = metric === 'dry' ? v > tor.base : v < tor.base;
      el('rect', { x: Math.min(a, b), y, width: Math.max(1, Math.abs(b - a)), height: 18, class: 'tbar ' + (good ? 'good' : 'bad') }, g);
      if (!narrow && Math.abs(b - a) > 2) {
        const txt = `${lab}: ${fmt(v)}`, tw = txt.length * 6.7;
        const right = b >= a;
        // Outside the bar end if it fits, otherwise tucked inside the bar.
        const fits = right ? b + 4 + tw <= W - 2 : b - 4 - tw >= (narrow ? 2 : labW + 4);
        const x = fits ? b + (right ? 4 : -4) : b + (right ? -4 : 4);
        const anchor = (right === fits) ? 'start' : 'end';
        el('text', { x, y: y + 13, class: 'tb-t' + (fits ? '' : ' in'), 'text-anchor': anchor }, g, txt);
      }
    });
  });
}
