// Method, assumptions table, published findings and sources, rendered below the game.
import { PROB, ZONES, ZONE_KEYS, LIFT, ROC, UNLOAD, WIN } from '../data/params.js';
import { SOURCES, METHOD_HTML, STUDIES_HTML } from '../data/sources.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const srcCell = k => (k ? `<a href="#src-${k}">${esc(SOURCES[k]?.short || k)}</a>` : '<span class="notional">notional</span>');

export function renderInfo(P) {
  const rows = [
    ...ZONE_KEYS.map(z => [`${ZONES[z].t}: crossing, beach and port capacity, coastal defenders`, `${ZONES[z].km} km · beach ${ZONES[z].beach} · port ${ZONES[z].port.cap} pts/turn · ${ZONES[z].def} pts`, 'ne']),
    ['Amphibious lift: groups × points each (one lift of about 20,000 troops); hits to put a group out of action (notional)', `${LIFT.amph.n} × ${LIFT.amph.size} pt · ${LIFT.amph.w}`, 'kennedy'],
    ['Civilian RO-RO ferry groups: 2 ships each (30 large RO-ROs); points each and hits per group are notional', `${LIFT.ferry.n} × ${LIFT.ferry.size} pts · ${LIFT.ferry.w}`, 'csis'],
    ['Beach unloading, share of capacity in slight / moderate / rough seas (amphibious; ferries). Sea state 3 is the working limit; shares are notional', `${UNLOAD.beach.amph.join(' / ')}; ${UNLOAD.beach.ferry.join(' / ')}`, 'kennedy'],
    ['Turns before a ship that unloads is back (RAND: about 30 hours per lift; rounded up)', ZONE_KEYS.map(z => ZONES[z].cycle).join(' / '), 'rand'],
    ['Port unloading, same bands', `${UNLOAD.port.amph.join(' / ')}`, null],
    ['Taiwan Harpoon coastal batteries, missiles per battery per turn, missiles per battery (25 radar trucks, 100 launchers, 400 missiles)', `${ROC.launchers} · ${ROC.salvo} · ${ROC.magazine}`, 'dsca'],
    ['Taiwan mobile reserve groups (points)', ROC.reserves.map(r => r.s).join(' + '), null],
    ['Win: troops ashore, force ratio, troops needed without a port', `${WIN.minAshore} pts · ${WIN.ratio}:1 · ${WIN.noPortAshore} pts`, null],
    ...PROB.map(p => [p.t, `${P[p.k]}`, p.src]),
  ];
  document.getElementById('method-col').innerHTML = METHOD_HTML
    + `<h3 id="assumptions">Every parameter</h3><div class="tablewrap"><table><thead><tr><th scope="col">Parameter</th><th scope="col">Value</th><th scope="col">Basis</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td class="num">${esc(b)}</td><td>${c === 'ne' ? '<a href="#src-ne">Natural Earth</a> (distance); rest <span class="notional">notional</span>' : srcCell(c)}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('sources-col').innerHTML = `<h2>What the published studies found</h2>${STUDIES_HTML}<h2 class="mt">Sources</h2><ul class="src">${Object.entries(SOURCES).map(([k, s]) => `<li id="src-${k}">${s.html}</li>`).join('')}</ul>`;
  document.getElementById('aar-studies').innerHTML = `<p class="eyebrow">What the published studies found</p><div class="sl-studies">${STUDIES_HTML}</div>`;
}
