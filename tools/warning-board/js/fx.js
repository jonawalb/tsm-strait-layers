// Motion for this tool on Interactive Deterrence (and local previews) only. On TSM Interactive every export
// below is a pass-through: charts draw exactly as before and nothing animates.
//   chart(svg, key, draw)  draws via draw(); the first time the chart is seen its marks draw in (lines stroke in,
//                          bars grow, areas fade up); when `key` changes the marks glide from old to new positions.
//   count(root, sel)       numbers in root's matching leaf elements count up to their value; changed ones flash.
//   stagger(root, sel)     first render only: matching cards/rows rise in with a stagger.
//   changed(el)            flash el when its text differs from the last call.
// Motion never changes a number (every animation ends on the exact text/attribute the tool drew) and is off under
// prefers-reduced-motion.
import { reveal, flash, reduced } from '../../../shared/js/motion.js';

export const ON = true; // Same motion on both sites (owner, 2026-09-30).
const live = () => ON && !reduced();
const easeOut = u => 1 - Math.pow(1 - u, 3);
const MAX_ELS = 1400;
const ATTRS = { rect: ['x', 'y', 'width', 'height'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'], text: ['x', 'y'], path: ['d'], polyline: ['points'], polygon: ['points'] };
const TAGS = Object.keys(ATTRS).join(',');
const SKIP = 'defs, clipPath, mask, pattern, marker, symbol';
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

// ---- charts -------------------------------------------------------------------------------------------------
const gkey = n => `${n.tagName}.${n.getAttribute('class') || ''}|${n.parentNode?.getAttribute?.('class') || ''}`;
const marks = svg => [...svg.querySelectorAll(TAGS)].filter(n => !n.closest(SKIP));

function snapshot(svg) {
  const m = new Map();
  for (const n of marks(svg)) {
    const k = gkey(n);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(ATTRS[n.tagName].map(a => n.getAttribute(a)));
  }
  return m;
}

/** Interpolator between two attribute strings with the same shape, or null. */
function lerpStr(a, b) {
  if (a == null || b == null || a === b) return null;
  if (/[Aa]/.test(b)) return null;                                          // arc flags are 0/1: never tween them
  const na = a.match(NUM), nb = b.match(NUM);
  if (!na || !nb || na.length !== nb.length || na.length > 4000) return null;
  if (a.replace(NUM, '#') !== b.replace(NUM, '#')) return null;
  const fa = na.map(Number), fb = nb.map(Number), parts = b.split(NUM);
  return u => { let s = parts[0]; for (let i = 0; i < fb.length; i++) s += +(fa[i] + (fb[i] - fa[i]) * u).toFixed(2) + parts[i + 1]; return s; };
}

function fadeIn(n, opt) {
  const to = getComputedStyle(n).opacity;
  n.animate([{ opacity: 0 }, { opacity: to }], { easing: 'ease-out', fill: 'backwards', ...opt });
}

function morph(svg, snap) {
  const jobs = [];
  const now = new Map();
  for (const n of marks(svg)) { const k = gkey(n); if (!now.has(k)) now.set(k, []); now.get(k).push(n); }
  let count = 0;
  for (const [k, list] of now) {
    const old = snap.get(k) || [];
    list.forEach((n, i) => {
      if (++count > MAX_ELS) return;
      const o = old[i];
      if (!o) { fadeIn(n, { duration: 320 }); return; }
      ATTRS[n.tagName].forEach((a, j) => {
        const to = n.getAttribute(a), f = lerpStr(o[j], to);
        if (!f) return;
        const first = f(0); n.setAttribute(a, first);
        jobs.push({ n, a, f, to, last: first });
      });
    });
  }
  if (!jobs.length) return;
  const t0 = performance.now(), ms = 420;
  const step = t => {
    const u = Math.max(0, Math.min(1, (t - t0) / ms)), e = easeOut(u);
    for (const j of jobs) {
      if (j.dead) continue;
      // Stop if the node left the page or the tool changed this attribute itself.
      if (!j.n.isConnected || j.n.getAttribute(j.a) !== j.last) { j.dead = true; continue; }
      j.last = u < 1 ? j.f(e) : j.to;
      j.n.setAttribute(j.a, j.last);
    }
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function drawIn(svg) {
  const els = marks(svg);
  if (!els.length) return;
  if (els.length > MAX_ELS) { svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' }); return; }
  const vb = svg.viewBox?.baseVal;
  const W = (vb && vb.width) || svg.clientWidth || 1, H = (vb && vb.height) || svg.clientHeight || 1, X0 = (vb && vb.x) || 0;
  for (const n of els) {
    let bb; try { bb = n.getBBox(); } catch { continue; }
    const tag = n.tagName, cs = getComputedStyle(n);
    if (cs.display === 'none') continue;
    const opt = { duration: 520, delay: Math.max(0, Math.min(1, (bb.x - X0) / W)) * 220, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' };
    const own = n.hasAttribute('transform') || cs.transform !== 'none';
    if ((tag === 'line' || tag === 'polyline' || (tag === 'path' && cs.fill === 'none')) && cs.stroke !== 'none' && !/\d/.test(cs.strokeDasharray)) {
      let L = 0; try { L = n.getTotalLength(); } catch { /* not measurable */ }
      if (L > 0 && L < 2e5) {
        n.animate([{ strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 }],
          { ...opt, duration: 680, delay: tag === 'line' ? opt.delay : 0 });
        continue;
      }
    }
    if (!own && tag === 'rect' && bb.height > 0 && bb.height < H * 0.6 && bb.width < W * 0.5) {
      n.style.transformBox = 'fill-box'; n.style.transformOrigin = '50% 100%';
      n.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], opt);
      continue;
    }
    if (!own && (tag === 'circle' || tag === 'ellipse')) {
      n.style.transformBox = 'fill-box'; n.style.transformOrigin = '50% 50%';
      n.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: cs.opacity }], { ...opt, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      continue;
    }
    fadeIn(n, opt);
  }
}

function firstView(svg, state) {
  const go = () => { state.pending = false; if (live()) drawIn(svg); };
  if (!('IntersectionObserver' in window)) { go(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { threshold: 0.15 });
  io.observe(svg);
}

/** Draw a chart through `draw()` and animate it (see header). Returns draw()'s result. */
export function chart(svg, key, draw) {
  const prev = svg?.__fx;
  const snap = svg && prev && !prev.pending && prev.key !== key && live() ? snapshot(svg) : null;
  const out = draw ? draw() : undefined;
  if (!ON || !svg) return out;
  if (!prev) { svg.__fx = { key, pending: true }; firstView(svg, svg.__fx); }
  else if (prev.key !== key) { prev.key = key; if (snap) morph(svg, snap); }
  return out;
}

// ---- numbers ------------------------------------------------------------------------------------------------
const LEAF = /^([^\d]*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?([^\d]*)$/;
const memo = new WeakMap();

/** Count numbers up in root's matching leaf elements; flash the ones that changed since the last call. */
export function count(root, sel) {
  if (!ON || !root) return;
  const old = memo.get(root), now = new Map();
  [...root.querySelectorAll(sel)].filter(e => !e.children.length).forEach((e, i) => {
    const t = e.textContent, m = t.trim().match(LEAF);
    if (!m) return;
    const [, pre, int, dec = '', suf] = m;
    if (!dec && !int.includes(',') && /^(1[89]|20)\d\d$/.test(int)) return;   // a year
    if (/[:/]/.test(pre + suf)) return;                                        // a time or date
    const v = parseFloat(int.replace(/,/g, '') + dec), k = pre + '|' + suf;
    now.set(i, { k, v });
    const o = old?.get(i);
    if (old && o && o.k === k && o.v === v) return;
    if (old) flash(e);
    if (old && (!o || o.k !== k)) return;                                     // changed shape: flash only
    const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0], places = dec ? dec.length - 1 : 0, comma = int.includes(',');
    const fmt = n => lead + pre + (comma ? n.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }) : n.toFixed(places)) + suf + trail;
    if (fmt(v) !== t || !live()) return;                                      // only animate what we can end on exactly
    tick(e, o ? o.v : 0, v, fmt, t);
  });
  memo.set(root, now);
}

function tick(e, from, to, fmt, final) {
  const t0 = performance.now(), ms = 600;
  let last = fmt(from); e.textContent = last;
  const step = t => {
    if (!e.isConnected || e.textContent !== last) return;                    // the tool rewrote it: leave it alone
    const u = Math.max(0, Math.min(1, (t - t0) / ms));
    last = u < 1 ? fmt(from + (to - from) * easeOut(u)) : final;
    e.textContent = last;
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---- cards and rows -----------------------------------------------------------------------------------------
/** First call per root only: rise the matching elements in with a stagger. */
export function stagger(root, sel) {
  if (!ON || !root || root.__fxR) return;
  root.__fxR = true;
  reveal(root.querySelectorAll(sel), { stagger: 45 });
}

/** Flash el if its text changed since the last call. */
export function changed(el) {
  if (!ON || !el) return;
  const t = el.textContent;
  if (el.__fxT !== undefined && el.__fxT !== t) flash(el);
  el.__fxT = t;
}
