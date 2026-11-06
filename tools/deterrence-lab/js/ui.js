// Small DOM and SVG helpers shared by the three modules.
import { el } from '../../../shared/js/mapkit.js';

export { el };
export const f2 = x => (x == null || !Number.isFinite(x)) ? '–' : (Math.abs(x) < 5e-4 ? '0' : x.toFixed(2).replace('-', '−'));
export const f3 = x => (x == null || !Number.isFinite(x)) ? '–' : (Math.abs(x) < 5e-5 ? '0' : x.toFixed(3).replace('-', '−'));
export const pct = x => (x == null || !Number.isFinite(x)) ? '–' : `${Math.round(x * 100 + 1e-9)}%`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Build a labeled range slider inside `parent`.
 * spec: { key, label, min, max, step, help, math }  get(): number, set(v): void, onInput(v)
 */
export function slider(parent, spec, value, onInput) {
  const id = 'sl-' + spec.key;
  const wrap = document.createElement('div');
  wrap.className = 'slider';
  wrap.innerHTML = `<div class="sl-h"><label for="${id}">${spec.label}${spec.math ? ` <span class="sym">${spec.math}</span>` : ''}</label><output for="${id}"></output></div>
    <input type="range" id="${id}" min="${spec.min}" max="${spec.max}" step="${spec.step}">
    ${spec.help ? `<small>${spec.help}</small>` : ''}`;
  parent.appendChild(wrap);
  const input = wrap.querySelector('input'), out = wrap.querySelector('output');
  const fmt = spec.fmt || (v => (+v).toFixed(spec.step < 0.01 ? 3 : 2));
  const show = v => { out.textContent = fmt(v); };
  input.value = value; show(value);
  input.addEventListener('input', () => { show(+input.value); onInput(+input.value); });
  return {
    input,
    set(v) { input.value = v; show(+input.value); },
    setMax(m) { input.max = m; },
    text(t) { out.textContent = t; },
    setMin(m) { input.min = m; },
  };
}

/** A segmented choice group (.choices) with aria-pressed buttons. */
export function choices(parent, opts, value, onPick, label) {
  const g = document.createElement('div');
  g.className = 'choices';
  g.setAttribute('role', 'group');
  if (label) g.setAttribute('aria-label', label);
  const btns = opts.map(o => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.v = o.v;
    b.innerHTML = `<b>${o.t}</b>${o.s ? `<span>${o.s}</span>` : ''}`;
    b.addEventListener('click', () => { onPick(o.v); });
    g.appendChild(b);
    return b;
  });
  parent.appendChild(g);
  const set = v => btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  set(value);
  return { set };
}

/** Render TeX into an element if KaTeX has loaded; otherwise show the source as plain text. */
export function tex(node, src, display = false) {
  if (window.katex) {
    try { window.katex.render(src, node, { displayMode: display, throwOnError: false }); return; } catch (e) { /* fall through */ }
  }
  node.textContent = src;
}

/** Section scaffold in the side panel. */
export function sec(parent, title, cls = '') {
  const s = document.createElement('div');
  s.className = 'sec ' + cls;
  if (title) s.innerHTML = `<p class="eyebrow">${title}</p>`;
  parent.appendChild(s);
  return s;
}

/**
 * Plot frame: returns scale functions and a group to draw in.
 * box: { W, H, m: {l, r, t, b}, x: [x0, x1], y: [y0, y1], ylog }
 */
