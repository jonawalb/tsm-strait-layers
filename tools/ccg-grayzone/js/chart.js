// Monthly stacked bar chart of incidents by location for the selected window, synced to the time slider.
import { el } from '../../../shared/js/mapkit.js';
import { LOCS, monthly, monthName, monthShort } from './model.js';

export function createChart(svg, tip, { onMonth }) {
  const W = Math.round(Math.max(340, Math.min(760, svg.parentElement.clientWidth || 640))), H = W < 500 ? 190 : 210;
  const L = 28, R = 8, T = 14, B = 34;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const grid = el('g', {}, svg), cur = el('rect', { y: T - 6, height: H - T - B + 8, class: 'ch-cur' }, svg);
  const bars = el('g', {}, svg), axis = el('g', {}, svg), hitsG = el('g', {}, svg);
  let last = null, hits = [], shape = '';

  function show(j, e, anchor) {
    if (!last) return;
    const { ym, c } = last[j], tot = Object.values(c).reduce((a, b) => a + b, 0);
    const rows = LOCS.filter(l => c[l.key]).map(l => `<li><i style="background:${l.color}"></i>${l.label} <b class="num">${c[l.key]}</b></li>`).join('');
    tip.innerHTML = `<b>${monthName(ym, true)}</b> · <span class="num">${tot}</span> incident${tot === 1 ? '' : 's'}${rows ? `<ul class="tip-list">${rows}</ul>` : '<br><span class="muted">None recorded up to the slider date.</span>'}`;
    tip.hidden = false;
    const box = svg.parentElement.getBoundingClientRect();
    const r = anchor ? anchor.getBoundingClientRect() : null;
    const x = e ? e.clientX - box.left : r.left - box.left + r.width / 2;
    tip.style.left = Math.min(box.width - 220, Math.max(0, x + 12)) + 'px';
    tip.style.top = '8px';
  }

  /** Rebuild axis and hit areas when the window (number of months) changes. */
  function frame(months) {
    const key = months[0].ym + months.length;
    if (key === shape) return;
    shape = key;
    axis.innerHTML = ''; hitsG.innerHTML = '';
    const bw = (W - L - R) / months.length;
    const every = months.length <= 12 ? 1 : months.length <= 18 ? 2 : 3;
    months.forEach(({ ym }, j) => {
      const x = L + bw * j + bw / 2, jan = ym.endsWith('-01');
      const nearJan = months.slice(j + 1, j + 1 + Math.max(1, every - 1)).some(m => m.ym.endsWith('-01'));
      if ((j % every === 0 && !nearJan) || jan) el('text', { x, y: H - 20, class: 'ch-axis', 'text-anchor': 'middle' }, axis, monthShort(ym));
      if (jan || j === 0) el('text', { x: L + bw * j + 1, y: H - 5, class: 'ch-year' }, axis, ym.slice(0, 4));
      if (jan && j > 0) el('line', { x1: L + bw * j, x2: L + bw * j, y1: T - 6, y2: H - 14, class: 'ch-yline' }, axis);
    });
    hits = months.map(({ ym }, j) => {
      const r = el('rect', { x: L + bw * j, y: 0, width: bw, height: H - B + 4, class: 'ch-hit', tabindex: 0, role: 'button' }, hitsG);
      r.setAttribute('aria-label', `Jump to the end of ${monthName(ym, true)}`);
      r.addEventListener('click', () => onMonth(ym));
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonth(ym); } });
      r.addEventListener('pointerenter', e => show(j, e));
      r.addEventListener('pointermove', e => show(j, e));
      r.addEventListener('pointerleave', () => { tip.hidden = true; });
      r.addEventListener('focus', () => show(j, null, r));
      r.addEventListener('blur', () => { tip.hidden = true; });
      return r;
    });
    cur.setAttribute('width', bw);
  }

  function update({ w, date, on }) {
    last = monthly(w, date, on);
    frame(last);
    const bw = (W - L - R) / last.length;
    const tot = m => Object.values(m.c).reduce((a, b) => a + b, 0);
    const max = Math.max(8, ...last.map(tot));
    const Y = v => H - B - v / max * (H - B - T);
    const gstep = max <= 12 ? 2 : max <= 24 ? 4 : 8;
    grid.innerHTML = '';
    for (let v = 0; v <= max; v += gstep) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'ch-grid' }, grid);
      el('text', { x: L - 5, y: Y(v) + 3, class: 'ch-axis', 'text-anchor': 'end' }, grid, v);
    }
    bars.innerHTML = '';
    const curYm = date.slice(0, 7);
    const showTotals = bw >= 16;
    last.forEach((m, j) => {
      let acc = 0;
      const x = L + bw * j + bw * 0.16, bwid = bw * 0.68;
      LOCS.forEach(l => {
        const n = m.c[l.key];
        if (!n) return;
        const r = el('rect', { x, width: bwid, y: Y(acc + n), height: Math.max(0.5, Y(acc) - Y(acc + n) - 0.8), class: 'ch-bar' }, bars);
        r.style.fill = l.color;
        acc += n;
      });
      if (acc && showTotals) el('text', { x: x + bwid / 2, y: Y(acc) - 4, class: 'ch-total', 'text-anchor': 'middle' }, bars, acc);
      if (m.ym > curYm) el('text', { x: x + bwid / 2, y: H - B - 4, class: 'ch-future', 'text-anchor': 'middle' }, bars, '·');
    });
    const ci = Math.max(0, last.findIndex(m => m.ym === curYm));
    cur.setAttribute('x', L + bw * ci);
    hits.forEach((h, j) => h.classList.toggle('future', last[j].ym > curYm));
  }
  return { update };
}
