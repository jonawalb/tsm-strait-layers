// Anatomy of an Exercise: state, wiring, playback and the URL hash.
import { METRICS, byId, windowOf, coverage, priorMean, timelineOf, PRE } from './data.js';
import { createMap, drawZones } from './map.js';
import { drawDays, drawCompare } from './chart.js';
import { exListHtml, dayReadHtml, metricHtml, timelineHtml, factsHtml, zoneSrcHtml, sourcesHtml, dayLab } from './panel.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const COLS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7', '--c8'];
const S = { view: 'replay', x: 'aug-2022', k: 0, m: 'air', picks: ['joint-sword-2024a', 'joint-sword-2024b', 'justice-mission-2025'], norm: false, ck: null };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const map = createMap($('map'));
let timer = null;

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (['replay', 'compare'].includes(q.get('v'))) S.view = q.get('v');
  if (byId(q.get('x'))) S.x = q.get('x');
  if (METRICS[q.get('m')]) S.m = q.get('m');
  const k = parseInt(q.get('d'), 10); if (Number.isFinite(k)) S.k = k;
  if (q.get('p')) { const p = q.get('p').split(',').filter(byId); if (p.length) S.picks = p; }
  if (q.has('n')) S.norm = q.get('n') === '1';
}
function writeHash() {
  const q = new URLSearchParams({ v: S.view });
  if (S.view === 'replay') { q.set('x', S.x); q.set('d', S.k); q.set('m', S.m); } else { q.set('p', S.picks.join(',')); q.set('n', +S.norm); }
  history.replaceState(null, '', '#' + q.toString());
}

function renderPicker() {
  document.body.dataset.view = S.view;
  $('view').querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.view));
  $('picker-label').textContent = S.view === 'replay' ? 'Pick an exercise' : 'Pick exercises to overlay (two or more)';
  $('exlist').innerHTML = exListHtml(S.x, S.view === 'compare', S.picks);
  fx.stagger($('exlist'), 'button');
  $('exlist').querySelectorAll('button').forEach(b => b.onclick = () => {
    const id = b.dataset.x;
    if (S.view === 'replay') { stop(); S.x = id; S.k = 0; const x = byId(id); if (coverage(x, S.m).none) S.m = 'air'; }
    else S.picks = S.picks.includes(id) ? S.picks.filter(p => p !== id) : [...S.picks, id].slice(-8);
    render();
  });
}

function renderReplay() {
  const x = byId(S.x), win = windowOf(x);
  const kMin = win[0].k, kMax = win[win.length - 1].k;
  S.k = Math.max(kMin, Math.min(kMax, S.k));
  if (!win.some(d => d.v[S.m] != null)) S.m = 'air';
  const day = win.find(d => d.k === S.k), tl = timelineOf(x.id);
  $('map-title').textContent = `${x.short} · ${dayLab(S.k, day.d)}`;
  fx.chart($('map'), `${x.id}|${day.d}`, () => drawZones(map, x.id, day.d));
  $('zone-src').innerHTML = zoneSrcHtml(x);
  $('chart-title').textContent = `${METRICS[S.m].name} per day, ${x.short}`;
  fx.changed($('chart-title'));
  fx.chart($('days'), `${x.id}|${S.m}`, () => drawDays($('days'), win, { m: S.m, cur: S.k, onScrub: k => { stop(); S.k = k; render(); } }));
  { // narrow screens scroll the chart sideways: keep the current day in view
    const cw = $('days').parentElement;
    if (cw.scrollWidth > cw.clientWidth + 1) {
      const f = (S.k - kMin + 0.5) / (kMax - kMin + 1), px = f * cw.scrollWidth;
      if (px < cw.scrollLeft + 40 || px > cw.scrollLeft + cw.clientWidth - 40) cw.scrollLeft = px - cw.clientWidth / 2;
    }
  }
  const sl = $('day'); sl.min = kMin; sl.max = kMax; sl.value = S.k;
  $('day-out').textContent = dayLab(S.k, day.d);
  $('day-eyebrow').textContent = dayLab(S.k, day.d).split(' · ')[0];
  $('dayread').innerHTML = dayReadHtml(x, day, S.m, tl);
  fx.count($('dayread'), '.big b');
  $('metric').innerHTML = metricHtml(x, S.m, win);
  $('metric').querySelectorAll('button').forEach(b => b.onclick = () => { S.m = b.dataset.m; render(); });
  $('timeline').innerHTML = timelineHtml(tl, day.d);
  fx.stagger($('timeline'), 'li');
  $('timeline').querySelectorAll('[data-date]').forEach(b => b.onclick = () => {
    const w = win.find(d => d.d === b.dataset.date);
    if (w) { stop(); S.k = w.k; render(); }
  });
  $('facts').innerHTML = factsHtml(x);
}

