// Figure 1 (daily air activity) and Figure 3 (PLAN and official ships), for the selected month.
import { frame, el, niceMax, yAxis, hoverColumns, star } from './fig.js';
import { monthDays, CCG, TRANSITS, nice } from './data.js';
import { dateLinksHtml } from '../../../shared/js/links.js';

/** Links from a day column to A Day in the Strait and any exercise replay around it. */
export const dayLinks = ({ date }) => dateLinksHtml(date);

export function dayTip({ date, row }) {
  if (!row) return `<b>${nice(date)}</b><br><span class="muted">No TSM record for this day.</span>`;
  const [, air, adiz, plan, off, f] = row;
  const ccg = CCG.filter(c => c[0] === date), tr = TRANSITS.filter(t => t[0] === date);
  const line = (k, v, c) => `<tr><td><i class="key" style="background:${c}"></i>${k}</td><td class="num">${v ?? '—'}</td></tr>`;
  return `<b>${nice(date)}</b>${String(f ?? '').includes('J') ? ' <span class="pill jcrp">JCRP</span>' : String(f ?? '').includes('L') ? ' <span class="pill">Long-distance flight</span>' : ''}
    <table class="tt">${line('Aircraft', air, 'var(--c1)')}${line('Entered ADIZ', adiz, 'var(--c2)')}${line('PLAN ships', plan, 'var(--c7)')}${line('Official ships', off, 'var(--c5)')}</table>
    ${ccg.map(c => `<div class="tt-x">CCG incursion: ${c[1] === 'Taiwan' ? 'southwest of Taiwan' : c[1]}</div>`).join('')}
    ${tr.map(t => `<div class="tt-x">Strait transit: ${t[1]} (${t[5]})</div>`).join('')}`;
}

export function drawDaily(box, ym) {
  const days = monthDays(ym);
  const f = frame(box, { H: 280, m: { l: 34, r: 10, t: 30, b: 30 } });
  const max = niceMax(Math.max(10, ...days.map(d => d.row?.[1] ?? 0)));
  const bw = f.iw / days.length;
  const X = i => f.m.l + bw * i + bw / 2;
  const Y = v => f.m.t + f.ih - v / max * f.ih;
  const g = el('g', {}, f.svg);
  yAxis(g, f, max, Y, { label: 'Aircraft' });
  days.forEach((d, i) => {
    const r = d.row;
    if (!r) { el('rect', { x: X(i) - bw / 2, y: f.m.t, width: bw, height: f.ih, class: 'nodata' }, g); return; }
    if (r[1] === 0) el('rect', { x: X(i) - bw / 2, y: f.m.t, width: bw, height: f.ih, class: 'zero' }, g);
    const w = Math.max(1.5, bw * 0.38);
    el('rect', { x: X(i) - w, y: Y(r[1]), width: w, height: Y(0) - Y(r[1]), class: 'b-air' }, g);
    if (r[2] != null) el('rect', { x: X(i), y: Y(r[2]), width: w, height: Y(0) - Y(r[2]), class: 'b-adiz' }, g);
    if (String(r[5] ?? '').includes('J')) el('path', { d: star(X(i), Y(r[1]) - 10, 7), class: 'jstar' }, g);
    if (String(r[5] ?? '').includes('L')) el('circle', { cx: X(i), cy: Y(r[1]) - 9, r: 4, class: 'ldf' }, g);
    if (TRANSITS.some(t => t[0] === d.date)) el('line', { x1: X(i), x2: X(i), y1: f.m.t - 6, y2: Y(0), class: 'transit' }, g);
  });
  xDays(g, f, days, X, Y(0));
  hoverColumns(f, days, { x: X, w: bw, html: dayTip, links: dayLinks, label: 'Daily aircraft' });
}

export function drawShips(box, ym) {
  const days = monthDays(ym);
  const f = frame(box, { H: 260, m: { l: 34, r: 10, t: 26, b: 30 } });
  const vals = days.filter(d => d.row && d.row[3] != null);
  const max = niceMax(Math.max(8, ...vals.map(d => Math.max(d.row[3], d.row[4] ?? 0))));
  const bw = f.iw / days.length;
  const X = i => f.m.l + bw * i + bw / 2;
  const Y = v => f.m.t + f.ih - v / max * f.ih;
  const g = el('g', {}, f.svg);
  yAxis(g, f, max, Y, { label: 'Ships detected' });
  days.forEach((d, i) => {
    if (!d.row || d.row[4] == null) return;
    const w = Math.max(1.5, bw * 0.55);
    el('rect', { x: X(i) - w / 2, y: Y(d.row[4]), width: w, height: Y(0) - Y(d.row[4]), class: 'b-off' }, g);
  });
  const pts = days.map((d, i) => (d.row && d.row[3] != null ? [X(i), Y(d.row[3])] : null));
  let line = '', area = '';
  pts.forEach((p, i) => {
    if (!p) return;
    const startSeg = i === 0 || !pts[i - 1];
    line += (startSeg ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  });
  const segs = line.split('M').filter(Boolean);
  segs.forEach(s => {
    const coords = s.split('L').map(c => c.split(' ').map(Number));
    area += `M${coords[0][0]} ${Y(0)}L` + coords.map(c => c.join(' ')).join('L') + `L${coords.at(-1)[0]} ${Y(0)}Z`;
  });
  el('path', { d: area, class: 'a-plan' }, g);
  el('path', { d: line, class: 'l-plan' }, g);
  pts.forEach(p => p && el('circle', { cx: p[0], cy: p[1], r: 2.4, class: 'd-plan' }, g));
  if (vals.length) {
    const avg = vals.reduce((s, d) => s + d.row[3], 0) / vals.length;
    el('line', { x1: f.m.l, x2: f.W - f.m.r, y1: Y(avg), y2: Y(avg), class: 'avg' }, g);
    el('text', { x: f.W - f.m.r - 2, y: Y(avg) - 5, class: 'avg-t', 'text-anchor': 'end' }, g, `PLAN average ${avg.toFixed(1)}/day`);
  }
  days.forEach((d, i) => {
    if (String(d.row?.[5] ?? '').includes('J')) el('path', { d: star(X(i), f.m.t - 12, 6), class: 'jstar' }, g);
    if (TRANSITS.some(t => t[0] === d.date)) el('line', { x1: X(i), x2: X(i), y1: f.m.t - 4, y2: Y(0), class: 'transit' }, g);
  });
  xDays(g, f, days, X, Y(0));
  hoverColumns(f, days, { x: X, w: bw, html: dayTip, links: dayLinks, label: 'Daily ships' });
}

function xDays(g, f, days, X, y0) {
  const ax = el('g', { class: 'axis' }, g);
  el('line', { x1: f.m.l, x2: f.W - f.m.r, y1: y0, y2: y0, class: 'base' }, ax);
  const every = days.length > 20 && f.W < 520 ? 7 : days.length > 20 ? 3 : 2;
  days.forEach((d, i) => {
    const n = Number(d.date.slice(8));
    if ((n - 1) % every === 0) el('text', { x: X(i), y: y0 + 16, 'text-anchor': 'middle' }, ax, n);
  });
}
