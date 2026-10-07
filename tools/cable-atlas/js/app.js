// Undersea Cable Atlas: state, URL hash, and wiring between map, calculator, dossier, incident log and tour.
import { META, CABLES } from '../data/cables.js';
import { INCIDENTS } from '../data/incidents.js';
import { TOTALS } from '../data/capacity.js';
import { addExportBar } from '../../../shared/js/export.js';
import { UNIT, LP, NODE, CABLE, evaluate, unitsOfCable } from './net.js';
import { SCENARIO } from './scenarios.js';
import { createMap, VIEWS } from './map.js';
import { createPanel } from './panel.js';
import { createTimeline } from './timeline.js';
import { createRepair } from './repairview.js';
import { createTour } from './tour.js';
import { prefersReduced } from './util.js';

const S = { year: 2026, planned: false, cut: new Set(), scen: 'none', region: 'taiwan', sel: null, tab: 'calc',
  view: 'fic', ctx: true, inc: true, ships: true, speed: 11 };
const INC = Object.fromEntries(INCIDENTS.map(i => [i.id, i]));
const validSel = s => !!s && ((s[0] === 'l' && LP[s.slice(2)]) || (s[0] === 'c' && CABLE[s.slice(2)])
  || (s[0] === 'n' && NODE[s.slice(2)]) || (s[0] === 'i' && INC[s.slice(2)]));

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const y = parseInt(q.get('y'), 10);
  if (y >= 2000 && y <= 2026) S.year = y;
  S.planned = q.get('pl') === '1';
  if (['taiwan', 'ryukyu', 'philippines'].includes(q.get('r'))) S.region = q.get('r');
  if (SCENARIO[q.get('s')]) { S.scen = q.get('s'); S.cut = new Set(SCENARIO[S.scen].cut()); }
  if (q.has('cut')) { S.cut = new Set(q.get('cut').split(',').filter(id => UNIT[id])); S.scen = null; }
  if (validSel(q.get('sel'))) { S.sel = q.get('sel'); S.tab = 'dos'; }
  if (q.get('tab') === 'calc') S.tab = 'calc';
  if (VIEWS[q.get('v')]) S.view = q.get('v');
  for (const k of ['ctx', 'inc', 'ships']) if (q.get(k) === '0') S[k] = false;
  const sp = parseInt(q.get('kn'), 10); if (sp >= 8 && sp <= 15) S.speed = sp;
}
function writeHash() {
  const q = new URLSearchParams();
  if (S.year !== 2026) q.set('y', S.year);
  if (S.planned) q.set('pl', 1);
  if (S.region !== 'taiwan') q.set('r', S.region);
  const cut = [...S.cut].sort().join(',');
  if (S.scen && SCENARIO[S.scen] && SCENARIO[S.scen].cut().sort().join(',') === cut) { if (S.scen !== 'none') q.set('s', S.scen); }
  else if (cut) q.set('cut', cut);
  if (S.sel) q.set('sel', S.sel);
  if (S.sel && S.tab === 'calc') q.set('tab', 'calc');
  if (S.view !== 'fic') q.set('v', S.view);
  for (const k of ['ctx', 'inc', 'ships']) if (!S[k]) q.set(k, 0);
  if (S.speed !== 11) q.set('kn', S.speed);
  history.replaceState(null, '', q.toString() ? '#' + q.toString() : location.pathname);
}

readHash();
const mapbox = document.getElementById('mapbox');
let cutMode = false;
const map = createMap(document.getElementById('map'), document.getElementById('tip'), {
  cable: (cid, uid) => {
    if (cutMode) { const ids = uid ? [uid] : unitsOfCable(cid); act.cutUnits(ids, !ids.every(u => S.cut.has(u))); return; }
    act.select('c:' + cid);
  },
  landing: id => act.select('l:' + id),
  incident: id => act.incident(id),
  hover: id => map.highlight(id),
  cutMode: () => cutMode,
});

