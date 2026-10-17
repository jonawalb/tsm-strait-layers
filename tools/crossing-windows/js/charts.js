// Year-by-week heatmap, week climatology chart and month comparison chart.
import { el } from '../../../shared/js/mapkit.js';
import { YEARS, MONTHS, weekLabel } from './model.js';

const pct = v => (v == null ? 'n/a' : Math.round(v * 100) + '%');
// First week index of each month in a non-leap year.
const MONTH_WK = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334].map(d => d / 7);
// Claimed windows, in weeks. Easton (as quoted by 19FortyFive): April and October.
// Easton as summarized in War on the Rocks (2023): March to May and September to October.
export const CLAIMS = {
  easton: [[90 / 7, 120 / 7], [273 / 7, 304 / 7]],
  wotr: [[59 / 7, 151 / 7], [243 / 7, 304 / 7]],
};

function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
function tipAt(tip, box, x, y, html) {
  tip.innerHTML = html; tip.hidden = false;
  const r = box.getBoundingClientRect(), tw = tip.offsetWidth;
  tip.style.left = (box.scrollLeft + Math.max(4, Math.min(r.width - tw - 4, x - r.left + 12))) + 'px';
  tip.style.top = (y - r.top + 14) + 'px';
}

/** Heatmap of the share of days opening a window, one row per year, one column per week. */
export function drawHeatmap(svg, tip, agg, s, { onPick, stormYears }) {
  clear(svg);
  const L = 40, T = 30, W = 920, cw = (W - L - 6) / 52, ch = 11, H = T + YEARS.length * ch + 26;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const x = wk => L + wk * cw;
  const ax = el('g', { class: 'tsm-axis' }, svg);
  MONTHS.forEach((m, i) => el('text', { x: x(MONTH_WK[i]) + 2, y: T - 16 }, ax, m));
  claimBrackets(svg, x, T - 12, 'easton');
  YEARS.forEach((y, r) => { if (y % 5 === 0 || r === 0 || r === YEARS.length - 1) el('text', { x: L - 6, y: T + r * ch + ch - 2, 'text-anchor': 'end' }, ax, y); });
  const g = el('g', {}, svg);
  agg.grid.forEach((row, r) => row.forEach((v, wk) => {
    el('rect', { x: x(wk) + 0.5, y: T + r * ch + 0.5, width: cw - 1, height: ch - 1, class: v ? 'hm-c' : 'hm-c zero',
      'fill-opacity': v ? 0.12 + 0.88 * v : 1, 'data-r': r, 'data-wk': wk }, g);
    if (stormYears?.[r]?.[wk]) el('circle', { cx: x(wk) + cw / 2, cy: T + r * ch + ch / 2, r: 1.8, class: 'hm-tc' }, g);
  }));
  el('rect', { x: x(s.wk), y: T - 2, width: cw, height: YEARS.length * ch + 4, class: 'hm-sel' }, svg);
  // legend
  const lg = el('g', { class: 'tsm-axis' }, svg), ly = T + YEARS.length * ch + 16;
  el('text', { x: L, y: ly }, lg, 'Share of days that open a window:');
  [0, 0.25, 0.5, 0.75, 1].forEach((v, i) => {
    el('rect', { x: L + 240 + i * 46, y: ly - 9, width: 14, height: 10, class: v ? 'hm-c' : 'hm-c zero', 'fill-opacity': v ? 0.12 + 0.88 * v : 1 }, lg);
    el('text', { x: L + 258 + i * 46, y: ly }, lg, pct(v));
  });
  el('circle', { cx: L + 486, cy: ly - 4, r: 2.6, class: 'hm-tc' }, lg);
  el('text', { x: L + 494, y: ly }, lg, 'tropical storm inside the typhoon radius that week');
  const pick = e => {
    const t = e.target.closest?.('rect[data-wk]');
    if (!t) { tip.hidden = true; return null; }
    const r = +t.dataset.r, wk = +t.dataset.wk, v = agg.grid[r][wk];
    tipAt(tip, svg.parentNode, e.clientX, e.clientY, `<b>${YEARS[r]}, ${weekLabel(wk)}</b>
      <span class="tt-d">${pct(v)} of days open a ${s.n}-day window${stormYears?.[r]?.[wk] ? ' · tropical storm nearby' : ''}</span>`);
    return wk;
  };
  svg.onpointermove = pick;
  svg.onpointerleave = () => { tip.hidden = true; };
  svg.onclick = e => { const wk = pick(e); if (wk != null) onPick(wk); };
}

