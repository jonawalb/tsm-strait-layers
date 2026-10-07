// Blockade & Quarantine Simulator: wiring.
import { simulate, H } from './model.js';
import { decode, encode, resolve } from './state.js';
import { mountPanel, syncPanel } from './panel.js';
import { mountMap, updateMap } from './map.js';
import { mountGauges, updateGauges, drawTab } from './views.js';
import { drawEvidence } from './evidence.js';
import { mountMethod } from './method.js';
import { createTour } from './tour.js';
import { BASE } from '../data/params.js';
import { addExportBar } from '../../../shared/js/export.js';

const $ = id => document.getElementById(id);
let { cfg, over, cmp } = decode(location.hash);
let sim, ref = null, refCfg = null, day = 0, tab = 'energy', timer = 0;

const fmtBn = v => (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1));
const dayTxt = t => (t == null ? 'not reached' : 'day ' + t);

function run() {
  const A = resolve(over);
  sim = simulate(cfg, A);
  if (refCfg) ref = simulate(refCfg.cfg, resolve(refCfg.over));
  history.replaceState(null, '', '#' + encode(cfg, over) + (refCfg ? '&cmp=' + encodeURIComponent(encode(refCfg.cfg, refCfg.over)) : ''));
  syncPanel(cfg, over);
  summary();
  compare();
  render();
}

function render() {
  const d = sim.days[day];
  $('day').value = day;
  $('day-n').textContent = 'Day ' + day;
  $('day-s').textContent = d.on ? (cfg.mode === 'q' ? 'Quarantine in force' : 'Blockade in force') : day === 0 ? '' : 'Lifted; recovery';
  updateMap(sim, day);
  updateGauges(sim, day);
  drawTab(tab, sim, ref, day, t => { day = t; stop(); render(); });
}

