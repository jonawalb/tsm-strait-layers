// Strait Landing: state, URL hash, flow from plan to turns to review.
import { ZONES, ZONE_KEYS, PROB_DEF, TURNS, LIFT } from '../data/params.js';
import { createGame, step, seaAt, defAt, busiest } from './model.js';
import { drawStart } from './weather.js';
import { plaDoctrine, rocDoctrine } from './policy.js';
import { createMap } from './map.js';
import { drawRace, turnLabel } from './chart.js';
import { setupHTML, ordersHTML, defaultOrders } from './panel.js';
import { renderAAR, runBatch, aiSetup, OUT } from './aar.js';
import { renderInfo } from './info.js';
import { mountLesson } from './lesson.js';
import { randomSeed } from './rng.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = v => Math.round(v * 10) / 10;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- state and hash ----------
const MINE_UNIT = 0.35;
const S = {
  role: 'pla', seed: randomSeed(), P: { ...PROB_DEF }, phase: 'setup',
  setup: { month: 3, wait: 0, zones: ['central', null], us: true, prep: 'hunt',
    roc: { mines: { north: 0.7, central: 0.35, south: 0 }, demo: 0.5, forward: 0.5 } },
};
let G = null, orders = null, rec = [], chartZone = 'main';

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.get('side') === 'roc') S.role = 'roc';
  const sd = parseInt(q.get('seed'), 10); if (sd >= 1 && sd <= 999999) S.seed = sd;
  const m = parseInt(q.get('m'), 10); if (m >= 0 && m <= 11) S.setup.month = m;
  const w = q.get('w'); if (w === 'calm') S.setup.wait = 'calm'; else if (/^[0-3]$/.test(w || '')) S.setup.wait = +w;
  const z = (q.get('z') || '').split(',');
  if (ZONES[z[0]]) S.setup.zones = [z[0], ZONES[z[1]] && z[1] !== z[0] ? z[1] : null];
  if (q.has('us')) S.setup.us = q.get('us') === '1';
  if (['hunt', 'sweep', 'cut', 'even'].includes(q.get('p'))) S.setup.prep = q.get('p');
  const mi = q.get('mines');
  if (/^[0-3]{3}$/.test(mi || '')) ZONE_KEYS.forEach((k, i) => { S.setup.roc.mines[k] = +mi[i] * MINE_UNIT; });
  const f = parseFloat(q.get('f')); if (f >= 0 && f <= 1) S.setup.roc.forward = Math.round(f * 10) / 10;
  if (q.has('demo')) S.setup.roc.demo = q.get('demo') === '1' ? 0.85 : 0.5;
}
function writeHash() {
  const s = S.setup;
  const parts = [`side=${S.role}`, `seed=${S.seed}`, `m=${s.month}`];
  if (S.role === 'pla') parts.push(`w=${s.wait}`, `z=${s.zones.filter(Boolean).join(',')}`, `p=${s.prep}`);
  else parts.push(`mines=${ZONE_KEYS.map(k => Math.round(s.roc.mines[k] / MINE_UNIT)).join('')}`, `f=${s.roc.forward}`, `demo=${s.roc.demo > 0.6 ? 1 : 0}`);
  parts.push(`us=${s.us ? 1 : 0}`);
  history.replaceState(null, '', '#' + parts.join('&'));
}

// ---------- rendering ----------
const map = createMap($('map'), $('tip'), { onZone: z => pickZone(z) });

function pickZone(z) {
  if (S.phase !== 'setup' || S.role !== 'pla') return;
  const zs = S.setup.zones;
  if (zs[0] === z) return;
  if (zs[1] === z) S.setup.zones = [z, zs[0]];
  else S.setup.zones = [z, zs[1] === z ? null : zs[1]];
  render();
}

function startDay() { return drawStart(S.seed, S.setup.month); }