const act = {
  set(o) { Object.assign(S, o); update(); },
  region(r) { S.region = r; setView({ taiwan: 'taiwan', ryukyu: 'ryukyu', philippines: 'philippines' }[r]); update(); },
  scenario(id) {
    const s = SCENARIO[id]; if (!s) return;
    S.scen = id; S.cut = new Set(s.cut()); S.tab = 'calc';
    S.year = s.year || 2026;
    if (s.region && s.region !== 'all') S.region = s.region;
    if (s.view) setView(s.view);
    update();
  },
  cutUnits(ids, on) { ids.forEach(u => on ? S.cut.add(u) : S.cut.delete(u)); S.scen = null; update(); },
  restoreCable(cid) { unitsOfCable(cid).forEach(u => S.cut.delete(u)); S.scen = null; update(); },
  select(sel) {
    S.sel = sel; S.tab = 'dos';
    if (sel[0] === 'l') { const l = LP[sel.slice(2)]; S.region = NODE[l.node].region; }
    if (sel[0] === 'n') { const n = NODE[sel.slice(2)]; S.region = n.region; map.zoomToPoint(n.lon, n.lat, n.id === 'taiwan' ? 2.4 : 0.9); }
    update();
    if (innerWidth < 1020) document.getElementById('panel').scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
  },
  incident(id) {
    const i = INC[id]; if (!i) return;
    S.sel = 'i:' + id; S.tab = 'dos'; S.inc = true;
    if (i.region) S.region = i.region;
    if (i.lon != null) map.zoomToPoint(i.lon, i.lat, i.zoom || 1.6);
    timeline.show(id);
    update();
    mapbox.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'nearest' });
  },
  node(id) { act.select('n:' + id); },
  zoomPoint(lon, lat, span) { map.zoomToPoint(lon, lat, span); },
};
function setView(v) {
  S.view = v; map.zoomTo(v);
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
}

const panel = createPanel(document.getElementById('panel'), S, act);
const timeline = createTimeline(document.getElementById('timeline'), act);
const repair = createRepair(document.getElementById('repair'), S, act);
function update() {
  const R = evaluate(S);
  map.render(S, R);
  panel.render(R);
  repair.render();
  document.querySelectorAll('[data-layer]').forEach(b => b.setAttribute('aria-pressed', String(S[b.dataset.layer])));
  writeHash();
}

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { setView(b.dataset.view); writeHash(); });
document.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => act.set({ [b.dataset.layer]: !S[b.dataset.layer] }));
document.getElementById('zoom-in').onclick = () => map.zoomIn();
document.getElementById('zoom-out').onclick = () => map.zoomOut();
const cm = document.getElementById('cut-mode');
cm.onclick = () => { cutMode = !cutMode; cm.setAttribute('aria-pressed', String(cutMode)); mapbox.classList.toggle('cutting', cutMode); };

addExportBar(mapbox, {
  where: 'after', target: () => document.getElementById('map'),
  title: () => `Undersea cables of the First Island Chain, ${S.year}${S.cut.size ? `, scenario with ${S.cut.size} cable unit${S.cut.size > 1 ? 's' : ''} cut` : ''}`,
  note: `Cable data: TeleGeography Submarine Cable Map, CC BY-SA 4.0, fetched ${META.fetched}. Taiwan Security Monitor.`,
  csv: () => [['cable', 'rfs', 'planned', 'length', 'countries', 'study_landings', 'design_capacity_tbps', 'capacity_basis', 'capacity_source', 'owners'],
    ...CABLES.map(c => [c.name, c.rfs, c.planned ? 'yes' : 'no', c.length, c.countries.join('; '), c.study.map(l => LP[l].name).join('; '),
      c.cap ? c.cap.tbps : '', c.cap ? c.cap.basis : '', c.cap ? c.cap.url : '', c.owners])],
  csvLabel: 'Copy cable list as CSV',
});

const tour = createTour(mapbox, step => {
  if (step.scen) act.scenario(step.scen);
  if (step.region) S.region = step.region;
  if (step.sel) { S.sel = step.sel; S.tab = 'dos'; } else S.tab = 'calc';
  if (step.view) setView(step.view);
  update();
});
document.getElementById('start-tour').onclick = () => tour.start();
document.getElementById('copy-link').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; } catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
};
const tw = TOTALS.find(t => t.id === 'twnic-2026-07');
if (tw) document.getElementById('twnic').textContent = `${tw.value_tbps.toFixed(1)} Tbps`;
document.querySelectorAll('[data-fetched]').forEach(n => { n.textContent = META.fetched; });

setView(S.view);
update();
if (S.sel && S.sel[0] === 'i') { const i = INC[S.sel.slice(2)]; timeline.show(i.id); if (i.lon != null) map.zoomToPoint(i.lon, i.lat, i.zoom || 1.6); }
if (S.sel && S.sel[0] === 'l') { const l = LP[S.sel.slice(2)]; map.zoomToPoint(l.lon, l.lat, 1.2); }
