// Site table under the map: every site, its distance to PRC territory, what reaches it, and its sources.
import { fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { SITES, LAYERS } from '../data/sites.js';
import { MISSILES } from '../data/pla.js';
import { siteReach } from './model.js';

const LAYER = Object.fromEntries(LAYERS.map(l => [l.id, l]));

export function renderTable(box) {
  const rows = SITES.map(s => ({ s, r: siteReach(s) })).sort((a, b) => a.r.prc.km - b.r.prc.km);
  box.innerHTML = `<div class="tablewrap"><table class="ic-table"><thead><tr><th>Site</th><th>Layer</th><th>To PRC territory</th><th>Reached from PRC territory by</th><th>Source</th></tr></thead><tbody>
    ${rows.map(({ s, r }) => `<tr><td><b>${escapeHtml(s.n)}</b><br><span class="muted">${escapeHtml(s.where)}${s.approx ? ' · island-level' : ''}</span></td>
      <td><span style="color:var(${LAYER[s.layer].col})">${LAYER[s.layer].name}</span></td>
      <td class="num">${fmt(r.prc.km)} km</td>
      <td>${MISSILES.filter(m => r.fromPRC.includes(m.id)).map(m => `<span class="pill" style="color:var(${m.col})">${m.name}</span>`).join('') || '<span class="muted">none listed</span>'}</td>
      <td>${s.src.map((x, i) => `<a href="${x.u}" target="_blank" rel="noopener" title="${escapeHtml(x.t)}">[${i + 1}]</a>`).join(' ')}</td></tr>`).join('')}
  </tbody></table></div>`;
}

/** The site table as CSV rows (header first), for "Copy data as CSV". */
export function tableCsv() {
  const rows = SITES.map(s => ({ s, r: siteReach(s) })).sort((a, b) => a.r.prc.km - b.r.prc.km);
  return [['site', 'location', 'layer', 'km_to_prc_territory', 'reached_from_prc_territory_by', 'position', 'sources'],
    ...rows.map(({ s, r }) => [s.n, s.where, LAYER[s.layer].name, Math.round(r.prc.km),
      MISSILES.filter(m => r.fromPRC.includes(m.id)).map(m => m.name).join('; '),
      s.approx ? 'island-level' : 'installation', s.src.map(x => x.u).join(' ')])];
}
