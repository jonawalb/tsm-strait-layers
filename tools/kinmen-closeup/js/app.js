// Kinmen Close-Up: state, scrubber, URL hash and wiring.
import { INC, SECTORS, AREA_NOTE, AREA_EXAMPLES, YEARS, FIXES, AIS, END, windowOf, inWindow, shown, addDays, daysBetween, niceLong, nice } from './model.js';
import { createMap } from './map.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { monthChart, hourChart } from './charts.js';
import { renderSectors, renderHulls, renderDetail, renderTable } from './panel.js';

document.getElementById('area-note').textContent = AREA_NOTE;
document.getElementById('area-ex').textContent = AREA_EXAMPLES;
import { createTour } from './tour.js';

const $ = id => document.getElementById(id);
const S = { y: 'all', w: windowOf('all'), date: END, sectors: new Set(SECTORS.map(s => s.key)), sel: null, hull: null, waters: true, ais: true, mode: 'entry' };

function writeHash() {
  const q = new URLSearchParams({ y: S.y, d: S.date });
  if (S.sectors.size < SECTORS.length) q.set('s', [...S.sectors].join(','));
  if (S.sel != null) q.set('i', INC[S.sel].id);
  if (S.hull) q.set('h', S.hull);
  if (!S.waters) q.set('w', 0);
  if (!S.ais) q.set('a', 0);
  if (S.mode !== 'entry') q.set('t', 'first');
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  S.y = YEARS.includes(q.get('y')) ? q.get('y') : 'all';
  S.w = windowOf(S.y);
  const d = q.get('d');
  S.date = /^\d{4}-\d\d-\d\d$/.test(d || '') && d >= S.w.s && d <= S.w.e ? d : S.w.e;
  if (q.has('s')) { const v = q.get('s').split(',').filter(k => SECTORS.some(s => s.key === k)); if (v.length) S.sectors = new Set(v); }
  const i = INC.find(x => String(x.id) === q.get('i'));
  S.sel = i ? i.k : null;
  S.hull = /^14[56]\d\d$/.test(q.get('h') || '') ? q.get('h') : null;
  S.waters = q.get('w') !== '0';
  S.ais = q.get('a') !== '0';
  S.mode = q.get('t') === 'first' ? 'first' : 'entry';
}

const tip = $('map-tip');
const map = createMap($('map'), tip, {
  onPick: k => { S.sel = k; render(); },
  onHover: (i, e, anchor) => {
    if (!i) { tip.hidden = true; return; }
    map.show(`<b>${nice(i.date)}</b><span class="tt-d">${esc(i.desc)}</span>${i.ccg.length ? i.ccg.join(', ') : esc(i.vessels)}<small>Approximate area, not a position</small>`, e, anchor);
  },
});
const drawMonths = monthChart($('mchart'), $('mchart-tip'), { onMonth: d => { S.date = d < S.w.e ? d : S.w.e; stopPlay(); render(); } });
const drawHours = hourChart($('hchart'), $('hchart-tip'));
const tour = createTour($('mapbox'), st => {
  S.y = st.year; S.w = windowOf(st.year); S.date = st.date || S.w.e;
  S.sectors = new Set(SECTORS.map(s => s.key)); S.hull = st.hull || null; S.sel = st.pick ?? null;
  if (st.waters) S.waters = true;
  if (st.ais) S.ais = true;
  render();
});

