// Indo-Pacific Leadership Index: state, filters, URL hash, wiring.
import { LEADERS } from '../data/index.js';
import { SCORES } from '../data/scores.js';
import { LAYERS, yearOf, activeAt, buildEdges, edgeActive, statusAt, earliestYear, stateEdge, FACTION_COLORS } from './edges.js';
import { computeConnections, renderConnList, renderCmpBar } from './connections.js';
import { watchHtml, coverageText } from './watch.js';
import { turnoverCases, renderTurnover } from './turnover.js';
import { centrality } from './centrality.js';
import { createGraph } from './graph.js';
import { renderProfile, renderEmptyProfile, renderPair, COUNTRY_NAMES } from './profile.js';
import { renderTable } from './table.js';
import { createScenario, CRISES } from './scenario.js';
import { renderTiles, renderOrgChart } from './orgchart.js';
import { loadTraits, traitsHtml, traitsMethodHtml } from './traits.js';
import { loadRhetoric, statementsHtml, rhetoricMethodHtml } from './rhetoric.js';
import { loadOptional } from './optional.js';
import { meetingEdges, meetingEdgeAt, meetingsHtml, renderMatrix } from './meetings.js';
import { toneHtml } from './tone.js';
import { badgesHtml, renderCalendar } from './transitions.js';
import { renderPacket } from './packet.js';
import { NEW_LAYERS, cohortEdges, cosponsorEdges, voteEdges, sanctionTies, recs, hasLayer } from './layerdata.js';
import { profileLayersHtml, renderSanctionsPanel, renderLegislature, renderSuccession, renderChanges, renderTriggers } from './layerviews.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

const $ = id => document.getElementById(id);
const L = LEADERS;
const COUNTRIES = Object.keys(COUNTRY_NAMES);
const asOfY = yearOf(L.asOf);
const people = new Map(L.people.map(p => [p.id, p]));
const orgs = new Map(L.orgs.map(o => [o.id, o]));
const ALL_EDGES = buildEdges(L);
const nameOf = id => people.get(id)?.name || id;
ALL_EDGES.forEach(e => { e.layerLabel = LAYERS[e.layer].label; e.na = nameOf(e.a); e.nb = nameOf(e.b); });
const hasData = L.people.length > 0;
const CASES = turnoverCases(L);
const TRAITS = await loadTraits(L.fixture); // optional data/traits.js; empty if missing
const hasTraits = Object.keys(TRAITS.people).length > 0;
const RHET = await loadRhetoric(L.fixture); // optional data/rhetoric_people.js; empty if missing
const hasStatements = Object.keys(RHET.people).length > 0;
// Optional data from other agents; a missing file hides its feature.
const [MEETINGS, TONE, TRANSITIONS] = await Promise.all([loadOptional('meetings', 'MEETINGS', L.fixture), loadOptional('tone_people', 'TONE', L.fixture), loadOptional('transitions', 'TRANSITIONS', L.fixture)]);
for (const e of meetingEdges(MEETINGS, people)) { e.layerLabel = LAYERS.mt.label; e.na = nameOf(e.a); e.nb = nameOf(e.b); ALL_EDGES.push(e); }
if (!MEETINGS) delete LAYERS.mt;
// Wave-3 layers and the change log load after first paint. undefined = loading, null = not available.
let LD, CH;
const tISO = () => S.month === monthsMax ? L.asOf : `${ym(S.month)}-31`;
const perCountry = Object.fromEntries(COUNTRIES.map(c => [c, L.people.filter(p => p.country === c).length]));

// PRC Eastern Theater focus: CHN orgs named or coded as the Eastern Theater, plus their child orgs.
const ETC = new Set(L.orgs.filter(o => o.country === 'CHN' && (/eastern theat/i.test(o.name) || /-ETC$/.test(o.id) || /东部战区/.test(o.name_native || ''))).map(o => o.id));
for (let grew = true; grew;) { grew = false; for (const o of L.orgs) if (o.parent && ETC.has(o.parent) && !ETC.has(o.id)) { ETC.add(o.id); grew = true; } }
const etcPeople = new Set(L.people.filter(p => p.posts.some(x => ETC.has(x.org))).map(p => p.id));
const FOCI = { all: 'All people', ...(etcPeople.size ? { etc: 'PRC Eastern Theater and ties' } : {}) };

