// Penghu Gambit: state, controls, turn stepping, Monte Carlo and the below-the-fold content.
import { MENU, TOGGLES, BUDGET, PROB, PROB_DEF, BLOCKADE_DAYS, TURN_HOURS } from '../data/params.js';
import { SOURCES, HISTORY } from '../data/sources.js';
import { playGame } from './model.js';
import { monteCarlo, drivers, RUNS } from './montecarlo.js';
import { panelHtml, assumptionsHtml, spent, NOTIONAL } from './panel.js';
import { createMap } from './map.js';
import { turnLogHtml, crtHtml, readoutHtml, mcHtml, outcomeText } from './views.js';
import { writeHash, readHash } from './hash.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const defaults = () => ({
  roc: { ...Object.fromEntries(MENU.map(m => [m.k, m.def])), mines: { N: false, E: true, W: false }, ...Object.fromEntries(TOGGLES.map(t => [t.k, t.def])) },
  pla: { plan: 'assault', strikes: 1, sector: 'E', lift: 4, vertical: 'heli', offload: false },
  turns: 8,
});
let { cfg, P, seed, view } = readHash(defaults(), { ...PROB_DEF }, 1683);
let game, anim = null, mcTimer = null;

$('panel').innerHTML = panelHtml();
const map = createMap($('map'), $('tip'), { onSector: k => { cfg.pla.sector = k; changed(); } });
const tour = createTour($('box'), s => {
  cfg = { roc: { ...s.roc, mines: { ...s.roc.mines } }, pla: { ...s.pla }, turns: s.turns };
  changed(s.view);
});

// ---- Controls --------------------------------------------------------------------------
const syncs = [];
function bindSlider(id, get, set, f = v => v) {
  const i = $(id);
  const out = () => { $(id + '-out').textContent = f(get()); };
  i.oninput = () => { set(+i.value); changed(); };
  syncs.push(() => { i.value = get(); out(); });
}
const choice = (id, get, set) => {
  $(id).querySelectorAll('button').forEach(b => b.onclick = () => { set(b.dataset.k); changed(); });
  syncs.push(() => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(get(b.dataset.k)))));
};

for (const m of MENU) {
  const row = document.querySelector(`.stepper[data-k="${m.k}"]`);
  row.querySelectorAll('button').forEach(b => b.onclick = () => {
    const d = +b.dataset.d, next = cfg.roc[m.k] + d;
    if (next < 0 || next > m.max) return;
    if (d > 0 && spent(cfg.roc) + m.cost > BUDGET) { flashBudget(); return; }
    cfg.roc[m.k] = next; changed();
  });
  syncs.push(() => {
    $('n-' + m.k).textContent = cfg.roc[m.k];
    row.querySelector('[data-d="-1"]').disabled = cfg.roc[m.k] <= 0;
    row.querySelector('[data-d="1"]').disabled = cfg.roc[m.k] >= m.max;
  });
}
choice('mines', k => cfg.roc.mines[k], k => {
  if (!cfg.roc.mines[k] && spent(cfg.roc) + 8 > BUDGET) { flashBudget(); return; }
  cfg.roc.mines[k] = !cfg.roc.mines[k];
});
for (const t of TOGGLES) {
  $('tg-' + t.k).onchange = e => {
    if (e.target.checked && spent(cfg.roc) + t.cost > BUDGET) { e.target.checked = false; flashBudget(); return; }
    cfg.roc[t.k] = e.target.checked; changed();
  };
  syncs.push(() => { $('tg-' + t.k).checked = cfg.roc[t.k]; });
}
choice('plan', k => cfg.pla.plan === k, k => { cfg.pla.plan = k; });
choice('sector', k => cfg.pla.sector === k, k => { cfg.pla.sector = k; });
choice('vertical', k => cfg.pla.vertical === k, k => { cfg.pla.vertical = k; });
bindSlider('strikes', () => cfg.pla.strikes, v => { cfg.pla.strikes = v; }, v => `${v} (${v * TURN_HOURS} h)`);
bindSlider('lift', () => cfg.pla.lift, v => { cfg.pla.lift = v; });
bindSlider('turns', () => cfg.turns, v => { cfg.turns = v; }, v => cfg.pla.plan === 'blockade' ? `${v} × ${BLOCKADE_DAYS} days` : `${v} × ${TURN_HOURS} h`);
$('tg-offload').onchange = e => { cfg.pla.offload = e.target.checked; changed(); };
syncs.push(() => {
  $('tg-offload').checked = cfg.pla.offload;
  $('assault-opts').hidden = cfg.pla.plan !== 'assault';
  $('turn-note').innerHTML = cfg.pla.plan === 'blockade'
    ? `Blockade turns are ${BLOCKADE_DAYS} days ${NOTIONAL}, so ${cfg.turns} turns cover ${cfg.turns * BLOCKADE_DAYS} days.`
    : `Assault turns are ${TURN_HOURS} hours, so ${cfg.turns} turns cover ${cfg.turns * TURN_HOURS / 24} days.`;
  $('seed-t').textContent = seed;
});
$('reseed').onclick = () => { seed = 1 + Math.floor(Math.random() * 999998); changed(); };

