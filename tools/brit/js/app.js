// BRIT: wiring, legend, URL hash state.
import { COUNTRIES, META } from '../data/countries.js';
import { IMAGERY } from '../data/imagery.js';
import { createMap } from './map.js';
import { renderOverview, renderCountry, markProject } from './panel.js';
import { METRICS, EDGE_LABELS, SECTOR_GROUPS, escapeHtml } from './fmt.js';

const $ = (s) => document.querySelector(s);
const panel = $('#panel');
const state = { metric: 'ad', iso: null, bri: false, all: false, sat: null };
const cache = {};

const map = createMap({
  svg: $('#map'), tip: $('#tip'),
  onSelect: (iso) => selectCountry(iso, { focus: false }),
  onProject: (id) => { markProject(panel, id); openSat(id); },
  onSat: (id) => openSat(id),
});

// Open (or with null, forget) a satellite view: switch the dossier to its country without moving the map,
// then the map zooms to the site and draws the card and leader line.
async function openSat(id) {
  if (id == null) { state.sat = null; state.satIso = null; writeHash(); return; }
  const cur = Object.hasOwn(IMAGERY, id) ? IMAGERY[id] : null;
  const iso = cur ? cur.iso : state.iso;
  if (!iso) return;
  if (state.iso !== iso) await selectCountry(iso, { zoom: false, focus: false });
  if (cur) map.openSat(id);
  else {
    const p = (cache[iso] || []).find((x) => x.id === id && x.ll);
    if (!p) return;
    map.openLive(p, iso);
  }
  state.sat = id; state.satIso = iso;
  writeHash();
  status(`Showing satellite view of ${cur ? cur.site || 'the project site' : 'the project location'}`);
}
const pick = (iso) => selectCountry(iso);

async function loadProjects(iso) {
  if (iso === 'CHN' || !COUNTRIES[iso]?.ad) return [];
  if (!cache[iso]) {
    try { cache[iso] = (await import(`../data/c/${iso}.js`)).PROJECTS; } catch { cache[iso] = []; }
  }
  return cache[iso];
}

const status = (t) => { $('#brit-status').textContent = t; };
const focusHead = () => panel.querySelector('h2')?.focus({ preventScroll: true });

async function selectCountry(iso, { zoom = true, focus = true } = {}) {
  if (state.sat && state.satIso !== iso) { state.sat = null; state.satIso = null; map.closeSat(); }
  state.iso = iso;
  map.select(iso, { zoomTo: zoom });
  writeHash();
  legend();
  if (!iso) { map.showProjects([]); renderOverview(panel, state.metric, { onPick: pick, name: map.name, onSat: openSat }); status('Showing overview'); if (focus) focusHead(); return; }
  panel.innerHTML = '<div class="sec"><p class="note">Loading…</p></div>';
  const projects = await loadProjects(iso);
  if (state.iso !== iso) return;
  map.showProjects(projects);
  renderCountry(panel, iso, state.metric, projects, {
    name: map.name,
    onBack: () => { selectCountry(null); map.zoomToView('world'); },
    onShow: (id) => { markProject(panel, id); map.highlightProject(id); },
    onSat: openSat,
  });
  status(`Showing dossier for ${map.name(iso)}`);
  if (focus) focusHead();
  if (matchMedia('(max-width: 1020px)').matches && zoom) panel.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function legend() {
  const m = METRICS[state.metric];
  $('#legend').innerHTML = `<span class="lt">${escapeHtml(m.label)}, ${m.span}</span>
    <div class="ramp">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<span style="background:var(--r${i})"></span>`).join('')}</div>
    <div class="ticks"><span>&gt;0</span>${EDGE_LABELS.map((t) => `<span>${t}</span>`).join('')}</div>
    <div class="keys"><span><i class="k-cn"></i>China</span><span><i class="k-nd"></i>None recorded</span><span><i class="k-bri"></i>BRI signatory</span><span><i class="k-ex"></i>Left or uncertain</span><span><i class="k-sat"></i>Satellite view</span></div>
    ${state.iso || state.all ? `<div class="sects">${SECTOR_GROUPS.map((g) => `<span><i style="background:${g.color}"></i>${g.name}</span>`).join('')}</div>` : ''}`;
}

function setMetric(m) {
  state.metric = m;
  document.querySelectorAll('[data-metric]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === m)));
  map.setMetric(m);
  legend();
  selectCountry(state.iso, { zoom: false, focus: false });
}

function writeHash() {
  const p = new URLSearchParams();
  if (state.iso) p.set('c', state.iso);
  if (state.metric !== 'ad') p.set('m', state.metric);
  if (state.bri) p.set('bri', '1');
  if (state.all) p.set('pts', '1');
  if (state.sat) p.set('sat', state.sat);
  const s = p.toString();
  history.replaceState(null, '', s ? `#${s}` : location.pathname + location.search);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const m = p.get('m');
  const c = p.get('c'), sat = p.get('sat');
  return { metric: m === 'aei' ? 'aei' : 'ad', iso: (c && Object.hasOwn(COUNTRIES, c)) || c === 'CHN' ? c : null, bri: p.get('bri') === '1', all: p.get('pts') === '1', sat: sat && /^\d{1,7}$/.test(sat) ? +sat : null };
}