// Slider: months from the earliest dated post (or 10 years back) to asOf.
const y0 = Math.min(earliestYear(L) ?? Math.floor(asOfY) - 10, Math.floor(asOfY) - 1);
const monthsMax = Math.round((asOfY - y0) * 12);
const monthToY = m => Math.min(asOfY, y0 + (m + 0.5) / 12); // the last month ends at the data date
const ym = m => { const y = y0 + Math.floor(m / 12); return `${y}-${String((m % 12) + 1).padStart(2, '0')}`; };
const ymToMonth = s => { const r = /^(\d{4})-(\d{2})$/.exec(s || ''); return r ? (+r[1] - y0) * 12 + (+r[2] - 1) : null; };

const S = {
  sel: null, pair: null, view: 'org', orgC: null, orgOpen: new Map(), focus: FOCI.etc ? 'etc' : 'all', tier: 'all', former: true, q: '',
  layers: { co: true, hi: true, ca: true, bg: false, rel: true, fa: true, st: false, mt: true, pc: false, cs: false, lv: false, sx: true }, cmp: [],
  countries: new Set(COUNTRIES), month: monthsMax,
  sort: { k: 'tier', dir: 'asc' }, traitCols: false, stCol: false, scen: { actors: [], crisis: CRISES[0].id }, turn: { c: 'CHN', fam: 'all', since: 2023 }, cal: { c: 'all', k: 'all' }, toneOv: false, pk: false,
  tw: { topic: 'all' }, succ: { c: 'all' }, chg: { k: 'all', c: 'all' }, trigK: 'all', sx: { sort: { k: 'date', dir: 'desc' }, only: false },
};
readHash();
const fresh = !location.hash;

// ---------- derived view ----------
let V = { nodes: [], edges: [], cent: new Map() };
function topPost(p, t) {
  const act = p.posts.filter(x => activeAt(x, t, asOfY));
  const last = act[0] || p.posts.slice().filter(x => (yearOf(x.start) ?? -Infinity) <= t).sort((a, b) => (yearOf(b.end) ?? asOfY) - (yearOf(a.end) ?? asOfY))[0];
  if (!last) return '';
  return `${act.length ? '' : 'Former '}${last.title}, ${orgs.get(last.org)?.name || last.org}`;
}
function decorate(p, t) {
  return { ...p, activeNow: p.posts.some(x => activeAt(x, t, asOfY)), statusNow: statusAt(p, t), topPost: topPost(p, t),
    short: p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name };
}
function toggleCmp(id) {
  if (!id) return;
  S.cmp = S.cmp.includes(id) ? S.cmp.filter(x => x !== id) : [...S.cmp, id];
  refresh();
}
function compute() {
  const t = monthToY(S.month);
  // People in the record by date t: at least one post started by then (unknown start counts).
  let ps = L.people.filter(p => S.countries.has(p.country) && (S.tier === 'all' || p.tier === 1));
  ps = ps.map(p => ({ p, act: p.posts.some(x => activeAt(x, t, asOfY)), started: p.posts.some(x => (yearOf(x.start) ?? -Infinity) <= t) }))
    .filter(x => x.act || (S.former && x.started)).map(x => ({ ...x.p, activeNow: x.act }));
  let ids = new Set(ps.map(p => p.id));
  let es = ALL_EDGES.filter(e => S.layers[e.layer] && ids.has(e.a) && ids.has(e.b) && edgeActive(e, t)).map(e => e.layer === 'mt' ? meetingEdgeAt(e, t) : e);
  if (S.focus === 'etc') {
    const keep = new Set([...etcPeople].filter(id => ids.has(id)));
    for (const e of es) if (e.layer !== 'bg') { if (etcPeople.has(e.a)) keep.add(e.b); if (etcPeople.has(e.b)) keep.add(e.a); }
    ps = ps.filter(p => keep.has(p.id)); ids = keep;
    es = es.filter(e => keep.has(e.a) && keep.has(e.b));
  }
  const cent = centrality(ps.map(p => p.id), es);
  // State alignment (not personal): only from the selected person to tier-1 people of other countries with no relation edge.
  const sp = S.layers.st && S.sel && ids.has(S.sel) ? people.get(S.sel) : null;
  if (sp) {
    const related = new Set(es.filter(e => e.layer === 'rel' && (e.a === sp.id || e.b === sp.id)).map(e => e.a === sp.id ? e.b : e.a));
    for (const q of ps) if (q.tier === 1 && q.id !== sp.id && !related.has(q.id)) { const e = stateEdge(L, sp, q, t); if (e) { e.layerLabel = LAYERS.st.label; e.na = nameOf(e.a); e.nb = nameOf(e.b); es.push(e); } }
  }
  const cmpSet = new Set(S.cmp);
  const nodes = ps.map(p => ({ ...decorate(p, t), ties: cent.get(p.id).degree, cmp: cmpSet.has(p.id) }));
  V = { nodes, edges: es, cent, t };
  if (S.view === 'conn') {
    V.C = computeConnections({ L, people, edges: ALL_EDGES, layers: S.layers, t, cmp: S.cmp, decorate: q => decorate(q, t) });
    // Sanctions: state -> compared actor, as state-level adversarial ties. Never used for paths.
    if (S.layers.sx && LD && hasLayer(LD, 'sanctions')) {
      const X = sanctionTies(LD, V.C.sel, people, tISO(), asOfY, c => COUNTRY_NAMES[c] || c);
      X.edges.forEach(e => { e.layerLabel = LAYERS.sx.label; e.na = STATE_NODES.get(e.a)?.name || X.nodes.find(n => n.id === e.a).name; e.nb = nameOf(e.b); });
      X.nodes.forEach(n => STATE_NODES.set(n.id, n));
      V.C.nodes.push(...X.nodes); V.C.edges.push(...X.edges);
    }
  }
}
const STATE_NODES = new Map(); // imposing states drawn in Connections, by "state:ISO3"
const personOrState = id => people.get(id) || STATE_NODES.get(id);

