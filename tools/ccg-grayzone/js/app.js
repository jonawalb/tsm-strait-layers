// CCG Gray-Zone Map: state, year window, slider and playback, URL hash, and wiring between map, chart and panel.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { INC, LOCS, LOC, YEARS, AS_OF, windowOf, inWindow, addDays, daysBetween, niceLong, nice, monthEnd, monthsOf, monthShort, computeFirsts } from './model.js';
import { createMap } from './map.js';
import { createChart } from './chart.js';
import { renderFilters, renderDetail, renderFirsts, renderTable, flagPills } from './panel.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = { w: windowOf('all'), date: AS_OF, on: new Set(LOCS.map(l => l.key)), sel: null, adiz: true, speed: 1 };
const FIRSTS = computeFirsts();

readHash();

const mapTip = $('#map-tip');
const map = createMap($('#map'), {
  onPick: id => select(id, false),
  onHover: (i, e, anchor) => {
    if (!i) { mapTip.hidden = true; return; }
    const box = $('#mapbox').getBoundingClientRect();
    const r = anchor ? anchor.getBoundingClientRect() : null;
    const x = e ? e.clientX - box.left : r.left - box.left, y = e ? e.clientY - box.top : r.top - box.top;
    mapTip.innerHTML = `<b>${nice(i.date)}</b> · ${LOC[i.loc].label}<br>${escapeHtml(i.desc || i.timeline || 'No description recorded.')}` +
      `${i.flags.length ? `<br>${flagPills(i)}` : ''}<br><span class="muted">Approximate position. Click for details.</span>`;
    mapTip.hidden = false;
    mapTip.style.left = Math.max(0, Math.min(box.width - 290, x + 14)) + 'px';
    mapTip.style.top = Math.max(0, y - 10) + 'px';
  },
});
const chart = createChart($('#chart'), $('#chart-tip'), {
  onMonth: ym => { stop(); setDate(monthEnd(ym)); },
});

/* Year window */
const yearsEl = $('#years');
yearsEl.innerHTML = ['all', ...YEARS].map(y => `<button type="button" class="btn sm" data-y="${y}">${y === 'all' ? 'All years' : y}</button>`).join('');
yearsEl.querySelectorAll('[data-y]').forEach(b => b.onclick = () => { stop(); setWindow(b.dataset.y); });
function setWindow(y, date) {
  S.w = windowOf(y);
  S.date = date && date >= S.w.s && date <= S.w.e ? date : S.w.e;
  const cur = INC.find(i => i.id === S.sel);
  if (!cur || !inWindow(cur, S.w) || cur.date > S.date) S.sel = visible().at(-1)?.id ?? null;
  frameSlider();
  render();
}

const slider = $('#slider');
slider.addEventListener('input', () => { stop(); setDate(addDays(S.w.s, Number(slider.value))); });
/** Slider range and tick labels for the current window: years for the full range, months for one year. */
function frameSlider() {
  const span = daysBetween(S.w.s, S.w.e);
  slider.max = span;
  yearsEl.querySelectorAll('[data-y]').forEach(b => b.setAttribute('aria-pressed', b.dataset.y === S.w.y));
  const months = monthsOf(S.w);
  const ticks = S.w.y === 'all'
    ? months.filter((m, j) => j === 0 || m.endsWith('-01')).map(m => [m, m.slice(0, 4)])
    : months.map(m => [m, monthShort(m)]);
  $('#ticks').innerHTML = ticks.map(([m, t]) => {
    const d = m + '-01' < S.w.s ? S.w.s : m + '-01';
    return `<span style="left:${(daysBetween(S.w.s, d) / span * 100).toFixed(2)}%">${t}</span>`;
  }).join('');
  $('#to-start').setAttribute('aria-label', `Go to ${niceLong(S.w.s)}`);
}

/* Playback */
let timer = null;
const playBtn = $('#play');
function play() {
  if (S.date >= S.w.e) setDate(S.w.s, false);
  playBtn.setAttribute('aria-pressed', 'true');
  playBtn.innerHTML = '<span aria-hidden="true">❚❚</span> Pause';
  const step = S.w.y === 'all' ? 3 : 1;
  const tick = () => {
    if (S.date >= S.w.e) { stop(); return; }
    setDate(addDays(S.date, step), false);
  };
  timer = setInterval(tick, reduced ? 250 : 70 / S.speed);
}
function stop() {
  if (!timer) return;
  clearInterval(timer); timer = null;
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.innerHTML = '<span aria-hidden="true">▶</span> Play';
  render();
}
playBtn.onclick = () => (timer ? stop() : play());
document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => {
  S.speed = Number(b.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b));
  if (timer) { clearInterval(timer); timer = null; play(); }
});
$('#to-start').onclick = () => { stop(); setDate(S.w.s); };
$('#to-end').onclick = () => { stop(); setDate(S.w.e); };

$('#adiz').checked = S.adiz;
$('#adiz').onchange = e => { S.adiz = e.target.checked; render(); };

