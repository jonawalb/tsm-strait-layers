// Small SVG chart helpers shared by the six figures: frame, tooltip, axes, hover columns.
import { el } from '../../../shared/js/mapkit.js';

export { el };

/** Prepare an <svg> inside `box` with a viewBox sized to the box width. */
export function frame(box, { H = 260, m = { l: 36, r: 12, t: 16, b: 28 } } = {}) {
  const svg = box.querySelector('svg');
  const W = Math.round(Math.max(340, Math.min(1400, box.clientWidth || 640)));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const tip = box.querySelector('.tooltip');
  tip.classList.remove('pinned');
  let pinned = false;
  const place = (html, x, y) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = box.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x - r.left + 14, top = y - r.top - th - 10;
    if (left + tw > r.width) left = Math.max(0, x - r.left - tw - 14);
    if (top < 0) top = Math.min(r.height - th, y - r.top + 16);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, top) + 'px';
  };
  const show = (html, x, y) => { if (!pinned) place(html, x, y); };
  const hide = () => { if (!pinned) tip.hidden = true; };
  /** Click-to-pin: the tooltip stays open and takes pointer events so its links work. */
  const pin = (html, x, y) => { pinned = false; place(html, x, y); pinned = true; tip.classList.add('pinned'); };
  const unpin = () => { pinned = false; tip.classList.remove('pinned'); tip.hidden = true; };
  if (!box._pinWired) {
    box._pinWired = true;
    document.addEventListener('pointerdown', e => { if (!box.contains(e.target)) box._unpin?.(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') box._unpin?.(); });
  }
  box._unpin = unpin;
  return { svg, W, H, m, iw: W - m.l - m.r, ih: H - m.t - m.b, show, hide, pin, unpin, isPinned: () => pinned };
}

export function niceMax(v, steps = 4) {
  if (v <= 0) return steps;
  const raw = v / steps, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  return Math.ceil(v / step) * step;
}

/** Horizontal gridlines and labels for a linear y scale. */
export function yAxis(g, f, max, Y, { steps, label = '' } = {}) {
  steps = steps || [4, 5, 6, 3, 2].find(k => Number.isInteger(max / k)) || 4;
  const ax = el('g', { class: 'axis' }, g);
  for (let i = 0; i <= steps; i++) {
    const v = max / steps * i, y = Y(v);
    el('line', { x1: f.m.l, x2: f.W - f.m.r, y1: y, y2: y, class: 'grid' }, ax);
    el('text', { x: f.m.l - 6, y: y + 3.5, 'text-anchor': 'end' }, ax, Number.isInteger(v) ? v : v.toFixed(1));
  }
  if (label) el('text', { x: f.m.l, y: f.m.t - 5, class: 'ylab' }, ax, label);
}

/**
 * Transparent hit columns for hover/focus. items: array; x(i) center; w column width; html(i) tooltip.
 * Keyboard: the column group is one focusable element; arrow keys move between items.
 */
export function hoverColumns(f, items, { x, w, html, links, top = f.m.t, bottom = f.H - f.m.b, label = 'Chart' }) {
  const g = el('g', { class: 'hits', tabindex: 0, role: 'group' }, f.svg);
  g.setAttribute('aria-label', `${label}. Use arrow keys to read values.`);
  const guide = el('line', { y1: top, y2: bottom, class: 'guide' }, f.svg);
  guide.style.display = 'none';
  let cur = -1;
  const at = (i, cx, cy) => {
    cur = i;
    guide.style.display = '';
    guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i));
    f.show(html(items[i]) + (links && links(items[i]) ? '<small class="tt-hint">Click or press Enter for links</small>' : ''), cx, cy);
  };
  const full = i => {
    const l = links ? links(items[i]) : '';
    return html(items[i]) + (l ? `<div class="xlinks">${l}</div>` : '');
  };
  const pinAt = (i, cx, cy) => {
    const l = links ? links(items[i]) : '';
    if (!l) return;
    cur = i; guide.style.display = '';
    guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i));
    f.pin(full(i), cx, cy);
  };
  items.forEach((it, i) => {
    const r = el('rect', { x: x(i) - w / 2, y: top, width: w, height: bottom - top, class: 'hit' }, g);
    r.addEventListener('pointerenter', e => { if (!f.isPinned()) at(i, e.clientX, e.clientY); });
    r.addEventListener('pointermove', e => { if (!f.isPinned()) at(i, e.clientX, e.clientY); });
    if (links) r.addEventListener('click', e => pinAt(i, e.clientX, e.clientY));
  });
  if (links) g.classList.add('pinnable');
  g.addEventListener('pointerleave', () => { if (!f.isPinned()) { guide.style.display = 'none'; f.hide(); } });
  const kb = i => {
    const svgR = f.svg.getBoundingClientRect(), k = svgR.width / f.W;
    return [svgR.left + x(i) * k, svgR.top + top * k + 20];
  };
  g.addEventListener('keydown', e => {
    if (e.key === 'Enter' && links && cur >= 0) { e.preventDefault(); pinAt(cur, ...kb(cur)); return; }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    f.unpin();
    const i = Math.max(0, Math.min(items.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
    at(i, ...kb(i));
  });
  g.addEventListener('focus', () => { const i = cur < 0 ? 0 : cur; at(i, ...kb(i)); });
  g.addEventListener('blur', () => { if (!f.isPinned()) { guide.style.display = 'none'; f.hide(); } });
  return g;
}

export const star = (cx, cy, r = 6) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
};
