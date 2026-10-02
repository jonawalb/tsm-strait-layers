// Motion for Interceptor Burn-down on Interactive Deterrence (and localhost) only. On TSM Interactive every
// export here is a no-op, so the tool there looks and behaves exactly as before. Presentation only: nothing
// here changes a number, and everything is off under prefers-reduced-motion.
import { pulse, flash, shake, burst, ping, reduced } from '../../../shared/js/motion.js';

export const MOTION = true; // Same motion on both sites (owner, 2026-09-30).
if (MOTION) document.documentElement.classList.add('ib-m');
const on = () => MOTION && !reduced();
const NS = 'http://www.w3.org/2000/svg';

/** Tween a number in an element's text, cancelling any tween already running on it. */
const runs = new WeakMap();
export function tween(el, to, fmt, ms = 450) {
  const from = el.dataset.v == null ? null : +el.dataset.v;
  el.dataset.v = to;
  cancelAnimationFrame(runs.get(el));
  if (!on() || from == null || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const u = Math.min(1, (now - t0) / ms), e = 1 - (1 - u) ** 3;
    el.textContent = fmt(u < 1 ? from + (to - from) * e : to);
    if (u < 1) runs.set(el, requestAnimationFrame(step));
  };
  runs.set(el, requestAnimationFrame(step));
}

export const press = el => { if (on()) pulse(el); };
export const changed = el => { if (on()) flash(el); };
export const hit = el => { if (on()) shake(el); };

/** Charts draw in the first time they scroll into view (a left-to-right wipe on the whole SVG). */
export function drawIn(svgs) {
  if (!on() || !('IntersectionObserver' in window)) return;
  // Watch the card, not the clipped SVG: a fully clipped element never reports as intersecting.
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.querySelector(':scope > svg.chart')?.classList.replace('ib-pre', 'ib-draw');
    io.unobserve(e.target);
  }), { threshold: .2 });
  svgs.forEach(s => { s.classList.add('ib-pre'); io.observe(s.parentElement); });
}

/** Tornado bars grow out from the base line (on first view and when the tested result changes). */
export function growBars(svg) {
  if (!on()) return;
  const base = svg.querySelector('.basel');
  const bx = base ? +base.getAttribute('x1') : 0;
  svg.querySelectorAll('.tbar').forEach((r, i) => {
    const x = +r.getAttribute('x');
    r.style.transformOrigin = x + 0.5 >= bx ? 'left center' : 'right center';
    r.style.animationDelay = `${Math.floor(i / 2) * 40}ms`;
    r.classList.add('ib-grow');
  });
}

// A layer over a chart for effects that must outlive the chart's redraws (it is redrawn every day in play).
function layer(svg) {
  const card = svg.parentElement;
  let o = card.querySelector(':scope > svg.ib-fx');
  if (!o) {
    o = document.createElementNS(NS, 'svg');
    o.setAttribute('class', 'ib-fx'); o.setAttribute('aria-hidden', 'true');
    card.appendChild(o);
  }
  o.setAttribute('viewBox', svg.getAttribute('viewBox'));
  // SVG elements have no offsetTop/offsetLeft: place the layer from the two bounding boxes.
  const r = svg.getBoundingClientRect(), c = card.getBoundingClientRect();
  Object.assign(o.style, { left: (r.left - c.left - card.clientLeft) + 'px', top: (r.top - c.top - card.clientTop) + 'px', width: r.width + 'px', height: r.height + 'px' });
  return o;
}

/** The magazine that can stop ballistic missiles just ran dry: a red burst on the chart's dry-day mark. */
export function dryBurst(svg) {
  if (!on()) return;
  const m = svg.querySelector('.drymark');
  if (!m) return;
  const o = layer(svg), x = +m.getAttribute('x1'), y = +m.getAttribute('y1');
  burst(o, x, y, { color: 'var(--bad)', n: 14, r: 34, ms: 700 });
  ping(o, x, y, { color: 'var(--bad)', r: 46, ms: 800 });
}
