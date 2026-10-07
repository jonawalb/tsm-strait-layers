// App state, mode switching and rendering.
import { along, distKm, fmt } from './geo.js';
import { PLA, TAIWAN, BLUE_ROUTES, RED_ROUTES, BASES, FUJIAN } from './layers.js';
import { createMap } from './map.js';
import { drawProfile, resetProfile } from './profile.js';
import { createTour } from './tour.js';
import { layerList, panelApproach, panelCrossing, panelSalvo, panelActivity, MODE_LAYERS } from './panel.js';
import { assessBlue, statusOf, whyText, notesFor, renderFlightTable, profileRows } from './modes/approach.js';
import { assessRed, statusRed, whyRed, renderExposure, profileRowsRed } from './modes/crossing.js';
import { SALVO_DEFAULTS, SALVO_CONTROLS, runSalvo, renderSalvo } from './modes/salvo.js';
import { PRESETS, AS_OF, summarize, renderStats, drawTimeline, drawOverlay, hoverText, dayText } from './modes/activity.js';
import { readHash, writeHash } from './hash.js';
import { addExportBar } from '../../../shared/js/export.js';
import { TSM } from '../../../shared/data/tsm.js';
import * as fx from './fx.js';
import { widths } from './fxbars.js';

const $ = id => document.getElementById(id);
const BOXES = { region: null, strait: [117.3, 21.6, 122.8, 26.8] };

const S = {
  mode: 'approach',
  blue: { route: 0, t: 0.72, free: null },
  red: { route: 1, t: 0.35, free: null },
  cm: { emcon: false, jam: false, blind: false, aew: false, c2: false },
  rc: { radar: false, mpa: false, supp: 0.3, disperse: false, mines: false, drones: false },
  knots: 12,
  salvo: structuredClone(SALVO_DEFAULTS),
  range: PRESETS[2].r(),
  show: {
    approach: Object.fromEntries(MODE_LAYERS.approach.map(id => [id, id !== 'twascm'])),
    crossing: Object.fromEntries(MODE_LAYERS.crossing.map(id => [id, !['sam', 'srbm', 'twdrone'].includes(id)])),
    geo: { adiz: true, median: true, zones: false, fic: false, bases: true, ccg: true, transitline: true },
  },
  measure: null,
  playing: false,
};
readHash(S);

const map = createMap($('map'), {
  onClick: p => {
    if (S.measure) { S.measure = S.measure.length >= 2 ? [p] : [...S.measure, p]; map.drawMeasure(S.measure); return; }
    const u = unitFor(S.mode); if (!u) return;
    S[u].free = p; stopPlay(); render();
  },
  onUnitDrag: (key, p) => { S[key].free = p; stopPlay(); render(); },
});
const tour = createTour($('mapbox'), applyPatch);
fx.chart($('map'), 'map', null); // first view: the map's layers draw in

const unitFor = m => (m === 'crossing' ? 'red' : m === 'activity' ? null : 'blue');
const routesFor = u => (u === 'red' ? RED_ROUTES : BLUE_ROUTES);
const posOf = u => S[u].free || along(routesFor(u)[S[u].route].pts, S[u].t);
const showFor = () => (S.mode === 'crossing' ? S.show.crossing : S.show.approach);

// ---- Panel mounting ----------------------------------------------------------
function mountPanel() {
  const p = $('panel');
  p.innerHTML = { approach: panelApproach, crossing: panelCrossing, salvo: panelSalvo, activity: () => panelActivity(AS_OF) }[S.mode]();
  document.querySelectorAll('.tabs [data-mode]').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === S.mode));
  document.body.dataset.mode = S.mode;
  mountLayers();
  fx.stagger(p, '.sec');
  const u = unitFor(S.mode);
  if (u && $('routes')) {
    $('routes').querySelectorAll('button').forEach(b => b.onclick = () => { S[u].route = +b.dataset.route; S[u].free = null; S[u].t = 0; resetProfile(); render(); });
    $('progress').oninput = e => { S[u].free = null; S[u].t = e.target.value / 1000; stopPlay(); render(); };
    $('play').onclick = togglePlay;
  }
  document.querySelectorAll('[id^="cm-"]').forEach(i => { const k = i.id.slice(3); i.checked = S.cm[k]; i.onchange = () => { S.cm[k] = i.checked; resetProfile(); render(); }; });
  document.querySelectorAll('[id^="rc-"]').forEach(i => { const k = i.id.slice(3); i.checked = S.rc[k]; i.onchange = () => { S.rc[k] = i.checked; resetProfile(); render(); }; });
  bindSlider('speed', () => S.knots, v => { S.knots = v; }, v => v + ' kn');
  bindSlider('supp', () => S.rc.supp, v => { S.rc.supp = v; resetProfile(); }, v => Math.round(v * 100) + '%');
  SALVO_CONTROLS.forEach(c => bindSlider('sv-' + c.k, () => S.salvo[c.k], v => { S.salvo[c.k] = v; }, c.f));
  ['ascm', 'df21', 'df26'].forEach(k => bindSlider('sn-' + k, () => S.salvo.n[k], v => { S.salvo.n[k] = v; }, v => v));
  if ($('presets')) $('presets').querySelectorAll('button').forEach(b => b.onclick = () => { S.range = PRESETS.find(p => p.k === b.dataset.preset).r(); render(); });
  resetProfile();
}

