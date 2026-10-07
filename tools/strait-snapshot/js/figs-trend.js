// Figure 2 (monthly sortie totals by year) and Figure 6 (same month, year over year).
import { frame, el, niceMax, yAxis, hoverColumns } from './fig.js';
import { yearSeries, monthStats, MON, MONTH_NAMES, yearAgo } from './data.js';

const YEARS = [
  { y: 2023, color: 'var(--c8)', cls: 'y23' },
  { y: 2024, color: 'var(--faint)', cls: 'y24' },
  { y: 2025, color: 'var(--c3)', cls: 'y25' },
  { y: 2026, color: 'var(--c2)', cls: 'y26' },
];
const val = (s, metric) => (s.total == null ? null : metric === 'perDay' ? s.perDay : s.total);
const fmtV = (v, metric) => (v == null ? '—' : metric === 'perDay' ? v.toFixed(1) : Math.round(v).toLocaleString('en-US'));
const cover = s => (s.days < s.calendarDays ? `${s.days} of ${s.calendarDays} days reported` : '');

export function drawMonthly(box, ym, { metric, show2023 }) {
  const f = frame(box, { H: 270, m: { l: 42, r: 44, t: 26, b: 28 } });
  const years = YEARS.filter(Y => show2023 || Y.y !== 2023);
  const data = years.map(Y => ({ ...Y, s: yearSeries(Y.y) }));
  const max = niceMax(Math.max(...data.flatMap(d => d.s.map(s => val(s, metric) ?? 0))));
  const X = m => f.m.l + (m - 0.5) / 12 * f.iw;
  const Yv = v => f.m.t + f.ih - v / max * f.ih;
  const g = el('g', {}, f.svg);
  const sel = Number(ym.slice(5));
  el('rect', { x: X(sel) - f.iw / 24, y: f.m.t - 8, width: f.iw / 12, height: f.ih + 8, class: 'selband' }, g);
  yAxis(g, f, max, Yv, { label: metric === 'perDay' ? 'Aircraft per reported day' : 'Aircraft per month' });
  const ax = el('g', { class: 'axis' }, g);
  MON.forEach((m, i) => el('text', { x: X(i + 1), y: f.H - 10, 'text-anchor': 'middle' }, ax, f.W < 480 ? m[0] : m)); // one letter on phones so labels don't run together
  data.forEach(d => {
    let path = '';
    d.s.forEach((s, i) => {
      const v = val(s, metric);
      if (v == null) return;
      path += (i && val(d.s[i - 1], metric) != null ? 'L' : 'M') + X(s.m).toFixed(1) + ' ' + Yv(v).toFixed(1);
    });
    const p = el('path', { d: path, class: 'yl ' + d.cls }, g);
    p.style.stroke = d.color;
    d.s.forEach(s => {
      const v = val(s, metric);
      if (v == null) return;
      const c = el('circle', { cx: X(s.m), cy: Yv(v), r: s.m === sel ? 5.5 : 3.8, class: 'ypt' + (s.days < s.calendarDays ? ' gap' : '') }, g);
      c.style.stroke = d.color;
      if (s.days >= s.calendarDays) c.style.fill = d.color;
    });
    const last = [...d.s].reverse().find(s => val(s, metric) != null);
    if (last) {
      const t = el('text', { x: X(last.m) + 8, y: Yv(val(last, metric)) + 4, class: 'ylab-end' }, g, d.y);
      t.style.fill = d.color;
    }
  });
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  hoverColumns(f, months, {
    x: m => X(m), w: f.iw / 12, label: 'Monthly aircraft by year',
    html: m => `<b>${MONTH_NAMES[m - 1]}</b><table class="tt">${data.map(d => {
      const s = d.s[m - 1];
      if (!s || s.total == null) return `<tr><td><i class="key" style="background:${d.color}"></i>${d.y}</td><td class="num">—</td></tr>`;
      return `<tr><td><i class="key" style="background:${d.color}"></i>${d.y}</td><td class="num">${fmtV(val(s, metric), metric)}</td><td class="muted">${cover(s)}</td></tr>`;
    }).join('')}</table>`,
  });
  return data.map(d => d.y);
}

export function drawYoY(box, ym, { metric, show2023 }) {
  const f = frame(box, { H: 270, m: { l: 42, r: 12, t: 26, b: 34 } });
  const years = YEARS.filter(Y => show2023 || Y.y !== 2023);
  const rows = years.map(Y => ({ ...Y, s: monthStats(yearAgo(ym, 2026 - Y.y)) }));
  const vals = rows.flatMap(r => [val(r.s, metric) ?? 0, metric === 'perDay' ? (r.s.adiz != null && r.s.days ? r.s.adiz / r.s.days : 0) : r.s.adiz ?? 0]);
  const max = niceMax(Math.max(...vals, 1));
  const gw = f.iw / rows.length;
  const X = i => f.m.l + gw * i + gw / 2;
  const Yv = v => f.m.t + f.ih - v / max * f.ih;
  const g = el('g', {}, f.svg);
  yAxis(g, f, max, Yv, { label: metric === 'perDay' ? 'Aircraft per reported day' : 'Aircraft in the month' });
  const bw = Math.min(46, gw * 0.3);
  rows.forEach((r, i) => {
    const v = val(r.s, metric);
    const ax = el('g', { class: 'axis' }, g);
    el('text', { x: X(i), y: f.H - 16, 'text-anchor': 'middle', class: 'yr' }, ax, r.y);
    if (r.s.days < r.s.calendarDays && r.s.days) el('text', { x: X(i), y: f.H - 3, 'text-anchor': 'middle' }, ax, `${r.s.days}/${r.s.calendarDays} days`);
    if (v == null) { el('text', { x: X(i), y: Yv(0) - 8, 'text-anchor': 'middle', class: 'na' }, g, 'no data'); return; }
    const hasAdiz = r.s.adiz != null;
    const x0 = hasAdiz ? X(i) - bw - 1 : X(i) - bw / 2;
    const b = el('rect', { x: x0, y: Yv(v), width: bw, height: Yv(0) - Yv(v), class: 'yb' }, g);
    b.style.fill = r.color;
    el('text', { x: x0 + bw / 2, y: Yv(v) - 5, 'text-anchor': 'middle', class: 'bl' }, g, fmtV(v, metric));
    if (hasAdiz) {
      const a = metric === 'perDay' ? r.s.adiz / r.s.days : r.s.adiz;
      el('rect', { x: X(i) + 1, y: Yv(a), width: bw, height: Yv(0) - Yv(a), class: 'b-adiz' }, g);
      el('text', { x: X(i) + 1 + bw / 2, y: Yv(a) - 5, 'text-anchor': 'middle', class: 'bl' }, g, fmtV(a, metric));
    }
  });
  hoverColumns(f, rows, {
    x: X, w: gw, label: 'Year over year',
    html: r => {
      const s = r.s;
      if (!s.days) return `<b>${s.name} ${r.y}</b><br><span class="muted">No aircraft data in the TSM daily record.</span>`;
      return `<b>${s.name} ${r.y}</b><table class="tt">
        <tr><td>Aircraft</td><td class="num">${s.total.toLocaleString('en-US')}</td></tr>
        <tr><td>Per reported day</td><td class="num">${s.perDay.toFixed(1)}</td></tr>
        <tr><td>Entered ADIZ</td><td class="num">${s.adiz ?? 'not in dataset'}</td></tr>
        <tr><td>Days reported</td><td class="num">${s.days} of ${s.calendarDays}</td></tr></table>`;
    },
  });
}