// Controls
document.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => setMetric(b.dataset.metric)));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => map.zoomToView(b.dataset.view)));
$('#zoom-in').addEventListener('click', () => map.zoomBy(1.6));
$('#zoom-out').addEventListener('click', () => map.zoomBy(1 / 1.6));
$('#bri-only').addEventListener('click', (e) => {
  state.bri = !state.bri; e.currentTarget.setAttribute('aria-pressed', String(state.bri)); map.setBriOnly(state.bri); writeHash();
});
$('#all-pts').addEventListener('click', (e) => {
  state.all = !state.all; e.currentTarget.setAttribute('aria-pressed', String(state.all)); map.showAll(state.all); legend(); writeHash();
});

// Country search
const names = Object.keys(COUNTRIES).map((iso) => [map.name(iso), iso]).sort((a, b) => a[0].localeCompare(b[0]));
$('#country-list').innerHTML = names.map(([n]) => `<option value="${escapeHtml(n)}"></option>`).join('');
$('#country-search').addEventListener('change', (e) => {
  const v = e.target.value.trim().toLowerCase();
  const hit = names.find(([n]) => n.toLowerCase() === v) || names.find(([n]) => n.toLowerCase().startsWith(v));
  if (hit) { selectCountry(hit[1]); e.target.value = ''; } else if (v) status('No country matches that name');
});

$('#built').textContent = META.built;
$('#regional-note').textContent = `$${META.gcdfRegional.toFixed(1)} billion of it went to regional or multi-country projects with no single recipient, so the country shading covers the rest.`;

// Init
const init = readHash();
state.bri = init.bri; state.all = init.all;
$('#bri-only').setAttribute('aria-pressed', String(state.bri)); map.setBriOnly(state.bri);
$('#all-pts').setAttribute('aria-pressed', String(state.all)); map.showAll(state.all);
setMetric(init.metric);
if (init.sat && !Object.hasOwn(IMAGERY, init.sat) && init.iso) selectCountry(init.iso, { focus: false }).then(() => openSat(init.sat));
else if (init.sat) openSat(init.sat); else if (init.iso) selectCountry(init.iso, { focus: false });

// Follow links that change only the hash (e.g. pasted share links in an open tab)
addEventListener('hashchange', () => {
  const s = readHash();
  if (s.metric !== state.metric) setMetric(s.metric);
  if (s.bri !== state.bri) { state.bri = s.bri; $('#bri-only').setAttribute('aria-pressed', String(s.bri)); map.setBriOnly(s.bri); }
  if (s.all !== state.all) { state.all = s.all; $('#all-pts').setAttribute('aria-pressed', String(s.all)); map.showAll(s.all); legend(); }
  if (s.sat && s.sat !== state.sat) openSat(s.sat);
  else if (s.iso !== state.iso) selectCountry(s.iso, { focus: false });
});