function bindSlider(id, get, set, f) {
  const i = $(id); if (!i) return;
  i.value = get(); $(id + '-out').textContent = f(get());
  i.oninput = () => { set(+i.value); $(id + '-out').textContent = f(+i.value); render(); };
}

function mountLayers() {
  const box = $('layers'); if (!box) return;
  box.innerHTML = layerList(S.mode, { ...showFor(), ...S.show.geo });
  box.querySelectorAll('input').forEach(i => {
    const id = i.id.slice(4);
    i.onchange = () => { (id in S.show.geo ? S.show.geo : showFor())[id] = i.checked; render(); };
  });
}

// ---- Playback ----------------------------------------------------------------
let raf = null, last = null;
function togglePlay() {
  const u = unitFor(S.mode);
  if (S.playing) return stopPlay();
  S[u].free = null; if (S[u].t >= 1) S[u].t = 0;
  S.playing = true; last = null; raf = requestAnimationFrame(step);
}
function step(ts) {
  const u = unitFor(S.mode);
  if (!S.playing || !u) return;
  if (last != null) { S[u].t = Math.min(1, S[u].t + (ts - last) / 14000); render(); }
  last = ts;
  if (S[u].t >= 1) stopPlay(); else raf = requestAnimationFrame(step);
}
function stopPlay() { S.playing = false; cancelAnimationFrame(raf); const b = $('play'); if (b) b.textContent = 'Play'; }

// ---- Rendering ---------------------------------------------------------------
function statusBox(st) {
  const b = $('status'); if (!b) return;
  b.dataset.s = st.s; b.innerHTML = `<b>${st.b}</b><span>${st.t}</span>`;
  fx.changed(b);
}
function chainBox(states) {
  const c = $('chain'); if (!c) return;
  [...c.children].forEach((li, i) => { li.dataset.s = states[i] ? 'ok' : 'off'; });
}

function renderVisibility() {
  const show = showFor(), geo = S.show.geo, allowed = new Set(MODE_LAYERS[S.mode === 'salvo' ? 'approach' : S.mode]);
  Object.entries(map.rings).forEach(([id, g]) => { g.style.display = allowed.has(id) && show[id] ? '' : 'none'; });
  map.geo.adiz.style.display = geo.adiz ? '' : 'none';
  map.geo.median.style.display = geo.median ? '' : 'none';
  [map.geo.ts12, map.geo.cz24, map.geo.zlabel].forEach(e => { e.style.display = geo.zones ? '' : 'none'; });
  map.geo.fic.style.display = geo.fic ? '' : 'none';
  map.g.bases.style.display = geo.bases ? '' : 'none';
  map.g.overlay.style.display = S.mode === 'activity' ? '' : 'none';
  map.g.rings.style.opacity = S.mode === 'crossing' ? 0.55 : 1;
  map.geo.adiz.style.removeProperty('--adiz-heat');
  map.g.rings.querySelectorAll('.ring').forEach(r => { r.classList.toggle('countered', false); });
  if (S.mode !== 'crossing') {
    map.rings.sky.classList.toggle('countered', S.cm.jam);
    map.rings.sig.classList.toggle('countered', S.cm.emcon);
    map.rings.aew.classList.toggle('countered', S.cm.aew);
  } else {
    map.rings.twradar.classList.toggle('countered', S.rc.radar);
    map.rings.twmpa.classList.toggle('countered', S.rc.mpa);
    map.rings.twascm.classList.toggle('countered', S.rc.supp >= 0.9 && !S.rc.disperse);
  }
}

