// Figure 4 (CCG incursions by location) and Figure 5 (multi-domain overview), January to the selected month.
import { frame, el, niceMax, hoverColumns, star } from './fig.js';
import { CCG, CCG_LOCS, BY_DATE, TRANSITS, MON, AS_OF, daysIn, nice, pad } from './data.js';
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { dayTip, dayLinks } from './figs-daily.js';

const DAY = 864e5;
const endOf = ym => {
  const [y, m] = ym.split('-').map(Number);
  const e = `${ym}-${pad(daysIn(y, m))}`;
  return e > AS_OF ? AS_OF : e;
};
const locOf = k => CCG_LOCS.find(l => l.key === k);

function timeScale(f, ym) {
  const t0 = Date.parse('2026-01-01'), t1 = Date.parse(endOf(ym)) + DAY;
  return { t0, t1, X: d => f.m.l + (Date.parse(d) - t0) / (t1 - t0) * f.iw, end: endOf(ym) };
}
function monthTicks(g, f, ts, ym, y) {
  const ax = el('g', { class: 'axis' }, g);
  const last = Number(ym.slice(5));
  for (let m = 1; m <= last; m++) {
    const x = ts.X(`2026-${pad(m)}-01`);
    el('line', { x1: x, x2: x, y1: f.m.t - 4, y2: y, class: 'mline' }, ax);
    const xe = m < last ? ts.X(`2026-${pad(m + 1)}-01`) : f.W - f.m.r;
    el('text', { x: (x + xe) / 2, y: y + 15, 'text-anchor': 'middle' }, ax, MON[m - 1]);
  }
}
function selBand(g, f, ts, ym, y0, y1) {
  const x = ts.X(`${ym}-01`);
  el('rect', { x, y: y0, width: f.W - f.m.r - x, height: y1 - y0, class: 'selband' }, g);
}

