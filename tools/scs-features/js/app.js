// South China Sea Features: state, URL hash and wiring between map, panel, timelines and walkthrough.
import { FEATURES, OCCUPANTS, PCA_CLASS, KIND_LABEL } from '../data/features.js';
import { addExportBar } from '../../../shared/js/export.js';
import { TSM } from '../../../shared/data/tsm.js';
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { createMap, VIEWS } from './map.js';
import { createPanel } from './panel.js';
import { createTimeline } from './timeline.js';
import { createTour } from './tour.js';

const OCC = Object.keys(OCCUPANTS);
const S = { occ: new Set(OCC), sel: null, ts12: false, award: false, eez: false, ndl: false, view: 'sea', flash: [], tl: 'build' };

// Hash: #o=china,vietnam&f=fiery-cross-reef&l=ts12,award&v=spratly&t=thomas
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.has('o')) { const o = q.get('o').split(',').filter(x => OCCUPANTS[x]); if (o.length) S.occ = new Set(o); }
  if (FEATURES.some(f => f.id === q.get('f'))) S.sel = q.get('f');
  if (q.has('l')) { const l = new Set(q.get('l').split(',')); for (const k of ['ts12', 'award', 'eez', 'ndl']) S[k] = l.has(k); }
  if (VIEWS[q.get('v')]) S.view = q.get('v');
  if (q.get('t')) S.tl = q.get('t');
}
function writeHash() {
  const q = new URLSearchParams();
  if (S.occ.size < OCC.length) q.set('o', [...S.occ].join(','));
  if (S.sel) q.set('f', S.sel);
  const l = ['ts12', 'award', 'eez', 'ndl'].filter(k => S[k]);
  if (l.length) q.set('l', l.join(','));
  if (S.view !== 'sea') q.set('v', S.view);
  if (S.tl !== 'build') q.set('t', S.tl);
  history.replaceState(null, '', q.toString() ? '#' + q : location.pathname);
}

readHash();
const map = createMap(document.getElementById('map'), document.getElementById('tip'), { onSelect: id => act.select(id) });
const act = {
  set(o) { Object.assign(S, o); if (o.award) S.ts12 = true; update(); },
  toggleOcc(o, only) {
    if (only) S.occ = new Set([o]);
    else { S.occ.has(o) ? S.occ.delete(o) : S.occ.add(o); if (!S.occ.size) S.occ = new Set(OCC); }
    update();
  },
  select(id, zoom) {
    S.sel = id;
    const f = FEATURES.find(x => x.id === id);
    if (f && !S.occ.has(f.occ)) S.occ.add(f.occ);
    if (f && zoom) map.zoomToFeature(id);
    update();
  },
};
function setView(v) {
  S.view = v; map.zoomTo(v);
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  writeHash();
}
const panel = createPanel(document.getElementById('panel'), S, act);
function update() { map.render(S); panel.render(); writeHash(); }

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
document.getElementById('zoom-in').onclick = () => map.zoomIn();
document.getElementById('zoom-out').onclick = () => map.zoomOut();

const tl = createTimeline(document.getElementById('tl-tabs'), document.getElementById('tl-strip'), document.getElementById('tl-cards'), (ids, zoom) => {
  S.flash = ids;
  if (zoom && ids.length === 1) { S.sel = ids[0]; map.zoomToFeature(ids[0]); }
  else if (zoom && ids.length) setView(ids.every(id => FEATURES.find(f => f.id === id)?.group === 'Spratly Islands') ? 'spratly' : 'sea');
  update();
});
const tlTabs = document.getElementById('tl-tabs');
tlTabs.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { S.tl = b.dataset.t; writeHash(); } });
tl.show(S.tl);

const tour = createTour(document.getElementById('mapbox'), set => {
  Object.assign(S, { ts12: false, award: false, eez: false, ndl: false, flash: [], sel: null, occ: new Set(OCC) }, set.state || {});
  if (set.occ) S.occ = new Set(set.occ);
  if (set.tl) { S.tl = set.tl; tl.show(set.tl); }
  if (set.feature) { S.sel = set.feature; map.zoomToFeature(set.feature); } else setView(set.view || 'sea');
  if (set.view && set.feature) setView(set.view);
  update();
});
document.getElementById('start-tour').onclick = () => tour.start();
document.getElementById('copy-link').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; } catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
};

// Acreage chart (China's seven Spratly features, AMTI feature pages) and TSM's Dongsha count
const seven = FEATURES.filter(f => f.occ === 'china' && f.group === 'Spratly Islands').sort((a, b) => b.acres - a.acres);
const maxA = Math.max(...seven.map(f => f.acres));
const acres = document.getElementById('acres');
acres.innerHTML = seven.map(f => `<div role="button" tabindex="0" data-f="${f.id}"><span>${escapeHtml(f.name)}</span><i style="width:${(f.acres / maxA * 100).toFixed(1)}%"></i><span>${Math.round(f.acres).toLocaleString('en-US')}</span></div>`).join('')
  + `<div class="sum"><span>Total</span><i style="width:0"></i><span>${Math.round(seven.reduce((a, f) => a + f.acres, 0)).toLocaleString('en-US')}</span></div>`;
acres.querySelectorAll('[data-f]').forEach(d => {
  const go = () => { act.select(d.dataset.f, true); document.getElementById('mapbox').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  d.onclick = go; d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
});
document.getElementById('dongsha-n').textContent = TSM.ccg.filter(r => /Dongsha/i.test(r[1]) && r[0].startsWith('2026')).length;
document.getElementById('tsm-asof').textContent = new Date(TSM.asOf + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const VIEW_NAME = { sea: 'the whole sea', spratly: 'the Spratly Islands', paracel: 'the Paracel Islands', shoals: 'Scarborough Shoal to Palawan', thomas: 'Second Thomas Shoal' };
addExportBar(document.getElementById('mapbox'), {
  where: 'after', target: () => document.getElementById('map'),
  title: () => `South China Sea features by occupant: ${VIEW_NAME[S.view] || 'custom view'}${S.award ? ', with 2016 award classifications' : ''}`,
  note: 'Occupants and positions: CSIS AMTI Island Tracker; classifications: PCA Case 2013-19 award. Map takes no position on sovereignty',
  csv: () => [['feature', 'group', 'occupant', 'status', 'occupied_since', 'acres_reclaimed_amti', 'award_2016_classification', 'award_paragraphs', 'lon', 'lat', 'amti_page'],
    ...FEATURES.map(f => [f.name, f.group, OCCUPANTS[f.occ].label, KIND_LABEL[f.kind] || f.kind, f.since ?? '', f.acres ?? '',
      f.pca ? PCA_CLASS[f.pca.cls] : '', f.pca?.para ?? '', f.lon, f.lat, f.amti ?? ''])],
  csvLabel: 'Copy feature list as CSV',
});

setView(S.view);
if (S.sel && S.view === 'sea') map.zoomToFeature(S.sel);
update();