function render() {
  writeHash();
  document.body.dataset.phase = S.phase;
  document.body.dataset.role = S.role;
  const panel = $('panel');
  if (S.phase === 'setup') {
    panel.innerHTML = setupHTML(S, startDay());
    // Seas on the first day of the forecast, before any waiting.
    const probe = { dday: startDay() };
    const sea = Object.fromEntries(ZONE_KEYS.map(z => [z, seaAt(probe, 1, z)]));
    map.draw({ zones: S.role === 'pla' ? S.setup.zones : [], G: null, sea, def: {} });
    drawRace($('race'), { hist: [emptySnap()], zone: 'all', seas: [] });
    $('race-note').textContent = S.role === 'pla'
      ? 'The race you will run: red is your strength ashore, the pale band is troops still afloat, teal is Taiwan\'s strength at your beaches.'
      : 'The race you will run: red is the PLA\'s strength ashore, the pale band is troops still afloat, teal is your strength at its beaches.';
    $('turn-t').textContent = 'Plan';
    $('log').innerHTML = `<p class="sl-prompt"><b>First move:</b> ${S.role === 'pla'
      ? 'pick a month and a main landing zone (click the map), check the three-day forecast, then press <i>Launch the landing</i>.'
      : 'place your three loads of mines, set your posture, then press <i>Take command</i>. The PLA\'s landing zone stays hidden until H-hour.'}</p>`;
    $('status-t').textContent = S.role === 'pla' ? 'You plan the PLA landing' : 'You command Taiwan\'s defense';
    $('status-s').textContent = 'Eight 12-hour turns, D-day to D+3.';
    $('status').dataset.s = '';
    return;
  }
  const t = G.t;
  const zones = G.setup.zones.filter(Boolean);
  const hidden = S.role === 'roc' && t === 0;
  const seaNow = Object.fromEntries(ZONE_KEYS.map(z => [z, seaAt(G, Math.max(1, Math.min(TURNS, t + (G.over ? 0 : 1))), z)]));
  const def = Object.fromEntries(ZONE_KEYS.map(z => [z, defAt(G, z)]));
  map.draw({ zones: hidden ? [] : zones, G, sea: seaNow, def });
  const zc = chartZone === 'all' ? 'all' : (S.role === 'pla' ? zones[0] : (t ? busiest(G) : 'all'));
  const seas = Array.from({ length: TURNS }, (_, i) => (i < t + (G.over ? 0 : 1) ? seaAt(G, i + 1, zc === 'all' ? zones[0] : zc) : null));
  drawRace($('race'), { hist: G.hist, zone: zc, seas });
  $('race-note').textContent = zc === 'all' ? 'All zones: PLA strength ashore in total, and Taiwan\'s strength at its largest lodgment.'
    : `${ZONES[zc].t} (${ZONES[zc].area}). Red: PLA ashore. Pale band: afloat offshore. Teal: Taiwan at these beaches.`;
  $('turn-t').textContent = G.over ? 'After D+3' : `Turn ${t + 1} of ${TURNS}: ${turnLabel(t + 1)}`;
  renderStatus();
  if (G.over) {
    const R = G.result, o = OUT[R.outcome];
    $('panel').innerHTML = `<div class="sec"><div class="status" data-s="${o.s}"><b>${o.t}</b><span>${esc($('aar-sub')?.textContent || '')}</span></div>
      <button type="button" class="btn solid" id="to-aar">See the after-action review</button>
      <button type="button" class="btn" id="again">Play this week again</button>
      <button type="button" class="btn" id="replan">Change the plan</button></div>`;
  } else {
    panel.innerHTML = ordersHTML(S, G, orders);
  }
}

function renderStatus() {
  const s = G.stats, zones = G.setup.zones.filter(Boolean);
  const ashore = ZONE_KEYS.reduce((a, z) => a + G.ashore[z], 0);
  const afloat = ZONE_KEYS.reduce((a, z) => a + G.queue[z].amph * LIFT.amph.size + G.queue[z].ferry * LIFT.ferry.size, 0);
  const hot = S.role === 'pla' ? zones[0] : busiest(G);
  const D = defAt(G, hot), A = G.ashore[hot];
  const ratio = A / Math.max(0.1, D);
  $('status').dataset.s = G.t === 0 ? '' : S.role === 'pla' ? (ratio >= 1.5 ? 'good' : ratio >= 0.7 ? 'warn' : 'bad') : (ratio >= 1.5 ? 'bad' : ratio >= 0.7 ? 'warn' : 'good');
  $('status-t').textContent = G.t === 0 ? 'H-hour' : `PLA ${r1(A)} vs Taiwan ${r1(D)} at the ${ZONES[hot].area}`;
  $('status-s').textContent = `PLA ${r1(ashore)} ashore, ${r1(afloat)} afloat · ${s.lostAmph + s.lostFerry} ship groups lost · Taiwan ${G.launchers.filter(L => L.alive).length} missile batteries left`;
}

