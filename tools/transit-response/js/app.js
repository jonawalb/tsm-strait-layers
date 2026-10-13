// Transit Response Explorer: state, wiring, rendering and the URL hash.
import { EVENTS, METRICS, AS_OF, analyze, unavailable, aggregate, eventById, nice, OFFSETS } from './events.js';
import { drawSingle, drawAggregate } from './chart.js';
import { drawStrip, drawMap } from './strip.js';
import { shipsHtml, eventListHtml, singleReadout, flagsHtml, offHtml, aggReadout, dayTip, aggTip } from './panel.js';
import { createTour } from './tour.js';
import { dateLinksHtml, dayLink, exerciseFor, exerciseLink, linkHtml } from '../../../shared/js/links.js';
import { addExportBar } from '../../../shared/js/export.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const S = { view: 'single', ev: EVENTS[EVENTS.length - 1].id, m: 'air', unit: 'count', to: 3, dropx: false, clean: false, showev: true };
const TIP0 = 'Hover or use the arrow keys on the chart for daily detail. Click a day to keep it here with links.';
let focusK = null, current = null, agg = null;

// ---- hash ---------------------------------------------------------------------------
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (['single', 'agg'].includes(q.get('v'))) S.view = q.get('v');
  if (eventById(q.get('e'))) S.ev = q.get('e');
  if (METRICS[q.get('m')]) S.m = q.get('m');
  if (['count', 'pct'].includes(q.get('u'))) S.unit = q.get('u');
  const w = parseInt(q.get('w'), 10); if (w >= 0 && w <= 10) S.to = w;
  if (q.has('x')) S.dropx = q.get('x') === '1';
  if (q.has('c')) S.clean = q.get('c') === '1';
  if (q.has('s')) S.showev = q.get('s') === '1';
}
function writeHash() {
  const q = new URLSearchParams({ v: S.view, m: S.m, u: S.unit, w: S.to, x: +S.dropx });
  if (S.view === 'single') q.set('e', S.ev); else { q.set('c', +S.clean); q.set('s', +S.showev); }
  history.replaceState(null, '', '#' + q.toString());
}

// ---- helpers ------------------------------------------------------------------------
const opts = () => ({ dropExercises: S.dropx });
const isOff = e => unavailable(e, S.m, opts());
const okEvents = () => EVENTS.filter(e => !isOff(e));
function step(dir) {
  const ok = okEvents(); if (!ok.length) return;
  const cur = EVENTS.find(e => e.id === S.ev);
  const next = dir > 0 ? ok.find(e => e.date > cur.date) : ok.slice().reverse().find(e => e.date < cur.date);
  if (next) { S.ev = next.id; render(); scrollToSelected(); }
}
function scrollToSelected() {
  const b = $('evlist').querySelector('[aria-pressed="true"]');
  if (b) b.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
const pressed = (box, attr, v) => box.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === String(v)));

// ---- rendering ----------------------------------------------------------------------
function renderControls() {
  document.body.dataset.view = S.view;
  pressed($('view'), 'v', S.view);
  $('metric').innerHTML = Object.entries(METRICS).map(([k, M]) => {
    const n = EVENTS.filter(e => !unavailable(e, k, opts())).length;
    return `<button type="button" data-m="${k}" aria-pressed="${k === S.m}"><b>${M.short}</b><span>${n} events</span></button>`;
  }).join('');
  $('metric').querySelectorAll('button').forEach(b => b.onclick = () => { S.m = b.dataset.m; render(); });
  $('metric-help').textContent = METRICS[S.m].help + ` Recorded since ${METRICS[S.m].fromText || 'Aug. 6, 2022'}.`;
  pressed($('unit'), 'u', S.unit);
  $('win').value = S.to; $('win-out').textContent = `day 0 to +${S.to}`;
  $('dropx').checked = S.dropx; $('clean').checked = S.clean; $('showev').checked = S.showev;
}