// ---------- controls ----------
function buildLayerToggles() {
  $('layers').innerHTML = Object.entries(LAYERS).map(([k, v]) => `<label class="tg"><input type="checkbox" data-layer="${k}"${S.layers[k] ? ' checked' : ''}><span class="sw"></span>
    <span class="t"><i class="sw-${k}" aria-hidden="true"></i>${v.label} <span class="num cnt" data-cnt="${k}"></span><small>${v.help}</small></span></label>`).join('');
  $('layers').querySelectorAll('input').forEach(i => i.addEventListener('change', () => { S.layers[i.dataset.layer] = i.checked; S.pair = null; refresh(); }));
}
function buildControls() {
  buildLayerToggles();
  $('countries').innerHTML = COUNTRIES.map(c => `<button type="button" data-c="${c}" style="--k:var(--k-${c})" ${perCountry[c] ? '' : 'disabled'} title="${COUNTRY_NAMES[c]}${perCountry[c] ? '' : ': records pending'}">${c}<small>${perCountry[c] || 'pending'}</small></button>`).join('');
  $('countries').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.c; S.countries.has(c) ? S.countries.delete(c) : S.countries.add(c); refresh();
  }));
  $('c-all').addEventListener('click', () => { S.countries = new Set(COUNTRIES); refresh(); });
  $('c-none').addEventListener('click', () => { S.countries = new Set(); refresh(); });
  $('tier').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.tier = b.dataset.tier; refresh(); }));
  $('focus').innerHTML = Object.entries(FOCI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('focus').addEventListener('change', e => { S.focus = e.target.value; refresh(true); });
  $('former').addEventListener('change', e => { S.former = e.target.checked; refresh(); });
  const sl = $('date'); sl.max = monthsMax; sl.disabled = !hasData;
  sl.addEventListener('input', () => { S.month = +sl.value; refresh(); });
  $('date-now').addEventListener('click', () => { S.month = monthsMax; refresh(); });
  $('date-min').textContent = y0; $('date-max').textContent = L.asOf.slice(0, 7);
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { S.view = b.dataset.view; refresh(); }));
  $('zin').addEventListener('click', () => graph.zoomBy(1.3)); $('zout').addEventListener('click', () => graph.zoomBy(1 / 1.3));
  $('zfit').addEventListener('click', () => graph.fit());
  $('copy-link').addEventListener('click', async () => { writeHash(); try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy the address bar'; } setTimeout(() => { $('copy-link').textContent = 'Copy link to this view'; }, 1800); });
  const q = $('q');
  q.disabled = !hasData;
  q.addEventListener('input', () => { S.q = q.value; renderSearch(); graph.highlight(S.sel, matches()); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const m = searchHits()[0]; if (m) pick(m.id, true); } if (e.key === 'Escape') { q.value = ''; S.q = ''; renderSearch(); graph.highlight(S.sel); } });
}
function searchHits() {
  const s = S.q.trim().toLowerCase(); if (s.length < 2) return [];
  return L.people.filter(p => [p.name, p.name_native, p.id, ...p.posts.map(x => x.title + ' ' + (orgs.get(x.org)?.name || ''))].join(' ').toLowerCase().includes(s)).slice(0, 8);
}
const matches = () => new Set(searchHits().map(p => p.id));
function renderSearch() {
  const hits = searchHits();
  $('hits').innerHTML = hits.map(p => `<li><button type="button" class="linkbtn" data-pick="${esc(p.id)}">${esc(p.name)}</button> <span class="fine">${p.country} · ${esc(topPost(p, asOfY) || 'no post')}</span></li>`).join('')
    || (S.q.trim().length >= 2 ? '<li class="fine">No match.</li>' : '');
  $('hits').querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => pick(b.dataset.pick, true)));
}

