// Daily timeline with a draggable window (brush), JCRP ticks and click-to-pick a day.
import { el } from '../../../shared/js/mapkit.js';
import { ALL, META, has, nice, indexOf } from './data.js';

const W = 1000, H = 150, TOP = 22, BOT = 124;

export function createTimeline(svg, { onWindow, onDay, onHover }) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const n = ALL.length;
  const x = i => (i / (n - 1)) * W;
  const ix = px => Math.max(0, Math.min(n - 1, Math.round((px / W) * (n - 1))));
  const maxV = Math.max(...ALL.map(d => d.entered || 0));
  const y = v => BOT - (Math.sqrt(v) / Math.sqrt(maxV)) * (BOT - TOP);

  // era bands: SW-ADIZ-only reports (to Aug 2022), then aircraft lists with no sector wording (to Nov 2022)
  const iAround = indexOf(META.firstAround), iDaily = indexOf(META.firstDaily);
  el('rect', { x: 0, y: TOP - 4, width: x(iAround), height: BOT - TOP + 4, class: 'era' }, svg);
  el('text', { x: 6, y: TOP + 8, class: 'era-t' }, svg, 'Southwestern ADIZ reports only');
  el('rect', { x: x(iAround), y: TOP - 4, width: x(iDaily) - x(iAround), height: BOT - TOP + 4, class: 'era era2' }, svg);

  const bars = el('path', { class: 'bars' }, svg);
  const barsHi = el('path', { class: 'bars hi' }, svg);
  const jc = el('path', { class: 'jcrp-ticks' }, svg);
  let d = '';
  ALL.forEach(day => { if (day.jcrp) d += `M${x(day.i).toFixed(1)} ${TOP - 12}v7`; });
  jc.setAttribute('d', d);

  // year ticks
  const ax = el('g', { class: 'axis' }, svg);
  ALL.forEach(day => {
    if (day.d.endsWith('-01-01')) {
      el('line', { x1: x(day.i), x2: x(day.i), y1: BOT, y2: BOT + 5 }, ax);
      el('text', { x: x(day.i) + 3, y: BOT + 16 }, ax, day.d.slice(0, 4));
    }
  });
  el('line', { x1: 0, x2: W, y1: BOT, y2: BOT, class: 'base' }, ax);

  const brush = el('rect', { class: 'brush', y: TOP - 14, height: BOT - TOP + 14, tabindex: 0, role: 'slider',
    'aria-label': 'Time window. Arrow keys move it by a day, Page Up and Page Down by a month.' }, svg);
  const hL = el('rect', { class: 'handle', y: TOP - 14, height: BOT - TOP + 14, width: 8, 'data-h': 'l' }, svg);
  const hR = el('rect', { class: 'handle', y: TOP - 14, height: BOT - TOP + 14, width: 8, 'data-h': 'r' }, svg);
  const cursor = el('line', { class: 'cursor', y1: TOP - 14, y2: BOT }, svg);

  let win = [0, n - 1], dayI = null;
  const px = e => {
    const r = svg.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };

  let drag = null;
  svg.addEventListener('pointerdown', e => {
    const p = px(e), t = e.target.dataset?.h;
    if (t) drag = { mode: t, p0: p, w0: [...win] };
    else if (e.target === brush) drag = { mode: 'move', p0: p, w0: [...win], moved: false };
    else drag = { mode: 'new', p0: p, w0: [...win], moved: false };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    const p = px(e);
    onHover(ALL[ix(p)], e);
    if (!drag) return;
    const di = ix(p) - ix(drag.p0);
    if (Math.abs(p - drag.p0) > 3) drag.moved = true;
    if (drag.mode === 'l') win = [Math.min(ix(p), win[1]), win[1]];
    else if (drag.mode === 'r') win = [win[0], Math.max(ix(p), win[0])];
    else if (drag.mode === 'move' && drag.moved) {
      const len = drag.w0[1] - drag.w0[0];
      const a = Math.max(0, Math.min(n - 1 - len, drag.w0[0] + di));
      win = [a, a + len];
    } else if (drag.mode === 'new' && drag.moved) {
      win = [Math.min(ix(drag.p0), ix(p)), Math.max(ix(drag.p0), ix(p))];
    }
    draw();
    if (drag.moved || drag.mode === 'l' || drag.mode === 'r') onWindow(win, false);
  });
  const end = e => {
    if (!drag) return;
    if (!drag.moved && (drag.mode === 'new' || drag.mode === 'move')) onDay(ALL[ix(px(e))]);
    else onWindow(win, true);
    drag = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', () => { drag = null; });
  svg.addEventListener('pointerleave', () => onHover(null));
  brush.addEventListener('keydown', e => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -30, PageDown: 30 }[e.key];
    if (!step) return;
    e.preventDefault();
    const len = win[1] - win[0];
    const a = Math.max(0, Math.min(n - 1 - len, win[0] + step));
    win = [a, a + len];
    draw(); onWindow(win, true);
  });

  function draw() {
    const [a, b] = win;
    brush.setAttribute('x', x(a)); brush.setAttribute('width', Math.max(2, x(b) - x(a)));
    hL.setAttribute('x', x(a) - 4); hR.setAttribute('x', x(b) - 4);
    brush.setAttribute('aria-valuetext', `${nice(ALL[a].d)} to ${nice(ALL[b].d)}`);
    cursor.style.display = dayI == null ? 'none' : '';
    if (dayI != null) { cursor.setAttribute('x1', x(dayI)); cursor.setAttribute('x2', x(dayI)); }
  }
  function setBars(sector) {
    let lo = '', hi = '';
    const bw = Math.max(0.6, W / n);
    for (const day of ALL) {
      if (!day.entered) continue;
      const seg = `M${x(day.i).toFixed(2)} ${BOT}V${y(day.entered).toFixed(1)}h${bw.toFixed(2)}V${BOT}Z`;
      if (sector && has(day, sector)) hi += seg; else lo += seg;
    }
    bars.setAttribute('d', lo); barsHi.setAttribute('d', hi);
    bars.classList.toggle('dim', !!sector);
  }
  return {
    set(w, di, sector) { win = w; dayI = di; setBars(sector); draw(); },
  };
}