function emptySnap() {
  const z0 = Object.fromEntries(ZONE_KEYS.map(z => [z, 0]));
  return { ashore: z0, afloat: z0, def: z0 };
}

const TONE = { pla: 'PLA gains', roc: 'Taiwan gains', '': '' };
function logTurn(label, rows, open = true) {
  const html = `<details class="sl-turn" ${open ? 'open' : ''}><summary>${esc(label)}</summary><ul>${rows.map(r =>
    `<li data-tone="${r.tone || ''}"><span class="ph">${esc(r.ph)}</span><span class="ev">${esc(r.ev)}</span><span class="res">${esc(r.res)}</span>${r.tone ? `<span class="sr">${TONE[r.tone]}</span>` : ''}</li>`).join('')}</ul></details>`;
  $('log').querySelectorAll('details[open]').forEach(d => { d.open = false; });
  $('log').insertAdjacentHTML('afterbegin', html);
}

// ---------- flow ----------
function launch() {
  const setup = S.role === 'pla' ? { ...S.setup, roc: undefined } : aiSetup(S);
  if (S.role === 'pla') setup.roc = { mines: { north: 0.6, central: 0.4, south: 0.2 }, demo: 0.5, forward: 0.5 };
  G = createGame(setup, S.seed, S.P);
  S.phase = 'play'; rec = [];
  orders = defaultOrders(S, G);
  $('log').innerHTML = '';
  $('aar').hidden = true;
  const pre = G.prepLog.length ? G.prepLog : [{ ph: 'D-day', ev: 'No waiting: the fleet sails at once', res: 'strikes start with the landing', tone: '' }];
  logTurn(S.role === 'pla' ? `Before H-hour: D-day is ${dday()}` : `Before H-hour: the PLA has picked its beaches (hidden). D-day is ${dday()}`, pre);
  render();
  fx.launch();
  $('panel').querySelector('#resolve')?.focus({ preventScroll: true });
}
const dday = () => { const d = new Date(Date.UTC(1996, 0, 1) + G.dday * 864e5); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };

function resolve() {
  if (!G || G.over) return;
  const t = G.t + 1;
  let pla, roc;
  if (S.role === 'pla') {
    const zones = G.setup.zones.filter(Boolean);
    const split = (n, z) => (zones.length === 1 ? n : z === zones[0] ? Math.round(n * orders.share) : n - Math.round(n * orders.share));
    pla = { send: Object.fromEntries(zones.map(z => [z, { amph: split(orders.amph, z), ferry: split(orders.ferry, z) }])), strike: orders.strike, port: { ...orders.port } };
    rec[t] = { amph: G.ready.amph ? orders.amph / G.ready.amph : 1, ferry: G.ready.ferry ? orders.ferry / G.ready.ferry : 0, mainShare: orders.share, strike: orders.strike, port: !!orders.port[zones[0]], ferryRule: 'always' };
    roc = rocDoctrine(G);
  } else {
    pla = plaDoctrine(G);
    roc = { fire: orders.fire, moves: { ...orders.moves }, ca: { ...orders.ca }, mobTo: orders.mobTo || busiest(G) };
    rec[t] = roc;
  }
  const pre = fx.snap(G);
  const rows = step(G, pla, roc);
  logTurn(`Turn ${t}: ${turnLabel(t)}`, rows);
  if (G.over) finish();
  else { const keep = S.role === 'pla' ? { strike: orders.strike, share: orders.share, port: orders.port } : { fire: orders.fire, mobTo: orders.mobTo }; orders = { ...defaultOrders(S, G), ...keep }; }
  render();
  fx.turn({ pre, G, rows, geom: map.geom, svg: $('map') });
  if (!G.over) $('panel').querySelector('#resolve')?.focus({ preventScroll: true });
}