// ---------- selection ----------
function pick(id, reveal = false) {
  S.pair = null;
  if (id && reveal) { // make sure the person is in view
    const p = people.get(id);
    S.countries.add(p.country);
    if (S.tier === '1' && p.tier !== 1) S.tier = 'all';
    if (S.focus === 'etc') { compute(); if (!V.nodes.some(n => n.id === id)) S.focus = 'all'; }
  }
  if (id && reveal && S.view === 'org') { S.orgC = people.get(id).country; S.sel = id; refresh(); openDrawer(id); return; }
  S.sel = id; refresh();
  if (id && reveal && S.view === 'net') graph.focusNode(id);
}
function pickPair(pair) { S.pair = pair; renderPairBox(true); writeHash(); }
function renderPairBox(focus = false) {
  const box = $('pair');
  if (!S.pair) { box.hidden = true; box.innerHTML = ''; return; }
  const [a, b] = S.pair.split('|');
  const es = (S.view === 'conn' && V.C ? V.C.edges : V.edges).filter(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  if (!es.length) { S.pair = null; box.hidden = true; return; }
  renderPair(box, personOrState(a), personOrState(b), es, id => pick(id), () => { S.pair = null; renderPairBox(); writeHash(); }, focus);
}

// ---------- render ----------
let graph;
function refresh(reheat = false) {
  compute();
  if (S.sel && !V.nodes.some(n => n.id === S.sel)) { /* keep selection; the profile still shows */ }
  const t = V.t;
  $('date').value = S.month; $('date-out').textContent = ym(S.month) + (S.month === monthsMax ? ' (latest)' : '');
  $('focus').value = S.focus; $('former').checked = S.former;
  $('countries').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', S.countries.has(b.dataset.c)));
  $('tier').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', S.tier === b.dataset.tier));
  for (const k of Object.keys(LAYERS)) {
    if (k === 'sx') { const cntEl = $('layers').querySelector('[data-cnt="sx"]'); if (cntEl) cntEl.textContent = `${recs(LD, 'sanctions').length} records${S.layers.sx ? '' : ' off'}`; continue; }
    const n = k === 'st' ? (L.relations?.state_dyads || []).filter(d => activeAt(d, t, asOfY)).length : ALL_EDGES.filter(e => e.layer === k && edgeActive(e, t)).length;
    const shown = (S.view === 'conn' && V.C ? V.C.edges : V.edges).filter(e => e.layer === k).length;
    const cntEl = $('layers').querySelector(`[data-cnt="${k}"]`); if (cntEl) cntEl.textContent = k === 'st' ? `${n} dyads${S.layers[k] ? '' : ' off'}` : S.layers[k] ? `${shown}` : `${n} off`;
  }
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', S.view === b.dataset.view));
  $('netbox').hidden = S.view !== 'net' && S.view !== 'conn';
  for (const [box, v] of [['connbox', 'conn'], ['lyrbox', 'conn'], ['tablebox', 'table'], ['orgbox', 'org'], ['turnbox', 'turn'], ['calbox', 'cal'], ['twbox', 'tw'], ['succbox', 'succ'], ['chgbox', 'chg']]) $(box).hidden = S.view !== v;
  if (S.view !== 'conn') $('mxbox').hidden = true;
  document.body.dataset.view = S.view;
  $('netctl').hidden = (S.view !== 'net' && S.view !== 'conn') || !hasData;
  renderCmpBar($('cmpbar'), S.cmp, people, { showing: S.view === 'conn', onRemove: id => toggleCmp(id), onClear: () => { S.cmp = []; refresh(); }, onShow: () => { S.view = 'conn'; refresh(); }, onPacket: openPacket });
  renderFactionLegend(S.view === 'conn' && V.C ? V.C.edges : V.edges);
  $('count').innerHTML = hasData ? `<b class="num">${V.nodes.length}</b> people · <b class="num">${new Set(V.edges.map(e => e.a < e.b ? e.a + e.b : e.b + e.a)).size}</b> linked pairs · ${ym(S.month)}` : 'No records loaded';

  if (!hasData) { $('empty').hidden = false; if (S.view === 'org') renderOrg(); }
  else {
    $('empty').hidden = V.nodes.length > 0;
    $('empty').innerHTML = V.nodes.length ? '' : '<p><b>Nobody matches these filters.</b></p><p class="fine">Turn on more countries, both tiers, or former officials, or move the date.</p>';
    if (S.view === 'net') graph.update(V.nodes, V.edges, { sel: S.sel, reheat, match: matches() });
    else if (S.view === 'conn') { graph.update(V.C.nodes, V.C.edges, { sel: S.sel, reheat: true }); $('empty').hidden = true; renderConnList($('connbox'), V.C, people, { onPick: id => pick(id) }); renderMatrix($('mxbox'), MEETINGS, people, V.C.sel, tISO()); renderSx(); }
    else if (S.view === 'org') renderOrg();
    else if (S.view === 'turn') { $('empty').hidden = true; renderTurn(); }
    else if (S.view === 'cal') { $('empty').hidden = true; renderCal(); }
    else if (S.view === 'tw') { $('empty').hidden = true; renderTw(); }
    else if (S.view === 'succ') { $('empty').hidden = true; renderSucc(); }
    else if (S.view === 'chg') { $('empty').hidden = true; renderChg(); }
    else renderTable($('tablebox'), V.nodes.map(n => ({ ...n, CC: TRAITS.people[n.id]?.CC?.score, TASK: TRAITS.people[n.id]?.TASK?.score, stmts: RHET.people[n.id]?.n_docs })), S.sort, { sel: S.sel, hasStatements, stCol: S.stCol, onStCol: on => { S.stCol = on; refresh(); }, hasTraits, traitCols: S.traitCols, onTraitCols: on => { S.traitCols = on; refresh(); }, onSort: s => { S.sort = s; refresh(); }, onPick: id => pick(id) });
  }
  const p = S.sel && people.get(S.sel);
  if (p) {
    const ties = V.edges.filter(e => e.a === p.id || e.b === p.id);
    renderProfile($('profile'), p, { ...extras(p), inCmp: S.cmp.includes(p.id), onCmp: toggleCmp, traits: traitsHtml(p, TRAITS), orgs, people, t, asOfY, ties, cent: V.cent.get(p.id), n: V.nodes.length, onPick: id => pick(id, true) });
  } else renderEmptyProfile($('profile'), hasData);
  renderPairBox();
  writeHash();
}

// Profile sections that come from optional data files.
let drawerId = null;
function extras(p) {
  const watch = watchHtml(p, L, { triggers: LD && hasLayer(LD, 'triggers') ? recs(LD, 'triggers', 'trigger') : null, trigK: S.trigK }), st = statementsHtml(p, RHET);
  return { watch, badges: badgesHtml(p, TRANSITIONS), meetings: meetingsHtml(p, MEETINGS, people, tISO()), layers: profileLayersHtml(p, LD, { people, orgs, asOfY }),
    statements: st + toneHtml(p, TONE, { overlayAllowed: !!watch, overlay: S.toneOv, heading: !st }) };
}
const openP = id => { S.sel = id; refresh(); openDrawer(id); };
function renderSx() {
  renderSanctionsPanel($('lyrbox'), LD, S.sx, { people, orgs, cmp: V.C?.sel || [], iso: tISO(), asOfY, onChange: renderSx, onOpen: openP });
}
function renderTw() { renderLegislature($('twbox'), LD, S.tw, { people, onChange: () => { renderTw(); writeHash(); }, onOpen: openP }); }
function renderSucc() { renderSuccession($('succbox'), LD, S.succ, { L, people, orgs, asOfY, onChange: () => { renderSucc(); writeHash(); }, onOpen: openP }); }
function renderChg() { renderChanges($('chgbox'), CH, S.chg, { people, onChange: () => { renderChg(); writeHash(); }, onOpen: openP }); }
function renderCal() {
  renderTriggers($('caltrig'), LD, { get k() { return S.trigK; }, set k(v) { S.trigK = v; } }, { people, onChange: () => { renderCal(); writeHash(); }, onOpen: openP });
  renderCalendar($('calmain'), TRANSITIONS, S.cal, { people, onChange: () => { renderCal(); writeHash(); }, onOpen: id => { S.sel = id; refresh(); openDrawer(id); } });
}
function openPacket() {
  if (!S.cmp.length) return;
  if ($('drawer').open) $('drawer').close();
  S.pk = true;
  renderPacket($('packet'), S.cmp, { L, people, orgs, edges: ALL_EDGES, t: V.t, tISO: tISO(), asOfY, TRAITS, RHET, MEETINGS, TONE, TRANSITIONS }, { onClose: closePacket });
  $('packet').hidden = false; document.body.classList.add('packet-open'); scrollTo(0, 0); writeHash();
  $('packet').querySelector('[data-print]').focus();
}
function closePacket() { S.pk = false; $('packet').hidden = true; document.body.classList.remove('packet-open'); writeHash(); $('cmpbar').querySelector('[data-packet]')?.focus(); }

// ---------- turnover ----------
function renderTurn() {
  renderTurnover($('turnbox'), L, CASES, S.turn, { onChange: () => { renderTurn(); writeHash(); }, onOpen: id => { S.sel = id; refresh(); openDrawer(id); } });
}

// ---------- country view + drawer ----------
function renderOrg() {
  const el = $('orgbox');
  if (!hasData) { el.innerHTML = ''; return; }
  if (!S.orgC) { renderTiles(el, L, V.t, c => { S.orgC = c; refresh(); el.querySelector('.crumbs button')?.focus(); }); return; }
  renderOrgChart(el, S.orgC, {
    L, t: V.t, asOfY, former: S.former, open: S.orgOpen,
    onBack: () => { const c = S.orgC; S.orgC = null; refresh(); el.querySelector(`.tile[data-c="${c}"]`)?.focus(); },
    onToggle: (id, on) => { S.orgOpen.set(id, on); renderOrg(); el.querySelector(`[data-tg="${CSS.escape(id)}"]`)?.focus(); },
    onAll: (ids, on) => { ids.forEach(id => S.orgOpen.set(id, on)); renderOrg(); },
    onOpenPerson: id => { S.sel = id; refresh(); openDrawer(id); },
    onNet: id => showInNetwork(id),
    cmp: new Set(S.cmp), onCmp: id => toggleCmp(id),
  });
}
function showInNetwork(id) {
  if ($('drawer').open) $('drawer').close();
  S.view = 'net'; pick(id, true);
}
// Ties and centrality for the drawer: the whole record at date t with the chosen layers, not the network filters.
let fullCache = { key: '' };
function fullNet() {
  const key = S.month + Object.values(S.layers).join('');
  if (fullCache.key === key) return fullCache;
  const t = V.t;
  const ids = L.people.filter(p => p.posts.some(x => (yearOf(x.start) ?? -Infinity) <= t)).map(p => p.id);
  const set = new Set(ids);
  const es = ALL_EDGES.filter(e => S.layers[e.layer] && set.has(e.a) && set.has(e.b) && edgeActive(e, t));
  fullCache = { key, es, cent: centrality(ids, es), n: ids.length };
  return fullCache;
}
function openDrawer(id) {
  const p = people.get(id); if (!p) return;
  const d = $('drawer'), F = fullNet();
  drawerId = id;
  renderProfile($('drawer-body'), p, { ...extras(p), inCmp: S.cmp.includes(p.id), onCmp: q => { toggleCmp(q); openDrawer(q); }, traits: traitsHtml(p, TRAITS), orgs, people, t: V.t, asOfY, big: true, ties: F.es.filter(e => e.a === id || e.b === id), cent: F.cent.get(id), n: F.n,
    onPick: q => { S.sel = q; refresh(); openDrawer(q); } });
  $('drawer-body').querySelector('.pf-cent + .fine').textContent = `Both are computed on everyone in the record at ${ym(S.month)}, with the tie layers now switched on.`;
  $('drawer-net').onclick = () => showInNetwork(id);
  if (!d.open) d.showModal();
  d.querySelector('.drawer-in').scrollTop = 0;
  writeHash();
}

// ---------- hash ----------
function writeHash() {
  const q = new URLSearchParams();
  q.set('view', S.view);
  if (S.view === 'org' && S.orgC) q.set('c', S.orgC);
  if (S.view === 'cal') { if (S.cal.c !== 'all') q.set('cc', S.cal.c); if (S.cal.k !== 'all') q.set('ck', S.cal.k); }
  if (S.trigK !== 'all') q.set('tk', S.trigK);
  if (S.view === 'tw' && S.tw.topic !== 'all') q.set('lt', S.tw.topic);
  if (S.view === 'succ' && S.succ.c !== 'all') q.set('sw', S.succ.c);
  if (S.view === 'chg') { if (S.chg.k !== 'all') q.set('hk', S.chg.k); if (S.chg.c !== 'all') q.set('hc', S.chg.c); }
  if (S.pk) q.set('pk', '1');
  if (S.view === 'turn') { q.set('c', S.turn.c); if (S.turn.fam !== 'all') q.set('tf', S.turn.fam); if (S.turn.since !== 2023) q.set('ts', S.turn.since); }
  if (S.sel) q.set('p', S.sel);
  q.set('l', Object.keys(S.layers).filter(k => S.layers[k]).join(','));
  if (S.view !== 'org' && S.view !== 'turn' && S.countries.size !== COUNTRIES.length) q.set('c', [...S.countries].join(','));
  if (S.month !== monthsMax) q.set('d', ym(S.month));
  if (S.focus !== 'all') q.set('f', S.focus);
  if (S.tier !== 'all') q.set('t', S.tier);
  if (!S.former) q.set('fo', '0');
  if (S.pair) q.set('e', S.pair);
  if (S.cmp.length) q.set('sel', S.cmp.join(','));
  if ($('drawer')?.open && S.sel) q.set('pd', '1');
  if (S.scen.actors.length) q.set('sa', S.scen.actors.join(','));
  if (S.scen.crisis !== CRISES[0].id) q.set('sc', S.scen.crisis);
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (people.has(q.get('p'))) S.sel = q.get('p');
  if (q.has('l')) { const on = new Set(q.get('l').split(',')); for (const k of Object.keys(S.layers)) S.layers[k] = on.has(k); }
  const view = q.get('view') || q.get('v');
  if (['net', 'table', 'org', 'conn', 'turn', 'cal', 'tw', 'succ', 'chg'].includes(view)) S.view = view;
  if (q.has('tk')) S.trigK = q.get('tk'); if (q.has('lt')) S.tw.topic = q.get('lt'); if (q.has('sw')) S.succ.c = q.get('sw');
  if (q.has('hk')) S.chg.k = q.get('hk'); if (q.has('hc')) S.chg.c = q.get('hc');
  if (q.has('cc')) S.cal.c = q.get('cc'); if (q.has('ck')) S.cal.k = q.get('ck');
  if (q.has('sel')) S.cmp = q.get('sel').split(',').filter(id => people.has(id));
  if (S.view === 'org') { if (perCountry[q.get('c')]) S.orgC = q.get('c'); }
  else if (S.view === 'turn') { if (perCountry[q.get('c')]) S.turn.c = q.get('c'); if (q.has('tf')) S.turn.fam = q.get('tf'); const ts = +q.get('ts'); if (ts >= 2012 && ts <= 2026) S.turn.since = ts; }
  else if (q.has('c')) S.countries = new Set(q.get('c').split(',').filter(c => COUNTRIES.includes(c)));
  const m = ymToMonth(q.get('d')); if (m != null) S.month = Math.max(0, Math.min(monthsMax, m));
  if (q.has('f')) S.focus = FOCI[q.get('f')] ? q.get('f') : 'all'; else if (location.hash) S.focus = 'all';
  if (q.get('t') === '1') S.tier = '1';
  if (q.get('fo') === '0') S.former = false;
  if (q.has('e')) S.pair = q.get('e');
  if (q.has('sa')) S.scen.actors = q.get('sa').split(',').filter(id => people.get(id)?.tier === 1);
  if (CRISES.some(c => c.id === q.get('sc'))) S.scen.crisis = q.get('sc');
}

// ---------- boot ----------
graph = createGraph($('netbox'), $('tip'), { onPick: (id, ev) => { if (id?.startsWith('state:')) return; if (id && ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey)) toggleCmp(id); else if (id || S.view !== 'conn') pick(id); }, onEdge: pickPair });
buildControls();
$('drawer-x').addEventListener('click', () => $('drawer').close());
$('drawer').addEventListener('close', () => writeHash());
if (!TRANSITIONS) { document.querySelector('[data-view="cal"]').hidden = true; }
document.addEventListener('change', e => {
  if (e.target.matches('[data-trig-kind]')) { S.trigK = e.target.value; const inDrawer = !!e.target.closest('#drawer'); refresh(); if (inDrawer && drawerId) openDrawer(drawerId); (inDrawer ? $('drawer') : $('profile')).querySelector('[data-trig-kind]')?.focus(); return; }
  if (!e.target.matches('[data-tone-overlay]')) return;
  S.toneOv = e.target.checked; const inDrawer = !!e.target.closest('#drawer'); refresh(); if (inDrawer && drawerId) openDrawer(drawerId);
});
// Method links: close the drawer and scroll, without replacing the state hash.
document.addEventListener('click', e => {
  const a = e.target.closest('a[href="#traits-method"], a[href="#rhetoric-method"]'); if (!a) return;
  e.preventDefault(); if ($('drawer').open) $('drawer').close();
  const t = $(a.getAttribute('href').slice(1)); t?.scrollIntoView({ block: 'center' }); t?.setAttribute('tabindex', '-1'); t?.focus({ preventScroll: true });
});
$('drawer').addEventListener('click', e => { if (e.target === $('drawer')) $('drawer').close(); });
if (L.fixture) $('fixture').hidden = false;
const packetOnLoad = new URLSearchParams(location.hash.slice(1)).get('pk') === '1';
const drawerOnLoad = S.view === 'org' && S.sel && new URLSearchParams(location.hash.slice(1)).get('pd') === '1';
if (fresh && hasData) {
  // Open on the Eastern Theater's current tier-1 commander if there is one, else the most central person.
  compute();
  const t = V.t;
  const etcNow = V.nodes.filter(n => n.tier === 1 && n.statusNow === 'active' && n.posts.some(x => ETC.has(x.org) && activeAt(x, t, asOfY)));
  const best = (etcNow.length ? etcNow : V.nodes).slice().sort((a, b) => V.cent.get(b.id).betweenness - V.cent.get(a.id).betweenness)[0];
  S.sel = best?.id || null;
  S.scen.actors = L.people.filter(p => p.tier === 1 && p.status === 'active').slice(0, 2).map(p => p.id);
}
refresh(true);
if (drawerOnLoad) openDrawer(S.sel);
if (packetOnLoad && S.cmp.length) openPacket();
createScenario($('scenario'), { actors: L.people.filter(p => p.tier === 1), scores: SCORES, state: S.scen, onChange: writeHash });
renderBelow();
loadLate();
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.view === 'net' && hasData) { graph.resize(); } }, 200); });