/* Selection */
function visible() { return INC.filter(i => inWindow(i, S.w) && i.date <= S.date && S.on.has(i.loc)); }
function select(id, jump) {
  const i = INC.find(x => x.id === id);
  if (!i) return;
  if (!inWindow(i, S.w)) { S.w = windowOf('all'); frameSlider(); }
  if (jump || i.date > S.date) S.date = i.date;
  if (!S.on.has(i.loc)) S.on.add(i.loc);
  S.sel = id;
  stop();
  render();
  if (jump) $('#mapbox').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
}
function setDate(d, full = true) {
  S.date = d < S.w.s ? S.w.s : d > S.w.e ? S.w.e : d;
  const cur = INC.find(i => i.id === S.sel);
  if (!cur || !inWindow(cur, S.w) || cur.date > S.date || !S.on.has(cur.loc) || timer) S.sel = visible().at(-1)?.id ?? null;
  render(full);
}

/* Render */
function render(full = true) {
  slider.value = daysBetween(S.w.s, S.date);
  slider.setAttribute('aria-valuetext', niceLong(S.date));
  const vis = visible();
  const locsSeen = new Set(vis.map(i => i.loc));
  $('#date').textContent = niceLong(S.date);
  $('#from').textContent = `from ${niceLong(S.w.s)}`;
  $('#count').textContent = vis.length;
  $('#count-l').textContent = vis.length === 1 ? 'incident' : 'incidents';
  $('#locs').textContent = locsSeen.size;
  $('#locs-l').textContent = locsSeen.size === 1 ? 'location' : 'locations';
  const recent = vis.filter(i => (Date.parse(S.date) - Date.parse(i.date)) / 864e5 <= 10);
  $('#recent').textContent = recent.length ? `${recent.length} in the last 10 days, pulsing on the map` : 'None in the last 10 days';
  map.update({ w: S.w, date: S.date, on: S.on, sel: S.sel, showAdiz: S.adiz });
  chart.update({ w: S.w, date: S.date, on: S.on });
  renderFilters($('#filters'), S.on, S.w, S.date, k => {
    if (S.on.has(k)) S.on.delete(k); else S.on.add(k);
    setDate(S.date);
  });
  renderFirsts($('#firsts'), FIRSTS, S.w, S.date, f => select(f.id, true));
  if (!full && timer) { writeHash(); return; }
  const idx = vis.findIndex(i => i.id === S.sel);
  const cur = vis[idx] || null;
  renderDetail($('#detail'), cur, { hasPrev: idx > 0, hasNext: idx >= 0 && idx < vis.length - 1, pos: idx + 1, total: vis.length });
  $('#detail').querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    const n = vis[idx + Number(b.dataset.d)];
    if (n) select(n.id, false);
  });
  renderTable($('#rows'), S.w, S.on, S.sel, select);
  $('#table-note').textContent = S.w.y === 'all' ? 'All years, newest first.' : `${S.w.y} only, newest first.`;
  writeHash();
}

/* Hash: #y=2025&d=2025-06-19&i=33&off=Kinmen */
function writeHash() {
  const q = new URLSearchParams();
  if (S.w.y !== 'all') q.set('y', S.w.y);
  q.set('d', S.date);
  if (S.sel) q.set('i', S.sel);
  const off = LOCS.filter(l => !S.on.has(l.key)).map(l => l.short);
  if (off.length) q.set('off', off.join(','));
  if (!S.adiz) q.set('adiz', '0');
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  S.w = windowOf(q.get('y') || 'all');
  const d = q.get('d');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && d >= S.w.s && d <= S.w.e) S.date = d; else S.date = S.w.e;
  (q.get('off') || '').split(',').forEach(s => { const L = LOCS.find(l => l.short === s); if (L) S.on.delete(L.key); });
  const i = Number(q.get('i'));
  if (visible().some(x => x.id === i)) S.sel = i;
  if (q.get('adiz') === '0') S.adiz = false;
  if (!S.sel) S.sel = visible().at(-1)?.id ?? null;
}

$('#copy-link').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
  catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
};

const tour = createTour($('#mapbox'), s => {
  stop();
  S.on = new Set(LOCS.map(l => l.key));
  S.w = windowOf(s.year || 'all');
  S.date = s.date && s.date >= S.w.s && s.date <= S.w.e ? s.date : S.w.e;
  const pick = INC.find(i => i.id === s.pick);
  if (pick && pick.date > S.date) S.date = pick.date;
  S.sel = pick && inWindow(pick, S.w) ? pick.id : visible().at(-1)?.id ?? null;
  frameSlider();
  render();
});
$('#start-tour').onclick = () => tour.start();

/* Export */
const NOTE = 'Data: TSM CGA/CCG Incident Tracker (Taiwan Coast Guard Administration releases). Pins are approximate positions by location.';
const period = () => `${S.w.y === 'all' ? 'June 2024' : niceLong(S.w.s)} to ${niceLong(S.date)}`;
const csvRows = () => [['date', 'location', 'description', 'event_timeline', 'ccg_prc_vessels', 'cga_vessels'],
  ...visible().map(i => [i.date, LOC[i.loc].label, i.desc, i.timeline, i.vessels, i.cga])];
addExportBar($('#mapbox'), { where: 'after', target: () => $('#map'), note: NOTE, title: () => `China Coast Guard incidents around Taiwan, ${period()}`, csv: csvRows });
addExportBar(document.querySelector('.chartwrap'), { where: 'after', target: () => $('#chart'), note: NOTE, title: () => `CCG incidents per month by location, ${period()}`, csv: csvRows });

frameSlider();
render();
