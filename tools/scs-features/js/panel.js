// Side panel: claimant filter, layer toggles, feature finder and the selected feature's card.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { FEATURES, OCCUPANTS, PCA_CLASS, KIND_LABEL, PCA } from '../data/features.js';
import { NINE_DASH } from '../data/ninedash.js';

const esc = escapeHtml;
const OCC_IDS = Object.keys(OCCUPANTS);
const count = occ => FEATURES.filter(f => f.occ === occ).length;

export function createPanel(root, S, act) {
  const hasNdl = !!NINE_DASH.dashes?.length;
  root.innerHTML = `
    <div class="sec">
      <p class="eyebrow">Who holds what</p>
      <div class="occ-bar" id="occ-bar" aria-hidden="true"></div>
      <div class="occ-btns" role="group" aria-label="Filter by occupant">${OCC_IDS.map(o => `<button type="button" class="occ" data-o="${o}" aria-pressed="true">
        <i style="background:var(${OCCUPANTS[o].col})"></i><span>${esc(OCCUPANTS[o].label)}</span><b class="num">${count(o)}</b></button>`).join('')}</div>
      <p class="fine" id="occ-note"></p>
    </div>
    <div class="sec" id="card"></div>
    <div class="sec">
      <p class="eyebrow">Layers</p>
      <label class="tg"><input type="checkbox" id="l-ts12"><span class="sw"></span><span class="t">12 nm rings<small>Distance around each feature. A ring is not a legal entitlement.</small></span></label>
      <label class="tg"><input type="checkbox" id="l-award"><span class="sw"></span><span class="t">Apply the 2016 award<small>Grey out rings around features the tribunal found submerged at high tide. Those generate no territorial sea of their own.</small></span></label>
      <label class="tg"><input type="checkbox" id="l-eez"><span class="sw"></span><span class="t">200 nm from coastlines<small>Approximate EEZ-style reach of mainland and major-island coasts. Not legal limits.</small></span></label>
      <label class="tg${hasNdl ? '' : ' disabled'}"><input type="checkbox" id="l-ndl" ${hasNdl ? '' : 'disabled'}><span class="sw"></span><span class="t">Nine-dash line${hasNdl ? '' : ' (not drawn)'}<small>${esc(NINE_DASH.note)}</small></span></label>
    </div>
    <div class="sec">
      <label class="find"><span class="eyebrow">Find a feature</span>
        <select id="find"><option value="">Choose…</option>${OCC_IDS.map(o => `<optgroup label="${esc(OCCUPANTS[o].label)}">${FEATURES.filter(f => f.occ === o).sort((a, b) => a.name.localeCompare(b.name)).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    </div>`;
  const $ = s => root.querySelector(s);
  root.querySelectorAll('.occ').forEach(b => b.onclick = e => act.toggleOcc(b.dataset.o, e.shiftKey || e.altKey));
  for (const k of ['ts12', 'award', 'eez', 'ndl']) $('#l-' + k).onchange = e => act.set({ [k]: e.target.checked });
  $('#find').onchange = e => { if (e.target.value) act.select(e.target.value, true); };

  return {
    render() {
      root.querySelectorAll('.occ').forEach(b => b.setAttribute('aria-pressed', String(S.occ.has(b.dataset.o))));
      const shown = FEATURES.filter(f => S.occ.has(f.occ));
      $('#occ-bar').innerHTML = OCC_IDS.map(o => `<i style="flex:${count(o)};background:var(${OCCUPANTS[o].col});opacity:${S.occ.has(o) ? 1 : .2}"></i>`).join('');
      $('#occ-note').textContent = `${shown.length} of ${FEATURES.length} features shown. Press a name to hide or show it; shift-click to show only that one.`;
      for (const k of ['ts12', 'award', 'eez', 'ndl']) $('#l-' + k).checked = !!S[k];
      $('#find').value = S.sel || '';
      const f = FEATURES.find(x => x.id === S.sel);
      $('#card').innerHTML = f ? card(f) : `<p class="eyebrow">Feature</p><p class="fine">Click a feature on the map, or pick one below, to see who holds it, what is built there and how the 2016 tribunal classified it.</p>
        <p class="fine"><span class="key k-art"></span> artificial island, 100+ acres (AMTI) &nbsp; <span class="key k-out"></span> outpost &nbsp; <span class="key k-ctl"></span> controlled, no outpost</p>`;
      $('#card').querySelector('.x')?.addEventListener('click', () => act.select(null));
    },
  };
}

function card(f) {
  const o = OCCUPANTS[f.occ];
  return `<div class="card-h"><p class="eyebrow">${esc(f.group)}</p><button type="button" class="x" aria-label="Close">×</button></div>
    <h3 class="fname">${esc(f.name)}</h3>
    ${f.alt?.length ? `<p class="fine">${esc(f.alt.join(' · '))}</p>` : ''}
    <dl class="readout">
      <dt>Held by</dt><dd><span class="dot" style="background:var(${o.col})"></span>${esc(o.label)}${f.since ? `, since ${esc(f.since)}` : ''}</dd>
      <dt>Type</dt><dd>${esc(KIND_LABEL[f.kind])}</dd>
      <dt>Position</dt><dd class="num">${f.lat.toFixed(2)}°N ${f.lon.toFixed(2)}°E${f.approx ? ' <small>(approximate; large bank)</small>' : ''}</dd>
      ${f.amtiLabel ? `<dt>AMTI label</dt><dd>${esc(f.amtiLabel)}</dd>` : ''}
    </dl>
    ${f.built ? `<p class="built">${esc(f.built)}</p>` : ''}
    <div class="award-box" data-c="${f.pca ? f.pca.cls : 'none'}">
      <b>2016 arbitral award</b>
      ${f.pca ? `<span>${esc(PCA_CLASS[f.pca.cls])}. ${esc(PCA_CLASS_NOTE[f.pca.cls])}${f.pca.note ? ' ' + esc(f.pca.note) : ''} <a href="${PCA.award}" target="_blank" rel="noopener">Award</a>, para. ${esc(f.pca.para)}.</span>`
        : f.group === 'Spratly Islands' ? `<span>Not individually classified. The tribunal found that no high-tide feature in the Spratlys can generate an EEZ or continental shelf (<a href="${PCA.award}" target="_blank" rel="noopener">Award</a>, para. ${esc(PCA.spratlyPara)}).</span>`
        : `<span>Not before the tribunal. The case covered Scarborough Shoal and features in the Spratlys, not the Paracels or Pratas.</span>`}
    </div>
    <p class="fine">${[f.amti ? `<a href="${esc(f.amti)}" target="_blank" rel="noopener">AMTI imagery and profile</a>` : '', ...(f.src || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`)].filter(Boolean).join(' · ')}</p>`;
}
const PCA_CLASS_NOTE = {
  rock: 'Above water at high tide, but a "rock" under Article 121(3): at most a 12 nm territorial sea, no EEZ.',
  lte: 'Submerged at high tide. It generates no territorial sea, EEZ or continental shelf of its own, and cannot be appropriated.',
  noeez: 'Above water at high tide, but cannot sustain human habitation or economic life of its own (Article 121(3)), so it generates no EEZ or continental shelf.',
  examined: 'The tribunal examined it (para. 407) and found that no Spratly high-tide feature generates an EEZ or continental shelf.',
  mixed: 'Gaven (North) is a rock with at most a 12 nm territorial sea; Gaven (South) is submerged at high tide and lies within 12 nm of Gaven (North) and Namyit Island.',
};