function renderFactionLegend(es) {
  const fs = [...new Set(es.filter(e => e.layer === 'fa').map(e => e.faction))];
  const byF = new Map((L.relations?.factions || []).map((f, i) => [f.id, { f, c: FACTION_COLORS[i % FACTION_COLORS.length] }]));
  $('fa-legend').innerHTML = fs.map(id => byF.get(id)).filter(Boolean).map(({ f, c }) => `<span><i class="sw-fa" style="--fc:var(${c})"></i>${esc(f.name)}${f.name_native ? ` ${esc(f.name_native)}` : ''}</span>`).join('');
}
function renderBelow() {
  if (MEETINGS?.meta) $('meet-meta').textContent = ` This build scanned ${MEETINGS.meta.n_docs_scanned?.toLocaleString('en-US') ?? '?'} documents.${MEETINGS.meta.precision ? ` Precision: ${MEETINGS.meta.precision}` : ''}${MEETINGS.meta.method ? ` ${MEETINGS.meta.method}` : ''}`; else $('meet-meta').textContent = ' The meetings file is not loaded yet.';
  $('watch-cover').textContent = coverageText();
  $('traits-method').insertAdjacentHTML('afterend', rhetoricMethodHtml(RHET));
  $('traits-method').outerHTML = traitsMethodHtml(TRAITS).replace('<li>', '<li id="traits-method">');
  const groups = L.groups || [];
  $('coverage').innerHTML = COUNTRIES.map(c => `<li><b>${COUNTRY_NAMES[c]}</b>: ${perCountry[c] ? `${perCountry[c]} people` : 'records pending'}</li>`).join('');
  $('built').textContent = hasData ? `Data as of ${L.asOf}, built from ${groups.length} country file(s): ${L.people.length} people, ${L.orgs.length} organizations, ${L.coappear.length} co-appearances, ${ALL_EDGES.length} derived ties.` : `No country files have passed the build yet (as of ${L.asOf}).`;
  $('gaps').innerHTML = (L.gaps || []).map(g => `<li><span class="pill">${esc(g.group)}</span> ${esc(g.text)}</li>`).join('') || '<li>No gaps reported yet.</li>';
}