function renderSingle() {
  const e = eventById(S.ev);
  const a = analyze(e, S.m, opts());
  current = a; agg = null;
  $('evlist').innerHTML = eventListHtml(EVENTS, S.ev, isOff);
  $('evlist').querySelectorAll('button').forEach(b => b.onclick = () => { S.ev = b.dataset.ev; focusK = null; render(); });
  const ex = exerciseFor(e.date);
  const evLinks = [linkHtml(dayLink(e.date), 'See the transit day'), ex ? linkHtml(exerciseLink(ex.id, e.date), `Replay ${ex.short}`) : ''].filter(Boolean).join('');
  $('ships').innerHTML = shipsHtml(e) + (evLinks ? `<p class="xlinks">${evLinks}</p>` : '');
  fx.chart($('map'), e.id, () => drawMap($('map'), e));
  $('chart-title').textContent = `${METRICS[S.m].name} around ${nice(e.date)}`;
  $('chart-legend').innerHTML = '<span><i class="sw bar"></i>Daily count</span><span><i class="sw base"></i>30-day baseline ± 1 sd</span><span><i class="sw up"></i>Above</span><span><i class="sw down"></i>Below</span><span><b class="jm">J</b> Joint readiness patrol</span><span><i class="tri"></i>Other transit</span>';
  if (a.why) {
    $('chart').innerHTML = ''; $('chart').style.display = 'none';
    $('chart-msg').hidden = false;
    $('chart-msg').innerHTML = `<b>No chart for this event.</b> ${a.why}.`;
    $('readout').innerHTML = offHtml(e, a.why, S.m);
    $('flags').innerHTML = '<li>Pick an event with a filled dot to see its window.</li>';
    $('tip').textContent = TIP0;
    return;
  }
  $('chart').style.display = ''; $('chart-msg').hidden = true;
  fx.chart($('chart'), `s|${S.ev}|${S.m}|${S.unit}|${S.to}|${S.dropx}`, () => drawSingle($('chart'), a, { unit: S.unit, to: S.to, focus: focusK, onHover }));
  $('readout').innerHTML = singleReadout(a, S.unit, S.to);
  fx.count($('readout'), '.num, dd');
  $('flags').innerHTML = flagsHtml(a);
  showTip(focusK);
}

function renderAgg() {
  current = null;
  agg = aggregate(S.m, { unit: S.unit, to: S.to, clean: S.clean, dropExercises: S.dropx });
  $('chart-title').textContent = `${METRICS[S.m].name}: average change around transits`;
  $('chart-legend').innerHTML = '<span><i class="sw us"></i>U.S. ship present</span><span><i class="sw ally"></i>No U.S. ship</span><span>Bands: 95% bootstrap interval</span>';
  $('chart').style.display = ''; $('chart-msg').hidden = true;
  if (!agg.us.n && !agg.ally.n) {
    $('chart').style.display = 'none'; $('chart-msg').hidden = false;
    $('chart-msg').innerHTML = '<b>No analyzable events</b> for this metric and filter.';
  } else {
    fx.chart($('chart'), `a|${S.m}|${S.unit}|${S.to}|${S.clean}|${S.dropx}|${S.showev}`, () => drawAggregate($('chart'), agg, { showEvents: S.showev, onHover, onPick: id => { S.view = 'single'; S.ev = id; focusK = null; render(); scrollToSelected(); } }));
  }
  $('readout').innerHTML = aggReadout(agg);
  fx.count($('readout'), '.num, dd');
  showTip(focusK);
}

/** Hover shows a day; a click holds it (with links) until another day is clicked. */
function onHover(k, hold) {
  if (hold) {
    focusK = k;
    if (S.view === 'single' && current && !current.why) drawSingle($('chart'), current, { unit: S.unit, to: S.to, focus: focusK, onHover });
  }
  showTip(k ?? focusK);
}
function showTip(k) {
  if (k == null) { $('tip').innerHTML = TIP0; return; }
  if (current && !current.why) {
    const d = current.days.find(x => x.k === k), l = d ? dateLinksHtml(d.d) : '';
    $('tip').innerHTML = dayTip(current, k, S.unit) + (l ? ` <span class="xlinks">${l}</span>` : '');
  } else if (agg) $('tip').innerHTML = aggTip(agg, k);
}