export function frame(svg, box) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${box.W} ${box.H}`);
  const { m } = box, iw = box.W - m.l - m.r, ih = box.H - m.t - m.b;
  const ly = v => box.ylog ? Math.log10(v) : v;
  const [y0, y1] = box.y.map(ly);
  const sx = v => m.l + (v - box.x[0]) / (box.x[1] - box.x[0]) * iw;
  const sy = v => m.t + ih - (ly(v) - y0) / (y1 - y0) * ih;
  const ix = px => box.x[0] + (px - m.l) / iw * (box.x[1] - box.x[0]);
  const iy = py => { const t = y0 + (m.t + ih - py) / ih * (y1 - y0); return box.ylog ? 10 ** t : t; };
  const g = el('g', {}, svg);
  return { g, sx, sy, ix, iy, iw, ih, m, box };
}

/** Axes with ticks and titles. */
export function axes(F, { xt = [], yt = [], xl = '', yl = '', xf = f2, yf = f2 }) {
  const { g, sx, sy, m, box } = F;
  const a = el('g', { class: 'axis' }, g);
  el('line', { x1: m.l, x2: box.W - m.r, y1: box.H - m.b, y2: box.H - m.b }, a);
  el('line', { x1: m.l, x2: m.l, y1: m.t, y2: box.H - m.b }, a);
  xt.forEach(v => { el('line', { x1: sx(v), x2: sx(v), y1: box.H - m.b, y2: box.H - m.b + 4 }, a); el('text', { x: sx(v), y: box.H - m.b + 16, 'text-anchor': 'middle' }, a, xf(v)); });
  yt.forEach(v => { el('line', { x1: m.l - 4, x2: m.l, y1: sy(v), y2: sy(v) }, a); el('text', { x: m.l - 7, y: sy(v) + 4, 'text-anchor': 'end' }, a, yf(v)); });
  if (xl) el('text', { x: m.l + F.iw / 2, y: box.H - 6, 'text-anchor': 'middle', class: 'ax-t' }, a, xl);
  if (yl) el('text', { x: 14, y: m.t + F.ih / 2, 'text-anchor': 'middle', class: 'ax-t', transform: `rotate(-90 14 ${m.t + F.ih / 2})` }, a, yl);
  return a;
}

/**
 * Raster of classes over a 2-D parameter grid, drawn as run-length rects per row.
 * classify(x, y) -> { key, alpha? }. colors: key -> CSS var name.
 */
export function regionRaster(F, nx, ny, classify, colors) {
  const { g, sx, sy, box } = F;
  const layer = el('g', { class: 'raster', 'shape-rendering': 'crispEdges' }, g);
  let alphaMode = false;
  const dx = (box.x[1] - box.x[0]) / nx, dy = (box.y[1] - box.y[0]) / ny;
  for (let j = 0; j < ny; j++) {
    const yv = box.y[0] + (j + 0.5) * dy;
    let run = null;
    const flush = i => {
      if (!run) return;
      const x0 = sx(box.x[0] + run.i0 * dx), x1 = sx(box.x[0] + i * dx);
      const yTop = sy(box.y[0] + (j + 1) * dy), yBot = sy(box.y[0] + j * dy);
      const r = el('rect', { x: x0, y: yTop, width: x1 - x0 + (run.alpha == null ? 0.8 : 0), height: yBot - yTop + (run.alpha == null ? 0.8 : 0), fill: `var(${colors[run.key]})` }, layer);
      if (run.alpha != null) { r.setAttribute('fill-opacity', run.alpha); alphaMode = true; }
    };
    for (let i = 0; i < nx; i++) {
      const c = classify(box.x[0] + (i + 0.5) * dx, yv);
      const alpha = c.alpha == null ? null : Math.round(c.alpha * 10) / 10;
      if (!run || run.key !== c.key || (run.alpha ?? null) !== alpha) { flush(i); run = { key: c.key, i0: i, alpha }; }
    }
    flush(nx);
  }
  if (!alphaMode) layer.setAttribute('opacity', 0.36);
  return layer;
}

/** Pointer drag on a plot that reports data coordinates. */
export function dragPlot(svg, F, onMove) {
  const pt = e => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const px = (e.clientX - r.left) / r.width * vb.width, py = (e.clientY - r.top) / r.height * vb.height;
    onMove(F().ix(px), F().iy(py));
  };
  let down = false;
  svg.addEventListener('pointerdown', e => { down = true; svg.setPointerCapture(e.pointerId); pt(e); });
  svg.addEventListener('pointermove', e => { if (down) pt(e); });
  const up = () => { down = false; };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
}

export function legend(node, entries) {
  node.innerHTML = entries.map(([col, label, title]) =>
    `<span class="lg" ${title ? `title="${title}"` : ''}><i style="background:var(${col})"></i>${label}</span>`).join('');
}
