// Interceptor Burn-down: state, rendering, playback and URL hash.
import { SYSTEMS, INV_PRESETS } from '../data/inventory.js';
import { THREATS, SALVOS, DOCTRINES, NOTIONAL } from '../data/threats.js';
import { SOURCES, SOURCE_ORDER } from '../data/sources.js';
import { simulate, leakersBy, shot } from './model.js';
import { tornado, METRICS } from './sensitivity.js';
import { drawBurn, drawLeak, drawTornado } from './charts.js';
import { mountControls, syncControls, DRONE_POL } from './controls.js';
import { mountLesson } from './lesson.js';
import { addExportBar, tableRows } from '../../../shared/js/export.js';
import { MOTION, tween, press, changed, hit, drawIn, growBars, dryBurst } from './fx.js';

const $ = id => document.getElementById(id);
const HZ = [30, 60, 90];
export const DEFAULT = () => ({
  salvo: { ...SALVOS[0].v }, surge: NOTIONAL.surge, cap: true, inv: { ...INV_PRESETS[0].v }, avail: NOTIONAL.avail,
  pk: { ...NOTIONAL.pk }, doc: { ...NOTIONAL.doc }, dronePol: 'cheap', savePac: true, nk: NOTIONAL.nk,
  prod: 96, us: 0, day: 10, metric: 'dry', horizon: 30,
});
const S = DEFAULT();
let sim = null, playing = false, raf = null, last = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const r0 = v => Math.round(v).toLocaleString();

// ---- Hash --------------------------------------------------------------------------------
function writeHash() {
  const q = new URLSearchParams({
    b: S.salvo.b, c: S.salvo.c, d: S.salvo.d, su: S.surge, cap: +S.cap, av: S.avail, nk: S.nk, dp: S.dronePol, sp: +S.savePac,
    pr: S.prod, us: S.us, t: S.day, m: S.metric, h: S.horizon,
    inv: SYSTEMS.map(s => S.inv[s.k]).join('.'), pk: THREATS.map(t => S.pk[t.k]).join('_'), doc: THREATS.map(t => S.doc[t.k]).join('.'),
  });
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k, lo, hi) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };
  THREATS.forEach(t => { const v = num(t.k, 0, t.max); if (v != null) S.salvo[t.k] = v; });
  [['su', 'surge', 1, 3], ['av', 'avail', 0.3, 1], ['nk', 'nk', 0, 0.9], ['pr', 'prod', 0, 192], ['us', 'us', 0, 40], ['t', 'day', 0, 90]]
    .forEach(([k, f, lo, hi]) => { const v = num(k, lo, hi); if (v != null) S[f] = v; });
  if (HZ.includes(+q.get('h'))) S.horizon = +q.get('h');
  if (q.has('cap')) S.cap = q.get('cap') === '1';
  if (q.has('sp')) S.savePac = q.get('sp') === '1';
  if (DRONE_POL.some(p => p.k === q.get('dp'))) S.dronePol = q.get('dp');
  if (METRICS.some(m => m.k === q.get('m'))) S.metric = q.get('m');
  if (q.has('inv')) q.get('inv').split('.').forEach((v, i) => { const s = SYSTEMS[i], n = parseInt(v, 10); if (s && Number.isFinite(n)) S.inv[s.k] = Math.max(0, Math.min(s.max, n)); });
  if (q.has('pk')) q.get('pk').split('_').forEach((v, i) => { const t = THREATS[i], n = parseFloat(v); if (t && Number.isFinite(n)) S.pk[t.k] = Math.max(0.2, Math.min(0.95, n)); });
  if (q.has('doc')) q.get('doc').split('.').forEach((v, i) => { const t = THREATS[i]; if (t && DOCTRINES.some(d => d.k === v)) S.doc[t.k] = v; });
  S.day = Math.min(S.horizon, Math.round(S.day));
}

// ---- Render ---------------------------------------------------------------------------------
const dryText = v => (v == null ? `lasts ${S.horizon}+ days` : `dry day ${v}`);