function flashBudget() { const b = $('budget-t'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }

// Assumptions editor
function renderAssumptions() {
  $('assume-body').innerHTML = assumptionsHtml(P);
  const nChanged = PROB.filter(p => P[p.k] !== p.v).length, nNot = PROB.filter(p => !p.src).length;
  $('assume-n').textContent = `${PROB.length} values, ${nNot} notional${nChanged ? `, ${nChanged} changed` : ''}`;
  $('assume-body').querySelectorAll('input').forEach(i => i.onchange = () => {
    const p = PROB.find(x => x.k === i.dataset.k);
    const v = parseFloat(i.value);
    P[p.k] = Number.isFinite(v) ? Math.max(p.min, Math.min(p.max, v)) : p.v;
    changed();
  });
}
$('assume-reset').onclick = () => { P = { ...PROB_DEF }; changed(); };

// Turn stepping
$('prev').onclick = () => { stop(); setView(view - 1); };
$('next').onclick = () => { stop(); setView(view + 1); };
$('scrub').oninput = e => { stop(); setView(+e.target.value); };
$('playall').onclick = playAll;
$('start-tour').onclick = () => { showTab('play'); tour.start(); };

// Phone tabs (Setup / Play / 1,000 games). On wider screens every section shows and the tabs are hidden.
const phone = matchMedia('(max-width: 760px)');
function showTab(t) {
  const lay = document.querySelector('.layout');
  if (lay.dataset.tab === t) return;
  lay.dataset.tab = t;
  document.querySelectorAll('.pg-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  if (phone.matches) document.querySelector('.pg-tabs').scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
}
document.querySelectorAll('.pg-tabs [data-tab], [data-go]').forEach(b => b.onclick = () => showTab(b.dataset.tab || b.dataset.go));
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Link copied'; }
  catch { $('copy-link').textContent = 'Copy the address bar'; }
  setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800);
};

// ---- Compute and draw -----------------------------------------------------------------------
function changed(v = 0) {
  stop();
  syncs.forEach(f => f());
  const used = spent(cfg.roc);
  $('budget-bar').style.width = Math.min(100, used / BUDGET * 100) + '%';
  $('budget-t').innerHTML = `${used} of ${BUDGET} points spent ${NOTIONAL}`;
  renderAssumptions();
  game = playGame(cfg, P, seed);
  $('scrub').max = game.turns.length;
  setView(Math.min(v, game.turns.length));
  scheduleMc();
}

function startState() {
  return { ashm: cfg.roc.ashm, salvos: cfg.roc.ashm * P.salvos, shorad: cfg.roc.shorad, drones: cfg.roc.drones,
    garrison: P.garrison + cfg.roc.marines + cfg.roc.reserves * P.reserveEff, stocks: P.baseStock + cfg.roc.stocks * 7,
    ashore: 0, fleet: cfg.pla.lift, progress: 0, airfield: 'roc', mineEff: 1 };
}

function setView(v) {
  const was = view, before = [...$('readout').querySelectorAll('dd')].map(d => d.textContent);
  view = Math.max(0, Math.min(game.turns.length, v));
  const st = view ? game.turns[view - 1].state : startState();
  const T = view ? game.turns[view - 1] : null;
  map.draw(cfg, st, { turn: view, outcome: game.outcome, wonAt: game.wonAt });
  $('scrub').value = view;
  $('prev').disabled = view === 0; $('next').disabled = view >= game.turns.length;
  $('turn-t').textContent = view ? `Turn ${view} of ${game.turns.length} · ${T.label} · ${T.phase}` : `Setup · up to ${cfg.turns} turns to play`;
  $('readout').innerHTML = readoutHtml(st, cfg, view, game);
  $('log').innerHTML = turnLogHtml(game, view, cfg);
  $('crt-wrap').hidden = cfg.pla.plan !== 'assault';
  $('crt').innerHTML = crtHtml(T && T.crt);
  $('crt-note').textContent = T && T.crt ? `This turn: ratio ${T.crt.ratio === Infinity ? 'unopposed' : T.crt.ratio.toFixed(2)} (column ${['< 1:2', '1:2', '1:1', '1.5:1', '2:1', '3:1+'][T.crt.col]}), die ${T.crt.roll}.` : 'No ground combat this turn.';
  writeHash(cfg, P, seed, view);
  fx.turn({ svg: $('map'), log: $('log'), crt: $('crt'), readout: $('readout'), prevReadout: before, prev: view > 1 ? game.turns[view - 2].state : startState(),
    st, cfg, view, game, forward: view === was + 1 && view > 0 });
}

