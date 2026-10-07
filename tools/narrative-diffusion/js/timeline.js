// Swimlane timeline: one row per source, dots where the talking point appears, and the
// month-by-month collection coverage drawn behind each row so gaps are visible.
import { el } from '../../../shared/js/mapkit.js';
import { LANES, MONTHS, COVERAGE, FULLTEXT } from '../data/coverage.js';
import { toT, fromT } from './model.js';

const ROW = 21, TOP = 26, LAB = 150, DAY = 864e5;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function createTimeline(svg, tip, { onPick }) {
  let G = null;

  function render(sum, win, sel) {
    const W = Math.max(360, svg.parentElement.clientWidth);
    const H = TOP + LANES.length * ROW + 8;
    const [t0, t1] = win;
    const x = t => LAB + ((t - t0) / (t1 - t0)) * (W - LAB - 12);
    const span = (t1 - t0) / DAY;
    const bin = span > 700 ? 14 : span > 240 ? 7 : 1;
    G = { x, t0, t1, W, H, bin, bins: new Map() };
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);

    // Month grid and labels
    const d = new Date(t0); d.setUTCDate(1);
    let lastX = -1e9;
    for (; d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + 1)) {
      const t = d.getTime(); if (t < t0) continue;
      const xx = x(t), m = d.getUTCMonth();
      el('path', { d: `M${xx} ${TOP - 4}V${H - 6}`, class: m === 0 ? 'grid yr' : 'grid' }, svg);
      const lab = m === 0 ? String(d.getUTCFullYear()) : MON[m];
      if (xx - lastX > lab.length * 6.5 + 8) { el('text', { x: xx + 2, y: TOP - 10, class: 'ax' + (m === 0 ? ' yr' : '') }, svg, lab); lastX = xx; }
    }

    LANES.forEach((ln, i) => {
      const y = TOP + i * ROW;
      if (i === 3) el('path', { d: `M0 ${y - 1}H${W}`, class: 'sep' }, svg);
      const lab = el('text', { x: LAB - 8, y: y + 14, class: 'lane' + (ln.group === 'official' ? ' off' : '') + (sel?.lane === i ? ' on' : ''), 'data-lane': i, tabindex: 0, role: 'button', 'aria-label': `List ${ln.name} records` }, svg, ln.name);
      lab.style.cursor = 'pointer';
      // Coverage cells
      MONTHS.forEach((m, mi) => {
        const a = toT(m + '-01'), bD = new Date(a); bD.setUTCMonth(bD.getUTCMonth() + 1);
        const b = bD.getTime();
        if (b <= t0 || a >= t1 || !COVERAGE[ln.key][mi]) return;
        const xa = x(Math.max(a, t0)), xb = x(Math.min(b, t1));
        el('rect', { x: xa, y: y + 3, width: Math.max(0.5, xb - xa - 0.5), height: ROW - 6, class: FULLTEXT[ln.key][mi] ? 'cov full' : 'cov head' }, svg);
      });
    });

    // Dots, binned per lane
    sum.byLane.forEach((rs, lane) => {
      const bins = new Map();
      for (const r of rs) {
        if (r.t < t0 || r.t > t1) continue;
        const k = Math.floor((r.t - t0) / (bin * DAY));
        if (!bins.has(k)) bins.set(k, []);
        bins.get(k).push(r);
      }
      const y = TOP + lane * ROW + ROW / 2;
      for (const [k, rs2] of bins) {
        const cx = x(Math.min(t1, t0 + (k + 0.5) * bin * DAY));
        const r = Math.min(8, 2.6 + Math.sqrt(rs2.length) * 1.6);
        const c = el('circle', { cx, cy: y, r, class: 'dot ' + LANES[lane].group + (sel && sel.lane === lane && sel.k === k ? ' on' : ''), 'data-lane': lane, 'data-k': k }, svg);
        c.style.cursor = 'pointer';
        G.bins.set(`${lane}:${k}`, rs2);
      }
    });

    // First-appearance markers
    for (const f of sum.firsts) {
      if (f.r.t < t0 || f.r.t > t1) continue;
      const y = TOP + f.lane * ROW + ROW / 2;
      el('path', { d: `M${x(f.r.t)} ${y - 8}v16`, class: 'first' + (f.gap ? ' gap' : '') }, svg);
    }
  }

  function binAt(e) {
    const c = e.target.closest('circle.dot');
    if (!c) return null;
    const lane = +c.dataset.lane, k = +c.dataset.k;
    return { lane, k, rs: G.bins.get(`${lane}:${k}`) };
  }

  svg.addEventListener('pointermove', e => {
    const b = binAt(e);
    if (!b) { tip.hidden = true; return; }
    const a = fromT(G.t0 + b.k * G.bin * DAY), z = fromT(G.t0 + ((b.k + 1) * G.bin - 1) * DAY);
    tip.innerHTML = `<b>${LANES[b.lane].name}</b><br>${G.bin === 1 ? a : `${a} to ${z}`}<br><span class="num">${b.rs.length}</span> record${b.rs.length > 1 ? 's' : ''}: ${b.rs.slice(0, 2).map(r => r.title.slice(0, 60)).join('; ')}${b.rs.length > 2 ? '…' : ''}`;
    tip.hidden = false;
    const box = svg.parentElement.getBoundingClientRect();
    tip.style.left = Math.max(4, Math.min(e.clientX - box.left + 12, box.width - tip.offsetWidth - 4)) + 'px';
    tip.style.top = (e.clientY - box.top + 14) + 'px';
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('click', e => {
    const b = binAt(e);
    if (b) { onPick({ lane: b.lane, k: b.k, rs: b.rs }); return; }
    const l = e.target.closest('[data-lane]');
    if (l) onPick({ lane: +l.dataset.lane });
  });
  // Keyboard: lane labels are focusable; Enter or Space lists that source's records.
  svg.addEventListener('keydown', e => {
    const l = e.target.closest('text[data-lane]');
    if (!l || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const i = l.dataset.lane;
    onPick({ lane: +i });
    svg.querySelector(`text[data-lane="${i}"]`)?.focus({ preventScroll: true });
  });
  return { render };
}
