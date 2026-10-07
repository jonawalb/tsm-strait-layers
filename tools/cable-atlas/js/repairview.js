// Repair capacity: the regional cable-ship fleet (home ports), sourced historical repair durations, and a
// transit-time estimator from a home port to a landing site (sailing time only, speed is a labelled assumption).
import { el, escapeHtml as esc, distKm } from '../../../shared/js/mapkit.js';
import { SHIPS, DURATIONS, ZONES, TAIWAN_SHIP, STATS } from '../data/repair.js';
import { LP } from './net.js';
import { fmtDate } from './util.js';

const DEST = ['toucheng-taiwan', 'tanshui-taiwan', 'fangshan-taiwan', 'magong-taiwan', 'nangan-taiwan', 'dongyin-taiwan',
  'guningtou-taiwan', 'naha-japan', 'shiraho-japan', 'yonaguni-japan', 'baler-philippines', 'batangas-philippines', 'davao-philippines'];
const link = s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`;

export function createRepair(root, S, act) {
  const ports = [...new Map(SHIPS.filter(s => s.base_lon != null).map(s => [s.base_port, s])).values()];
  root.innerHTML = `
    <div class="rp-h"><p class="eyebrow">Repair capacity</p><h2>Who fixes a cut cable, and how long it takes</h2></div>
    <div class="rp-grid">
      <div class="card rp-card">
        <p class="eyebrow">Historical repair durations</p>
        <p class="fine">Days from the reported fault to the reported repair, where both dates are on the record.</p>
        <svg id="dur" class="dur" role="img" aria-label="Bar chart of cable repair durations in days"></svg>
        <details><summary class="fine">Dates and sources for each bar</summary><ul class="plain fine" id="dur-src"></ul></details>
        <p class="eyebrow mt">How often</p><ul class="plain">${STATS.map(t => `<li>${esc(t.text)} ${t.sources.map(link).join(' · ')}</li>`).join('')}</ul>
      </div>
      <div class="card rp-card">
        <p class="eyebrow">How far is help?</p>
        <label class="sel">From home port <select id="rp-from">${ports.map(p => `<option>${esc(p.base_port)}</option>`).join('')}</select></label>
        <label class="sel">To landing site <select id="rp-to">${DEST.filter(d => LP[d]).map(d => `<option value="${d}">${esc(LP[d].name)}</option>`).join('')}</select></label>
        <label class="slider"><span class="sl-h"><span>Transit speed <span class="notional">assumption</span></span><output id="rp-kn"></output></span>
          <input type="range" id="rp-speed" min="8" max="15" step="1" aria-label="Transit speed in knots">
          <small>Cable ships cruise at roughly 10 to 15 knots; pick a speed. Great-circle distance, so real routes are longer.</small></label>
        <div class="status" id="rp-out"></div>
        <p class="fine">Sailing time is the smallest part of a repair. Ships must first be released from other work, load spare cable, get permits for the waters they work in, and wait for weather; the recorded durations on the left include all of that.</p>
      </div>
    </div>
    <div class="card rp-card">
      <p class="eyebrow">Cable ships that serve these waters</p>
      <div id="tw-ship"></div>
      <div class="tablewrap"><table class="ships"><thead><tr><th>Ship</th><th>Operator</th><th>Home port</th><th>Built</th><th>Source</th></tr></thead><tbody>
      ${SHIPS.map(s => `<tr><td><b>${esc(s.name)}</b>${s.notes ? `<br><small class="muted">${esc(s.notes)}</small>` : ''}</td><td>${esc(s.operator || '')}</td><td>${esc(s.base_port || 'not stated')}</td><td class="num">${esc(s.built || '')}</td>
        <td>${(s.sources || []).map(link).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
      ${ZONES.length ? `<p class="eyebrow mt">Maintenance agreements</p><ul class="plain">${ZONES.map(z => `<li><b>${esc(z.name)}</b>: ${esc(z.summary)} ${(z.sources || []).map(link).join(' · ')}</li>`).join('')}</ul>` : ''}
      <p class="fine">Positions are home ports, not live locations. The atlas has no live feed of repair-ship positions or availability (see Method).</p>
    </div>`;
  const $ = s => root.querySelector(s);
  if (TAIWAN_SHIP) $('#tw-ship').innerHTML = `<div class="callout"><b>${esc(TAIWAN_SHIP.headline)}</b> ${esc(TAIWAN_SHIP.text)} ${(TAIWAN_SHIP.sources || []).map(link).join(' · ')}</div>`;

  // Durations chart
  const rows = DURATIONS.filter(d => d.days != null).sort((a, b) => b.days - a.days);
  const svg = $('#dur'), W = 520, rowH = 26, H = rows.length * rowH + 24, max = Math.max(60, ...rows.map(r => r.days));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const x0 = 200, sx = d => x0 + d / max * (W - x0 - 46);
  for (let d = 0; d <= max; d += max > 120 ? 30 : 15) {
    el('line', { x1: sx(d), x2: sx(d), y1: 0, y2: H - 18, class: 'dgrid' }, svg);
    el('text', { x: sx(d), y: H - 4, class: 'dax', 'text-anchor': 'middle' }, svg, d);
  }
  rows.forEach((r, i) => {
    const y = i * rowH + 4;
    el('text', { x: x0 - 8, y: y + 15, class: 'dlab', 'text-anchor': 'end' }, svg, r.short || r.event);
    el('rect', { x: x0, y: y + 3, width: Math.max(2, sx(r.days) - x0), height: rowH - 9, class: 'dbar' }, svg);
    el('text', { x: sx(r.days) + 5, y: y + 15, class: 'dval' }, svg, `${r.days} d`);
  });
  $('#dur-src').innerHTML = rows.map(r => `<li>${esc(r.short || r.event)}: ${esc(fmtDate(r.fault_date))} to ${esc(fmtDate(r.repaired_date))}. ${(r.sources || []).map(link).join(' · ')}</li>`).join('');

  const calc = () => {
    const p = ports.find(q => q.base_port === $('#rp-from').value), d = LP[$('#rp-to').value];
    if (!p || !d) return;
    const km = distKm([p.base_lon, p.base_lat], [d.lon, d.lat]), days = km / 1.852 / S.speed / 24;
    $('#rp-kn').textContent = S.speed + ' kn';
    $('#rp-out').innerHTML = `<b>${days < 1 ? 'under a day' : days.toFixed(1) + ' days'}</b><span>${Math.round(km).toLocaleString('en-US')} km great-circle from ${esc(p.base_port)} to ${esc(d.name)} at ${S.speed} knots</span>`;
  };
  $('#rp-from').onchange = calc; $('#rp-to').onchange = calc;
  $('#rp-speed').oninput = e => act.set({ speed: +e.target.value });
  return { render() { $('#rp-speed').value = S.speed; calc(); } };
}
