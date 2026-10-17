// Two small charts: incidents per month (up to the scrubber date) and clock time of incursions.
import { el } from '../../../shared/js/mapkit.js';
import { monthsOf, monthName, monthEnd } from './model.js';

function tipAt(tip, svg, e, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const box = svg.parentElement.getBoundingClientRect();
  tip.style.left = Math.max(4, Math.min(box.width - tip.offsetWidth - 4, e.clientX - box.left + 12)) + 'px';
  tip.style.top = Math.max(0, e.clientY - box.top - tip.offsetHeight - 10) + 'px';
}

export function monthChart(svg, tip, { onMonth }) {
  const W = 1000, H = 200, M = { l: 30, r: 10, t: 16, b: 34 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  return function update({ S, list }) {
    svg.replaceChildren();
    const months = monthsOf(S.w);
    const c = Object.fromEntries(months.map(m => [m, 0]));
    list.forEach(i => { if (c[i.ym] != null) c[i.ym]++; });
    const max = Math.max(4, ...Object.values(c));
    const bw = (W - M.l - M.r) / months.length, IH = H - M.t - M.b;
    const y = v => M.t + IH - v / max * IH;
    const ax = el('g', { class: 'tsm-axis' }, svg);
    for (let v = 0; v <= max; v += max > 8 ? 2 : 1) {
      el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'ch-grid' }, ax);
      el('text', { x: M.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax, String(v));
    }
    months.forEach((ym, k) => {
      const x = M.l + k * bw, n = c[ym], future = ym > S.date.slice(0, 7);
      if (ym === S.date.slice(0, 7)) el('rect', { x, y: M.t, width: bw, height: IH, class: 'ch-cur' }, svg);
      if (n) el('rect', { x: x + bw * .15, y: y(n), width: bw * .7, height: IH - (y(n) - M.t), class: 'bar' }, svg);
      if (n && bw > 18) el('text', { x: x + bw / 2, y: y(n) - 3, 'text-anchor': 'middle', class: 'ch-total' }, svg, String(n));
      const m = +ym.slice(5, 7);
      if (months.length <= 12 || ((m === 1 || m === 7) && k > 1) || k === 0) el('text', { x: x + bw / 2, y: H - M.b + 14, 'text-anchor': 'middle' }, ax, monthName(ym).slice(0, 3));
      if (m === 1 || k === 0) el('text', { x: x + 2, y: H - M.b + 28, class: 'ch-year' }, ax, ym.slice(0, 4));
      const hit = el('rect', { x, y: M.t, width: bw, height: IH, class: 'ch-hit', tabindex: 0, role: 'button' }, svg);
      hit.setAttribute('aria-label', `${monthName(ym, true)}: ${future ? 'after the slider date' : n + ' incidents'}`);
      hit.onclick = () => onMonth(monthEnd(ym));
      hit.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonth(monthEnd(ym)); } };
      hit.onpointermove = e => tipAt(tip, svg, e, `<b>${monthName(ym, true)}</b><span class="tt-d">${future ? 'After the slider date' : `${n} incident${n === 1 ? '' : 's'} at Kinmen`}</span><small>Click to move the scrubber here</small>`);
      hit.onpointerleave = () => { tip.hidden = true; };
    });
  };
}

/** 24 hourly bins of the clock time the tracker records (Taiwan time, UTC+8). */
export function hourChart(svg, tip) {
  const W = 1000, H = 200, M = { l: 30, r: 10, t: 16, b: 34 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  return function update({ list, mode }) {
    svg.replaceChildren();
    const bins = Array(24).fill(0);
    const key = mode === 'entry' ? 'hEntry' : 'hFirst';
    let n = 0;
    list.forEach(i => { if (i[key] != null) { bins[i[key]]++; n++; } });
    const max = Math.max(4, ...bins);
    const bw = (W - M.l - M.r) / 24, IH = H - M.t - M.b;
    const y = v => M.t + IH - v / max * IH;
    const ax = el('g', { class: 'tsm-axis' }, svg);
    for (let v = 0; v <= max; v += max > 10 ? 4 : 2) {
      el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'ch-grid' }, ax);
      el('text', { x: M.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax, String(v));
    }
    const night = h => h < 6 || h >= 18;
    bins.forEach((v, h) => {
      const x = M.l + h * bw;
      if (night(h)) el('rect', { x, y: M.t, width: bw, height: IH, class: 'night' }, svg);
      if (v) el('rect', { x: x + bw * .12, y: y(v), width: bw * .76, height: IH - (y(v) - M.t), class: 'bar hour' }, svg);
      if (v) el('text', { x: x + bw / 2, y: y(v) - 3, 'text-anchor': 'middle', class: 'ch-total' }, svg, String(v));
      if (h % 3 === 0) el('text', { x, y: H - M.b + 14, 'text-anchor': 'middle' }, ax, `${String(h).padStart(2, '0')}:00`);
      const hit = el('rect', { x, y: M.t, width: bw, height: IH, class: 'ch-hit' }, svg);
      hit.onpointermove = e => tipAt(tip, svg, e, `<b>${String(h).padStart(2, '0')}:00 to ${String(h).padStart(2, '0')}:59</b><span class="tt-d">${v} incident${v === 1 ? '' : 's'}</span>`);
      hit.onpointerleave = () => { tip.hidden = true; };
    });
    return n;
  };
}
