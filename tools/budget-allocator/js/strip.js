// Stylized approach: the attacking force moves from its start line (left) to the defended coast or line (right)
// through the defender's layers. For Taiwan: a PLA wave crossing from the embarkation coast to Taiwan.
import { el } from '../../../shared/js/mapkit.js';
import { ctx } from './ctx.js';
import { hit as fxHit, bands as fxBands, ON as MOTION } from './fx.js';

const W = 1000, H = 250, X0 = 120, X1 = 900, N = 36;
const CROSSING = { get km() { return ctx.geo.km; } };
const kmToX = km => X1 - (km / CROSSING.km) * (X1 - X0);   // km measured from the defended coast or line
const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];
const tickStep = km => STEPS.find(s => s >= km / 4) || 1000;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createStrip(svg, onClock) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let bands, shooters, fleet, fx, ships = [], raf = null, res = null, key = '', shown = null;

  // Background, labels and distance scale depend on the country and the approach length.
  function frame() {
    const P = ctx.P, land = P.strip.land;
    key = P.k + ':' + CROSSING.km;
    svg.innerHTML = '';
    svg.classList.toggle('land', !!land);
    el('rect', { x: 0, y: 0, width: W, height: H, class: land ? 'st-land-bg' : 'st-sea' }, svg);
    bands = el('g', {}, svg);
    el('path', { d: `M0 0H${X0 - 18}C${X0 - 8} 60 ${X0 - 26} 140 ${X0 - 12} ${H}H0Z`, class: land ? 'st-edge' : 'st-land' }, svg);
    el('path', { d: `M${W} 0H${X1 + 20}C${X1 + 8} 70 ${X1 + 26} 150 ${X1 + 14} ${H}H${W}Z`, class: land ? 'st-edge' : 'st-land' }, svg);
    el('text', { x: 14, y: 22, class: 'st-lbl' }, svg, P.strip.left);
    el('text', { x: W - 14, y: 22, class: 'st-lbl', 'text-anchor': 'end' }, svg, P.strip.right);
    const scale = el('g', { class: 'st-scale' }, svg), step = tickStep(CROSSING.km);
    for (let k = 0; k <= CROSSING.km; k += step) { const x = kmToX(k); el('line', { x1: x, x2: x, y1: H - 16, y2: H - 10 }, scale); el('text', { x, y: H - 1, 'text-anchor': 'middle' }, scale, k ? `${k} km` : P.strip.zero); }
    shooters = el('g', {}, svg);
    fleet = el('g', {}, svg);
    fx = MOTION ? el('g', { 'pointer-events': 'none', 'aria-hidden': 'true' }, svg) : null;
    svg.setAttribute('aria-label', P.strip.aria);
  }

  function drawBands(r) {
    bands.innerHTML = '';
    const act = r.layers.filter(l => l.reach > 0).sort((a, b) => b.reach - a.reach);
    const rowH = 150 / act.length;
    const legend = document.getElementById('strip-legend');
    if (legend) legend.innerHTML = act.map(l => `<li${l.active ? '' : ' class="off"'}><i style="background:var(${l.col})"></i>${l.t}${l.active ? '' : ' (too weak to count)'}</li>`).join('');
    act.forEach((l, i) => {
      const x = Math.max(0, kmToX(Math.min(l.reach, CROSSING.km + 40)));
      const y = 34 + i * rowH;
      el('rect', { x, y, width: X1 + 16 - x, height: rowH - 3, fill: `var(${l.col})`, 'fill-opacity': (0.08 + 0.5 * l.st).toFixed(2), class: 'st-band' + (l.active ? '' : ' off'), ...(MOTION ? { 'data-l': l.t } : {}) }, bands);
      const narrow = X1 - x < 200;
      el('text', { x: narrow ? x - 6 : Math.max(x, X0) + 6, y: y + rowH / 2 + 4, class: 'st-band-t', 'text-anchor': narrow ? 'end' : 'start' }, bands, `${l.t}${l.active ? '' : ' (too weak to count)'}`);
    });
    if (MOTION) fxBands(bands);
  }

  function drawShooters(r) {
    shooters.innerHTML = '';
    const n = 10, alive = Math.round(r.surv.mobile * n);
    for (let i = 0; i < n; i++) {
      const y = 40 + i * 16, x = X1 + 40 + (i % 2) * 14;
      el('path', { d: `M${x} ${y - 5}l6 10h-12z`, class: 'st-launcher' + (i < alive ? '' : ' dead') }, shooters);
    }
    const pn = 3, palive = Math.round(r.surv.platform * pn);
    for (let i = 0; i < pn; i++) {
      const y = 205, x = X1 + 36 + i * 20;
      el('rect', { x: x - 7, y: y - 4, width: 14, height: 8, rx: 2, class: 'st-plat' + (i < palive ? '' : ' dead') }, shooters);
    }
  }

  function plan(r) {
    const R = rng(11);
    const hitters = r.layers.filter(l => l.p > 0);
    const psum = hitters.reduce((a, l) => a + l.p, 0);
    // Hit exactly the modelled share of the fleet (rounded), so the ship count matches "force engaged".
    const order = Array.from({ length: N }, (_, i) => [R(), i]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const hitSet = new Set(psum > 0 ? order.slice(0, Math.round(r.engaged * N)) : []);
    return Array.from({ length: N }, (_, i) => {
      const row = i % 6, col = Math.floor(i / 6);
      const s = { y: 44 + row * 27 + (col % 2) * 8, off: col * 15, hitAt: null, by: null };
      s.start = X0 - 60 - s.off; s.end = X1 - 12 - col * 5;
      if (hitSet.has(i)) {
        let u = R() * psum, pick = hitters[0];
        for (const l of hitters) { if ((u -= l.p) <= 0) { pick = l; break; } }
        const reach = Math.min(pick.reach, CROSSING.km);
        s.hitAt = Math.min(s.end - 2, kmToX(R() * reach * 0.95)); s.by = pick;
      }
      return s;
    });
  }

  function place(t) {
    // t: 0..1 of the crossing
    fleet.innerHTML = '';
    let hit = 0;
    ships.forEach(s => {
      const x = s.start + t * (s.end - s.start);
      const stopped = s.hitAt != null && x >= s.hitAt;
      const px = stopped ? s.hitAt : x;
      if (stopped) hit++;
      if (MOTION && stopped && shown && !shown.has(s)) { shown.add(s); fxHit(fx, px, s.y, s.by.col, X1 + 30); }
      if (px < X0 - 20) return;
      el('path', { d: ctx.P.strip.vehicle ? `M${px - 9} ${s.y - 4}h16v8h-16z` : `M${px - 9} ${s.y - 3}h14l4 3l-4 3h-14z`, class: 'st-ship' + (stopped ? ' hit' : '') }, fleet);
      if (stopped) el('path', { d: `M${px - 5} ${s.y - 6}l8 12M${px + 3} ${s.y - 6}l-8 12`, class: 'st-x', stroke: `var(${s.by.col})` }, fleet);
    });
    onClock && onClock(t, hit, N);
  }

  function set(r) { res = r; stop(); if (key !== ctx.P.k + ':' + CROSSING.km) frame(); drawBands(r); drawShooters(r); ships = plan(r); place(1); }

  function play() {
    stop();
    if (reduced()) { place(1); return; }
    const t0 = performance.now(), dur = 7000;
    shown = new Set();
    const step = now => { const t = Math.min(1, (now - t0) / dur); place(t); if (t < 1) raf = requestAnimationFrame(step); else { raf = null; shown = null; } };
    raf = requestAnimationFrame(step);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; shown = null; }
  return { set, play, stop, playing: () => !!raf, get res() { return res; } };
}
