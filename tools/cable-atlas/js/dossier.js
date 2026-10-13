// Dossier pane: one landing site, island, cable or incident, with sources.
import { escapeHtml as esc, distKm } from '../../../shared/js/mapkit.js';
import { CABLES, LANDINGS } from '../data/cables.js';
import { INCIDENTS } from '../data/incidents.js';
import { SHIPS } from '../data/repair.js';
import { LP, NODE, CABLE, inService, unitsAt } from './net.js';
import { SCENARIO } from './scenarios.js';
import { fmtTbps, fmtDate } from './util.js';

const INC = Object.fromEntries(INCIDENTS.map(i => [i.id, i]));
const link = s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`;
const capCell = c => c.cap && c.cap.tbps != null
  ? `${fmtTbps(c.cap.tbps)}${c.cap.basis && c.cap.basis !== 'design' ? ` <span class="muted">(${esc(c.cap.basis)})</span>` : ''} <a href="${esc(c.cap.url)}" target="_blank" rel="noopener" title="${esc(c.cap.label)}">src</a>`
  : '<span class="muted">not published</span>';
const incidentsFor = ids => INCIDENTS.filter(i => (i.cables || []).some(c => ids.includes(c)));
const bases = () => {
  const m = new Map();
  for (const s of SHIPS.filter(s => s.base_lon != null)) {
    if (!m.has(s.base_port)) m.set(s.base_port, { port: s.base_port, lon: s.base_lon, lat: s.base_lat, ships: [] });
    m.get(s.base_port).ships.push(s.name);
  }
  return [...m.values()];
};

function cableTable(cs, S) {
  return `<div class="tablewrap"><table class="ctab"><thead><tr><th>Cable</th><th>RFS</th><th>Design capacity</th></tr></thead><tbody>
    ${cs.map(c => `<tr class="${inService(c, S.year, S.planned) ? '' : 'off'}"><td><button type="button" class="linkish" data-sel="c:${esc(c.id)}">${esc(c.name)}</button>
      ${c.domestic ? '<small class="muted">domestic</small>' : c.prcOnly ? '<small class="warn-t">lands only in mainland China</small>' : ''}${c.planned ? ' <small class="muted">planned</small>' : ''}</td>
      <td class="num">${esc(c.rfsYear || '')}</td><td>${capCell(c)}</td></tr>`).join('')}</tbody></table></div>`;
}

function repairLines(lon, lat, S) {
  const bs = bases().map(b => ({ ...b, km: distKm([lon, lat], [b.lon, b.lat]) })).sort((a, b) => a.km - b.km).slice(0, 3);
  if (!bs.length) return '';
  return `<p class="eyebrow mt">Nearest repair-ship bases</p><ul class="plain">${bs.map(b => {
    const days = b.km / 1.852 / S.speed / 24;
    return `<li><b>${esc(b.port)}</b>: ${Math.round(b.km).toLocaleString('en-US')} km great-circle, ${days < 1 ? 'under a day\'s' : `about ${days.toFixed(1)} days'`} sailing at ${S.speed} kn<span class="notional">notional</span><br><small class="muted">${esc(b.ships.join(', '))}</small></li>`;
  }).join('')}</ul><p class="fine">Straight-line distance from the home port, not a live position. Mobilisation, loading spares, permits and weather add time before and after transit.</p>`;
}

function incList(list) {
  if (!list.length) return '<p class="fine">No incident in this atlas names these cables.</p>';
  return `<ul class="plain">${list.map(i => `<li><button type="button" class="linkish" data-sel="i:${esc(i.id)}">${esc(i.dateLabel)}: ${esc(i.title)}</button></li>`).join('')}</ul>`;
}

export function renderDossier(root, S, R, act) {
  const sel = S.sel || '';
  const [kind, id] = [sel.slice(0, 1), sel.slice(2)];
  let html = '';
  if (kind === 'l' && LP[id]) {
    const l = LP[id], n = NODE[l.node];
    const cs = CABLES.filter(c => c.lps.includes(id)).sort((a, b) => a.domestic - b.domestic || (b.rfsYear || 0) - (a.rfsYear || 0));
    const reg = R.regions.find(r => r.id === n.region), st = reg.lps.find(x => x.id === id);
    const intl = cs.filter(c => !c.domestic && inService(c, S.year, S.planned));
    const units = unitsAt([id]);
    const isCut = units.length && units.every(u => S.cut.has(u));
    const prcOwned = intl.filter(c => c.prcOwner);
    html = `<p class="eyebrow">Landing site · ${esc(n.name)}</p><h3 class="dh">${esc(l.name)}</h3>
      <p class="fine">Town-level landing point as TeleGeography publishes it. The atlas shows no station address or facility.</p>
      <dl class="readout"><dt>Working units</dt><dd>${st.alive} of ${st.total} cable branches and segments</dd>
        <dt>International</dt><dd>${intl.length} system${intl.length === 1 ? '' : 's'}, ${Math.round(100 * intl.length / Math.max(1, reg.intlTotal))}% of the ${esc(reg.name)} total</dd>
        <dt>Capacity</dt><dd>${(() => { const k = intl.filter(c => c.cap && c.cap.tbps != null); return k.length ? `${fmtTbps(k.reduce((s, c) => s + c.cap.tbps, 0))} published design capacity across ${k.length} of ${intl.length} systems` : 'no published figures'; })()}</dd>
        ${prcOwned.length ? `<dt>Owners</dt><dd>${prcOwned.length} of ${intl.length} international systems list a PRC state carrier among their owners</dd>` : ''}</dl>
      <div class="row-btns"><button type="button" class="btn ${isCut ? '' : 'solid'}" id="d-cut">${isCut ? 'Restore this site' : 'Cut every cable here'}</button>
        <button type="button" class="btn" id="d-zoom">Zoom to</button></div>
      <p class="eyebrow mt">Cables</p>${cableTable(cs, S)}
      <p class="eyebrow mt">Incidents on these cables</p>${incList(incidentsFor(cs.map(c => c.id)))}
      ${repairLines(l.lon, l.lat, S)}`;
    setTimeout(() => {
      root.querySelector('#d-cut').onclick = () => act.cutUnits(units, !isCut);
      root.querySelector('#d-zoom').onclick = () => act.zoomPoint(l.lon, l.lat, 0.6);
    });
  } else if (kind === 'n' && NODE[id]) {
    const n = NODE[id], rn = R.nodes.find(x => x.id === id);
    const lps = LANDINGS.filter(l => l.node === id);
    const cs = CABLES.filter(c => c.lps.some(l => LP[l].node === id));
    html = `<p class="eyebrow">Island · ${esc(n.region === 'ryukyu' ? 'Nansei islands' : n.region === 'taiwan' ? 'Taiwan' : 'Philippines')}</p><h3 class="dh">${esc(n.name)}</h3>
      <dl class="readout"><dt>Status</dt><dd>${{ good: 'Connected', warn: 'Reachable only via mainland China', bad: 'Cut off by cable' }[rn.status]}</dd>
      <dt>Routes</dt><dd>${rn.routes} edge-disjoint cable route${rn.routes === 1 ? '' : 's'} to places outside the region</dd>
      <dt>Landing towns</dt><dd>${lps.map(l => `<button type="button" class="linkish" data-sel="l:${esc(l.id)}">${esc(l.name)}</button>`).join(', ')}</dd></dl>
      <p class="eyebrow mt">Cables</p>${cableTable(cs, S)}
      <p class="eyebrow mt">Incidents on these cables</p>${incList(incidentsFor(cs.map(c => c.id)))}`;
  } else if (kind === 'c' && CABLE[id]) {
    const c = CABLE[id];
    const isCut = c.units.every(u => S.cut.has(u.id));
    html = `<p class="eyebrow">Cable${c.domestic ? ' · domestic' : ''}</p><h3 class="dh">${esc(c.name)}</h3>
      <dl class="readout"><dt>RFS</dt><dd>${esc(c.rfs || 'n/a')}${c.planned ? ' (planned)' : ''}</dd><dt>Length</dt><dd>${esc(c.length || 'n/a')}</dd>
      <dt>Capacity</dt><dd>${capCell(c)}${c.cap && c.cap.note ? `<br><small class="muted">${esc(c.cap.note)}</small>` : ''}</dd>
      <dt>Owners</dt><dd>${esc(c.owners || 'not listed')}</dd><dt>Supplier</dt><dd>${esc(c.suppliers || 'not listed')}</dd>
      <dt>Countries</dt><dd>${esc(c.countries.join(', '))}</dd>
      <dt>Study landings</dt><dd>${c.study.map(l => `<button type="button" class="linkish" data-sel="l:${esc(l)}">${esc(LP[l].name)}</button>`).join(', ') || 'none'}</dd></dl>
      <div class="row-btns"><button type="button" class="btn ${isCut ? '' : 'solid'}" id="d-cut">${isCut ? 'Restore cable' : 'Cut whole cable'}</button>
      ${c.url ? `<a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">Operator site</a>` : ''}
      <a class="btn" href="https://www.submarinecablemap.com/submarine-cable/${esc(c.id)}" target="_blank" rel="noopener">TeleGeography</a></div>
      <p class="eyebrow mt">Incidents</p>${incList(incidentsFor([c.id]))}`;
    setTimeout(() => { root.querySelector('#d-cut').onclick = () => act.cutUnits(c.units.map(u => u.id), !isCut); });
  } else if (kind === 'i' && INC[id]) {
    const i = INC[id], sc = SCENARIO['r-' + id];
    html = `<p class="eyebrow">Incident · ${esc(i.areaLabel)}</p><h3 class="dh">${esc(i.title)}</h3>
      <p class="inc-date num">${esc(i.dateLabel)}</p><p>${esc(i.summary)}</p>
      <dl class="readout"><dt>Cause</dt><dd>${esc(i.causeLabel)}</dd>
        ${i.vessels && i.vessels.length ? `<dt>Vessels</dt><dd>${esc(i.vessels.join('; '))}</dd>` : ''}
        ${i.outcome ? `<dt>Outcome</dt><dd>${esc(i.outcome)}</dd>` : ''}
        ${i.repaired ? `<dt>Repaired</dt><dd>${esc(fmtDate(i.repaired))}${i.days != null ? ` (${i.days} day${i.days === 1 ? "" : "s"})` : ''}</dd>` : ''}
        ${i.cables && i.cables.length ? `<dt>Cables</dt><dd>${i.cables.filter(c => CABLE[c]).map(c => `<button type="button" class="linkish" data-sel="c:${esc(c)}">${esc(CABLE[c].name)}</button>`).join(', ')}${i.cableNote ? `<br><small class="muted">${esc(i.cableNote)}</small>` : ''}</dd>` : ''}</dl>
      ${sc ? '<div class="row-btns"><button type="button" class="btn solid" id="d-replay">Replay in calculator</button></div>' : ''}
      <p class="eyebrow mt">Sources</p><ul class="plain src">${i.sources.map(s => `<li>${link(s)}${s.type === 'official' ? ' <small class="pill">official</small>' : ''}</li>`).join('')}</ul>
      <p class="fine">Map marker placed at the reported area, not the fault position.</p>`;
    if (sc) setTimeout(() => { root.querySelector('#d-replay').onclick = () => act.scenario(sc.id); });
  } else {
    html = `<p class="eyebrow">Dossier</p><h3 class="dh">Pick something on the map</h3>
      <p>Click a landing site (circle), a cable, or an incident marker (diamond), or a name in the calculator, to open its record here.</p>
      <p class="fine">Landing sites are sized by how many international systems land there.</p>`;
  }
  root.innerHTML = html;
  root.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => act.select(b.dataset.sel));
}
