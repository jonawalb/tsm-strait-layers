// Context views: the week around the day, and the day's place in 2026.
import { el } from '../../../shared/js/mapkit.js';
import { BY_DATE, DAYS_2026, START, AS_OF, addDays, tinyDate } from './day.js';
import { INCIDENTS } from '../data/incidents.js';
import { TSM } from '../../../shared/data/tsm.js';

export function renderWeek(root, d, onPick) {
  const days = [];
  for (let k = -3; k <= 3; k++) days.push(addDays(d, k));
  const max = Math.max(10, ...days.map(x => BY_DATE.get(x)?.[1] ?? 0));
  root.innerHTML = days.map(x => {
    const r = BY_DATE.get(x), inRange = x >= START && x <= AS_OF;
    const air = r?.[1];
    const ccg = INCIDENTS.filter(i => i.date === x).length;
    const tr = TSM.transits.filter(t => t[0] === x).length;
    const h = air != null ? Math.max(2, air / max * 100) : 0;
    const wd = new Date(x + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return `<button type="button" class="wk ${x === d ? 'cur' : ''}" data-d="${x}" ${inRange ? '' : 'disabled'}
      aria-label="${tinyDate(x)}: ${air ?? 'no'} aircraft${String(r?.[5] ?? '').includes('J') ? ', joint combat readiness patrol' : ''}${ccg ? `, ${ccg} CCG incursion` : ''}${tr ? ', allied transit' : ''}">
      <span class="wk-bar"><i style="height:${h}%"></i></span>
      <b class="num">${air ?? '–'}</b>
      <span class="wk-tags">${String(r?.[5] ?? '').includes('J') ? '<i class="tag j" title="Joint combat readiness patrol">JCRP</i>' : ''}${ccg ? '<i class="tag c" title="CCG incursion">CCG</i>' : ''}${tr ? '<i class="tag t" title="Allied Strait transit">Transit</i>' : ''}</span>
      <span class="wk-d">${wd}<br>${tinyDate(x)}</span></button>`;
  }).join('');
  root.querySelectorAll('.wk:not([disabled])').forEach(b => b.onclick = () => onPick(b.dataset.d));
}

export function drawYear(svg, d, onPick) {
  const W = 1000, H = 150, L = 8, R = 8, T = 22, B = 24;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const n = DAYS_2026.length, bw = (W - L - R) / n;
  const max = Math.max(...DAYS_2026.map(r => r[1] ?? 0));
  const X = i => L + i * bw;
  const Y = v => H - B - v / max * (H - B - T);
  let path = '';
  DAYS_2026.forEach((r, i) => { if (r[1]) path += `M${(X(i) + bw / 2).toFixed(1)} ${H - B}V${Y(r[1]).toFixed(1)}`; });
  const bars = el('path', { d: path, class: 'yr-bars' }, svg);
  bars.style.strokeWidth = Math.max(1, bw * 0.75);
  for (let m = 1; m <= 12; m++) {
    const key = `2026-${String(m).padStart(2, '0')}-01`;
    const i = DAYS_2026.findIndex(r => r[0] === key);
    if (i < 0) continue;
    el('line', { x1: X(i), x2: X(i), y1: T - 6, y2: H - B, class: 'yr-m' }, svg);
    el('text', { x: X(i) + 3, y: H - 8, class: 'yr-t' }, svg, new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }));
  }
  const i = DAYS_2026.findIndex(r => r[0] === d);
  if (i >= 0) {
    const x = X(i) + bw / 2, v = DAYS_2026[i][1] ?? 0;
    el('line', { x1: x, x2: x, y1: T - 12, y2: H - B, class: 'yr-cur' }, svg);
    el('circle', { cx: x, cy: Y(v), r: 5, class: 'yr-dot' }, svg);
    el('text', { x: Math.min(W - 70, Math.max(70, x)), y: T - 14 + 8, class: 'yr-lab', 'text-anchor': 'middle' }, svg, tinyDate(d));
  }
  svg.onclick = e => {
    const r = svg.getBoundingClientRect();
    const k = Math.floor(((e.clientX - r.left) / r.width * W - L) / bw);
    if (DAYS_2026[k]) onPick(DAYS_2026[k][0]);
  };
}
