// Bars sized by an inline style width (HTML bars, not SVG). Companion to fx.js, same rules: the first time a root
// is seen its bars grow in from zero; after that a bar whose width changed glides from its old width and a new bar
// grows in. Animations run through the Web Animations API with no fill, so every bar settles on exactly the width
// the tool wrote.
// Off under prefers-reduced-motion.
import { reduced } from '../../../shared/js/motion.js';
import { ON } from './fx.js';

const memo = new WeakMap();
const EASE = 'cubic-bezier(.2,.8,.2,1)';

/** Animate root's matching bars. keyOf(el, i) pairs a bar with its previous version (default: its index). */
export function widths(root, sel, keyOf = (e, i) => i) {
  if (!ON || !root) return;
  const els = [...root.querySelectorAll(sel)];
  const old = memo.get(root), now = new Map();
  els.forEach((e, i) => now.set(keyOf(e, i), e.style.width));
  memo.set(root, now);
  if (reduced()) return;
  if (!old) { growOnView(root, sel); return; }
  els.forEach((e, i) => {
    const w = e.style.width, o = old.get(keyOf(e, i));
    if (!w || o === w) return;
    e.animate([{ width: o ?? '0%' }, { width: w }], { duration: o == null ? 520 : 420, easing: EASE });  // new bars grow in
  });
}

function growOnView(root, sel) {
  const go = () => root.querySelectorAll(sel).forEach((e, i) => {
    if (!e.style.width) return;
    e.animate([{ width: '0%' }, { width: e.style.width }], { duration: 600, delay: Math.min(8, i) * 30, easing: EASE, fill: 'backwards' });
  });
  if (!('IntersectionObserver' in window)) { go(); return; }
  const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); go(); } }, { threshold: 0.1 });
  io.observe(root);
}
