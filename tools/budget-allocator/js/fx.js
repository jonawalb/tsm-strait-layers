// Motion for the Budget Allocator on Interactive Deterrence (and localhost). TSM Interactive shares this tool and
// must stay exactly as it is, so every effect here is off unless ON is true. Nothing changes a number: values
// are set first, and the motion only shows how they arrive. Off under prefers-reduced-motion.
import { countUp, flash, pulse, burst, ping, tracer, reduced } from '../../../shared/js/motion.js';

export const ON = true; // Same motion on both sites (owner, 2026-09-30).
if (ON) document.documentElement.classList.add('ba-motion');
const rich = () => document.documentElement.dataset.skin === 'trailer';
const live = () => ON && !reduced();

export const press = el => { if (live()) pulse(el); };

const prevTiles = new Map();
/** Readout tiles: each number counts from its last value to the new one, and a tile that changed flashes. */
export function tiles(root) {
  root.querySelectorAll('.tile').forEach(t => {
    const key = t.querySelector('span')?.textContent, b = t.querySelector('b');
    const m = b && /^(-?[\d.]+)(.*)$/.exec(b.textContent);
    if (!m) return;
    const to = +m[1], dec = (m[1].split('.')[1] || '').length, post = m[2], from = prevTiles.get(key);
    prevTiles.set(key, to);
    if (!live() || from === undefined || from === to) return;
    countUp(b, to, { from, ms: 380, fmt: v => v.toFixed(dec) + post });
    flash(t);
  });
}

const prevW = new Map();
/** Layer bars grow or shrink from their last width instead of jumping. */
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

let lastVerdict = null;
/** The verdict box flashes when the verdict itself changes. */
export function verdict(el, text) {
  if (lastVerdict !== null && lastVerdict !== text && live()) { flash(el); if (rich()) pulse(el); }
  lastVerdict = text;
}

/** A ship in the crossing strip is hit: a short streak from the defended side, then a burst in the layer's colour. */
export function hit(layer, x, y, color, fromX) {
  if (!live() || !layer) return;
  const c = `var(${color})`;
  if (rich()) tracer(layer, fromX, y + (Math.random() - .5) * 30, x, y, { color: c, ms: 260, width: 1.6 }).then(() => burst(layer, x, y, { color: c, n: 12, r: 18 }));
  else burst(layer, x, y, { color: c, n: 8, r: 13, ms: 500 });
  if (rich()) ping(layer, x, y, { color: c, r: 22, ms: 700 });
}

/** Tween SVG band rectangles from their last geometry (x, width, opacity) to the new one. */
const prevBands = new Map();
export function bands(g) {
  const rects = [...g.querySelectorAll('rect[data-l]')];
  const now = rects.map(r => [r.dataset.l, { x: +r.getAttribute('x'), w: +r.getAttribute('width'), o: +r.getAttribute('fill-opacity') }]);
  if (live()) rects.forEach((r, i) => {
    const a = prevBands.get(now[i][0]), b = now[i][1];
    if (!a || (Math.abs(a.x - b.x) < .5 && Math.abs(a.o - b.o) < .005)) return;
    const t0 = performance.now(), ms = 320;
    const step = t => {
      if (!r.isConnected) return;
      const u = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - u, 3);
      r.setAttribute('x', (a.x + (b.x - a.x) * e).toFixed(1)); r.setAttribute('width', (a.w + (b.w - a.w) * e).toFixed(1));
      r.setAttribute('fill-opacity', (a.o + (b.o - a.o) * e).toFixed(3));
      if (u < 1) requestAnimationFrame(step);
    };
    r.setAttribute('x', a.x); r.setAttribute('width', a.w); r.setAttribute('fill-opacity', a.o);
    requestAnimationFrame(step);
  });
  prevBands.clear(); now.forEach(([k, v]) => prevBands.set(k, v));
}
