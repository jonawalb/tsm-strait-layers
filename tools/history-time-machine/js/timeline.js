// Timeline strip: policy bands, event dots by category, a draggable year cursor (and a second one in compare mode).
import { el, svgPoint } from '../../../shared/js/mapkit.js';
import { BANDS, YEAR0, YEAR1 } from '../data/control.js';
import { CATS, yearOf } from '../data/events.js';

const W = 1000, L = 128, R = 12, ROW = 17, TOP = 6;
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const frac = d => { const m = +(d.slice(5, 7) || 6); return (m - 0.5) / 12; };

export function createTimeline(svg, { onYear, onEvent }) {
  const bandsH = BANDS.length * ROW;
  const evTop = TOP + bandsH + 10, evH = 58, axisY = evTop + evH + 4, H = axisY + 22;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const x = y => L + (y - YEAR0) / (YEAR1 + 1 - YEAR0) * (W - L - R);
  const yearAt = px => Math.max(YEAR0, Math.min(YEAR1, Math.floor(YEAR0 + (px - L) / (W - L - R) * (YEAR1 + 1 - YEAR0))));

  el('rect', { x: 0, y: 0, width: W, height: H, class: 'tl-bg' }, svg);
  BANDS.forEach((b, i) => {
    const y = TOP + i * ROW;
    el('text', { x: L - 8, y: y + 12, class: 'tl-lab', 'text-anchor': 'end' }, svg, b.label);
    el('rect', { x: L, y: y + 2, width: W - L - R, height: ROW - 4, class: 'tl-track' }, svg);
    for (const [a, z, t, col] of b.segs) {
      const x0 = x(Math.max(a, YEAR0)), x1 = x(z ?? YEAR1 + 1);
      el('rect', { x: x0, y: y + 2, width: Math.max(1, x1 - x0), height: ROW - 4, rx: 2, class: 'tl-seg', fill: `var(${col})` }, svg);
      if (x1 - x0 > t.length * 6.2 + 8) el('text', { x: x0 + 5, y: y + 12, class: 'tl-segt' }, svg, t);
    }
  });
  el('text', { x: L - 8, y: evTop + 12, class: 'tl-lab', 'text-anchor': 'end' }, svg, 'Events');
  el('line', { x1: L, x2: W - R, y1: axisY, y2: axisY, class: 'tl-axis' }, svg);
  for (let y = 1900; y <= 2020; y += 10) {
    el('line', { x1: x(y), x2: x(y), y1: axisY, y2: axisY + 5, class: 'tl-axis' }, svg);
    el('text', { x: x(y), y: axisY + 17, class: 'tl-tick', 'text-anchor': 'middle' }, svg, y);
  }

  const dotsG = el('g', {}, svg);
  const cursorB = el('g', { class: 'tl-cursor b' }, svg);
  el('line', { y1: TOP, y2: axisY }, cursorB); el('rect', { y: axisY - 4, width: 34, height: 18, rx: 3, x: -17 }, cursorB);
  el('text', { y: axisY + 9, 'text-anchor': 'middle' }, cursorB);
  const cursorA = el('g', { class: 'tl-cursor a' }, svg);
  el('line', { y1: TOP, y2: axisY }, cursorA); el('rect', { y: axisY - 4, width: 34, height: 18, rx: 3, x: -17 }, cursorA);
  el('text', { y: axisY + 9, 'text-anchor': 'middle' }, cursorA);

  let dots = [];
  function setEvents(list, selId) {
    dotsG.innerHTML = '';
    const stack = {};
    dots = list.map(e => {
      const yr = yearOf(e), cx = x(yr + frac(e.date));
      const slot = Math.round(cx / 7);
      const k = stack[slot] = (stack[slot] || 0) + 1;
      const cy = evTop + evH - 6 - (k - 1) * 10;
      const c = el('circle', { cx, cy: Math.max(evTop + 4, cy), r: e.id === selId ? 6 : 4.2, class: 'tl-dot' + (e.id === selId ? ' sel' : ''), fill: `var(${CAT[e.cats[0]].col})` }, dotsG);
      const t = el('title', {}, c, `${e.date.slice(0, 4)} · ${e.title}`);
      c.addEventListener('click', ev => { ev.stopPropagation(); onEvent(e); });
      return { e, c, t };
    });
  }

  function setYears(a, b) {
    const pa = x(a + 0.5);
    cursorA.setAttribute('transform', `translate(${pa} 0)`);
    cursorA.querySelector('text').textContent = a;
    cursorB.style.display = b == null ? 'none' : '';
    if (b != null) {
      cursorB.setAttribute('transform', `translate(${x(b + 0.5)} 0)`);
      cursorB.querySelector('text').textContent = b;
    }
  }

  // Drag anywhere on the strip to scrub; in compare mode the nearer cursor moves.
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('tl-dot')) return;
    const [px] = svgPoint(svg, e);
    drag = svg.dataset.compare === '1' && svg.dataset.b && Math.abs(px - x(+svg.dataset.b + 0.5)) < Math.abs(px - x(+svg.dataset.a + 0.5)) ? 'b' : 'a';
    svg.setPointerCapture(e.pointerId);
    onYear(yearAt(px), drag);
  });
  svg.addEventListener('pointermove', e => { if (drag) onYear(yearAt(svgPoint(svg, e)[0]), drag); });
  const end = () => { drag = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);

  return { setEvents, setYears };
}
