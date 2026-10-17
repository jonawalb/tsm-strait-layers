// Timeline: JSO-reported crossings per month (stacked by strait) against Taiwan MND's daily PLAN ship
// counts (monthly mean), with PLA exercise dates and joint combat readiness patrol days.
import { el } from '../../../shared/js/mapkit.js';
import { MONTHS, MND, STRAITS, EXERCISES, monthName } from './model.js';

const W = 1000, H = 250, M = { l: 36, r: 44, t: 38, b: 40 };
const IW = W - M.l - M.r, IH = H - M.t - M.b;

export function createChart(svg, tip, { onMonth }) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const bw = IW / MONTHS.length;
  const xOf = i => M.l + i * bw;
  const xDate = d => {
    const i = MONTHS.indexOf(d.slice(0, 7));
    const days = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate();
    return xOf(i) + bw * (+d.slice(8, 10) - .5) / days;
  };
  const cur = el('rect', { y: M.t - 4, height: IH + 4, class: 'ch-cur' }, svg);
  const grid = el('g', { class: 'tsm-axis' }, svg);
  const exG = el('g', { class: 'ex' }, svg);
  const bars = el('g', {}, svg);
  const line = el('path', { class: 'mnd-line' }, svg);
  const dots = el('g', {}, svg);
  const jG = el('g', { class: 'jcrp' }, svg);
  const axis = el('g', { class: 'tsm-axis' }, svg);
  const hits = el('g', {}, svg);

  MONTHS.forEach((ym, i) => {
    const m = +ym.slice(5, 7);
    if (m === 1 || m === 4 || m === 7 || m === 10) el('text', { x: xOf(i) + bw / 2, y: H - M.b + 15, 'text-anchor': 'middle' }, axis, monthName(ym).slice(0, 3));
    if (m === 1) el('text', { x: xOf(i) + 2, y: H - M.b + 30, class: 'ch-year' }, axis, ym.slice(0, 4));
  });
  EXERCISES.forEach((x, k) => {
    const x0 = xDate(x.s) - 2, x1 = xDate(x.e) + 2;
    el('rect', { x: x0, y: M.t, width: x1 - x0, height: IH, class: 'ex-band' }, exG);
    el('text', { x: k === 0 ? x1 : x0 + 3, y: M.t - (k === 1 ? 6 : 18), class: 'ex-lab', 'text-anchor': k === 0 ? 'end' : 'start' }, exG, x.short);
  });
  MND.forEach(m => m.jcrp.forEach(d => el('line', { x1: xDate(d), x2: xDate(d), y1: H - M.b, y2: H - M.b + 5, class: 'jcrp-tick' }, jG)));

  const hitEls = MONTHS.map((ym, i) => {
    const r = el('rect', { x: xOf(i), y: M.t, width: bw, height: IH, class: 'ch-hit', tabindex: 0, role: 'button' }, hits);
    r.addEventListener('click', () => onMonth(i));
    r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonth(i); } });
    return r;
  });

  function update({ monthly, w }) {
    const maxB = Math.max(4, ...monthly.map(m => m.total));
    const maxL = Math.max(4, ...MND.map(m => m.mean || 0));
    const yB = v => M.t + IH - v / maxB * IH, yL = v => M.t + IH - v / maxL * IH;
    grid.replaceChildren();
    for (let v = 0; v <= maxB; v += maxB > 12 ? 4 : 2) {
      el('line', { x1: M.l, x2: W - M.r, y1: yB(v), y2: yB(v), class: 'ch-grid' }, grid);
      el('text', { x: M.l - 6, y: yB(v) + 4, 'text-anchor': 'end' }, grid, String(v));
    }
    for (let v = 0; v <= maxL; v += 2) el('text', { x: W - M.r + 6, y: yL(v) + 4, class: 'mnd-ax' }, grid, String(v));
    bars.replaceChildren();
    monthly.forEach((m, i) => {
      let y = M.t + IH;
      STRAITS.forEach(s => {
        const n = m.by[s.key] || 0;
        if (!n) return;
        const h = n / maxB * IH;
        el('rect', { x: xOf(i) + bw * .18, y: y - h, width: bw * .64, height: h, fill: s.color, class: 'bar' }, bars);
        y -= h;
      });
      if (m.total) el('text', { x: xOf(i) + bw / 2, y: y - 3, 'text-anchor': 'middle', class: 'ch-total' }, bars, String(m.total));
    });
    const pts = MND.map((m, i) => m.mean == null ? null : [xOf(i) + bw / 2, yL(m.mean)]);
    line.setAttribute('d', pts.filter(Boolean).map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''));
    dots.replaceChildren();
    pts.forEach(p => p && el('circle', { cx: p[0], cy: p[1], r: 3, class: 'mnd-dot' }, dots));
    cur.setAttribute('x', xOf(w.a));
    cur.setAttribute('width', (w.b - w.a + 1) * bw);
    hitEls.forEach((r, i) => {
      const m = monthly[i], d = MND[i];
      r.setAttribute('aria-label', `${monthName(MONTHS[i], true)}: ${m.total} crossings reported by Japan; MND mean ${d.mean == null ? 'n/a' : d.mean.toFixed(1)} PLAN ships a day`);
      r.onpointerenter = r.onpointermove = e => {
        tip.innerHTML = `<b>${monthName(MONTHS[i], true)}</b><span class="tt-d">Japan JSO: ${m.total} crossing${m.total === 1 ? '' : 's'}</span>` +
          `<span class="tt-d">Taiwan MND: ${d.mean == null ? 'no data' : d.mean.toFixed(1) + ' PLAN ships a day on average, peak ' + d.max}</span>` +
          (d.jcrp.length ? `<small>${d.jcrp.length} joint combat readiness patrol day${d.jcrp.length > 1 ? 's' : ''}</small>` : '') +
          '<small>Click to show this month</small>';
        tip.hidden = false;
        const box = svg.parentElement.getBoundingClientRect();
        tip.style.left = Math.max(4, Math.min(box.width - tip.offsetWidth - 4, e.clientX - box.left + 12)) + 'px';
        tip.style.top = Math.max(0, e.clientY - box.top - tip.offsetHeight - 10) + 'px';
      };
      r.onpointerleave = () => { tip.hidden = true; };
    });
  }
  return { update };
}