function renderMags() {
  if (MOTION) return renderMagsLive();
  const d = sim.days[S.day];
  $('mags').innerHTML = SYSTEMS.filter(s => sim.start[s.k] >= 1 || S.inv[s.k] > 0).map(s => {
    const cap = Math.max(1, sim.start[s.k]), v = d.stock[s.k], f = Math.max(0, Math.min(1, v / cap));
    const st = v < 1 ? 'empty' : f < 0.25 ? 'low' : 'ok';
    return `<li data-state="${st}"><span class="mn">${s.n}</span>
      <span class="mbar" role="meter" aria-label="${s.n} interceptors left" aria-valuemin="0" aria-valuemax="${Math.round(cap)}" aria-valuenow="${Math.round(v)}"><span style="width:${(f * 100).toFixed(1)}%;background:${s.col}"></span></span>
      <span class="mv num">${v < 1 ? 'Empty' : r0(v)}</span><span class="md">${dryText(sim.dry[s.k])}</span></li>`;
  }).join('') || '<li class="none">No interceptors in the magazine. Pick an inventory preset.</li>';
}

// Interactive Deterrence: the same rows, updated in place so the bars slide, the counts tween when the
// scenario changes, and a row that runs dry shakes. Same markup, text and attributes as renderMags().
function renderMagsLive() {
  const d = sim.days[S.day], list = SYSTEMS.filter(s => sim.start[s.k] >= 1 || S.inv[s.k] > 0), ul = $('mags');
  const keys = list.map(s => s.k).join();
  if (!list.length) { ul.dataset.keys = ''; ul.innerHTML = '<li class="none">No interceptors in the magazine. Pick an inventory preset.</li>'; return; }
  if (ul.dataset.keys !== keys) {
    ul.dataset.keys = keys;
    ul.innerHTML = list.map(s => `<li data-k="${s.k}"><span class="mn">${s.n}</span>
      <span class="mbar" role="meter" aria-label="${s.n} interceptors left" aria-valuemin="0"><span style="background:${s.col}"></span></span>
      <span class="mv num"></span><span class="md"></span></li>`).join('');
  }
  list.forEach((s, i) => {
    const li = ul.children[i], cap = Math.max(1, sim.start[s.k]), v = d.stock[s.k], f = Math.max(0, Math.min(1, v / cap));
    const st = v < 1 ? 'empty' : f < 0.25 ? 'low' : 'ok', was = li.dataset.state;
    li.dataset.state = st;
    const bar = li.querySelector('.mbar');
    bar.setAttribute('aria-valuemax', Math.round(cap)); bar.setAttribute('aria-valuenow', Math.round(v));
    bar.firstElementChild.style.width = `${(f * 100).toFixed(1)}%`;
    const mv = li.querySelector('.mv');
    // During play the day ticks every 110 ms, so counts jump with the day; scenario changes tween.
    if (playing) { mv.dataset.v = v; mv.textContent = v < 1 ? 'Empty' : r0(v); }
    else tween(mv, v, x => (x < 1 ? 'Empty' : r0(x)));
    li.querySelector('.md').textContent = dryText(sim.dry[s.k]);
    if (playing && was && was !== 'empty' && st === 'empty') { hit(li); changed(mv); }
  });
}

function renderDay() {
  const d = sim.days[S.day];
  $('day').value = S.day;
  $('day-n').textContent = 'Day ' + S.day;
  const leak = d.leak.b + d.leak.c + d.leak.d, inc = d.inc.b + d.inc.c + d.inc.d;
  $('day-s').textContent = S.day === 0 ? 'starting magazine' : `${r0(inc)} incoming, ${r0(leak)} get through`;
  renderMags();
  const scrub = t => { stop(); S.day = t; renderDay(); writeHash(); };
  drawBurn($('burn'), sim, S.day, scrub);
  drawLeak($('leak'), sim, S.day, scrub);
  if (playing && S.day === sim.bmdDry) { dryBurst($('burn')); hit($('status')); changed($('status')); }
  $('leak-day').innerHTML = S.day === 0 ? 'Drag across the chart to read any day.' :
    THREATS.map(t => `<span><i class="key" style="background:${t.col}"></i>${t.n}: <b class="num">${r0(d.leak[t.k])}</b> of ${r0(d.inc[t.k])} through</span>`).join('');
}

