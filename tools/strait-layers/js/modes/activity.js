// TSM activity: daily PLA activity, CCG incidents and allied transits from TSM trackers.
import { el, project, fmt, linePath } from '../geo.js';
import { TSM } from '../../../../shared/data/tsm.js';
import { CCG_LOCS, BLUE_ROUTES } from '../layers.js';
import { dayLink, exerciseFor, exerciseLink, linkHtml } from '../../../../shared/js/links.js';

const DAY = 86400000;
const t0 = Date.parse(TSM.daily[0][0]);
const tEnd = Date.parse(TSM.asOf);
export const DATA_START = TSM.daily[0][0];
export const AS_OF = TSM.asOf;
const byDate = new Map(TSM.daily.map(r => [r[0], r]));
const iso = t => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => iso(Date.parse(d) + n * DAY);
const nice = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export const PRESETS = [
  { k: '30', t: 'Last 30 days', r: () => [addDays(AS_OF, -29), AS_OF] },
  { k: '90', t: 'Last 90 days', r: () => [addDays(AS_OF, -89), AS_OF] },
  { k: '2026', t: '2026', r: () => ['2026-01-01', AS_OF] },
  { k: '2025', t: '2025', r: () => ['2025-01-01', '2025-12-31'] },
  { k: 'all', t: 'All', r: () => [DATA_START, AS_OF] },
];

export function summarize(from, to) {
  const rows = TSM.daily.filter(r => r[0] >= from && r[0] <= to);
  const sum = i => rows.reduce((a, r) => a + (r[i] ?? 0), 0);
  const have = i => rows.filter(r => r[i] != null);
  const avg = i => { const h = have(i); return h.length ? h.reduce((a, r) => a + r[i], 0) / h.length : null; };
  const peak = rows.reduce((m, r) => (r[1] ?? -1) > (m?.[1] ?? -1) ? r : m, null);
  const ccg = TSM.ccg.filter(c => c[0] >= from && c[0] <= to);
  const byLoc = {};
  ccg.forEach(c => { byLoc[c[1]] = (byLoc[c[1]] || 0) + 1; });
  return {
    from, to, days: rows.length, aircraft: sum(1), avgAir: avg(1), adiz: have(2).length ? sum(2) : null,
    avgPlan: avg(3), avgOfficial: avg(4), peak, jcrp: rows.filter(r => String(r[5] ?? '').includes('J')).length,
    ccg, byLoc, transits: TSM.transits.filter(t => t[0] >= from && t[0] <= to),
  };
}

function delta(cur, prev) {
  if (prev == null || cur == null || prev === 0) return '';
  const p = (cur - prev) / prev * 100;
  if (Math.abs(p) < 0.5) return '<span class="delta">■ 0%</span>';
  return `<span class="delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span>`;
}

/** Exercises whose dates fall inside the window, oldest first. */
function exercisesIn(from, to) {
  const out = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) { const x = exerciseFor(d); if (x && d >= x.start && d <= x.end) out.set(x.id, x); }
  return [...out.values()];
}
const dayA = (d, text) => { const h = dayLink(d); return h ? `<a class="xlink-inline" href="${h}">${text}</a>` : text; };

