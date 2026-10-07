// Motion for the Budget Allocator. Nothing changes a number: values are set first, and the motion only shows
// how they arrive. Off under prefers-reduced-motion.
import { pulse, reduced } from '../../../shared/js/motion.js';

export const ON = true; // Same motion on both sites (owner, 2026-09-30).
if (ON) document.documentElement.classList.add('ba-motion');
const live = () => ON && !reduced();

export const press = el => { if (live()) pulse(el); };

const prevW = new Map();
/** Bars grow or shrink from their last width instead of jumping. */
export function widths(root, sel, keyOf) {
  const els = [...root.querySelectorAll(sel)];
  const next = els.map(e => [keyOf(e), e.style.width]);
  if (live()) els.forEach((e, i) => {
    const was = prevW.get(next[i][0]);
    if (was === undefined || was === next[i][1]) return;
    e.style.transition = 'none'; e.style.width = was;
    requestAnimationFrame(() => { e.style.transition = 'width .35s cubic-bezier(.2,.8,.2,1)'; e.style.width = next[i][1]; });
  });
  next.forEach(([k, w]) => prevW.set(k, w));
}