function renderBlue() {
  const p = posOf('blue'), r = assessBlue(p, S.cm), st = statusOf(r);
  map.setUnit('blue', p, { state: st.s });
  map.setUnit('red', null, { visible: false });
  map.setRoute(S.blue.free ? null : BLUE_ROUTES[S.blue.route].pts, 'blue');
  map.setLines(r.cleared.map(l => ({ from: l.c, to: p, col: l.col })));
  statusBox(st);
  const route = BLUE_ROUTES[S.blue.route];
  const pk = `blue|${S.blue.route}|${JSON.stringify(S.cm)}`;
  fx.chart($('profile'), pk, () => drawProfile($('profile'), { key: pk, pts: route.pts, rows: profileRows(S.cm),
    t: S.blue.free ? null : S.blue.t, onScrub: t => { S.blue.free = null; S.blue.t = t; stopPlay(); render(); } }));
  $('profile-title').textContent = `Route profile · ${route.n}${S.blue.free ? ' (group placed off-route)' : ''}`;
  return { p, r };
}

function renderApproach() {
  const { p, r } = renderBlue();
  syncScrub('blue');
  $('readout').innerHTML = `<dt>Position</dt><dd>${p[1].toFixed(2)}°N ${p[0].toFixed(2)}°E</dd>
    <dt>To Fujian coast</dt><dd>${fmt(distKm(FUJIAN, p))} km · ${fmt(distKm(FUJIAN, p) / 1.852)} nm</dd>`;
  chainBox(r.chain);
  $('why').innerHTML = whyText(r);
  $('flight').innerHTML = renderFlightTable(r);
  $('notes').innerHTML = notesFor(r, p, TAIWAN.find(l => l.id === 'twascm').cs).map(n => `<li>${n}</li>`).join('');
}

function renderSalvoMode() {
  const { r } = renderBlue();
  const res = runSalvo(S.salvo, r.cleared.map(l => l.id));
  $('salvo').innerHTML = renderSalvo(res, S.salvo);
  fx.count($('salvo'), '.salvo-sum b');
  widths($('salvo'), '.mag span');
  fx.stagger($('salvo'), '.wave');
}