function renderStatus() {
  const st = $('status'), bd = sim.bmdDry;
  st.dataset.s = bd == null ? 'good' : bd > 30 ? 'warn' : 'bad';
  const head = S.salvo.b <= 0 ? 'No ballistic missiles in this salvo'
    : bd == null ? `Ballistic defense lasts past day ${S.horizon}` : `Ballistic defense runs dry on day ${bd}`;
  if (st.querySelector('b').textContent && st.querySelector('b').textContent !== head) changed(st);
  st.querySelector('b').textContent = head;
  const b30 = sim.days.slice(1, 31).reduce((a, x) => a + x.leak.b, 0);
  const sb = shot('b', 'mse', S);
  st.querySelector('span').textContent = (bd ? 'By then every interceptor that can engage a ballistic missile is spent. ' : '') +
    `Against ballistic missiles the doctrine uses about ${sb.e.toFixed(1)} PAC-3 per target. ` +
    `${r0(b30)} ballistic missiles get through in the first 30 days.`;
}

function renderSummary() {
  const rows = SYSTEMS.filter(s => sim.start[s.k] >= 1).map(s => `<dt>${s.n}</dt><dd>${dryText(sim.dry[s.k])}</dd>`).join('');
  const po = sim.prcOut;
  const before = [...$('summary').querySelectorAll('dd')].map(x => x.textContent);
  $('summary').innerHTML = rows +
    `<dt>PRC SRBMs used up</dt><dd>${S.cap ? (po.b ? 'day ' + po.b : 'not within ' + S.horizon + ' days') : 'no limit set'}</dd>
     <dt>PRC GLCMs used up</dt><dd>${S.cap ? (po.c ? 'day ' + po.c : 'not within ' + S.horizon + ' days') : 'no limit set'}</dd>
     <dt>Leakers, days 1-30</dt><dd>${r0(leakersBy(sim, 30))}</dd>
     <dt>Interceptors fired</dt><dd>${r0(sim.cum.fired)} of ${r0(sim.startTotal)} usable${S.prod > 0 || S.us > 0 ? ' at the start, plus resupply' : ''}</dd>`;
  const dds = $('summary').querySelectorAll('dd');
  if (before.length === dds.length) dds.forEach((x, i) => { if (x.textContent !== before[i]) changed(x); });
}