export function renderStats(s) {
  const len = Math.round((Date.parse(s.to) - Date.parse(s.from)) / DAY) + 1;
  const prev = summarize(addDays(s.from, -len), addDays(s.from, -1));
  const tile = (label, v, d = '') => `<div class="tile"><span>${label}</span><b>${v}</b>${d}</div>`;
  const locs = Object.entries(s.byLoc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  return `<p class="range">${nice(s.from)} – ${nice(s.to)} <span>(${len} days, vs. prior ${len})</span></p>
  <div class="tiles">
    ${tile('PLA aircraft', fmt(s.aircraft), delta(s.aircraft, prev.aircraft))}
    ${tile('Per day', s.avgAir?.toFixed(1) ?? '—', delta(s.avgAir, prev.avgAir))}
    ${tile('Entered ADIZ', s.adiz != null ? fmt(s.adiz) : '—', delta(s.adiz, prev.adiz))}
    ${tile('PLAN ships / day', s.avgPlan?.toFixed(1) ?? '—', delta(s.avgPlan, prev.avgPlan))}
    ${tile('Joint readiness patrols', s.jcrp, delta(s.jcrp, prev.jcrp))}
    ${tile('CCG incursions', s.ccg.length, delta(s.ccg.length, prev.ccg.length))}
  </div>
  ${s.peak && s.peak[1] ? `<p class="fine">Peak day: <b>${dayA(s.peak[0], nice(s.peak[0]))}</b>, ${s.peak[1]} aircraft${String(s.peak[5] ?? '').includes('J') ? ' (joint combat readiness patrol)' : ''}.</p>` : ''}
  ${locs ? `<p class="fine">CCG by location: ${locs}.</p>` : ''}
  <div class="transits"><p class="eyebrow sm">Allied Strait transits (${s.transits.length})</p>${
    s.transits.length ? '<ul>' + s.transits.slice(-8).reverse().map(t => `<li><span class="num">${dayA(t[0], t[0])}</span> ${t[1]} <span class="muted">${t[5]}</span></li>`).join('') + '</ul>' + (s.transits.length > 8 ? `<p class="fine">Showing the latest 8.</p>` : '')
    : '<p class="fine">None in this window.</p>'}</div>
  ${(() => {
    const xs = exercisesIn(s.from, s.to);
    return xs.length ? `<div class="xlinks"><span class="fine">Major exercises in this window:</span> ${xs.slice(-4).map(x => linkHtml(exerciseLink(x.id), `Replay ${x.short}`)).join(' ')}</div>` : '';
  })()}
  <p class="fine">ADIZ entries run from August 2022 and PLAN and official-ship counts from August 2024, checked against Taiwan MND reports. Days MND contradicts are left blank. CCG incursions here start ${nice(TSM.ccg[0][0])}, so longer windows undercount them; the <a href="../ccg-grayzone/">CCG Gray-Zone Map</a> has the full tracker.</p>`;
}

/** Draw the full-range timeline once; returns { setWindow } to move the selection. */
export function drawTimeline(svg, from, to, onBrush, onHover) {
  const Wd = 1000, Hd = 190, top = 26, base = 132, x0 = 50;
  const span = tEnd - t0;
  const X = d => x0 + (Date.parse(d) - t0) / span * (Wd - x0 - 8);
  const max = Math.max(...TSM.daily.map(r => r[1] ?? 0));
  const Y = v => base - v / max * (base - top);
  svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
  svg.innerHTML = '';
  [0, 50, 100, 150].filter(v => v <= max).forEach(v => {
    el('line', { x1: x0, x2: Wd - 8, y1: Y(v), y2: Y(v), class: 'tl-grid' }, svg);
    el('text', { x: x0 - 5, y: Y(v) + 3, class: 'tl-axis', 'text-anchor': 'end' }, svg, v);
  });
  for (let y = 2023; y <= 2026; y++) {
    const x = X(`${y}-01-01`);
    el('line', { x1: x, x2: x, y1: top - 8, y2: Hd - 22, class: 'tl-year' }, svg);
    el('text', { x: x + 3, y: Hd - 8, class: 'tl-axis' }, svg, y);
  }
  const win = el('rect', { y: top - 10, height: Hd - top - 10, class: 'tl-window' }, svg);
  const setWindow = (a, b) => { win.setAttribute('x', X(a)); win.setAttribute('width', Math.max(2, X(b) - X(a) + 1)); };
  setWindow(from, to);
  let bars = '';
  TSM.daily.forEach(r => { if (r[1]) { const x = X(r[0]).toFixed(1); bars += `M${x} ${base}V${Y(r[1]).toFixed(1)}`; } });
  el('path', { d: bars, class: 'tl-bars' }, svg);
  TSM.daily.filter(r => String(r[5] ?? '').includes('J')).forEach(r => el('path', { d: `M${X(r[0])} ${top - 12}l3 5l-6 0z`, class: 'tl-jcrp' }, svg));
  el('text', { x: x0 - 5, y: top - 8, class: 'tl-axis', 'text-anchor': 'end' }, svg, 'JCRP');
  const rowC = base + 14, rowT = base + 28;
  el('text', { x: x0 - 5, y: rowC + 3, class: 'tl-axis', 'text-anchor': 'end' }, svg, 'CCG');
  el('text', { x: x0 - 5, y: rowT + 3, class: 'tl-axis', 'text-anchor': 'end' }, svg, 'Transit');
  TSM.ccg.forEach(c => { const x = X(c[0]); el('path', { d: `M${x} ${rowC - 4}l4 4l-4 4l-4 -4z`, class: 'tl-ccg' }, svg); });
  TSM.transits.forEach(t => { if (t[0] >= DATA_START) { const x = X(t[0]); el('path', { d: `M${x} ${rowT - 4}l4 7h-8z`, class: 'tl-transit' }, svg); } });
  const hover = el('line', { x1: 0, x2: 0, y1: top - 10, y2: Hd - 22, class: 'tl-hover' }, svg);
  hover.style.display = 'none';

  const toDate = e => {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * Wd;
    return iso(Math.max(t0, Math.min(tEnd, t0 + (x - x0) / (Wd - x0 - 8) * span)));
  };
  let start = null;
  svg.onpointerdown = e => { svg.setPointerCapture(e.pointerId); start = toDate(e); };
  svg.onpointermove = e => {
    const d = toDate(e);
    hover.style.display = ''; hover.setAttribute('x1', X(d)); hover.setAttribute('x2', X(d));
    onHover(byDate.get(d) || [d], TSM.ccg.filter(c => c[0] === d), TSM.transits.filter(t => t[0] === d));
    if (start) { const a = start < d ? start : d, b = start < d ? d : start; onBrush(a, b, true); }
  };
  svg.onpointerup = e => { if (start) { const d = toDate(e); const a = start < d ? start : d, b = start < d ? d : start; onBrush(a === b ? addDays(a, -14) : a, a === b ? addDays(a, 14) : b, false, a === b ? a : null); } start = null; };
  svg.onpointerleave = () => { hover.style.display = 'none'; onHover(null); };
  // Keyboard: arrows step a day (Page Up/Down a month), Enter keeps that day with a four-week window.
  let kd = null;
  const lastDay = iso(tEnd);
  svg.setAttribute('tabindex', '0');
  svg.onkeydown = e => {
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 30, PageDown: -30, Home: -1e5, End: 1e5 }[e.key];
    if (step != null) {
      e.preventDefault();
      kd = kd ? addDays(kd, step) : lastDay;
      if (kd < iso(t0)) kd = iso(t0);
      if (kd > lastDay) kd = lastDay;
      hover.style.display = ''; hover.setAttribute('x1', X(kd)); hover.setAttribute('x2', X(kd));
      onHover(byDate.get(kd) || [kd], TSM.ccg.filter(c => c[0] === kd), TSM.transits.filter(t => t[0] === kd));
    } else if (e.key === 'Enter' && kd) { e.preventDefault(); onBrush(addDays(kd, -14), addDays(kd, 14), false, kd); }
  };
  svg.onblur = () => { hover.style.display = 'none'; };
  return { setWindow };
}

