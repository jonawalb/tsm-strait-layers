// Mine Warfare Simulator: state, wiring, animation and shareable hash.
import { GRID, ASSETS, ASSAULT, MINES } from '../data/params.js';
import { HISTORY, READING } from '../data/history.js';
import { N, idx, rowOf, colOf, rand, budget, used, evaluate, baseline, residual, applyPreset, PRESETS, encodeMines, decodeMines } from './model.js';
import { createGrid } from './grid.js';
import { panelHtml, resultsHtml, statusOf, readoutHtml, compareHtml } from './panel.js';
import { mountLesson } from './lesson.js';
import { addExportBar } from '../../../shared/js/export.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const S = {
  mines: new Uint8Array(N), preset: 'barrier', tool: 1, ships: 4, sorties: 2,
  assets: Object.fromEntries(ASSETS.map(a => [a.k, a.def])), hours: 48, strat: 'lanes', lanes: 2, fires: false,
};
let V = { hour: S.hours, p: 1 }; // view: clearance hour shown, assault progress (null = none)
let ev, other, base, anim = null;

readHash();
if (!location.hash) S.mines = applyPreset(S.preset, S);

$('panel').innerHTML = panelHtml();
$('results').innerHTML = resultsHtml();
const grid = createGrid($('grid'), { onPaint: paint, onHover: hover });

// ---- Controls ----------------------------------------------------------------------
function bindSlider(id, get, set, f = v => v) {
  const i = $(id);
  const out = () => { $(id + '-out').textContent = f(get()); };
  i.value = get(); out();
  i.oninput = () => { set(+i.value); out(); update(); };
  return () => { i.value = get(); out(); };
}
const syncs = [
  bindSlider('sorties', () => S.sorties, v => { S.sorties = v; refit(); }),
  bindSlider('hours', () => S.hours, v => { S.hours = v; }, v => `${v} h${v >= 24 ? ` · ${Math.round(v / 24 * 10) / 10} d` : ''}`),
  bindSlider('lanes', () => S.lanes, v => { S.lanes = v; }),
  ...ASSETS.map(a => bindSlider('as-' + a.k, () => S.assets[a.k], v => { S.assets[a.k] = v; })),
];
const choice = (id, get, set) => {
  $(id).querySelectorAll('button').forEach(b => b.onclick = () => { set(b.dataset.v ?? b.dataset.k); update(); });
  return () => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v ?? b.dataset.k) === String(get())));
};
syncs.push(
  choice('tool', () => S.tool, v => { S.tool = +v; }),
  choice('ships', () => S.ships, v => { S.ships = +v; refit(); }),
  choice('strat', () => S.strat, v => { S.strat = v; }),
  choice('presets', () => S.preset, v => { S.preset = v; S.mines = applyPreset(v, S); }),
);
$('fires').onchange = e => { S.fires = e.target.checked; update(); };
syncs.push(() => { $('fires').checked = S.fires; $('lanes-wrap').hidden = S.strat !== 'lanes'; });
$('clear-field').onclick = () => { S.mines = new Uint8Array(N); S.preset = null; update(); };
$('run').onclick = run;
$('hour').oninput = e => { stop(); V = { hour: +e.target.value, p: null }; draw(); };
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};

/** Keep the field inside the laying budget when ships or sorties change. */
function refit() {
  if (S.preset) { S.mines = applyPreset(S.preset, S); return; }
  let over = used(S.mines) - budget(S);
  for (let i = N - 1; i >= 0 && over > 0; i--) if (S.mines[i]) { S.mines[i] = 0; over--; }
}