function renderCompare() {
  const xs = S.picks.map(byId).filter(x => x && !coverage(x).none);
  const series = xs.map((x, i) => {
    const pm = priorMean(x);
    const pts = windowOf(x).map(d => ({ k: d.k, v: d.v.air == null ? null : S.norm ? (pm ? d.v.air / pm : null) : d.v.air }));
    return { x, pts, pm, col: COLS[i % COLS.length] };
  });
  const kMax = Math.max(PRE, ...series.map(s => s.pts[s.pts.length - 1].k));
  $('norm').querySelectorAll('[data-n]').forEach(b => b.setAttribute('aria-pressed', b.dataset.n === (S.norm ? '1' : '0')));
  fx.chart($('compare'), `${S.picks.join(',')}|${S.norm}`, () => drawCompare($('compare'), series, { norm: S.norm, cur: S.ck, kMin: -PRE, kMax, onHover: k => { S.ck = k; renderCompare(); } }));
  const fmtv = v => (v == null ? '—' : S.norm ? v.toFixed(1) + '×' : String(v));
  $('ctip').innerHTML = S.ck == null ? series.map(s => `<span class="lg"><i class="swatch" style="background:var(${s.col})"></i>${s.x.short}</span>`).join('') + ' <span class="muted">Hover the chart to compare days.</span>'
    : `<b>${S.ck === 0 ? 'Day 0' : 'Day ' + (S.ck > 0 ? '+' : '−') + Math.abs(S.ck)}</b>: ` + series.map(s => `<span style="color:var(${s.col})">${s.x.short}</span> ${fmtv(s.pts.find(p => p.k === S.ck)?.v)}`).join(' · ');
  $('ctable').innerHTML = series.map(s => {
    const vals = s.pts.map(p => p.v).filter(v => v != null), c = coverage(s.x);
    const peak = vals.length ? Math.max(...vals) : null, pk = s.pts.find(p => p.v === peak);
    return `<tr><td><span class="swatch" style="background:var(${s.col})"></span>${s.x.short}</td><td>${s.x.start === s.x.end ? 1 : Math.round((Date.parse(s.x.end) - Date.parse(s.x.start)) / 864e5) + 1}</td>
      <td class="num">${fmtv(peak)}${pk ? ` (day ${pk.k >= 0 ? '+' : '−'}${Math.abs(pk.k)})` : ''}</td><td class="num">${s.pm ? s.pm.toFixed(1) : '—'}</td>
      <td>${c.partial ? `${c.have} of ${c.total} days` : 'full'}</td></tr>`;
  }).join('') || '<tr><td colspan="5">Pick exercises above.</td></tr>';
  fx.count($('ctable'), 'td.num');
  $('cread').innerHTML = xs.length < 2 ? '<p class="fine warn">Pick at least two exercises with TSM data.</p>' : '';
}

function render() {
  renderPicker();
  if (S.view === 'replay') renderReplay(); else renderCompare();
  writeHash();
}

// ---- playback -----------------------------------------------------------------------
function stop() { clearInterval(timer); timer = null; $('play').textContent = 'Play'; }
function play() {
  if (timer) return stop();
  const win = windowOf(byId(S.x));
  if (S.k >= win[win.length - 1].k) S.k = win[0].k;
  $('play').textContent = 'Pause';
  timer = setInterval(() => {
    if (S.k >= win[win.length - 1].k) { stop(); return; }
    S.k++; render(); $('play').textContent = 'Pause';
  }, reduced ? 1400 : 800);
}

$('play').onclick = play;
$('day').oninput = () => { stop(); S.k = +$('day').value; render(); };
$('view').querySelectorAll('[data-v]').forEach(b => b.onclick = () => { stop(); S.view = b.dataset.v; render(); });
$('norm').querySelectorAll('[data-n]').forEach(b => b.onclick = () => { S.norm = b.dataset.n === '1'; render(); });
$('compare').addEventListener('pointerleave', () => { S.ck = null; renderCompare(); });
$('copy-link').onclick = async () => {
  writeHash();
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy from address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 2000);
};
$('sources').innerHTML = sourcesHtml();
const tour = createTour(document.body, p => { stop(); Object.assign(S, p); render(); });
$('start-tour').onclick = () => tour.start();

// ---- export -------------------------------------------------------------------------
const NOTE = 'Data: TSM PLA Activity Center (Taiwan MND daily reports); zones from official PRC announcements';
addExportBar($('map').closest('.card'), { target: () => $('map'), title: () => $('map-title').textContent, note: NOTE });
addExportBar($('days').closest('.card'), {
  target: () => $('days'), note: NOTE,
  title: () => `${$('chart-title').textContent} (TSM daily data)`,
  csv: () => {
    const x = byId(S.x);
    return [['date', 'day', 'exercise_day', ...Object.values(METRICS).map(M => M.name), 'flag'],
      ...windowOf(x).map(d => [d.d, d.k, d.during ? 1 : 0, ...Object.keys(METRICS).map(m => d.v[m] ?? ''), d.flag])];
  },
});
addExportBar($('compare').closest('.card'), {
  target: () => $('compare'), note: NOTE,
  title: () => `PLA aircraft around ${S.picks.map(byId).filter(Boolean).map(x => x.short).join(', ')}, aligned on day 0${S.norm ? ' (× usual level)' : ''}`,
  csv: () => {
    const xs = S.picks.map(byId).filter(x => x && !coverage(x).none);
    const ks = [...new Set(xs.flatMap(x => windowOf(x).map(d => d.k)))].sort((a, b) => a - b);
    return [['day', ...xs.map(x => `${x.short} aircraft`)],
      ...ks.map(k => [k, ...xs.map(x => windowOf(x).find(d => d.k === k)?.v.air ?? '')])];
  },
});

readHash();
render();
