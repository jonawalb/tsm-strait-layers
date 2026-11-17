// 24-hour clock ring spanning MND's reporting window (6 a.m. to 6 a.m.). Only events with recorded times go on it.
import { el } from '../../../shared/js/mapkit.js';
import { clock, shortDate } from './day.js';

const HOUR = 36e5;
const KIND_COLOR = { jcrp: 'var(--warn)', mnd: 'var(--muted)', ccg: 'var(--ccg)' };

export function drawClock(svg, c, { onHover } = {}) {
  const S = 420, cx = S / 2, cy = S / 2, R = 150;
  svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
  svg.innerHTML = '';
  const ang = t => ((t - c.win.t0) / (24 * HOUR)) * 2 * Math.PI - Math.PI / 2;
  const pt = (t, r) => [cx + r * Math.cos(ang(t)), cy + r * Math.sin(ang(t))];
  el('circle', { cx, cy, r: R, class: 'ring' }, svg);
  el('circle', { cx, cy, r: R - 26, class: 'ring-in' }, svg);
  // Night shading between 18:00 and 06:00 on the ring, for orientation only.
  arc(svg, pt, c.win.t0 + 12 * HOUR, c.win.t0 + 24 * HOUR, R - 13, 'night');
  for (let h = 0; h < 24; h++) {
    const t = c.win.t0 + h * HOUR, major = h % 3 === 0;
    const [x1, y1] = pt(t, R + 2), [x2, y2] = pt(t, R + (major ? 12 : 6));
    el('line', { x1, y1, x2, y2, class: 'tick' + (major ? ' major' : '') }, svg);
    if (major) {
      const [lx, ly] = pt(t, R + 30);
      el('text', { x: lx, y: ly + 4, class: 'hour', 'text-anchor': 'middle' }, svg, clock(t));
    }
  }
  const mid = c.win.t0 + 18 * HOUR;
  const [mx1, my1] = pt(mid, R - 26), [mx2, my2] = pt(mid, R);
  el('line', { x1: mx1, y1: my1, x2: mx2, y2: my2, class: 'midnight' }, svg);
  // Center text: the window.
  el('text', { x: cx, y: cy - 22, class: 'c-eyebrow', 'text-anchor': 'middle' }, svg, 'MND reporting window');
  el('text', { x: cx, y: cy + 4, class: 'c-main', 'text-anchor': 'middle' }, svg, `6 a.m. ${shortDate(c.win.startDay)}`);
  el('text', { x: cx, y: cy + 28, class: 'c-main', 'text-anchor': 'middle' }, svg, `to 6 a.m. ${shortDate(c.win.endDay)}`);

  const inWin = c.events.filter(e => e.inWindow);
  // CCG presence spans: from first to last timed entry of each incident.
  const byInc = new Map();
  inWin.filter(e => e.kind === 'ccg').forEach(e => { const a = byInc.get(e.inc.id) || []; a.push(e.ts); byInc.set(e.inc.id, a); });
  byInc.forEach(ts => { if (ts.length > 1) arc(svg, pt, Math.min(...ts), Math.max(...ts), R - 13, 'span-ccg'); });
  // Event markers, numbered in time order.
  const marks = [];
  let prev = -Infinity, stack = 0;
  inWin.forEach((e, i) => {
    stack = e.ts - prev < 45 * 60e3 ? stack + 1 : 0;
    prev = e.ts;
    const [x, y] = pt(e.ts, R - 13 - stack * 24);
    const g = el('g', { class: 'ev', tabindex: 0, role: 'button' }, svg);
    g.setAttribute('aria-label', `${clock(e.ts)}: ${e.title}, ${e.where}`);
    const dot = el('circle', { cx: x, cy: y, r: 11, class: 'ev-dot' }, g);
    dot.style.fill = KIND_COLOR[e.kind];
    el('text', { x, y: y + 4, class: 'ev-n', 'text-anchor': 'middle' }, g, i + 1);
    const on = () => onHover && onHover(i);
    g.addEventListener('pointerenter', on);
    g.addEventListener('focus', on);
    g.addEventListener('pointerleave', () => onHover && onHover(-1));
    g.addEventListener('blur', () => onHover && onHover(-1));
    marks.push(g);
  });
  // Events just outside the window (same calendar days) as small ticks outside the ring.
  c.events.filter(e => !e.inWindow).forEach(e => {
    const [x, y] = pt(e.ts, R + 40);
    const m = el('circle', { cx: x, cy: y, r: 3.5, class: 'ev-out' }, svg);
    m.style.stroke = KIND_COLOR[e.kind];
  });
  return {
    highlight: i => marks.forEach((m, j) => m.classList.toggle('hi', j === i)),
  };
}

function arc(svg, pt, a, b, r, cls) {
  const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r);
  const large = b - a > 12 * HOUR ? 1 : 0;
  el('path', { d: `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`, class: 'arc ' + cls }, svg);
}
