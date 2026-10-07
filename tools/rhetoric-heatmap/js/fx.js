// Motion for this tool. Presentation only: every animation ends on exactly what the tool rendered, nothing is
// hidden or delayed, and it is all off under reduced motion and while the window is being resized.
import { reduced, flash } from '../../../shared/js/motion.js';

const EASE = 'cubic-bezier(.2,.8,.2,1)';
let hold = 0;
addEventListener('resize', () => { hold = performance.now() + 700; });
export const live = () => !reduced() && performance.now() > hold && typeof Element.prototype.animate === 'function';

function anim(el, kf, o) { try { return el.animate(kf, { easing: EASE, fill: 'backwards', ...o }); } catch { return null; } }
// End on each element's own opacity so styled translucency (e.g. opacity .6) never snaps.
const op = el => getComputedStyle(el).opacity || '1';
const list = x => !x ? [] : typeof x === 'string' ? [...document.querySelectorAll(x)] : x instanceof Element ? [x] : [...x];

// Charts draw in the first time they scroll into view, then transition quickly on each later redraw.
// Redraws that come faster than `gap` ms apart (slider drags, key repeat) are left still.
const seen = new WeakSet(), last = new WeakMap();
export function chart(host, fn, { gap = 260 } = {}) {
  if (!host || !live()) return;
  const now = performance.now(), prev = last.get(host) || 0;
  last.set(host, now);
  if (!seen.has(host)) {
    seen.add(host);
    if (!('IntersectionObserver' in window)) { fn(true); return; }
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      if (live()) fn(true);
    }, { threshold: 0.15 });
    io.observe(host);
    return;
  }
  if (now - prev < gap) return;
  fn(false);
}

/** Bars grow from their baseline. axis 'y' grows upward (origin bottom), 'x' grows rightward (origin left). */
// stack: true scales every segment of a stacked SVG bar chart about the shared baseline, so stacks rise whole.
// baseY: scale about that y (view-box units) instead, e.g. the zero line of a chart with bars above and below it.
export function grow(nodes, { first = true, axis = 'y', origin, ms, stagger, stack = false, baseY = null } = {}) {
  const els = list(nodes);
  if (!els.length) return;
  const dur = ms ?? (first ? 560 : 340), spread = stagger ?? (first ? 240 : 90);
  let org = origin || (axis === 'y' ? '50% 100%' : '0% 50%');
  if (stack || baseY != null) {
    const base = baseY ?? Math.max(...els.map(e => +e.getAttribute('y') + +e.getAttribute('height')));
    els.forEach((el, i) => {
      el.style.transformBox = 'view-box'; el.style.transformOrigin = `0px ${base}px`;
      const x = +el.getAttribute('x') || 0;
      anim(el, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: dur, delay: (x / (els[els.length - 1].getAttribute('x') || 1)) * spread });
    });
    return;
  }
  const from = axis === 'y' ? 'scaleY(0)' : 'scaleX(0)';
  // Many bars: grow their shared group once instead of animating thousands of nodes.
  const parent = els[0].parentNode;
  if (els.length > 300 && parent && !parent.getAttribute?.('transform') && els.every(e => e.parentNode === parent)) {
    parent.style.transformBox = 'fill-box'; parent.style.transformOrigin = org;
    anim(parent, [{ transform: from }, { transform: 'none' }], { duration: dur });
    return;
  }
  els.forEach((el, i) => {
    const delay = els.length > 1 ? (i / (els.length - 1)) * spread : 0;
    if (el.getAttribute('transform')) { anim(el, [{ opacity: 0 }, { opacity: op(el) }], { duration: dur, delay }); return; }
    el.style.transformBox = 'fill-box'; el.style.transformOrigin = org;
    anim(el, [{ transform: from }, { transform: 'none' }], { duration: dur, delay });
  });
}

/** Lines stroke in from their start. Dashed lines fade in instead, so their dash pattern is never lost. */
export function stroke(nodes, { first = true, ms, delay = 0 } = {}) {
  const dur = ms ?? (first ? 700 : 420);
  list(nodes).forEach(p => {
    let len = 0;
    try { len = p.getTotalLength(); } catch { len = 0; }
    const dash = getComputedStyle(p).strokeDasharray;
    if (!len || (dash && dash !== 'none')) { anim(p, [{ opacity: 0 }, { opacity: op(p) }], { duration: dur * 0.7, delay }); return; }
    // fill 'backwards' holds the undrawn state through the delay and lets go at the end: nothing outlives it.
    anim(p, [{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }], { duration: dur, delay });
  });
}

/** Fade (and optionally lift) elements in, with a short stagger capped so the last one lands inside ~700 ms. */
export function fade(nodes, { first = true, ms, delay = 0, lift = 0, stagger = 22, max = 60 } = {}) {
  const els = list(nodes), dur = ms ?? (first ? 420 : 260);
  const step = els.length > 1 ? Math.min(stagger, 280 / (Math.min(els.length, max) - 1 || 1)) : 0;
  els.slice(0, max).forEach((el, i) => anim(el, lift
    ? [{ opacity: 0, transform: `translateY(${lift}px)` }, { opacity: op(el), transform: 'none' }]
    : [{ opacity: 0 }, { opacity: op(el) }], { duration: dur, delay: delay + i * step }));
  if (els.length > max) els.slice(max).forEach(el => anim(el, [{ opacity: 0 }, { opacity: op(el) }], { duration: dur, delay: delay + 280 }));
}