function summary() {
  const e = sim.ev, lowG = sim.minGrid;
  const bad = lowG.grid < 0.6 || e.runout.lng != null, warn = lowG.grid < 0.95 || sim.peakPrem > 0.1;
  const st = $('status');
  st.dataset.s = bad ? 'bad' : warn ? 'warn' : 'good';
  const short = sim.days.filter(d => d.supply < d.need - 0.005);
  st.querySelector('b').textContent = e.runout.lng != null ? `LNG runs out on day ${e.runout.lng}` : short.length ? `Power falls to ${Math.round(lowG.grid * 100)}% of demand` : 'Stocks hold';
  const powTxt = short.length ? `Lowest power ${Math.round(lowG.grid * 100)}% of normal demand, day ${lowG.t}.`
    : lowG.grid < 0.995 ? `No unplanned shortfall; the drawdown policy holds use at ${Math.round(lowG.grid * 100)}% of normal.` : 'No power shortfall.';
  st.querySelector('span').textContent = `${powTxt} Exports lost over 180 days: about US$${fmtBn(sim.lost)}bn.`;
  const down = sim.repairs.filter(r => r.intl);
  $('summary').innerHTML = [
    ['LNG out', dayTxt(e.runout.lng)], ['Coal out', dayTxt(e.runout.coal)], ['Power < 50%', dayTxt(e.gridHalf)],
    ['War-risk listing', e.listed == null ? 'none' : 'day ' + e.listed], ['Peak premium', sim.peakPrem.toFixed(2) + '% of hull'],
    ['Cables cut', down.length ? `${down.length} of ${sim.intlTotal} international, last back day ${Math.max(...down.map(r => r.done))}` : 'none'],
    ['Fabs < 50%', dayTxt(e.chipsDown)], ['Exports lost', `US$${fmtBn(sim.lost)}bn (chips US$${fmtBn(sim.lostIc)}bn)`],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('partners').innerHTML = sim.partners.map(p => {
    const w = sim.lost > 0 ? p.lost / Math.max(...sim.partners.map(x => x.lost)) : 0;
    return `<li><span>${p.n}</span><i style="--w:${(w * 100).toFixed(1)}%"></i><b class="num">US$${fmtBn(p.lost)}bn</b></li>`;
  }).join('');
}

const METRICS = [
  ['LNG runs out', s => dayTxt(s.ev.runout.lng)],
  ['Lowest power', s => `${Math.round(s.minGrid.grid * 100)}% (day ${s.minGrid.t})`],
  ['Peak war-risk premium', s => s.peakPrem.toFixed(2) + '%'],
  ['Average cargo arriving', s => Math.round(s.days.slice(0, s.cfg.dur).reduce((a, d) => a + d.arrive, 0) / s.cfg.dur * 100) + '%'],
  ['International cables down, days', s => s.repairs.filter(r => r.intl).reduce((a, r) => a + Math.min(H, r.done) - r.cut, 0)],
  ['Lowest chip output', s => Math.round(Math.min(...s.days.map(d => d.chips)) * 100) + '%'],
  ['Exports lost, 180 days', s => `US$${fmtBn(s.lost)}bn`],
];

function compare() {
  const box = $('compare');
  if (!ref) { box.hidden = true; $('pin').textContent = 'Pin for comparison'; return; }
  box.hidden = false; $('pin').textContent = 'Re-pin this scenario';
  $('cmp-body').innerHTML = METRICS.map(([n, f]) => `<tr><th scope="row">${n}</th><td class="num">${f(ref)}</td><td class="num">${f(sim)}</td></tr>`).join('');
}

function setTab(t) {
  tab = t;
  document.querySelectorAll('#tabs [role="tab"]').forEach(x => { x.setAttribute('aria-selected', String(x.dataset.t === t)); x.tabIndex = x.dataset.t === t ? 0 : -1; });
}

function stop() { clearInterval(timer); timer = 0; $('play').textContent = 'Play'; }
function play() {
  if (timer) return stop();
  if (day >= H - 1) day = 0;
  $('play').textContent = 'Pause';
  timer = setInterval(() => { if (day >= H - 1) return stop(); day += 1; render(); }, 90);
}

function init() {
  if (cmp) { const r = decode(cmp); refCfg = { cfg: r.cfg, over: r.over }; }
  mountPanel(cfg, over, (c, o) => { cfg = c; over = o; run(); });
  mountMap($('map'), $('tip'));
  mountGauges();
  drawEvidence();
  mountMethod();
  $('day').max = H - 1;
  $('day').addEventListener('input', e => { day = Number(e.target.value); stop(); render(); });
  $('play').addEventListener('click', play);
  $('pin').addEventListener('click', () => { refCfg = { cfg: structuredClone(cfg), over: { ...over } }; run(); });
  $('unpin').addEventListener('click', () => { refCfg = null; ref = null; run(); });
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; }
    catch { $('copy').textContent = 'Copy from the address bar'; }
    setTimeout(() => { $('copy').textContent = 'Copy link'; }, 1800);
  });
  document.querySelectorAll('#tabs [role="tab"]').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.t); render(); }));
  const tour = createTour(document.querySelector('.stage'), (c, d, t) => {
    stop(); cfg = c; refCfg = null; ref = null; run(); day = d; setTab(t); render(); return sim;
  });
  $('tour-btn').addEventListener('click', () => { tour.start(); document.querySelector('.tour').scrollIntoView({ block: 'nearest' }); });
  $('tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = [...document.querySelectorAll('#tabs [role="tab"]')];
    const i = tabs.findIndex(x => x.dataset.t === tab), j = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[j].focus(); tabs[j].click();
  });
  window.addEventListener('hashchange', () => {
    const r = decode(location.hash);
    if (encode(r.cfg, r.over) !== encode(cfg, over)) { cfg = r.cfg; over = r.over; run(); }
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { render(); drawEvidence(); }, 150); });
  addExportBar($('chart-note'), {
    target: () => $('chart'), where: 'after', csvLabel: 'Copy daily run as CSV',
    title: () => 'Blockade & Quarantine Simulator: ' + document.querySelector('#tabs [aria-selected="true"]').textContent,
    note: 'Scenario model, not a forecast. Taiwan Security Monitor. Data: IMF PortWatch, TeleGeography, MOEA, MOF.',
    csv: () => [['day', 'in_force', 'insurer_state', 'owners_staying_away', 'premium_pct_hull', 'cargo_arriving', 'lng_days', 'coal_days', 'oil_days',
      'power_share_of_normal', 'port_calls', 'strait_transits', 'intl_cables_up_share', 'chip_output', 'exports_usd_bn']]
      .concat(sim.days.map(d => [d.t, d.on ? 1 : 0, d.state, d.avoid.toFixed(3), d.prem.toFixed(3), d.arrive.toFixed(3), d.stock.lng.toFixed(1), d.stock.coal.toFixed(1),
        d.stock.oil.toFixed(1), d.grid.toFixed(3), d.calls.toFixed(1), d.strait.toFixed(1), d.cablesUp.toFixed(3), d.chips.toFixed(3), (d.icExp + d.otherExp).toFixed(3)])),
  });
  setTab(tab);
  day = Math.min(H - 1, 30);
  run();
  $('base-calls').textContent = BASE.callsDay.toFixed(0);
}

init();
