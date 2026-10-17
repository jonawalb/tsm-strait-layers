// Panel: mode switch, site readout, ring readout, layer toggles.
import { fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { SITES, LAYERS } from '../data/sites.js';
import { MISSILES, LAUNCH } from '../data/pla.js';
import { SITE, MISSILE, siteReach, sitesInRing } from './model.js';

const LAYER = Object.fromEntries(LAYERS.map(l => [l.id, l]));
const pill = (m, on) => `<span class="pill ic-pill${on ? ' on' : ''}" style="color:var(${m.col})">${m.name}</span>`;

export function buildPanel(root) {
  root.innerHTML = `
  <section class="sec">
    <div class="choices ic-modes" id="ic-modes" role="group" aria-label="Mode">
      <button type="button" data-m="site"><b>Pick a site</b><br><small>What can reach it, and from where</small></button>
      <button type="button" data-m="ring"><b>Pick a PLA ring</b><br><small>Which sites fall inside it</small></button>
    </div>
  </section>
  <section class="sec" id="ic-site-sec">
    <label class="eyebrow" for="ic-site-pick">Site</label>
    <select id="ic-site-pick" class="ic-select">${LAYERS.map(l => `<optgroup label="${l.name}">${SITES.filter(s => s.layer === l.id).map(s => `<option value="${s.id}">${escapeHtml(s.n)}</option>`).join('')}</optgroup>`).join('')}</select>
    <div id="ic-site-out"></div>
  </section>
  <section class="sec" id="ic-ring-sec">
    <p class="eyebrow">Missile</p>
    <div class="choices ic-missiles" id="ic-missiles">${MISSILES.map(m => `<button type="button" data-k="${m.id}"><b style="color:var(${m.col})">${m.name}</b> <span class="num">${m.rng}</span><br><small>${m.cls}</small></button>`).join('')}</div>
    <label class="eyebrow" for="ic-launch-pick">Launch area <span class="notional">notional</span></label>
    <select id="ic-launch-pick" class="ic-select">${LAUNCH.map(l => `<option value="${l.id}">${l.n}</option>`).join('')}</select>
    <div id="ic-ring-out"></div>
  </section>
  <section class="sec">
    <p class="eyebrow">Layers</p>
    <div class="ic-layers">${LAYERS.map(l => `<label class="tg"><input type="checkbox" data-layer="${l.id}" checked><span class="sw"></span>
      <span class="t"><i class="ic-key ic-key-${l.id}" style="color:var(${l.col})"></i>${l.name}<small>${l.help}</small></span></label>`).join('')}
      <label class="tg"><input type="checkbox" id="ic-chains" checked><span class="sw"></span><span class="t">Island chains<small>Conceptual lines, not boundaries</small></span></label>
    </div>
  </section>`;
}

export function renderPanel(S) {
  document.querySelectorAll('#ic-modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === S.mode)));
  document.getElementById('ic-site-sec').hidden = S.mode !== 'site';
  document.getElementById('ic-ring-sec').hidden = S.mode !== 'ring';
  document.querySelectorAll('[data-layer]').forEach(i => { i.checked = S.layers.has(i.dataset.layer); });
  document.getElementById('ic-chains').checked = S.chains;
  if (S.mode === 'site') renderSite(S); else renderRing(S);
}

function renderSite(S) {
  const s = SITE[S.site], r = siteReach(s);
  document.getElementById('ic-site-pick').value = s.id;
  const reachAny = MISSILES.filter(m => r.fromPRC.includes(m.id));
  const st = reachAny.length === MISSILES.length ? 'bad' : reachAny.length ? 'warn' : 'good';
  const srcs = s.src.map(x => `<a href="${x.u}" target="_blank" rel="noopener">${escapeHtml(x.t)}</a>`).join('; ');
  document.getElementById('ic-site-out').innerHTML = `
    <div class="ic-sitehead"><h3>${escapeHtml(s.n)}</h3><p>${escapeHtml(s.where)} · <span style="color:var(${LAYER[s.layer].col})">${LAYER[s.layer].name}</span>${s.approx ? ' · island-level position' : ''}</p><p class="fine">${escapeHtml(s.d)}</p></div>
    <div class="status" data-s="${st}"><b>${fmt(r.prc.km)} km</b><span>to the nearest PRC territory. From there, ${reachAny.length ? `these classes reach it: ${reachAny.map(m => m.name).join(', ')}` : 'none of the listed missiles reach it'}.</span></div>
    <p class="eyebrow ic-sub">Launch areas that reach it <span class="notional">notional</span></p>
    <div class="tablewrap"><table class="ic-mini"><thead><tr><th>Area</th><th>km</th><th>Reached by</th></tr></thead><tbody>
      ${[...r.launch].sort((a, b) => a.km - b.km).map(l => `<tr class="${l.by.length ? '' : 'muted'}"><td>${l.n}</td><td class="num">${fmt(l.km)}</td><td>${l.by.length ? l.by.map(id => pill(MISSILE[id], true)).join('') : 'none'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="fine">Rings on the map are drawn around the site: a launcher anywhere inside a ring is within that missile's range of the site. Source: ${srcs}.</p>`;
}

function renderRing(S) {
  const m = MISSILE[S.ring.missile], inside = sitesInRing(S.ring.missile, S.ring.launch).filter(o => S.layers.has(o.s.layer));
  document.querySelectorAll('#ic-missiles button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === m.id)));
  document.getElementById('ic-launch-pick').value = S.ring.launch;
  const shown = SITES.filter(s => S.layers.has(s.layer)).length;
  const counts = LAYERS.map(l => [l, inside.filter(o => o.s.layer === l.id).length, SITES.filter(s => s.layer === l.id).length]).filter(([l]) => S.layers.has(l.id));
  document.getElementById('ic-ring-out').innerHTML = `
    <div class="status" data-s="${inside.length ? 'bad' : 'good'}"><b>${inside.length} of ${shown} sites</b><span>inside ${m.name} range (${m.rng}) of the ${LAUNCH.find(l => l.id === S.ring.launch).n} reference point.</span></div>
    <div class="ic-counts">${counts.map(([l, n, t]) => `<span><i class="ic-key ic-key-${l.id}" style="color:var(${l.col})"></i>${l.name} <b class="num">${n}/${t}</b></span>`).join('')}</div>
    <ul class="ic-list">${inside.map(o => `<li><button type="button" data-site="${o.s.id}"><i class="ic-key ic-key-${o.s.layer}" style="color:var(${LAYER[o.s.layer].col})"></i>${escapeHtml(o.s.n)}<span class="num">${fmt(o.km)} km</span></button></li>`).join('') || '<li class="fine">No visible site is inside this ring.</li>'}</ul>
    <p class="fine">${m.note} <a href="${m.src}" target="_blank" rel="noopener">CSIS Missile Threat</a>.${m.rIn ? ' The dashed inner ring marks the 600 km lower estimate.' : ''}</p>`;
}