function scheduleMc() {
  clearTimeout(mcTimer);
  $('mc').classList.add('busy');
  mcTimer = setTimeout(() => {
    const mc = monteCarlo(cfg, P, seed);
    const drv = drivers(cfg, P, seed, mc);
    $('mc').innerHTML = mcHtml(mc, drv, cfg);
    fx.mc($('mc'));
    $('mc').classList.remove('busy');
    $('mc-h').textContent = `${RUNS.toLocaleString('en-US')} games, dice seed ${seed}`;
    status(mc);
  }, 60);
}

function status(mc) {
  const p = mc.pla / mc.n, r = mc.roc / mc.n, s = mc.stale / mc.n;
  const span = cfg.pla.plan === 'blockade' ? `${cfg.turns * BLOCKADE_DAYS} days` : `${cfg.turns * TURN_HOURS / 24} days`;
  const top = [['pla', p], ['roc', r], ['stale', s]].sort((a, b) => b[1] - a[1])[0][0];
  const S = $('status'), was = S.textContent;
  S.dataset.s = p >= 0.5 ? 'bad' : p >= 0.2 || top === 'stale' ? 'warn' : 'good';
  S.innerHTML = `<b>PLA holds Magong in ${Math.round(p * 100)}% of games</b><span>Within ${span}. Defense holds ${Math.round(r * 100)}%, stalemate ${Math.round(s * 100)}%. Most likely outcome: ${outcomeText(top)}.</span>`;
  fx.status(S, was);
  $('status-mini').dataset.s = S.dataset.s; $('status-mini').innerHTML = S.innerHTML;
  $('status-note').innerHTML = `Notional model, not a prediction. ${RUNS.toLocaleString('en-US')} seeded games; the turn log shows one of them.`;
}

// ---- Animation ---------------------------------------------------------------------------
function stop() { if (anim) clearInterval(anim); anim = null; $('playall').textContent = 'Play all turns'; }
function playAll() {
  if (anim) { stop(); return; }
  if (reduced.matches) { setView(game.turns.length); return; }
  if (view >= game.turns.length) setView(0);
  $('playall').textContent = 'Stop';
  anim = setInterval(() => { if (view >= game.turns.length) stop(); else setView(view + 1); }, 1100);
}

// ---- Below the fold ------------------------------------------------------------------------
$('history').innerHTML = HISTORY.map(h => `<li><p class="h-when">${h.when}</p><h3>${h.title}</h3><p>${h.text}</p>
  <p class="fine"><a href="${SOURCES[h.src].url}" target="_blank" rel="noopener">${SOURCES[h.src].t}</a></p></li>`).join('');
$('sources').innerHTML = Object.entries(SOURCES).map(([k, s]) => `<li id="src-${k}"><a href="${s.url}" target="_blank" rel="noopener">${s.t}</a>. <span>Used for: ${s.used}</span></li>`).join('');
$('param-table').innerHTML = `<thead><tr><th>Parameter</th><th>Default</th><th>Basis</th></tr></thead><tbody>${PROB.map(p => `<tr><td>${p.t}</td><td class="num">${p.v} ${p.u}</td><td>${p.src ? `<a href="#src-${p.src}">${SOURCES[p.src].t.split(',')[0]}</a>${p.note ? `: ${p.note}` : ''}` : `${NOTIONAL}${p.note ? ` ${p.note}` : ''}`}</td></tr>`).join('')}</tbody>`;
reduced.addEventListener?.('change', stop);

changed(view);
fx.wire([$('next'), $('playall')]);
addExportBar(document.querySelector('.playbar'), {
  target: () => $('map'),
  title: () => `Penghu Gambit: ${$('turn-t').textContent}`,
  note: 'Notional model, not a prediction (TSM Penghu Gambit). Defense assets shown in a notional zone.',
});
