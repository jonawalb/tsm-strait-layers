// Tables under the dashboard: Taiwan contingency effect on each voyage, and the chokepoint fact sheet.
import { fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { CHOKEPOINTS, SOURCES, HORMUZ } from '../data/chokepoints.js';
import { VOYAGES, PRESETS } from '../data/voyages.js';
import { route, days, KM_PER_NM } from './graph.js';

export function renderTable(box) {
  const tw = new Set(PRESETS.find(p => p.id === 'taiwan').closed);
  const rows = VOYAGES.map(v => {
    const a = route(v.from, v.to), b = route(v.from, v.to, tw);
    const cell = b ? `+${fmt((b.km - a.km) / KM_PER_NM)} nm · +${(days(b.km, 14) - days(a.km, 14)).toFixed(1)} days` : 'no route: destination inside the closure';
    const touched = a.tags.filter(t => tw.has(t)).map(t => CHOKEPOINTS.find(c => c.id === t).short);
    return `<tr><td>${v.name}</td><td>${touched.length ? touched.join(', ') : 'none'}</td><td class="num">${cell}</td></tr>`;
  }).join('');
  const src = s => s ? ` <a href="${SOURCES[s].u}" target="_blank" rel="noopener">[${s.startsWith('w') ? 'Wikipedia' : s === 'ne' ? 'measured' : s.startsWith('eia') ? 'EIA' : 'CSIS'}]</a>` : '';
  const facts = [...CHOKEPOINTS, { ...HORMUZ, short: 'Hormuz' }].map(c => `<tr><td><b>${c.name}</b>${c.tw ? ' <span class="pill cp-pill-tw">Taiwan</span>' : ''}</td>
    <td>${c.facts.map(([k, v, s]) => `<div><span class="muted">${k}:</span> ${escapeHtml(v)}${src(s)}</div>`).join('')}</td></tr>`).join('');
  box.innerHTML = `
    <h2>What a Taiwan contingency does to each voyage</h2>
    <p>The <b>Taiwan contingency</b> preset closes the Taiwan Strait, the Luzon Strait and Bashi Channel, and the waters between Taiwan and Yonaguni. Miyako stays open. Distances at 14 knots <span class="notional">notional</span>.</p>
    <div class="tablewrap"><table><thead><tr><th>Voyage</th><th>Contingency waters on the normal route</th><th>Added by the detour</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h2 class="mt">Chokepoint fact sheet</h2>
    <div class="tablewrap"><table class="cp-facts-t"><thead><tr><th>Chokepoint</th><th>Facts and sources</th></tr></thead><tbody>${facts}</tbody></table></div>`;
}

/** Chokepoint fact sheet as CSV rows (one row per fact), for "Copy data as CSV". */
export function factsCsv() {
  return [['chokepoint', 'fact', 'value', 'source'],
    ...[...CHOKEPOINTS, HORMUZ].flatMap(c => c.facts.map(([k, v, s]) => [c.name, k, v, s ? SOURCES[s].u : '']))];
}
