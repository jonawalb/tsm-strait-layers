// Small motion helpers shared by the tools on Interactive Deterrence. Every helper is a no-op (or jumps to the
// end state) when the viewer prefers reduced motion. Nothing here changes a number, only how it arrives.
//   import { countUp, reveal, pulse, ping, burst, tracer, shake } from '../../shared/js/motion.js';
const NS = 'http://www.w3.org/2000/svg';
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = u => 1 - Math.pow(1 - u, 3);

let css = false;
function styles() {
  if (css) return; css = true;
  const s = document.createElement('style');
  s.textContent = `
  .m-rise { opacity: 0; transform: translateY(10px); transition: opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1); }
  .m-rise.m-in { opacity: 1; transform: none; }
  @keyframes m-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }
  .m-pulse { animation: m-pulse .7s ease-out; }
  @keyframes m-shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-3px); } 40%, 60% { transform: translateX(3px); } }
  .m-shake { animation: m-shake .4s both; }
  @keyframes m-flash { from { background: color-mix(in srgb, var(--accent) 30%, transparent); } to { background: transparent; } }
  .m-flash { animation: m-flash .9s ease-out; }
  @media (prefers-reduced-motion: reduce) { .m-rise { opacity: 1; transform: none; transition: none; } .m-pulse, .m-shake, .m-flash { animation: none; } }`;
  document.head.appendChild(s);
}

/** Count a number up (or down) from its current value to `to`. fmt(n) formats each frame. */
export function countUp(el, to, { from, ms = 700, fmt = n => Math.round(n).toLocaleString('en-US') } = {}) {
  if (!el) return;
  const start = from ?? (parseFloat(String(el.dataset.mv ?? el.textContent).replace(/[^0-9.-]/g, '')) || 0);
  el.dataset.mv = to;
  if (reduced() || start === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => { const u = Math.min(1, Math.max(0, (now - t0) / ms)); el.textContent = fmt(start + (to - start) * easeOut(u)); if (u < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/** Staggered rise-in as elements enter the viewport. */
export function reveal(els, { stagger = 60 } = {}) {
  styles();
  const list = [...(typeof els === 'string' ? document.querySelectorAll(els) : els)];
  if (reduced() || !('IntersectionObserver' in window)) { list.forEach(e => e.classList.add('m-rise', 'm-in')); return; }
  list.forEach(e => e.classList.add('m-rise'));
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const i = list.indexOf(en.target);
    setTimeout(() => en.target.classList.add('m-in'), (i % 8) * stagger);
    io.unobserve(en.target);
  }), { threshold: .08 });
  list.forEach(e => io.observe(e));
}

const once = (el, cls) => { if (!el || reduced()) return; styles(); el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
/** A ring of accent light around an element (e.g. a button that just fired). */
export const pulse = el => once(el, 'm-pulse');
/** A short shake (e.g. a city that was hit). */
export const shake = el => once(el, 'm-shake');
/** A fading highlight behind an element whose value changed. */
export const flash = el => once(el, 'm-flash');

function svgEl(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; }
function anim(ms, frame, done) {
  const t0 = performance.now();
  const step = now => { const u = Math.min(1, Math.max(0, (now - t0) / ms)); frame(u); if (u < 1) requestAnimationFrame(step); else done?.(); };
  requestAnimationFrame(step);
}

/** Expanding sonar/radar ring in an SVG at (x, y). */
export function ping(svg, x, y, { color = 'var(--accent)', r = 40, ms = 900, width = 2 } = {}) {
  if (!svg || reduced()) return;
  const c = svgEl('circle', { cx: x, cy: y, r: 1, fill: 'none', stroke: color, 'stroke-width': width, 'pointer-events': 'none' }, svg);
  anim(ms, u => { c.setAttribute('r', 1 + r * easeOut(u)); c.setAttribute('opacity', 1 - u); }, () => c.remove());
}

/** Burst of sparks in an SVG at (x, y): hits, kills, detonations. */
export function burst(svg, x, y, { color = 'var(--accent)', n = 12, r = 26, ms = 650 } = {}) {
  if (!svg || reduced()) return;
  const g = svgEl('g', { 'pointer-events': 'none' }, svg);
  const core = svgEl('circle', { cx: x, cy: y, r: 3, fill: color }, g);
  const sparks = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * .3, d = r * (.6 + Math.random() * .5);
    return { a, d, el: svgEl('line', { x1: x, y1: y, x2: x, y2: y, stroke: color, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g) };
  });
  anim(ms, u => {
    const e = easeOut(u);
    core.setAttribute('r', 3 + 9 * e); core.setAttribute('opacity', 1 - u);
    for (const s of sparks) {
      const r0 = s.d * e * .55, r1 = s.d * e;
      s.el.setAttribute('x1', x + Math.cos(s.a) * r0); s.el.setAttribute('y1', y + Math.sin(s.a) * r0);
      s.el.setAttribute('x2', x + Math.cos(s.a) * r1); s.el.setAttribute('y2', y + Math.sin(s.a) * r1);
      s.el.setAttribute('opacity', 1 - u);
    }
  }, () => g.remove());
}

/** A streak from (x1, y1) to (x2, y2): an interceptor, a strike, an order. Resolves when it arrives. */
export function tracer(svg, x1, y1, x2, y2, { color = 'var(--accent)', ms = 450, width = 2.2 } = {}) {
  if (!svg || reduced()) return Promise.resolve();
  return new Promise(res => {
    const l = svgEl('line', { x1, y1, x2: x1, y2: y1, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'pointer-events': 'none' }, svg);
    anim(ms, u => {
      const e = easeOut(u), tail = Math.max(0, e - .35);
      l.setAttribute('x1', x1 + (x2 - x1) * tail); l.setAttribute('y1', y1 + (y2 - y1) * tail);
      l.setAttribute('x2', x1 + (x2 - x1) * e); l.setAttribute('y2', y1 + (y2 - y1) * e);
    }, () => { l.remove(); res(); });
  });
}