function claimBrackets(svg, x, y, which) {
  const g = el('g', { class: 'claim ' + which }, svg);
  CLAIMS[which].forEach(([a, b]) => {
    el('path', { d: `M${x(a)} ${y + 4}V${y}H${x(b)}V${y + 4}` }, g);
  });
}

/** Week climatology: bars for the window share, line for typhoon exposure, bands for claimed windows. */
export function drawWeekChart(svg, tip, agg, tcShare, s, { onPick }) {
  clear(svg);
  const L = 40, R = 10, T = 26, B = 24, W = 920, H = 250, iw = W - L - R, ih = H - T - B, bw = iw / 52;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const x = wk => L + wk * bw, y = v => T + ih * (1 - v);
  const bands = el('g', {}, svg);
  CLAIMS.wotr.forEach(([a, b]) => el('rect', { x: x(a), y: T, width: x(b) - x(a), height: ih, class: 'band wotr' }, bands));
  CLAIMS.easton.forEach(([a, b]) => el('rect', { x: x(a), y: T, width: x(b) - x(a), height: ih, class: 'band easton' }, bands));
  const ax = el('g', { class: 'tsm-axis' }, svg);
  [0, 0.25, 0.5, 0.75, 1].forEach(v => {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, ax);
    el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax, pct(v));
  });
  MONTHS.forEach((m, i) => el('text', { x: x(MONTH_WK[i]) + 2, y: H - 6 }, ax, m));
  el('text', { x: x(CLAIMS.easton[0][0]) + 3, y: T - 8, class: 'band-l' }, svg, 'April');
  el('text', { x: x(CLAIMS.easton[1][0]) + 3, y: T - 8, class: 'band-l' }, svg, 'October');
  const g = el('g', {}, svg);
  agg.week.forEach((v, wk) => el('rect', { x: x(wk) + 1, y: y(v), width: bw - 2, height: ih * v, class: wk === s.wk ? 'bar sel' : 'bar' }, g));
  if (s.r > 0) {
    el('path', { d: tcShare.map((v, wk) => `${wk ? 'L' : 'M'}${(x(wk) + bw / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(''), class: 'tcline' }, svg);
  }
  const hit = el('rect', { x: L, y: T, width: iw, height: ih, fill: 'transparent' }, svg);
  const wkAt = e => {
    const r = svg.getBoundingClientRect();
    return Math.max(0, Math.min(51, Math.floor(((e.clientX - r.left) / r.width * W - L) / bw)));
  };
  hit.onpointermove = e => {
    const wk = wkAt(e);
    tipAt(tip, svg.parentNode, e.clientX, e.clientY, `<b>${weekLabel(wk)}</b>
      <span class="tt-d">${pct(agg.week[wk])} of days open a ${s.n}-day window</span>
      ${s.r > 0 ? `<span class="tt-d">${pct(tcShare[wk])} of years had a tropical storm within ${s.r} km</span>` : ''}`);
  };
  hit.onpointerleave = () => { tip.hidden = true; };
  hit.onclick = e => onPick(wkAt(e));
}

/** Month bars ranked left to right by calendar, claimed months marked. */
export function drawMonthChart(svg, agg) {
  clear(svg);
  const L = 36, T = 16, B = 22, W = 460, H = 200, iw = W - L - 6, ih = H - T - B, bw = iw / 12;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const y = v => T + ih * (1 - v);
  const ax = el('g', { class: 'tsm-axis' }, svg);
  [0, 0.5, 1].forEach(v => {
    el('line', { x1: L, x2: W - 6, y1: y(v), y2: y(v), class: 'grid' }, ax);
    el('text', { x: L - 5, y: y(v) + 4, 'text-anchor': 'end' }, ax, pct(v));
  });
  const rank = [...agg.month.keys()].sort((a, b) => agg.month[b] - agg.month[a]);
  agg.month.forEach((v, m) => {
    const cls = m === 3 || m === 9 ? 'mbar claim' : [2, 4, 8].includes(m) ? 'mbar wotr' : 'mbar';
    el('rect', { x: L + m * bw + 3, y: y(v), width: bw - 6, height: ih * v, class: cls }, svg);
    el('text', { x: L + m * bw + bw / 2, y: y(v) - 4, 'text-anchor': 'middle', class: 'mval' }, svg, pct(v));
    el('text', { x: L + m * bw + bw / 2, y: H - 6, 'text-anchor': 'middle' }, ax, MONTHS[m]);
  });
  return rank;
}