function paint(i, mode) {
  if (mode == null) mode = S.tool && S.mines[i] === S.tool ? 0 : S.tool;
  if (S.mines[i] === mode) return mode;
  if (mode && !S.mines[i] && used(S.mines) >= budget(S)) { flashBudget(); return mode; }
  S.mines[i] = mode; S.preset = null; update();
  return mode;
}
function flashBudget() {
  const b = $('budget-t'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
}

// ---- Tooltip -------------------------------------------------------------------------
function hover(i, e) {
  const tip = $('tip');
  if (i == null) { tip.hidden = true; return; }
  const r = rowOf(i), m = S.mines[i], km = ((GRID.rows - r - 0.5) * GRID.cellM / 1000).toFixed(1);
  const k = ev.sim.order.indexOf(i), hit = k >= 0 ? ev.sim.E.findIndex(x => x >= k + 1) : -1;
  const when = k < 0 ? 'Outside the PLA search plan' : hit < 0 ? 'Not reached before the search stalls' : `Searched at hour ${hit}${hit > S.hours ? ' (after the time available)' : ''}`;
  const threat = m ? (ev.swept[i] ? `${Math.round(ev.res[i] * 100)}% chance the group was missed` : 'Intact') : 'No mines';
  tip.innerHTML = `<b>${m ? MINES[m].t + ' group' : 'Open water'}</b><br>${km} km from the beach<br>${when}<br>${threat}`;
  const box = $('box').getBoundingClientRect(), cr = $('grid').getBoundingClientRect();
  const x = e ? e.clientX - box.left : (colOf(i) + 1) / GRID.cols * cr.width, y = e ? e.clientY - box.top : (r + 1) / GRID.rows * cr.height;
  tip.hidden = false;
  tip.style.left = Math.min(x + 14, box.width - tip.offsetWidth - 6) + 'px';
  tip.style.top = Math.min(y + 14, box.height - tip.offsetHeight - 6) + 'px';
}

// ---- Compute and draw ------------------------------------------------------------------
function update() {
  stop();
  syncs.forEach(f => f());
  ev = evaluate(S, S.strat);
  other = evaluate(S, S.strat === 'lanes' ? 'area' : 'lanes');
  base = baseline(S);
  const groups = used(S.mines), b = budget(S);
  $('budget-bar').style.width = Math.min(100, groups / b * 100) + '%';
  $('budget-t').innerHTML = `${groups} of ${b} groups laid · ${S.ships} ships × ${S.sorties} sortie${S.sorties > 1 ? 's' : ''} × 48 mines <span class="notional">notional</span>`;
  const st = statusOf(S, ev, base, groups);
  $('status').dataset.s = st.s; $('status').innerHTML = `<b>${st.b}</b><span>${st.t}</span>`;
  $('status-mini').dataset.s = st.s; $('status-mini').innerHTML = `<b>${st.b}</b><span>${st.t}</span>`;
  $('status-note').textContent = 'Readouts are expected values. The animation shows one random draw of the same odds.';
  $('res-h').textContent = `Result at hour ${S.hours}`;
  $('readout').innerHTML = readoutHtml(S, ev, base, groups);
  const [L, A] = S.strat === 'lanes' ? [ev, other] : [other, ev];
  $('compare').innerHTML = compareHtml(S, L, A);
  $('hour').max = S.hours;
  V = { hour: S.hours, p: 1 };
  draw();
  writeHash();
}

function draw() {
  const { res, swept, n } = V.hour === S.hours ? ev : residual(S, ev.sim, V.hour);
  grid.drawField(S, ev, swept, res, V.hour);
  grid.drawMcm(ev.sim.order, n, S);
  grid.drawCraft(V.p == null ? [] : craftAt(V.p));
  $('hour').value = V.hour;
  const phase = V.p == null ? '' : V.p >= 1 ? ' · assault landed' : ' · assault under way';
  $('hour-t').textContent = `Hour ${Math.round(V.hour)} of ${S.hours} · ${n} of ${ev.sim.order.length} cells searched${phase}`;
}

/** Landing craft positions at assault progress p (0..1), using one seeded draw of the odds. */
function craftAt(p) {
  const cols = ev.now.cols, waves = Math.ceil(ASSAULT.craft / cols.length), out = [];
  for (let k = 0; k < ASSAULT.craft; k++) {
    const c = cols[k % cols.length], w = Math.floor(k / cols.length);
    let hitRow = null;
    for (let r = 0; r < GRID.rows && hitRow == null; r++) {
      const i = idx(c, r), m = S.mines[i];
      if (m && rand(k * 977 + r * 31 + 11) < MINES[m].hit * ev.res[i]) hitRow = r;
    }
    const start = w / waves * 0.45, t = Math.max(0, Math.min(1, (p - start) / 0.5));
    const end = GRID.rows + 0.15 + (w % 3) * 0.3;
    let y = -0.75 + t * (end + 0.75);
    const hit = hitRow != null && y >= hitRow;
    if (hit) y = hitRow;
    if (t <= 0 && w > 2) continue; // later waves wait off-screen in the transport area
    const dx = S.strat === 'lanes' ? (Math.floor(w / 3) % 3 - 1) * 7 : 0;
    out.push({ c, y, hit, dx: t <= 0 ? (w % 3 - 1) * 12 : dx });
  }
  return out;
}

// ---- Animation -------------------------------------------------------------------------
function stop() { if (anim) cancelAnimationFrame(anim); anim = null; $('run').textContent = 'Run clearance and assault'; }
function run() {
  if (anim) { stop(); return; }
  if (reduced.matches) { V = { hour: S.hours, p: 1 }; draw(); return; }
  $('run').textContent = 'Stop';
  const tClear = S.hours ? 3600 : 0, tAssault = 4800;
  let t0 = null;
  const step = ts => {
    if (t0 == null) t0 = ts;
    const e = ts - t0;
    V = e < tClear ? { hour: Math.round(e / tClear * S.hours), p: null } : { hour: S.hours, p: Math.min(1, (e - tClear) / tAssault) };
    draw();
    if (e < tClear + tAssault) anim = requestAnimationFrame(step); else stop();
  };
  anim = requestAnimationFrame(step);
}

// ---- Lesson and hash ----------------------------------------------------------------------
function applyPatch(p) {
  Object.assign(S, { ships: p.ships, sorties: p.sorties, hours: p.hours, strat: p.strat, fires: p.fires, lanes: p.lanes || S.lanes, assets: { ...p.assets }, preset: p.preset });
  S.mines = applyPreset(p.preset, S);
  update();
}

function writeHash() {
  const q = new URLSearchParams({ m: encodeMines(S.mines), sh: S.ships, so: S.sorties, t: S.hours, st: S.strat, ln: S.lanes, f: S.fires ? 1 : 0 });
  ASSETS.forEach(a => q.set(a.k, S.assets[a.k]));
  if (S.preset) q.set('p', S.preset);
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  if (!location.hash) return;
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k, lo, hi) => { const v = parseInt(q.get(k), 10); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };
  if ([4, 10].includes(num('sh', 0, 99))) S.ships = num('sh', 0, 99);
  if (num('so', 1, 3) != null) S.sorties = num('so', 1, 3);
  if (num('t', 0, 168) != null) S.hours = Math.round(num('t', 0, 168) / 6) * 6;
  if (['lanes', 'area'].includes(q.get('st'))) S.strat = q.get('st');
  if (num('ln', 1, 4) != null) S.lanes = num('ln', 1, 4);
  S.fires = q.get('f') === '1';
  ASSETS.forEach(a => { const v = num(a.k, 0, a.max); if (v != null) S.assets[a.k] = v; });
  const m = decodeMines(q.get('m') || '');
  S.preset = PRESETS.some(p => p.k === q.get('p')) ? q.get('p') : null;
  if (m) S.mines = m; else S.mines = applyPreset(S.preset || 'barrier', S);
}

// ---- Below-the-fold content ----------------------------------------------------------
$('history').innerHTML = HISTORY.map(h => `<li><p class="h-when">${h.when}</p><h3>${h.title}</h3><p>${h.text}</p>
  <p class="fine"><a href="${h.url}" target="_blank" rel="noopener">${h.src}</a></p></li>`).join('');
$('reading').innerHTML += READING.map(r => `<li><a href="${r.url}" target="_blank" rel="noopener">${r.t}</a>.</li>`).join('');
reduced.addEventListener?.('change', stop);

update();
mountLesson($('mw-learn'), { S, reset: () => {
  stop(); S.tool = 1;
  applyPatch({ preset: 'barrier', ships: 4, sorties: 2, assets: { v: 6, h: 4, u: 4 }, hours: 48, strat: 'area', lanes: 2, fires: false });
} });
addExportBar(document.querySelector('.runbar'), {
  target: () => $('grid'),
  title: () => `Mine warfare: ${$('status').querySelector('b')?.textContent || 'minefield'}`,
  note: 'Notional model (TSM Mine Warfare Simulator), generic beach, not a real location',
});