export function drawCCG(box, ym) {
  const rowsH = 30;
  const f = frame(box, { H: CCG_LOCS.length * rowsH + 50, m: { l: 124, r: 12, t: 14, b: 30 } });
  const ts = timeScale(f, ym);
  const g = el('g', {}, f.svg);
  const y0 = f.m.t, y1 = f.m.t + CCG_LOCS.length * rowsH;
  selBand(g, f, ts, ym, y0, y1);
  monthTicks(g, f, ts, ym, y1);
  const Yr = i => f.m.t + rowsH * i + rowsH / 2;
  const list = CCG.filter(c => c[0] <= ts.end);
  CCG_LOCS.forEach((L, i) => {
    el('line', { x1: f.m.l, x2: f.W - f.m.r, y1: Yr(i), y2: Yr(i), class: 'grid' }, g);
    const n = list.filter(c => c[0].startsWith(ym) && c[1] === L.key).length;
    const t = el('text', { x: f.m.l - 8, y: Yr(i) + 4, 'text-anchor': 'end', class: 'rowlab' }, g, L.label);
    if (n) el('tspan', { class: 'rown' }, t, ` ${n}`);
  });
  const pts = el('g', { class: 'ccg-pts', tabindex: 0, role: 'group' }, f.svg);
  pts.setAttribute('aria-label', 'CCG incursions. Use arrow keys to read each one.');
  const items = list.map(c => ({ c, x: ts.X(c[0]) + 0.5 * f.iw / ((ts.t1 - ts.t0) / DAY), y: Yr(CCG_LOCS.findIndex(l => l.key === c[1])) }));
  const html = ({ c }) => `<b>${nice(c[0])}</b> · ${locOf(c[1])?.label ?? c[1]}<br>${escapeHtml(c[2] || 'No description recorded.')}`;
  const pinned = it => html(it) + `<div class="xlinks">${dayLinks({ date: it.c[0] })}<a class="xlink" href="../ccg-grayzone/#d=${it.c[0]}">On the CCG map <span aria-hidden="true">→</span></a></div>`;
  const hint = '<small class="tt-hint">Click or press Enter for links</small>';
  let cur = -1;
  const focusOn = i => {
    cur = i;
    const it = items[i], r = f.svg.getBoundingClientRect(), k = r.width / f.W;
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
    f.unpin();
    f.show(html(it) + hint, r.left + it.x * k, r.top + it.y * k);
  };
  const dots = items.map((it, i) => {
    const d = el('circle', { cx: it.x, cy: it.y, r: 6.5, class: 'ccg-dot' + (it.c[0].startsWith(ym) ? ' cur' : '') }, pts);
    d.style.fill = locOf(it.c[1])?.color ?? 'var(--ccg)';
    d.addEventListener('pointerenter', e => { f.show(html(it) + hint, e.clientX, e.clientY); d.classList.add('on'); });
    d.addEventListener('pointerleave', () => { f.hide(); if (!f.isPinned()) d.classList.remove('on'); });
    d.addEventListener('click', e => { cur = i; dots.forEach((o, j) => o.classList.toggle('on', j === i)); f.pin(pinned(it), e.clientX, e.clientY); });
    return d;
  });
  pts.addEventListener('keydown', e => {
    if (e.key === 'Enter' && cur >= 0) {
      e.preventDefault();
      const it = items[cur], r = f.svg.getBoundingClientRect(), k = r.width / f.W;
      f.pin(pinned(it), r.left + it.x * k, r.top + it.y * k); return;
    }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    focusOn(Math.max(0, Math.min(items.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
  });
  pts.addEventListener('focus', () => items.length && focusOn(cur < 0 ? 0 : cur));
  pts.addEventListener('blur', () => { if (f.isPinned()) return; f.hide(); dots.forEach(d => d.classList.remove('on')); });
  return list.filter(c => c[0].startsWith(ym)).length;
}

export function drawOverview(box, ym) {
  const f = frame(box, { H: 330, m: { l: 52, r: 12, t: 24, b: 28 } });
  const ts = timeScale(f, ym);
  const days = [];
  for (let t = ts.t0; t < ts.t1; t += DAY) { const d = new Date(t).toISOString().slice(0, 10); days.push({ date: d, row: BY_DATE.get(d) || null }); }
  const bw = f.iw / days.length;
  const X = i => f.m.l + bw * i + bw / 2;
  const g = el('g', {}, f.svg);
  const P = [
    { top: f.m.t, h: 118, label: 'Aircraft' },
    { top: f.m.t + 132, h: 88, label: 'PLAN ships' },
    { top: f.m.t + 234, h: 34, label: 'CCG' },
  ];
  const bottom = P[2].top + P[2].h;
  selBand(g, f, ts, ym, f.m.t - 8, bottom);
  monthTicks(g, f, ts, ym, bottom);
  P.forEach(p => {
    el('text', { x: f.m.l - 8, y: p.top + 11, 'text-anchor': 'end', class: 'panel-lab' }, g, p.label);
    el('line', { x1: f.m.l, x2: f.W - f.m.r, y1: p.top + p.h, y2: p.top + p.h, class: 'base' }, g);
  });
  const amax = niceMax(Math.max(10, ...days.map(d => d.row?.[1] ?? 0)));
  const pmax = niceMax(Math.max(8, ...days.map(d => d.row?.[3] ?? 0)));
  el('text', { x: f.m.l - 8, y: P[0].top + 24, 'text-anchor': 'end', class: 'axis-s' }, g, `max ${amax}`);
  el('text', { x: f.m.l - 8, y: P[1].top + 24, 'text-anchor': 'end', class: 'axis-s' }, g, `max ${pmax}`);
  let air = '', plan = '';
  days.forEach((d, i) => {
    const r = d.row;
    if (!r) return;
    const x = X(i);
    if (r[1]) air += `M${x.toFixed(1)} ${P[0].top + P[0].h}V${(P[0].top + P[0].h - r[1] / amax * P[0].h).toFixed(1)}`;
    if (r[3] != null) plan += `${plan ? 'L' : 'M'}${x.toFixed(1)} ${(P[1].top + P[1].h - r[3] / pmax * P[1].h).toFixed(1)}`;
    if (String(r[5] ?? '').includes('J')) el('path', { d: star(x, P[0].top - 5, 4.5), class: 'jstar' }, g);
  });
  const ab = el('path', { d: air, class: 'ov-air' }, g);
  ab.style.strokeWidth = Math.max(1, bw * 0.8);
  el('path', { d: plan, class: 'l-plan' }, g);
  CCG.filter(c => c[0] <= ts.end).forEach(c => {
    const i = Math.round((Date.parse(c[0]) - ts.t0) / DAY);
    const t = el('line', { x1: X(i), x2: X(i), y1: P[2].top + 4, y2: P[2].top + P[2].h - 2, class: 'ov-ccg' }, g);
    t.style.stroke = locOf(c[1])?.color ?? 'var(--ccg)';
  });
  TRANSITS.filter(t => t[0] >= '2026-01-01' && t[0] <= ts.end).forEach(t => {
    const i = Math.round((Date.parse(t[0]) - ts.t0) / DAY);
    el('path', { d: `M${X(i) - 4} ${P[1].top - 8}h8l-4 7z`, class: 'tri-transit' }, g);
  });
  hoverColumns(f, days, { x: X, w: bw, html: dayTip, links: dayLinks, top: f.m.t - 8, bottom, label: 'Multi-domain overview' });
}