function renderTornado() {
  const tor = tornado(S, S.metric);
  $('metric-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.metric));
  drawTornado($('tornado'), tor, S.metric, S.horizon);
  if (growNext) { growNext = false; growBars($('tornado')); }
  const top = tor.rows[0];
  $('tor-note').textContent = top && top.swing > 0.05
    ? `${top.n} moves the result most: from ${fmtM(top.lo)} to ${fmtM(top.hi)}. Each input is moved on its own, 25% down and up unless labelled, with the rest held fixed.`
    : 'No single input moves this result much in the current scenario.';
}
let growNext = false;
const fmtM = v => (S.metric === 'dry' ? (v > S.horizon ? `past day ${S.horizon}` : `day ${v.toFixed(1)}`) : `${r0(v)} leakers`);

function update() {
  sim = simulate(S);
  if (S.day > S.horizon) S.day = S.horizon;
  $('day').max = S.horizon;
  $('hz-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.h === S.horizon));
  syncControls(S);
  renderStatus();
  renderSummary();
  renderDay();
  renderTornado();
  if (!playing) writeHash();
}

// ---- Playback ----------------------------------------------------------------------------
function play() {
  if (reduced) { S.day = Math.min(S.horizon, sim.bmdDry || S.horizon); renderDay(); writeHash(); return; }
  if (S.day >= S.horizon) S.day = 0;
  playing = true; last = null; $('play').textContent = 'Pause';
  raf = requestAnimationFrame(step);
}
function step(ts) {
  if (!playing) return;
  if (last != null) {
    const next = Math.min(S.horizon, S.day + Math.max(0, Math.floor((ts - last) / 110)));
    if (next !== S.day) { S.day = next; last = ts; renderDay(); }
  } else last = ts;
  if (S.day >= S.horizon) stop(); else raf = requestAnimationFrame(step);
}
function stop() { if (!playing) return; playing = false; cancelAnimationFrame(raf); $('play').textContent = 'Play'; writeHash(); }

// ---- Tables below --------------------------------------------------------------------------
function tables() {
  const tag = { order: 'order figure', estimate: 'analyst estimate', planned: 'planned' };
  $('invtable').innerHTML = SYSTEMS.map(s => `<tr><td>${s.long}</td><td class="num">${INV_PRESETS[0].v[s.k]}</td><td>${s.basis} <span class="pill">${tag[s.tag]}</span></td><td>${s.src === 'onn4' ? 'ONN Part 4' : s.src === 'onn2' ? 'ONN Part 2; CRS' : s.src === 'defpost' ? 'Defense Post / Liberty Times' : s.src === 'dsca' ? 'DSCA; TSM backlog' : 'Taipei Times'}</td></tr>`).join('');
  $('srclist').innerHTML = SOURCE_ORDER.map(k => `<li>${SOURCES[k]}</li>`).join('');
}

// ---- Boot -------------------------------------------------------------------------------------
readHash();
mountControls(S, update);
tables();
$('legend-burn').innerHTML = SYSTEMS.map(s => `<li><i class="sw" style="background:${s.col}"></i>${s.n}</li>`).join('');
$('legend-leak').innerHTML = THREATS.map(t => `<li><i class="sw" style="background:${t.col}"></i>${t.n} through</li>`).join('') + '<li><i class="sw incsw"></i>All incoming</li>';
$('metric-choices').innerHTML = METRICS.map(m => `<button type="button" class="btn" data-k="${m.k}">${m.n}</button>`).join('');
$('metric-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.metric = b.dataset.k; growNext = true; renderTornado(); writeHash(); });
$('hz-choices').innerHTML = HZ.map(h => `<button type="button" class="btn" data-h="${h}">${h} days</button>`).join('');
$('hz-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.horizon = +b.dataset.h; update(); });
$('day').oninput = e => { stop(); S.day = +e.target.value; renderDay(); writeHash(); };
$('play').onclick = () => { press($('play')); playing ? stop() : play(); };
mountLesson($('stage'), { S, reset: () => { stop(); Object.assign(S, DEFAULT(), { day: 0 }); update(); } });
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; }
  catch { $('copy').textContent = 'Copy failed'; }
  setTimeout(() => { $('copy').textContent = 'Copy link'; }, 1600);
};
$('reset').onclick = () => { stop(); Object.assign(S, DEFAULT()); update(); };
document.addEventListener('keydown', e => {
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); playing ? stop() : play(); }
});
update();
drawIn([$('burn'), $('leak')]);
if (MOTION && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); growBars($('tornado')); } }, { threshold: .3 });
  io.observe($('tornado'));
}
let rz = null;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderDay(); renderTornado(); }, 120); });
const NOTE = 'Notional model (TSM Interceptor Burn-down). Inventories: open-source estimates; kill chances and drone rates notional.';
addExportBar($('burn'), { target: () => $('burn'), title: () => 'Taiwan interceptors left by day (notional model)', note: NOTE, where: 'after',
  csv: () => [['day', ...SYSTEMS.map(s => s.n), 'ballistic in', 'cruise in', 'drones in', 'ballistic through', 'cruise through', 'drones through'],
    ...sim.days.map(d => [d.t, ...SYSTEMS.map(s => d.stock[s.k].toFixed(1)), ...THREATS.map(t => d.inc[t.k].toFixed(1)), ...THREATS.map(t => d.leak[t.k].toFixed(1))])] });
addExportBar($('tornado'), { target: () => $('tornado'), title: () => 'What moves the result most (notional model)', note: NOTE, where: 'after' });
addExportBar($('invtable').closest('.tablewrap'), { csv: () => tableRows($('invtbl')), csvLabel: 'Copy table as CSV', where: 'after' });