function finish() {
  S.phase = 'over';
  renderAAR(S, G, rec);
  $('aar').hidden = false;
  fx.aar();
  $('mc-out').innerHTML = '<p class="fine">Running 1,000 weeks…</p>';
  runBatch(S, rec, html => { $('mc-out').innerHTML = html; fx.mc($('mc-out')); });
}

function reset(keepSeed = true) {
  if (!keepSeed) S.seed = randomSeed();
  S.phase = 'setup'; G = null; $('aar').hidden = true;
  render();
}

// ---------- events ----------
$('panel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset, s = S.setup;
  if (d.role) { S.role = d.role; render(); }
  else if (d.month != null) { s.month = +d.month; render(); }
  else if (d.zone0) pickZone(d.zone0);
  else if (d.zone1 != null) { s.zones = [s.zones[0], d.zone1 && d.zone1 !== s.zones[0] ? d.zone1 : null]; render(); }
  else if (d.wait != null) { s.wait = d.wait === 'calm' ? 'calm' : +d.wait; render(); }
  else if (d.prep) { s.prep = d.prep; render(); }
  else if (d.mine) {
    const units = ZONE_KEYS.reduce((a, z) => a + Math.round(s.roc.mines[z] / MINE_UNIT), 0);
    const cur = Math.round(s.roc.mines[d.mine] / MINE_UNIT), nx = cur + (+d.d);
    if (nx >= 0 && nx <= 3 && (d.d < 0 || units < 3)) { s.roc.mines[d.mine] = nx * MINE_UNIT; render(); }
  }
  else if (b.id === 'launch') launch();
  else if (b.id === 'reseed') reset(false);
  else if (d.strike) { orders.strike = d.strike; render(); }
  else if (d.fire != null) { orders.fire = +d.fire; render(); }
  else if (b.id === 'resolve') resolve();
  else if (b.id === 'to-aar') { $('aar').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' }); $('aar-h').focus({ preventScroll: true }); }
  else if (b.id === 'again') reset(true);
  else if (b.id === 'replan') reset(true);
});
$('panel').addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'o-amph') { orders.amph = +el.value; $('o-amph-v').textContent = el.value; }
  else if (el.id === 'o-ferry') { orders.ferry = +el.value; $('o-ferry-v').textContent = el.value; }
  else if (el.id === 'o-share') { orders.share = +el.value; $('o-share-v').textContent = `${Math.round(el.value * 100)}%`; }
  else if (el.id === 'forward') { S.setup.roc.forward = +el.value; el.closest('.slider').querySelector('output').textContent = `${Math.round(el.value * 100)}%`; writeHash(); }
});
$('panel').addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'us') { S.setup.us = el.checked; writeHash(); }
  else if (el.id === 'demo') { S.setup.roc.demo = el.checked ? 0.85 : 0.5; writeHash(); }
  else if (el.dataset.port) orders.port[el.dataset.port] = el.checked;
  else if (el.dataset.ca) orders.ca[el.dataset.ca] = el.checked;
  else if (el.dataset.move != null) orders.moves[+el.dataset.move] = el.value;
  else if (el.id === 'mobto') orders.mobTo = el.value;
});
document.addEventListener('keydown', e => {
  if ((e.key === 'n' || e.key === 'N') && S.phase === 'play' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.('select, textarea, input[type="number"], [role="dialog"]')) { e.preventDefault(); resolve(); }
});
document.querySelectorAll('[data-chart]').forEach(b => b.addEventListener('click', () => {
  chartZone = b.dataset.chart;
  document.querySelectorAll('[data-chart]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  if (G) render();
}));
$('aar-again').onclick = () => { reset(true); $('box').scrollIntoView({ block: 'start' }); };
$('aar-new').onclick = () => { reset(false); $('box').scrollIntoView({ block: 'start' }); };
async function copy(text, btn) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { prompt('Copy this link:', text); }
  setTimeout(() => { btn.textContent = old; }, 1500);
}
$('copy-link').onclick = e => copy(location.href, e.currentTarget);
const lesson = mountLesson($('learn-slot'), { S, game: () => G, reset });
$('show-rules').onclick = () => lesson.sheet();

readHash();
renderInfo(S.P);
render();
matchMedia('(max-width: 640px)').addEventListener('change', () => render());

// Test hooks for the headless checks.
window.__sl = { S, get G() { return G; }, resolve, launch, reset };