function renderCrossing() {
  const route = RED_ROUTES[S.red.route], p = posOf('red'), r = assessRed(p, route, S.rc), st = statusRed(r);
  map.setUnit('red', p, { state: st.s });
  map.setUnit('blue', null, { visible: false });
  map.setRoute(S.red.free ? null : route.pts, 'red');
  const tw = TAIWAN.find(l => l.id === 'twascm');
  const shooter = tw.cs.reduce((a, c) => (distKm(c, p) < distKm(a, p) ? c : a));
  map.setLines(r.engage.length ? [{ from: shooter, to: p, col: '--tw' }] : []);
  statusBox(st);
  chainBox(r.chain);
  syncScrub('red');
  $('why').innerHTML = whyRed(r);
  $('exposure').innerHTML = renderExposure(route, S.rc, S.knots);
  fx.count($('exposure'), 'dd');
  const notes = [`${fmt(r.beachKm)} km to the landing area.`];
  if (r.mines) notes.push('Inside the minefield off the landing area.');
  if (S.rc.supp > 0) notes.push(`PLA suppression leaves ${Math.round(r.surv * 100)}% of Taiwan's coastal launchers.`);
  $('notes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
  const pk = `red|${S.red.route}|${JSON.stringify(S.rc)}`;
  fx.chart($('profile'), pk, () => drawProfile($('profile'), { key: pk, pts: route.pts, rows: profileRowsRed(route, S.rc),
    t: S.red.free ? null : S.red.t, onScrub: t => { S.red.free = null; S.red.t = t; stopPlay(); render(); } }));
  $('profile-title').textContent = `Crossing profile · ${route.n}`;
}

let timeline = null, heldDay = null;
const TL0 = 'Hover the timeline (or focus it and use the arrow keys) for daily detail. Click a day, or press Enter, to keep it here with links; drag to select a window.';
function renderActivity() {
  const [from, to] = S.range;
  const s = summarize(from, to);
  map.setUnit('blue', null, { visible: false }); map.setUnit('red', null, { visible: false });
  map.setRoute(null); map.setLines([]);
  fx.chart(map.g.overlay, `${from}|${to}`, () => drawOverlay(map.g.overlay, s, map.geo.adiz));
  fx.count(map.g.overlay, '.t-ccg-n');
  map.g.overlay.querySelectorAll('.ccg-bubble, .t-ccg, .t-ccg-n').forEach(e => { e.style.display = S.show.geo.ccg ? '' : 'none'; });
  map.g.overlay.querySelectorAll('.transit-line, .t-transit').forEach(e => { e.style.display = S.show.geo.transitline ? '' : 'none'; });
  $('stats').innerHTML = renderStats(s);
  fx.count($('stats'), '.tile b, .delta');
  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', JSON.stringify(PRESETS.find(p => p.k === b.dataset.preset).r()) === JSON.stringify(S.range)));
  if (!timeline) {
    timeline = fx.chart($('timeline'), 'tl', () => drawTimeline($('timeline'), from, to,
      (a, b, live, day) => { if (!live) heldDay = day; S.range = [a, b]; renderActivity(); if (!live) writeHash(S); },
      (row, ccg, tr) => { $('tl-tip').innerHTML = row ? hoverText(row, ccg, tr) : heldDay ? dayText(heldDay) : TL0; }));
  }
  timeline.setWindow(from, to);
}

function syncScrub(u) {
  const pr = $('progress'); if (pr && !S[u].free) pr.value = Math.round(S[u].t * 1000);
  document.querySelectorAll('#routes button').forEach(b => b.setAttribute('aria-pressed', !S[u].free && +b.dataset.route === S[u].route));
  const pl = $('play'); if (pl && !S.playing) pl.textContent = S[u].t >= 1 ? 'Replay' : 'Play';
  if (pl && S.playing) pl.textContent = 'Pause';
}

function render() {
  renderVisibility();
  ({ approach: renderApproach, crossing: renderCrossing, salvo: renderSalvoMode, activity: renderActivity })[S.mode]();
  if (!S.playing) writeHash(S);
}

// ---- Mode + patch application (tour, tabs, hash) -------------------------------
function setMode(m) { if (m === S.mode) return; stopPlay(); S.mode = m; mountPanel(); render(); }

function applyPatch(p) {
  stopPlay();
  if (p.blue) Object.assign(S.blue, p.blue);
  if (p.red) Object.assign(S.red, p.red);
  if (p.cm) S.cm = { ...p.cm };
  if (p.rc) S.rc = { ...S.rc, supp: 0, ...p.rc };
  if (p.range) S.range = PRESETS.find(x => x.k === p.range).r();
  if (p.zoom) p.zoom === 'region' ? map.reset() : map.zoomToBox(BOXES[p.zoom]);
  S.mode = p.mode; mountPanel(); render();
}

document.querySelectorAll('.tabs [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('zoom-in').onclick = () => map.zoomIn();
$('zoom-out').onclick = () => map.zoomOut();
$('zoom-region').onclick = () => map.reset();
$('zoom-strait').onclick = () => map.zoomToBox(BOXES.strait);
$('measure').onclick = () => {
  S.measure = S.measure ? null : [];
  $('measure').setAttribute('aria-pressed', !!S.measure);
  $('mapbox').classList.toggle('measuring', !!S.measure);
  map.drawMeasure(S.measure || []);
};
$('start-tour').onclick = () => tour.start();
$('copy-link').onclick = async () => {
  writeHash(S);
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy from address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 2000);
};

// Bases table (static)
$('basetable').innerHTML = BASES.map(b => {
  const reach = PLA.filter(l => ['srbm', 'df21', 'df26', 'ascm'].includes(l.id) && distKm(l.c, b.c) <= l.r);
  return `<tr><td>${b.n}</td><td class="num">${fmt(distKm(FUJIAN, b.c))} km</td><td>${reach.length ? reach.map(l => `<span class="pill" style="color:var(${l.col})">${l.name}</span>`).join('') : '<span class="muted">none modeled</span>'}</td></tr>`;
}).join('');
fx.stagger($('basetable'), 'tr');

// Export: the map in any mode; the activity timeline with its daily rows
const MODE_NAME = { approach: 'Blue approach', crossing: 'PLA crossing', salvo: 'Salvo math', activity: 'TSM activity' };
addExportBar($('mapbox'), { where: 'after', target: () => $('map'),
  title: () => `Strait Layers: ${MODE_NAME[S.mode]}${S.mode === 'activity' ? `, ${S.range[0]} to ${S.range[1]}` : ''}`,
  note: () => (S.mode === 'activity' ? 'Data: TSM PLA Activity Center, CCG Incident Tracker and Strait Transit Tracker'
    : 'Ranges: CSIS Missile Threat; coastal missile, SAM and sensor ranges are notional') });
addExportBar(document.querySelector('.under-timeline'), { target: () => $('timeline'),
  title: () => `PLA aircraft around Taiwan, daily; selected window ${S.range[0]} to ${S.range[1]}`,
  note: 'Data: TSM PLA Activity Center (Taiwan MND daily reports), CCG Incident Tracker, Strait Transit Tracker',
  csv: () => [['date', 'aircraft', 'adiz_entries', 'plan_ships', 'official_ships', 'flag'],
    ...TSM.daily.filter(r => r[0] >= S.range[0] && r[0] <= S.range[1]).map(r => r.slice(0, 6))] });

mountPanel();
render();
