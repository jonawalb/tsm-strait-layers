// Figure 1 donut for one month (Cato's or TSM's data), in TSM's current house style (make_fig1.py, February 2026 onward):
// six-line title, wedges clockwise Traditional, Traditional in progress, Munition, [Munition in progress],
// Asymmetric, Asymmetric in progress, with the Traditional block ending at 3 o'clock; labels outside the
// ring; total in the hole. Drawn as SVG so each wedge can be focused and clicked.
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

/** Geometry for the two layouts: TSM's 1980 x 1194 canvas, or a taller one for phones. */
function layout(narrow) {
  return narrow
    ? { W: 1000, H: 1060, cx: 500, cy: 650, R: 232, title: { x: 24, y0: 52, lh: 44, size: 36 }, lab: 23, val: 24, ctrB: 30, ctrV: 34, minTop: { left: 330, right: 330 }, wrap: true }
    : { W: 1980, H: 1194, cx: 989, cy: 596, R: 504, title: { x: 44, y0: 68, lh: 46, size: 28 }, lab: 21, val: 22, ctrB: 34.65, ctrV: 36.5, minTop: { left: 320, right: 24 }, wrap: false };
}

export function createDonut(svg, { onWedge }) {
  let month = null, active = null, notes = [];
  const box = svg.parentElement;

  function draw() {
    if (!month) return;
    svg.textContent = '';
    const narrow = box.clientWidth < 560, L = layout(narrow);
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    const tot = month.total;

    // Title block (left aligned, PT Serif), as in make_fig1.py
    const T = [['U.S. arms sale backlog to', true], [`Taiwan, ${month.label}`, true],
      ['Arms sales backlog by', false], ['weapons category, billions of', false], ['U.S. dollars', false]];
    const tg = el('g', { class: 'f1-title', 'aria-hidden': 'true' }, svg);
    T.forEach(([s, b], i) => el('text', { x: L.title.x, y: L.title.y0 + i * L.title.lh, 'font-size': L.title.size, 'font-weight': b ? 700 : 400 }, tg, s));

    // Wedges
    const trad = month.wedges.filter(w => w.id === 'trad' || w.id === 'trad_ip').reduce((s, w) => s + w.m, 0);
    let a = TAU / 4 - trad / tot * TAU;
    const r1 = L.R, r0 = L.R * 0.605;
    const wg = el('g', { class: 'f1-wedges' }, svg);
    const labels = [];
    month.wedges.forEach(w => {
      const a0 = a, a1 = a + w.m / tot * TAU;
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

    // Centre
    el('text', { x: L.cx - 11 * L.W / 1980, y: L.cy - 12, 'text-anchor': 'middle', 'font-size': L.ctrB, 'font-weight': 700, class: 'f1-ctr' }, svg, 'Total Backlog');
    el('text', { x: L.cx - 11 * L.W / 1980, y: L.cy + L.ctrV + 4, 'text-anchor': 'middle', 'font-size': L.ctrV, class: 'f1-ctr' }, svg, fmtHouse(tot));

    placeLabels(L, labels);
    const lg = el('g', { class: 'f1-labels' }, svg);
    labels.forEach(lb => {
      const g = el('g', { class: `f1-lab${lb.dim ? ' dim' : ''}`, 'data-w': lb.w.id, 'aria-hidden': 'true' }, lg);
      lb.lines.forEach((s, i) => el('text', { x: lb.x, y: lb.top + (i + 1) * lb.lh - lb.lh * 0.22, 'text-anchor': lb.anchor, 'font-size': L.lab, 'font-weight': 700, fill: lb.meta.ink }, g, s));
      const vy = lb.top + (lb.lines.length + 1) * lb.lh - lb.lh * 0.22;
      const t = el('text', { x: lb.x, y: vy, 'text-anchor': lb.anchor, 'font-size': L.val, fill: lb.meta.ink }, g, fmtHouse(lb.w.m));
      const fn = notes.find(n => n.at.wedge === lb.w.id);
      if (fn) {
        const a = el('a', { href: `#mvn-${fn.n}`, class: 'f1-fn' }, g);
        el('text', { x: lb.anchor === 'end' ? lb.x + 4 : lb.x + charW(fmtHouse(lb.w.m), L.val, false) + 6, y: vy - L.val * 0.45, 'font-size': L.val * 0.7, fill: lb.meta.ink }, a, String(fn.n));
        el('title', {}, a, `Note ${fn.n}: ${month.pub} printed a different value`);
      }
      g.addEventListener('click', e => { if (!e.target.closest('a')) onWedge(lb.w.id); });  // the note number only jumps to its note
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
      const lines = L.wrap ? lb.meta.lines.flatMap(s => s.split(', ').map((x, i, arr) => i < arr.length - 1 ? x + ',' : x)) : lb.meta.lines;
      lb.lines = lines;
      lb.lh = L.lab * 1.62;
      lb.h = (lines.length + 1) * lb.lh;
      lb.wd = Math.max(...lines.map(s => charW(s, L.lab, true)), charW(fmtHouse(lb.w.m), L.val, false) + L.val);
      const s = Math.sin(lb.mid);
      lb.side = s >= 0 ? 'right' : 'left';
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
        // horizontal: clear of the ring at the block's nearest height
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
    set(m, w, n) { month = m; active = w; notes = n; draw(); },
    focusWedge(id) { const p = svg.querySelector(`path[data-w="${id}"]`); if (p) p.focus(); },
  };
}
