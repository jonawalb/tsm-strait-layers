// Figure 1 donut for one monthly tracker record (Philippines, March 2026 onward), adapted from TSM's house style.
// The ring shows both tiers, clockwise from 12 o'clock: contracted wedges (greens, orange where deliveries are under
// way), then notified-not-accepted wedges (greys). The hole gives the two tier totals separately, never one sum.
import { el } from '../../../shared/js/mapkit.js';
import { WEDGE, fmtHouse, wedgeName } from './mdata.js';

const TAU = Math.PI * 2;
const pt = (cx, cy, r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
const charW = (s, size, bold) => s.length * size * (bold ? 0.56 : 0.52);

function arc(cx, cy, r0, r1, a0, a1) {
  const big = a1 - a0 > Math.PI ? 1 : 0;
  if (a1 - a0 >= TAU - 1e-6) a1 = a0 + TAU - 1e-4;
  const [x0, y0] = pt(cx, cy, r1, a0), [x1, y1] = pt(cx, cy, r1, a1);
  const [x2, y2] = pt(cx, cy, r0, a1), [x3, y3] = pt(cx, cy, r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`;
}

function layout(narrow) {
  return narrow
    ? { W: 1000, H: 1100, cx: 500, cy: 680, R: 232, title: { x: 24, y0: 52, lh: 44, size: 36 }, lab: 23, val: 24, ctrB: 27, ctrV: 32, minTop: { left: 330, right: 330 }, wrap: true }
    : { W: 1980, H: 1194, cx: 989, cy: 610, R: 480, title: { x: 44, y0: 68, lh: 46, size: 28 }, lab: 21, val: 22, ctrB: 30, ctrV: 34, minTop: { left: 330, right: 24 }, wrap: false };
}

export function createDonut(svg, { onWedge }) {
  let month = null, active = null;
  const box = svg.parentElement;

  function draw() {
    if (!month) return;
    svg.textContent = '';
    const narrow = box.clientWidth < 560, L = layout(narrow);
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    const tot = month.wedges.reduce((s, w) => s + w.m, 0);

    const T = [['U.S. arms sales to the', true], [`Philippines, ${month.label}`, true],
      ['Contracted and notified-not-', false], ['accepted, by weapons category,', false], ['U.S. dollars', false]];
    const tg = el('g', { class: 'f1-title', 'aria-hidden': 'true' }, svg);
    T.forEach(([s, b], i) => el('text', { x: L.title.x, y: L.title.y0 + i * L.title.lh, 'font-size': L.title.size, 'font-weight': b ? 700 : 400 }, tg, s));

    let a = 0;
    const r1 = L.R, r0 = L.R * 0.62;
    const wg = el('g', { class: 'f1-wedges' }, svg);
    const labels = [];
    // Keep slivers visible: a wedge under 1.2% of the ring is drawn at 1.2% and the rest rescaled (labels carry true values).
    const fr = month.wedges.map(w => Math.max(w.m / tot, 0.012)), fs = fr.reduce((s, x) => s + x, 0);
    month.wedges.forEach((w, wi) => {
      const a0 = a, a1 = a + fr[wi] / fs * TAU;
      a = a1;
      const meta = WEDGE[w.id], n = w.keys.length;
      const on = active === w.id, dim = active && !on;
      const p = el('path', {
        d: arc(L.cx, L.cy, r0, r1, a0, a1), fill: meta.fill, class: `f1-w${on ? ' on' : ''}${dim ? ' dim' : ''}`,
        tabindex: 0, role: 'button', 'aria-pressed': String(on), 'data-w': w.id,
        'aria-label': `${wedgeName(w.id)}: ${fmtHouse(w.m)}, ${n} case${n === 1 ? '' : 's'}. ${on ? 'Showing these cases in the table; press to show all.' : 'Show these cases in the table.'}`,
      }, wg);
      el('title', {}, p, `${wedgeName(w.id)}: ${fmtHouse(w.m)} (${n} case${n === 1 ? '' : 's'})`);
      labels.push({ w, meta, mid: (a0 + a1) / 2, dim });
    });

    // Centre: the two tiers, separately.
    const cx = L.cx;
    el('text', { x: cx, y: L.cy - L.ctrV * 1.55, 'text-anchor': 'middle', 'font-size': L.ctrB, 'font-weight': 700, class: 'f1-ctr' }, svg, 'Contracted');
    el('text', { x: cx, y: L.cy - L.ctrV * 0.5, 'text-anchor': 'middle', 'font-size': L.ctrV, class: 'f1-ctr' }, svg, fmtHouse(month.tot.contracted));
    el('text', { x: cx, y: L.cy + L.ctrV * 0.95, 'text-anchor': 'middle', 'font-size': L.ctrB, 'font-weight': 700, class: 'f1-ctr' }, svg, 'Not accepted');
    el('text', { x: cx, y: L.cy + L.ctrV * 2.0, 'text-anchor': 'middle', 'font-size': L.ctrV, class: 'f1-ctr' }, svg, fmtHouse(month.tot.nna));

    placeLabels(L, labels);
    const lg = el('g', { class: 'f1-labels' }, svg);
    labels.forEach(lb => {
      const g = el('g', { class: `f1-lab${lb.dim ? ' dim' : ''}`, 'data-w': lb.w.id, 'aria-hidden': 'true' }, lg);
      lb.lines.forEach((s, i) => el('text', { x: lb.x, y: lb.top + (i + 1) * lb.lh - lb.lh * 0.22, 'text-anchor': lb.anchor, 'font-size': L.lab, 'font-weight': 700, fill: lb.meta.ink }, g, s));
      const vy = lb.top + (lb.lines.length + 1) * lb.lh - lb.lh * 0.22;
      el('text', { x: lb.x, y: vy, 'text-anchor': lb.anchor, 'font-size': L.val, fill: lb.meta.ink }, g, fmtHouse(lb.w.m));
      g.addEventListener('click', () => onWedge(lb.w.id));
    });

    wg.querySelectorAll('path').forEach(p => {
      p.addEventListener('click', () => onWedge(p.dataset.w));
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWedge(p.dataset.w); } });
    });
  }

  // Outside labels: start at the wedge's mid-angle, keep clear of the ring, the title and each other.
  function placeLabels(L, labels) {
    const gap = L.R * 0.08, rr = L.R + gap;
    labels.forEach(lb => {
      const lines = L.wrap ? lb.meta.lines.flatMap(s => s.split(', ').map((x, i, arr) => i < arr.length - 1 ? x + ',' : x)).filter(Boolean) : lb.meta.lines;
      lb.lines = lines;
      lb.lh = L.lab * 1.62;
      lb.h = (lines.length + 1) * lb.lh;
      lb.wd = Math.max(...lines.map(s => charW(s, L.lab, true)), charW(fmtHouse(lb.w.m), L.val, false));
      lb.side = Math.sin(lb.mid) >= 0 ? 'right' : 'left';
      const [, y] = pt(L.cx, L.cy, rr + lb.h * 0.25, lb.mid);
      lb.top = y - lb.h / 2;
    });
    ['left', 'right'].forEach(side => {
      const grp = labels.filter(l => l.side === side).sort((a, b) => a.top - b.top);
      const min = L.minTop[side], max = L.H - 16;
      grp.forEach((l, i) => { l.top = Math.max(l.top, min, i ? grp[i - 1].top + grp[i - 1].h + 6 : 0); });
      for (let i = grp.length - 1; i >= 0; i--) {
        const lim = i === grp.length - 1 ? max : grp[i + 1].top - 6;
        if (grp[i].top + grp[i].h > lim) grp[i].top = lim - grp[i].h;
      }
      grp.forEach(lb => {
        const y0 = lb.top, y1 = lb.top + lb.h;
        const dy = y1 < L.cy ? L.cy - y1 : y0 > L.cy ? y0 - L.cy : 0;
        const dx = Math.sqrt(Math.max(0, rr * rr - dy * dy));
        if (side === 'right') { lb.anchor = 'start'; lb.x = Math.min(L.cx + dx, L.W - 14 - lb.wd); }
        else { lb.anchor = 'end'; lb.x = Math.max(L.cx - dx, 14 + lb.wd); }
      });
    });
  }

  new ResizeObserver(draw).observe(box);
  return {
    set(m, w) { month = m; active = w; draw(); },
    focusWedge(id) { const p = svg.querySelector(`path[data-w="${id}"]`); if (p) p.focus(); },
  };
}