/** Hover text for one date, looked up from the TSM trackers. */
export const dayText = d => hoverText(byDate.get(d) || [d], TSM.ccg.filter(c => c[0] === d), TSM.transits.filter(t => t[0] === d));

export function hoverText(row, ccg, tr) {
  if (!row) return '';
  const [d, air, adiz, plan, off, f] = row;
  const bits = [air != null ? `${air} aircraft` : 'no aircraft report', adiz != null ? `${adiz} into ADIZ` : '', plan != null ? `${plan} PLAN ships` : '', off != null ? `${off} official ships` : ''].filter(Boolean);
  const extra = [String(f ?? '').includes('J') ? 'Joint combat readiness patrol' : String(f ?? '').includes('L') ? 'Long-distance flight' : '',
    ...ccg.map(c => `CCG: ${c[1]}`), ...tr.map(t => `Transit: ${t[1]} (${t[5]})`)].filter(Boolean);
  const x = exerciseFor(d), links = [linkHtml(dayLink(d), 'See this day'), x ? linkHtml(exerciseLink(x.id, d), `Replay ${x.short}`) : ''].filter(Boolean).join(' ');
  return `<b>${nice(d)}</b> · ${bits.join(' · ')}${extra.length ? '<br>' + extra.join('<br>') : ''}${links ? `<br><span class="xlinks">${links}</span>` : ''}`;
}

/** Map overlay for the selected window. */
export function drawOverlay(g, s, adizEl) {
  g.innerHTML = '';
  Object.entries(s.byLoc).forEach(([loc, n]) => {
    const L = CCG_LOCS[loc]; if (!L) return;
    const [x, y] = project(L.c), r = 6 + Math.sqrt(n) * 5;
    el('circle', { cx: x, cy: y, r, class: 'ccg-bubble' }, g);
    el('text', { x, y: y + 4, class: 't-ccg-n', 'text-anchor': 'middle' }, g, n);
    el('text', { x: x + r + 4, y: y + 4, class: 't-ccg' }, g, L.offmap || L.label || loc);
  });
  if (s.transits.length) {
    const pts = BLUE_ROUTES.find(r => r.id === 'strait').pts;
    el('path', { d: linePath(pts), class: 'transit-line', 'marker-end': 'url(#arrow-blue)' }, g);
    const [x, y] = project([118.4, 22.2]);
    el('text', { x, y, class: 't-transit', 'text-anchor': 'end' }, g, `${s.transits.length} allied transit${s.transits.length > 1 ? 's' : ''}`);
  }
  const avg = s.adiz != null && s.days ? s.adiz / s.days : (s.avgAir ?? 0) * 0.7;
  adizEl.style.setProperty('--adiz-heat', Math.min(0.42, avg / 30).toFixed(3));
}