// ---------- wave-3 layers and change log (lazy) ----------
async function loadLate() {
  const [D, C] = await Promise.all([loadOptional('layers', 'LAYERS_DATA', L.fixture), loadOptional('changes', 'CHANGES', L.fixture)]);
  LD = D; CH = C;
  if (LD) {
    // New tie layers sit before the state-level ones in the toggles.
    const st = LAYERS.st; delete LAYERS.st;
    LAYERS.pc = NEW_LAYERS.pc; LAYERS.cs = NEW_LAYERS.cs;
    if (hasLayer(LD, 'ly_votes')) LAYERS.lv = NEW_LAYERS.lv;
    LAYERS.st = st;
    if (hasLayer(LD, 'sanctions')) LAYERS.sx = NEW_LAYERS.sx;
    for (const e of [...cohortEdges(LD, people), ...cosponsorEdges(LD, people), ...voteEdges(LD, people)]) { e.id = `${e.layer}:${e.a}|${e.b}`; e.layerLabel = LAYERS[e.layer].label; e.na = nameOf(e.a); e.nb = nameOf(e.b); ALL_EDGES.push(e); }
    fullCache = { key: '' };
    buildLayerToggles();
    if (!TRANSITIONS && hasLayer(LD, 'triggers')) document.querySelector('[data-view="cal"]').hidden = false;
  }
  if (!TRANSITIONS && !(LD && hasLayer(LD, 'triggers')) && S.view === 'cal') S.view = 'org';
  refresh();
  if ($('drawer').open && drawerId) openDrawer(drawerId);
}
