// Single-week drill-down: which tests fail, wind and wave spread, fog, storms, and moon, light and tide.
import { el, escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { POINTS, STATIONS, YEARS, weekLabel, weekDates, fmtDay, weekFailShares, weekDist, weekStorms, weekFog } from './model.js';
import { PORTS, sunTimes, moonIllum, phaseName, tideAt } from './astro.js';

const pct = v => (v == null ? 'n/a' : Math.round(v * 100) + '%');
const TZ = 8 * 36e5; // Taiwan and Fujian: UTC+8, no daylight saving
const hhmm = d => new Date(+d + TZ).toISOString().slice(11, 16);
function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

/** Horizontal box plot of one variable against its threshold. */
function boxPlot(svg, q, thr, max, unit, label) {
  clear(svg);
  const W = 420, H = 58, L = 8, R = 8, x = v => L + (W - L - R) * Math.min(1, v / max);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const ax = el('g', { class: 'tsm-axis' }, svg);
  for (let v = 0; v <= max + 1e-9; v += max / 4) {
    el('line', { x1: x(v), x2: x(v), y1: 12, y2: 40, class: 'grid' }, ax);
    el('text', { x: x(v), y: 54, 'text-anchor': v === 0 ? 'start' : v >= max ? 'end' : 'middle' }, ax, `${+v.toFixed(2)}${v >= max ? ' ' + unit : ''}`);
  }
  if (q.n) {
    el('line', { x1: x(q.p10), x2: x(q.p90), y1: 26, y2: 26, class: 'bx-w' }, svg);
    el('rect', { x: x(q.p25), y: 17, width: Math.max(2, x(q.p75) - x(q.p25)), height: 18, class: 'bx' }, svg);
    el('line', { x1: x(q.p50), x2: x(q.p50), y1: 15, y2: 37, class: 'bx-m' }, svg);
  }
  el('line', { x1: x(thr), x2: x(thr), y1: 6, y2: 44, class: 'thr' }, svg);
  el('text', { x: Math.min(W - 4, x(thr) + 4), y: 10, class: 'thr-l', 'text-anchor': x(thr) > W - 90 ? 'end' : 'start' }, svg, `limit ${thr} ${unit}`);
  svg.setAttribute('aria-label', `${label}: median ${q.p50 ?? 'n/a'} ${unit}, middle half ${q.p25} to ${q.p75} ${unit}, limit ${thr} ${unit}`);
}

/** Moon, light and tide for the 7 days of the week in a chosen year at a chosen port. */
function tideChart(svg, days, port) {
  clear(svg);
  const P = PORTS[port], [lat, lon] = P.grid;
  const W = 920, H = 230, L = 40, R = 10, T = 34, B = 26, iw = W - L - R, ih = H - T - B;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const t0 = +days[0] - TZ, t1 = +days[days.length - 1] - TZ + 864e5; // local midnight to midnight
  const pts = [];
  for (let t = t0; t <= t1; t += 9e5) pts.push([t, tideAt(port, new Date(t))]);
  const hs = pts.map(p => p[1]), top = Math.ceil(Math.max(...hs, 0.5) * 2) / 2, bot = Math.floor(Math.min(...hs, -0.5) * 2) / 2;
  const x = t => L + iw * (t - t0) / (t1 - t0), y = h => T + ih * (top - h) / (top - bot);
  const rows = [];
  days.forEach((d, i) => {
    const mid = +d - TZ + 12 * 36e5;
    const s = sunTimes(new Date(mid), lat, lon), sNext = sunTimes(new Date(mid + 864e5), lat, lon);
    const m = moonIllum(new Date(+s.set + 3 * 36e5));
    // night from sunset to next sunrise, clipped to the chart
    const a = Math.max(t0, +s.set), b = Math.min(t1, +sNext.rise);
    if (b > a) el('rect', { x: x(a), y: T, width: x(b) - x(a), height: ih, class: 'night', 'fill-opacity': 0.3 - 0.2 * m.fraction }, svg);
    if (i === 0 && +s.rise > t0) el('rect', { x: x(t0), y: T, width: x(+s.rise) - x(t0), height: ih, class: 'night', 'fill-opacity': 0.3 - 0.2 * moonIllum(new Date(t0)).fraction }, svg);
    const cx = Math.min(W - R - 48, x(+s.set + 5 * 36e5));
    moonIcon(svg, cx, T - 16, 7, m);
    el('text', { x: cx + 11, y: T - 12, class: 'mval' }, svg, pct(m.fraction));
    const day = pts.filter(p => p[0] >= +d - TZ && p[0] < +d - TZ + 864e5).map(p => p[1]);
    rows.push({ d, rise: s.rise, set: s.set, dusk: s.dusk, moon: m, hi: Math.max(...day), lo: Math.min(...day) });
  });
  const ax = el('g', { class: 'tsm-axis' }, svg);
  for (let h = bot; h <= top + 1e-9; h += 0.5) {
    el('line', { x1: L, x2: W - R, y1: y(h), y2: y(h), class: 'grid' }, ax);
    if (Math.abs(h * 2 % 2) < 1e-9 || top - bot <= 3) el('text', { x: L - 5, y: y(h) + 4, 'text-anchor': 'end' }, ax, `${h > 0 ? '+' : ''}${h} m`);
  }
  days.forEach(d => {
    const tx = x(+d - TZ);
    el('line', { x1: tx, x2: tx, y1: T, y2: T + ih, class: 'dayline' }, ax);
    el('text', { x: tx + 4, y: H - 8 }, ax, fmtDay(d));
  });
  el('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(''), class: 'tide' }, svg);
  svg.setAttribute('aria-label', `Predicted tide at ${P.label} with night shading and moon illumination for ${fmtDay(days[0])} to ${fmtDay(days[days.length - 1])}`);
  return rows;
}

function moonIcon(svg, cx, cy, r, m) {
  el('circle', { cx, cy, r, class: 'moon-dark' }, svg);
  // lit part: ellipse terminator. Waxing lit on the right, waning on the left.
  const k = 1 - 2 * m.fraction, waxing = m.phase < 0.5, sw = waxing ? 1 : 0;
  const rx = Math.abs(k) * r;
  const d = `M${cx} ${cy - r}A${r} ${r} 0 0 ${sw} ${cx} ${cy + r}A${rx} ${r} 0 0 ${k > 0 ? 1 - sw : sw} ${cx} ${cy - r}Z`;
  el('path', { d, class: 'moon-lit' }, svg);
}

export function renderDrill(root, s, ev) {
  const wk = s.wk, P = POINTS[s.p], f = weekFailShares(ev, wk);
  const wind = weekDist(P.wind, wk), wave = weekDist(P.wave, wk, 0.1);
  const storms = weekStorms(wk, s.r || 500), fog = weekFog(s.st, wk);
  root.querySelector('#dr-title').textContent = weekLabel(wk);
  root.querySelector('#dr-sub').textContent = `${P.label}, all ${YEARS.length} years ${YEARS[0]} to ${YEARS[YEARS.length - 1]}`;
  const bars = [['Go days (pass every test)', f.go, 'go'], [`Waves above ${s.h} m`, f.wave, 'x'], [`Wind above ${s.w} kt`, f.wind, 'x'],
    [s.fog ? `Fog reported at ${STATIONS[s.st].label.split(' (')[0]}` : 'Fog test off', s.fog ? f.fog : null, 'x'],
    [s.r > 0 ? `Tropical storm within ${s.r} km` : 'Typhoon test off', s.r > 0 ? f.tc : null, 'x']];
  root.querySelector('#dr-tests').innerHTML = bars.map(([t, v, c]) => `<div class="tb ${c}"><span>${t}</span>
    <i><b style="width:${v == null ? 0 : Math.round(v * 100)}%"></b></i><em class="num">${v == null ? 'off' : pct(v)}</em></div>`).join('');
  boxPlot(root.querySelector('#dr-wind'), wind, s.w, 50, 'kt', 'Daily max wind');
  boxPlot(root.querySelector('#dr-wave'), wave, s.h, 5, 'm', 'Daily max significant wave height');
  root.querySelector('#dr-wind-t').textContent = `median ${wind.p50} kt · 1 day in 10 above ${wind.p90} kt`;
  root.querySelector('#dr-wave-t').textContent = `median ${wave.p50?.toFixed(1)} m · 1 day in 10 above ${wave.p90?.toFixed(1)} m`;
  const st = storms.storms;
  root.querySelector('#dr-storms').innerHTML = `<p><b class="num">${pct(storms.share)}</b> of years had a tropical storm or typhoon within ${s.r || 500} km of the Strait center this week.</p>
    ${st.length ? `<p class="fine">${st.slice(0, 10).map(([n, d]) => `${esc(n)} <span class="num">${d} km</span>`).join(' · ')}${st.length > 10 ? ` and ${st.length - 10} more` : ''}</p>` : '<p class="fine">None in the record for this week.</p>'}`;
  root.querySelector('#dr-fog').innerHTML = fog.share == null ? '<p class="fine">No station reports for this week.</p>'
    : `<p>Fog was reported on <b class="num">${pct(fog.share)}</b> of days at ${esc(STATIONS[s.st].label)} (${fog.n} station-days).</p>`;
  const days = weekDates(wk, s.yr);
  const rows = tideChart(root.querySelector('#dr-tide'), days, s.port);
  root.querySelector('#dr-tide-h').textContent = `Moon, light and tide, ${fmtDay(days[0])} to ${fmtDay(days[days.length - 1])}, ${s.yr}`;
  root.querySelector('#dr-rows').innerHTML = rows.map(r => `<tr><td>${fmtDay(r.d)}</td><td class="num">${hhmm(r.rise)}</td><td class="num">${hhmm(r.set)}</td>
    <td class="num">${hhmm(r.dusk)}</td><td>${phaseName(r.moon.phase)} <span class="num">${pct(r.moon.fraction)}</span></td><td class="num">${(r.hi - r.lo).toFixed(1)} m</td></tr>`).join('');
  return f;
}