function render() {
  renderControls();
  fx.chart($('strip'), S.m, () => drawStrip($('strip'), { selected: S.view === 'single' ? S.ev : null, isOff, metric: S.m, onPick: id => { S.view = 'single'; S.ev = id; focusK = null; render(); scrollToSelected(); } }));
  if (S.view === 'single') renderSingle(); else renderAgg();
  fx.stagger($('evlist'), 'li');
  fx.stagger($('ships'), 'li');
  writeHash();
}

// ---- wiring -------------------------------------------------------------------------
$('view').querySelectorAll('button').forEach(b => b.onclick = () => { S.view = b.dataset.v; focusK = null; render(); });
$('unit').querySelectorAll('button').forEach(b => b.onclick = () => { S.unit = b.dataset.u; render(); });
$('win').oninput = () => { S.to = +$('win').value; render(); };
$('dropx').onchange = () => { S.dropx = $('dropx').checked; render(); };
$('clean').onchange = () => { S.clean = $('clean').checked; render(); };
$('showev').onchange = () => { S.showev = $('showev').checked; render(); };
$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('chart').addEventListener('keydown', ev => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
  ev.preventDefault();
  const lo = OFFSETS[0], hi = OFFSETS[OFFSETS.length - 1];
  if (focusK == null) focusK = 0;
  else if (ev.key === 'ArrowLeft') focusK = Math.max(lo, focusK - 1);
  else if (ev.key === 'ArrowRight') focusK = Math.min(hi, focusK + 1);
  else focusK = ev.key === 'Home' ? lo : hi;
  if (S.view === 'single' && current && !current.why) drawSingle($('chart'), current, { unit: S.unit, to: S.to, focus: focusK, onHover });
  showTip(focusK);
});
$('chart').addEventListener('blur', () => { focusK = null; });

// ---- export -------------------------------------------------------------------------
const NOTE = 'Data: TSM Taiwan Strait Transit Tracker and PLA Activity Center (Taiwan MND daily reports)';
addExportBar(document.getElementById('chart-wrap'), {
  where: 'after', target: () => $('chart'), note: NOTE,
  title: () => $('chart-title').textContent,
  csv: () => {
    if (S.view === 'single' && current && !current.why) {
      return [['date', 'day_offset', METRICS[S.m].name.toLowerCase(), 'baseline_mean', 'deviation', 'pct_vs_baseline', 'flag'],
        ...current.days.map(d => [d.d, d.k, d.v, current.b.mean?.toFixed(2), d.dev?.toFixed(2), d.pct?.toFixed(1), d.flag || ''])];
    }
    return [['date', 'ships', 'hulls', 'countries'], ...EVENTS.map(e => [e.date, e.ships.map(s => s.name).join('; '), e.ships.map(s => s.hull).join('; '), e.countries.join('; ')])];
  },
  csvLabel: 'Copy data as CSV',
});
addExportBar(document.querySelector('.stripwrap'), { where: 'after', target: () => $('strip'), title: 'Allied Taiwan Strait transits, 2017–2026', note: NOTE,
  csv: () => [['date', 'ship', 'hull', 'class', 'type', 'country'], ...EVENTS.flatMap(e => e.ships.map(s => [e.date, s.name, s.hull, s.cls, s.rawType ?? s.type, s.country]))] });
$('copy-link').onclick = async () => {
  writeHash();
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy from address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 2000);
};
$('asof').textContent = nice(AS_OF);

const tour = createTour(document.body, patch => { Object.assign(S, patch); focusK = null; render(); scrollToSelected(); });
$('start-tour').onclick = () => tour.start();

readHash();
render();
const sw = document.querySelector('.stripwrap');
if (sw) sw.scrollLeft = sw.scrollWidth;
