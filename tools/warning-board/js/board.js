// Rendering for the indicator tiles, domain gauges, band strip and the exercise-duration chart.
import { el, escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { INDICATORS, DOMAINS } from '../data/indicators.js';
import { BANDS } from './model.js';

const STATE_LABEL = ['Not observed', 'Ambiguous', 'Observed'];
const EX_LABEL = { high: 'Exercises produce this', some: 'Exercises sometimes produce this', low: 'Rare in exercises' };
const OBS_LABEL = { imagery: 'imagery', announced: 'public statements', data: 'trade, flight or ship data', hard: 'hard to see' };

/** Semicircle gauge per domain. */
export function drawGauges(root, a) {
  root.innerHTML = '';
  a.domains.forEach(d => {
    const wrap = document.createElement('div');
    wrap.className = 'gauge';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 72');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${d.name}: ${Math.round(d.score * 100)} percent of weighted indicators lit`);
    const arc = f => {
      const t = Math.PI * (1 - f), x = 60 + 48 * Math.cos(t), y = 62 - 48 * Math.sin(t);
      return `M12 62A48 48 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    };
    el('path', { d: 'M12 62A48 48 0 0 1 108 62', class: 'g-bg' }, svg);
    if (d.score > 0.001) el('path', { d: arc(Math.min(0.999, d.score)), class: 'g-fg', style: `stroke:${d.color}` }, svg);
    el('line', { x1: 60 + 40 * Math.cos(Math.PI * 0.65), y1: 62 - 40 * Math.sin(Math.PI * 0.65), x2: 60 + 56 * Math.cos(Math.PI * 0.65), y2: 62 - 56 * Math.sin(Math.PI * 0.65), class: 'g-tick' }, svg);
    el('text', { x: 60, y: 58, class: 'g-val', 'text-anchor': 'middle' }, svg, Math.round(d.score * 100) + '');
    wrap.appendChild(svg);
    const cap = document.createElement('p');
    cap.innerHTML = `<b>${esc(d.name)}</b><span>${d.lit} of ${d.n} lit</span>`;
    wrap.appendChild(cap);
    root.appendChild(wrap);
  });
}

/** Five-segment band strip with the current band marked, plus the exercise-overlap bar. */
export function drawBand(root, a) {
  root.innerHTML = `<div class="bandstrip" role="img" aria-label="Overall assessment: ${esc(a.band.name)}">
    ${BANDS.map(b => `<span class="seg-b b${b.id}${b.id === a.band.id ? ' on' : ''}"><i></i><small>${esc(b.short)}</small></span>`).join('')}
  </div>
  <div class="overlap">
    <div class="ov-h"><span>Signal an exercise could explain</span><b class="num">${a.lit ? Math.round(a.exShare * 100) + '%' : '–'}</b></div>
    <div class="ov-bar"><i style="width:${a.lit ? a.exShare * 100 : 0}%"></i></div>
    <small>Share of the weighted, lit signal coming from indicators that exercises also produce. <span class="notional">notional</span></small>
  </div>`;
}

/** Indicator tiles grouped by domain. */
export function drawBoard(root, states, selected, highlightEx) {
  root.innerHTML = DOMAINS.map(d => {
    const list = INDICATORS.filter(i => i.d === d.id);
    return `<section class="dom" style="--dc:${d.color}" aria-labelledby="dh-${d.id}">
      <h3 id="dh-${d.id}"><span class="dot"></span>${esc(d.name)}</h3>
      <div class="tiles">${list.map(i => tile(i, states[i.id] || 0, i.id === selected, highlightEx)).join('')}</div>
    </section>`;
  }).join('');
}

function tile(i, s, sel, hx) {
  return `<div class="ind s${s}${sel ? ' sel' : ''}${hx && i.ex === 'high' ? ' hx' : ''}" data-id="${i.id}">
    <button type="button" class="ind-name" data-info="${i.id}" aria-pressed="${sel}" title="Show details">${esc(i.name)}</button>
    <div class="seg" role="radiogroup" aria-label="${esc(i.name)}">
      ${STATE_LABEL.map((l, v) => `<button type="button" role="radio" aria-checked="${s === v}" data-set="${i.id}" data-v="${v}" class="v${v}">${l}</button>`).join('')}
    </div>
    <div class="tags"><span class="tag ex-${i.ex}">${i.ex === 'high' ? 'exercise-typical' : i.ex === 'some' ? 'some overlap' : 'rare in drills'}</span><span class="tag">lead: ${i.lead}</span><span class="wdots" title="Weight ${i.w} of 3: how diagnostic the indicator is" aria-label="Weight ${i.w} of 3">${'<span class="wdot"></span>'.repeat(i.w)}</span></div>
  </div>`;
}

/** Detail card for one indicator. */
export function detailHtml(i, SOURCES) {
  if (!i) return '<p class="fine">Click an indicator\'s name to see what it is, why it is ambiguous and who discusses it.</p>';
  const d = DOMAINS.find(x => x.id === i.d);
  return `<p class="eyebrow" style="color:${d.color}">${esc(d.name)}</p>
    <h3 class="det-h">${esc(i.name)}</h3>
    <p>${esc(i.desc)}</p>
    <p class="amb"><b>Why it is ambiguous.</b> ${esc(i.amb)}</p>
    <dl class="readout">
      <dt>Weight</dt><dd>${i.w} of 3 <span class="notional">notional</span></dd>
      <dt>In exercises</dt><dd>${EX_LABEL[i.ex]}</dd>
      <dt>Lead time</dt><dd>${i.lead}</dd>
      <dt>Seen through</dt><dd>${OBS_LABEL[i.obs]}</dd>
    </dl>
    <ul class="src det-src">${i.src.map(id => `<li>${esc(SOURCES[id].cite)} ${SOURCES[id].url ? `<a href="${SOURCES[id].url}" target="_blank" rel="noopener">Link</a>` : ''}</li>`).join('')}</ul>`;
}

/** Horizontal bars: duration of major PLA exercises, 2022–2025. */
export function drawExercises(svg, EXERCISES) {
  const days = e => Math.round((Date.parse(e.end) - Date.parse(e.start)) / 864e5) + 1;
  const W = 560, rowH = 26, L = 170, T = 8, H = T + EXERCISES.length * rowH + 26, max = 14;
  const x = v => L + (W - L - 10) * v / max;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  el('rect', { x: x(0), y: T - 4, width: x(max) - x(0), height: EXERCISES.length * rowH + 4, class: 'ex-zone' }, svg);
  [0, 7, 14].forEach(v => {
    el('line', { x1: x(v), x2: x(v), y1: T - 4, y2: H - 20, class: 'ex-grid' }, svg);
    el('text', { x: x(v), y: H - 6, class: 'ex-ax', 'text-anchor': 'middle' }, svg, v + ' d');
  });
  EXERCISES.forEach((e, k) => {
    const y = T + k * rowH;
    const a = el('a', { href: e.url, target: '_blank', rel: 'noopener' }, svg);
    el('title', {}, a, `${e.name}: ${e.start} to ${e.end}, ${days(e)} day${days(e) > 1 ? 's' : ''}. Opens source.`);
    el('text', { x: L - 8, y: y + rowH / 2 + 4, class: 'ex-name', 'text-anchor': 'end' }, a, e.name);
    el('rect', { x: x(0), y: y + 6, width: x(days(e)) - x(0), height: rowH - 12, rx: 2, class: 'ex-bar' }, a);
    el('text', { x: x(days(e)) + 5, y: y + rowH / 2 + 4, class: 'ex-ax' }, a, days(e) + (days(e) > 1 ? ' days' : ' day'));
  });
}