function render() {
  const list = INC.filter(i => shown(i, S));
  const visible = new Set(list.map(i => i.k));
  if (S.sel != null && !visible.has(S.sel)) S.sel = null;
  map.update({ S, visible, hullSet: S.hull ? new Set([S.hull]) : null });
  drawMonths({ S, list });
  const n = drawHours({ list, mode: S.mode });
  $('hnote').textContent = `${n} of ${list.length} incidents record a ${S.mode === 'entry' ? 'time of entry into the waters' : 'clock time'} (Taiwan time, UTC+8). Shaded hours are 18:00 to 06:00.`;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));

  $('date').textContent = niceLong(S.date);
  $('count').textContent = list.length;
  const last30 = list.filter(i => daysBetween(i.date, S.date) < 30).length;
  $('last30').textContent = last30;
  const prev = list.at(-1);
  $('since').textContent = prev ? `Last incident ${nice(prev.date)}, ${daysBetween(prev.date, S.date)} days before this date.` : 'No incidents yet in this window.';
  const fx = FIXES.filter(f => f.date <= S.date);
  $('aisn').textContent = S.date < AIS.t0.slice(0, 10) ? `AIS window starts ${nice(AIS.t0.slice(0, 10))}` : `${fx.length} AIS fixes in the box by this date`;
  const sl = $('slider');
  sl.max = daysBetween(S.w.s, S.w.e);
  sl.value = daysBetween(S.w.s, S.date);
  sl.setAttribute('aria-valuetext', niceLong(S.date));
  $('ticks').innerHTML = tickHtml(S.w);
  document.querySelectorAll('#years .btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.y === S.y)));

  const counts = {};
  INC.filter(i => inWindow(i, S.w) && i.date <= S.date).forEach(i => { counts[i.sec[0]] = (counts[i.sec[0]] || 0) + 1; });
  const on = {
    sector: k => { if (S.sectors.has(k)) { if (S.sectors.size > 1) S.sectors.delete(k); } else S.sectors.add(k); render(); },
    hull: h => { S.hull = S.hull === h ? null : h; render(); },
    pick: k => { if (k == null) return; S.sel = k; render(); },
  };
  renderSectors($('sectors'), S, counts, on);
  renderHulls($('hulls'), S, list, on);
  renderDetail($('detail'), S, list, on);
  renderTable($('rows'), $('table-note'), S, list, on);
  $('waters').checked = S.waters;
  $('ais').checked = S.ais;
  writeHash();
}

function tickHtml(w) {
  const span = daysBetween(w.s, w.e), out = [];
  for (let y = +w.s.slice(0, 4); y <= +w.e.slice(0, 4); y++) {
    const d = `${y}-01-01` < w.s ? w.s : `${y}-01-01`;
    out.push(`<span style="left:${daysBetween(w.s, d) / span * 100}%">${y}</span>`);
  }
  if (w.y !== 'all') return ['01', '04', '07', '10'].map(m => `${w.y}-${m}-01`).filter(d => d >= w.s && d <= w.e)
    .map(d => `<span style="left:${daysBetween(w.s, d) / span * 100}%">${nice(d).slice(0, 3)}</span>`).join('');
  return out.join('');
}

$('years').innerHTML = [['all', 'All years'], ...YEARS.map(y => [y, y])].map(([y, t]) => `<button type="button" class="btn sm" data-y="${y}">${t}</button>`).join('');
$('years').querySelectorAll('.btn').forEach(b => b.onclick = () => { S.y = b.dataset.y; S.w = windowOf(S.y); S.date = S.w.e; stopPlay(); render(); });
$('slider').addEventListener('input', e => { S.date = addDays(S.w.s, Number(e.target.value)); stopPlay(); render(); });
$('waters').addEventListener('change', e => { S.waters = e.target.checked; render(); });
$('ais').addEventListener('change', e => { S.ais = e.target.checked; render(); });
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { S.mode = b.dataset.mode; render(); });
$('to-start').onclick = () => { S.date = S.w.s; stopPlay(); render(); };
$('to-end').onclick = () => { S.date = S.w.e; stopPlay(); render(); };
let timer = null;
const play = $('play');
function stopPlay() { clearInterval(timer); timer = null; play.setAttribute('aria-pressed', 'false'); play.innerHTML = '<span aria-hidden="true">▶</span> Play'; }
play.onclick = () => {
  if (timer) { stopPlay(); return; }
  if (S.date >= S.w.e) S.date = S.w.s;
  play.setAttribute('aria-pressed', 'true');
  play.innerHTML = '<span aria-hidden="true">❚❚</span> Pause';
  const step = S.y === 'all' ? 7 : 3, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  timer = setInterval(() => {
    S.date = addDays(S.date, reduce ? step * 4 : step);
    if (S.date >= S.w.e) { S.date = S.w.e; stopPlay(); }
    render();
  }, reduce ? 800 : 160);
};
$('start-tour').onclick = () => { stopPlay(); tour.start(); };
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; } catch { $('copy-link').textContent = 'Copy from the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};
$('from').textContent = `TSM tracker, ${nice(INC[0].date)} to ${nice(INC.at(-1).date)}`;

readHash();
render();
