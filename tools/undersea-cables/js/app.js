// Taiwan's Undersea Cables: state, URL hash, and wiring between map, panel, timeline and walkthrough.
import { META, CABLES, LANDINGS } from '../data/cables.js';
import { addExportBar } from '../../../shared/js/export.js';
import { UNIT, evaluate } from './network.js';
import { PRESET } from './presets.js';
import { createMap, VIEWS } from './map.js';
import { createPanel } from './panel.js';
import { createTimeline } from './timeline.js';
import { createTour } from './tour.js';

const S = { year: 2026, planned: false, prcCounts: false, regional: true, cut: new Set(), sel: null, preset: 'none', view: 'taiwan' };

// Hash: #y=2026&cut=a,b&p=matsu&prc=1&pl=1&reg=0&sel=id&v=taiwan
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const y = parseInt(q.get('y'), 10);
  if (y >= 2000 && y <= 2029) S.year = y;
  S.planned = q.get('pl') === '1';
  S.prcCounts = q.get('prc') === '1';
  S.regional = q.get('reg') !== '0';
  if (PRESET[q.get('p')]) { S.preset = q.get('p'); S.cut = new Set(PRESET[S.preset].cut()); }
  if (q.has('cut')) { S.cut = new Set(q.get('cut').split(',').filter(id => UNIT[id])); if (!PRESET[q.get('p')]) S.preset = null; }
  if (CABLES.some(c => c.id === q.get('sel'))) S.sel = q.get('sel');
  if (VIEWS[q.get('v')]) S.view = q.get('v');
}
function writeHash() {
  const q = new URLSearchParams({ y: S.year });
  const presetCut = S.preset && PRESET[S.preset] ? PRESET[S.preset].cut().sort().join(',') : null;
  const cut = [...S.cut].sort().join(',');
  if (S.preset && presetCut === cut) { if (S.preset !== 'none') q.set('p', S.preset); } else if (cut) q.set('cut', cut);
  if (S.planned) q.set('pl', 1);
  if (S.prcCounts) q.set('prc', 1);
  if (!S.regional) q.set('reg', 0);
  if (S.sel) q.set('sel', S.sel);
  if (S.view !== 'taiwan') q.set('v', S.view);
  history.replaceState(null, '', '#' + q.toString());
}

readHash();
const tip = document.getElementById('tip');
const map = createMap(document.getElementById('map'), tip, {
  onCable: (cid, uid) => {
    if (cutMode) uid ? act.toggleCut(uid) : act.cutCable(cid, !CABLES.find(c => c.id === cid).units.every(u => S.cut.has(u.id)));
    act.select(cid);
  },
  onHover: id => map.highlight(id),
});
let cutMode = false;

const act = {
  set(o) { Object.assign(S, o); update(); },
  preset(id) {
    const p = PRESET[id];
    S.preset = id; S.cut = new Set(p.cut());
    S.year = p.year || Math.max(S.year, 2026);
    if (p.view) setView(p.view);
    update();
  },
  toggleCut(uid) { S.cut.has(uid) ? S.cut.delete(uid) : S.cut.add(uid); S.preset = null; update(); },
  cutCable(cid, on) { CABLES.find(c => c.id === cid).units.forEach(u => on ? S.cut.add(u.id) : S.cut.delete(u.id)); S.preset = null; update(); },
  select(cid) { S.sel = cid; update(); },
  hover(cid) { map.highlight(cid); },
};
function setView(v) {
  S.view = v; map.zoomTo(v);
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  writeHash();
}

const panel = createPanel(document.getElementById('panel'), S, act);
function update() {
  const R = evaluate(S);
  map.render(S, R);
  panel.render(R);
  writeHash();
}

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
document.getElementById('zoom-in').onclick = () => map.zoomIn();
document.getElementById('zoom-out').onclick = () => map.zoomOut();
const cm = document.getElementById('cut-mode');
cm.onclick = () => { cutMode = !cutMode; cm.setAttribute('aria-pressed', String(cutMode)); document.getElementById('mapbox').classList.toggle('cutting', cutMode); };

const TW_LP = new Map(LANDINGS.filter(l => l.country === 'Taiwan').map(l => [l.id, l.name]));
addExportBar(document.getElementById('mapbox'), {
  where: 'after', target: () => document.getElementById('map'),
  title: () => `Taiwan's submarine cables, ${S.year}${S.cut.size ? `, with ${S.cut.size} cable${S.cut.size > 1 ? 's' : ''} cut` : ''}`,
  note: `Cable data: TeleGeography Submarine Cable Map, CC BY-SA 4.0, fetched ${META.fetched}`,
  csv: () => [['cable', 'ready_for_service', 'planned', 'length', 'domestic', 'taiwan_landings', 'owners', 'suppliers'],
    ...CABLES.map(c => [c.name, c.rfs, c.planned ? 'yes' : 'no', c.length, c.domestic ? 'yes' : 'no',
      c.lps.filter(id => TW_LP.has(id)).map(id => TW_LP.get(id)).join('; '), c.owners, c.suppliers])],
  csvLabel: 'Copy cable list as CSV',
});

createTimeline(document.getElementById('tl-strip'), document.getElementById('tl-cards'), id => {
  act.preset(id);
  document.getElementById('mapbox').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
});

const tour = createTour(document.getElementById('mapbox'), set => {
  S.sel = null;
  if (set.year) S.year = set.year;
  act.preset(set.preset);
  if (set.view) setView(set.view);
});
document.getElementById('start-tour').onclick = () => tour.start();
document.getElementById('copy-link').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; } catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
};
document.getElementById('fetched').textContent = META.fetched;
document.getElementById('n-cables').textContent = CABLES.filter(c => !c.planned).length;

setView(S.view);
update();