/** HTML rows or cards rising in with a stagger. */
export const rise = (nodes, o = {}) => fade(nodes, { lift: 6, ...o });

// Numbers: the first number in an element's text counts from its previous value to the new one, and the
// element flashes when the value changed. The last frame writes back the exact text the tool rendered.
const NUM = /-?\d[\d,]*(?:\.\d+)?/;
const prevs = new Map(), toks = new WeakMap();
function firstNumberNode(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (NUM.test(n.nodeValue)) return n;
  return null;
}
export function count(el, key, { ms = 600, flashOn = true, still = false } = {}) {
  if (!el) return;
  key = key ?? el.id;
  const node = firstNumberNode(el);
  if (!node) { prevs.delete(key); return; }
  const text = node.nodeValue, m = text.match(NUM), raw = m[0];
  const to = parseFloat(raw.replace(/,/g, ''));
  const pre = text.slice(0, m.index), post = text.slice(m.index + raw.length);
  const p = prevs.get(key), had = !!p;
  prevs.set(key, { v: to, ctx: pre + '|' + post });
  if (still || !live() || !Number.isFinite(to) || (had && p.v === to)) return;
  if (had && flashOn && el instanceof HTMLElement) flash(el);
  // Count only between values in the same unit and wording (never from "850 m" to "1.2 bn").
  if (had && p.ctx !== pre + '|' + post) return;
  const from = had ? p.v : 0;
  const dec = raw.includes('.') ? raw.split('.')[1].length : 0, commas = raw.includes(',');
  const f = v => commas ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
  const t0 = performance.now(), tok = {};
  toks.set(node, tok);
  const step = now => {
    if (toks.get(node) !== tok || !node.isConnected) return;
    const u = Math.max(0, Math.min(1, (now - t0) / ms)), e = 1 - Math.pow(1 - u, 3);
    node.nodeValue = u < 1 ? pre + f(from + (to - from) * e) + post : text;
    if (u < 1) requestAnimationFrame(step);
  };
  node.nodeValue = pre + f(from) + post;
  requestAnimationFrame(step);
}

/** Flash an element when its text differs from the last time this key was seen. */
const texts = new Map();
export function flashIfChanged(el, key) {
  if (!el) return;
  key = key ?? el.id;
  const t = el.textContent, had = texts.has(key), changed = had && texts.get(key) !== t;
  texts.set(key, t);
  if (changed && live()) flash(el);
}

/** Run fn only when `key` differs from the previous call's key under `slot` (e.g. a new selection). */
const keys = new Map();
export function onChange(slot, key, fn) {
  const had = keys.has(slot), changed = keys.get(slot) !== key;
  keys.set(slot, key);
  if (changed && live()) fn(!had);
}

/** Marks pop in from their centre (dots, symbols), spread across `spread` ms in document order. */
export function pop(nodes, { first = true, ms, delay = 0, spread } = {}) {
  const els = list(nodes), dur = ms ?? (first ? 380 : 260), sp = spread ?? (first ? 320 : 140);
  els.forEach((el, i) => {
    const d = delay + (els.length > 1 ? (i / (els.length - 1)) * sp : 0);
    const o = op(el);
    if (el.getAttribute('transform')) { anim(el, [{ opacity: 0 }, { opacity: o }], { duration: dur, delay: d }); return; }
    el.style.transformBox = 'fill-box'; el.style.transformOrigin = '50% 50%';
    anim(el, [{ opacity: 0, transform: 'scale(0)' }, { opacity: o, transform: 'scale(1.25)', offset: 0.7 }, { opacity: o, transform: 'none' }], { duration: dur, delay: d });
  });
}

/** Left-to-right reveal of a whole element (a heatmap's cell group, a bar track), with a light fade. */
export function wipe(nodes, { first = true, ms } = {}) {
  const dur = ms ?? (first ? 650 : 380);
  list(nodes).forEach(el => anim(el, [{ clipPath: 'inset(0 100% 0 0)', opacity: 0.2 }, { clipPath: 'inset(0 0% 0 0)', opacity: op(el) }], { duration: dur, easing: 'cubic-bezier(.45,.05,.25,1)' }));
}

/** Expanding ring in an SVG at (x, y), e.g. on a newly selected mark or cell. (Like motion.js ping, but its
 *  progress is clamped at 0: a rAF timestamp can be earlier than the start time, which gave ping a negative r.) */
export function ring(svg, x, y, { color, r = 24, ms = 650, width = 2 } = {}) {
  if (!svg || !live()) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const col = color || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || 'currentColor';
  Object.entries({ cx: x, cy: y, r: 1, fill: 'none', stroke: col, 'stroke-width': width, 'pointer-events': 'none' }).forEach(([k, v]) => c.setAttribute(k, v));
  svg.appendChild(c);
  const t0 = performance.now();
  const step = now => {
    const u = Math.max(0, Math.min(1, (now - t0) / ms));
    c.setAttribute('r', (1 + r * (1 - Math.pow(1 - u, 3))).toFixed(2)); c.setAttribute('opacity', (1 - u).toFixed(3));
    if (u < 1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}
