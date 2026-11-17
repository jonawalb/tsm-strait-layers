// Energy Blockade Clock: state, controls, playback and URL hash.
import { FACTS, MIX_RAW, POWER_SHARE, FUELS, STOCKS, SEVERITY, SECTORS, POLICIES, MEASURES, NOTIONAL } from '../data/baseline.js';
import { simulate } from './model.js';
import { mountGauges, updateGauges, drawSupply, drawSectors, SUPPLY_LAYERS } from './charts.js';
import { createTour } from './tour.js';
import { addExportBar, tableRows } from '../../../shared/js/export.js';

const $ = id => document.getElementById(id);
const H = NOTIONAL.horizon;
const S = {
  sev: 100, dur: 120, stock: { ...STOCKS[0].v }, policy: 'csis',
  measures: Object.fromEntries(MEASURES.map(m => [m.k, false])), day: 14,
};
let sim = null, playing = false, raf = null, last = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Hash ----------------------------------------------------------------------
function writeHash() {
  const q = new URLSearchParams({ s: S.sev, d: S.dur, g: S.stock.lng, c: S.stock.coal, o: S.stock.oil, p: S.policy,
    m: Object.keys(S.measures).filter(k => S.measures[k]).join(','), t: S.day });
  history.replaceState(null, '', '#' + q.toString());
}
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k, lo, hi) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };
  if (num('s', 0, 100) != null) S.sev = num('s', 0, 100);
  if (num('d', 7, H) != null) S.dur = Math.round(num('d', 7, H));
  if (num('g', 0, 30) != null) S.stock.lng = num('g', 0, 30);
  if (num('c', 0, 90) != null) S.stock.coal = num('c', 0, 90);
  if (num('o', 0, 200) != null) S.stock.oil = num('o', 0, 200);
  if (POLICIES.some(p => p.k === q.get('p'))) S.policy = q.get('p');
  if (q.has('m')) { const on = new Set(q.get('m').split(',')); Object.keys(S.measures).forEach(k => { S.measures[k] = on.has(k); }); }
  if (num('t', 0, H - 1) != null) S.day = Math.round(num('t', 0, H - 1));
}

// ---- Controls --------------------------------------------------------------------
const STOCK_RANGE = { lng: [0, 30], coal: [0, 90], oil: [0, 200] };
function mountControls() {
  $('sev-choices').innerHTML = SEVERITY.map(p => `<button type="button" data-v="${p.v}"><b>${p.n}</b><br><small>${p.v}% · ${p.s}</small></button>`).join('');
  $('sev-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.sev = +b.dataset.v; update(true); });
  $('stock-choices').innerHTML = STOCKS.map(p => `<button type="button" data-k="${p.k}"><b>${p.n}</b><br><small>${p.s}</small></button>`).join('');
  $('stock-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.stock = { ...STOCKS.find(p => p.k === b.dataset.k).v }; update(true); });
  $('stock-sliders').innerHTML = FUELS.map(f => `<div class="slider"><div class="sl-h"><label for="st-${f.k}">${f.long}</label><output id="st-${f.k}-out"></output></div>
    <input type="range" id="st-${f.k}" min="${STOCK_RANGE[f.k][0]}" max="${STOCK_RANGE[f.k][1]}" step="1"></div>`).join('');
  FUELS.forEach(f => { $('st-' + f.k).oninput = e => { S.stock[f.k] = +e.target.value; update(true); }; });
  $('policy-choices').innerHTML = POLICIES.map(p => `<button type="button" data-k="${p.k}"><b>${p.n}</b><br><small>${p.s}</small></button>`).join('');
  $('policy-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.policy = b.dataset.k; update(); });
  $('measures').innerHTML = MEASURES.map(m => `<label class="tg"><input type="checkbox" id="m-${m.k}"><span class="sw"></span><span class="t">${m.n}<small>${m.s}</small></span></label>`).join('');
  MEASURES.forEach(m => { $('m-' + m.k).onchange = e => { S.measures[m.k] = e.target.checked; update(); }; });
  $('sev').oninput = e => { S.sev = +e.target.value; update(true); };
  $('dur').oninput = e => { S.dur = +e.target.value; update(); };
  $('day').oninput = e => { stop(); S.day = +e.target.value; update(); };
  $('play').onclick = () => (playing ? stop() : play());
  $('legend').innerHTML = SUPPLY_LAYERS.map(l => `<li><i class="sw" style="background:${l.c}"></i>${l.n}</li>`).join('') + '<li><i class="sw line"></i>Demand</li><li><i class="sw gapsw"></i>Shortfall</li>';
}

function syncControls() {
  $('sev').value = S.sev; $('sev-out').textContent = S.sev + '%';
  $('dur').value = S.dur; $('dur-out').textContent = S.dur + ' days';
  $('sev-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S.sev));
  const preset = STOCKS.find(p => FUELS.every(f => p.v[f.k] === S.stock[f.k]));
  $('stock-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', preset && b.dataset.k === preset.k));
  $('stock-note').textContent = preset ? preset.note : 'Custom stock levels.';
  FUELS.forEach(f => { $('st-' + f.k).value = S.stock[f.k]; $(`st-${f.k}-out`).textContent = S.stock[f.k] + ' days'; });
  $('policy-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.policy));
  MEASURES.forEach(m => { $('m-' + m.k).checked = S.measures[m.k]; });
  const perWeek = FACTS.lngCargoesMonth * 12 / 52;
  $('cargo').innerHTML = `At ${S.sev}%, about <b class="num">${(perWeek * (1 - S.sev / 100)).toFixed(1)}</b> of the roughly ${perWeek.toFixed(0)} LNG cargoes a week arrive. Severity levels are <span class="notional">notional</span>.`;
}

// ---- Render ------------------------------------------------------------------------
function dayText(d) {
  if (d.t < S.dur) return `of the blockade · ${S.dur - d.t} days to go`;
  return `· blockade lifted ${d.t - S.dur} day${d.t - S.dur === 1 ? '' : 's'} ago`;
}

function renderDay() {
  const d = sim.days[S.day];
  $('day').value = S.day;
  $('day-n').textContent = 'Day ' + S.day;
  $('day-s').textContent = dayText(d);
  updateGauges($('gauges'), sim, S.day);
  const scrub = t => { stop(); S.day = t; renderDay(); writeHash(); };
  drawSupply($('supply'), sim, S.dur, S.day, scrub);
  drawSectors($('sectors'), sim, S.dur, S.day, scrub);
  const ratio = d.supply / d.demand;
  const darkNow = SECTORS.filter(s => d.served[s.k] < NOTIONAL.dark).map(s => s.n.toLowerCase());
  const st = $('status');
  st.dataset.s = ratio >= 0.97 ? 'good' : ratio >= 0.6 ? 'warn' : 'bad';
  st.querySelector('b').textContent = ratio >= 0.97 ? 'Grid meets demand' : `Grid covers ${Math.round(ratio * 100)}% of demand`;
  const empty = FUELS.filter(f => d.stock[f.k] < 0.5 && S.stock[f.k] > 0).map(f => f.n);
  st.querySelector('span').textContent = `Day ${S.day}. ` +
    (empty.length ? `${empty.join(' and ')} stocks are empty. ` : 'All fuel stocks still hold. ') +
    (darkNow.length ? `Dark: ${darkNow.join(', ')}.` : 'No sector is below half its supply.');
  document.querySelectorAll('#darklist li').forEach(li => li.classList.toggle('now', sim.dark[li.dataset.k] != null && sim.dark[li.dataset.k] <= S.day));
}

function renderSummary() {
  const fuelRow = f => `<dt>${f.n} runs out</dt><dd>${sim.runout[f.k] == null ? 'not during the blockade' : 'day ' + sim.runout[f.k]}</dd>`;
  const below = sim.days.find(d => d.supply / d.demand < 0.5);
  const md = sim.minDay;
  $('summary').innerHTML = FUELS.map(fuelRow).join('') +
    `<dt>Grid below half</dt><dd>${below ? 'day ' + below.t : 'never'}</dd>
     <dt>Lowest point</dt><dd>${Math.round(md.supply / md.demand * 100)}% of demand, day ${md.t}</dd>
     <dt>Demand after cuts</dt><dd>${Math.round(sim.prof.total * 100)}% of normal</dd>`;
  const order = SECTORS.filter(s => sim.dark[s.k] != null).sort((a, b) => sim.dark[a.k] - sim.dark[b.k]);
  const kept = SECTORS.filter(s => sim.dark[s.k] == null);
  $('darklist').innerHTML = (order.length ? order.map(s => `<li data-k="${s.k}"><b>Day ${sim.dark[s.k]}</b> ${s.n} <small>${s.s}</small></li>`).join('') : '<li class="none">No sector falls below half its supply in this scenario.</li>') +
    (kept.length && order.length ? `<li class="kept">Keeps power: ${kept.map(s => s.n.toLowerCase()).join(', ')}</li>` : '');
}

function update(resetDayIfNeeded = false) {
  sim = simulate(S);
  if (resetDayIfNeeded && S.day >= H) S.day = H - 1;
  syncControls();
  renderSummary();
  renderDay();
  if (!playing) writeHash();
}

// ---- Playback ------------------------------------------------------------------------
function play() {
  if (reduced) { S.day = Math.min(H - 1, Math.max(S.dur, sim.minDay.t)); renderDay(); writeHash(); return; }
  if (S.day >= H - 1) S.day = 0;
  playing = true; last = null; $('play').textContent = 'Pause';
  raf = requestAnimationFrame(step);
}
function step(ts) {
  if (!playing) return;
  if (last != null) {
    const next = Math.min(H - 1, S.day + Math.max(0, Math.floor((ts - last) / 90)));
    if (next !== S.day) { S.day = next; last = ts; renderDay(); }
  } else last = ts;
  if (S.day >= H - 1) stop(); else raf = requestAnimationFrame(step);
}
function stop() { if (!playing) return; playing = false; cancelAnimationFrame(raf); $('play').textContent = 'Play'; writeHash(); }

// ---- Baseline table ---------------------------------------------------------------------
function baseTable() {
  const rows = [
    ['Energy imported', `about ${FACTS.importShare}% by sea (EIA: over 94%, 2024)`, 'Atlantic Council; CSIS; EIA'],
    ['Generation mix, 2025', `gas ${MIX_RAW.gas}%, coal ${MIX_RAW.coal}%, renewables ${MIX_RAW.renew}%, nuclear 1.1%`, 'MOEA via Eco-Business'],
    ['Nuclear', `last reactor (Maanshan 2) shut ${FACTS.maanshanClosed}; the Nuclear Safety Commission approved Taipower's restart plan on 24 Sept. 2026, but licensing and safety checks remain, so zero in the model`, 'World Nuclear News; CNA, 2026'],
    ['Share of fuel used for power', `gas ${POWER_SHARE.lng * 100}%, coal ${POWER_SHARE.coal * 100}%, oil about ${POWER_SHARE.oil * 100}%`, 'EIA (2024); CSIS'],
    ['LNG stocks', '10 to 11 days (2026); legal minimum 11 days (2025), 14 days (2027)', 'EIA; Energy Administration; Taipei Times'],
    ['Coal stocks', 'rules require up to 30 days; Taipower keeps 40 to 42; CSIS wargame default 45 days', 'Taipei Times, 2023; CSIS, 2025'],
    ['Oil stocks', '146 days (2024 estimate); more than 100 days (March 2026); legal minimum 60 + 30 days', 'EIA; Taipei Times; Energy Administration'],
    ['LNG deliveries', `about ${FACTS.lngCargoesMonth} cargoes a month through ${FACTS.lngTerminals} terminals`, 'Taipei Times, 2026; EIA'],
  ];
  $('basetable').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
}

// ---- Boot -------------------------------------------------------------------------------------
readHash();
mountGauges($('gauges'));
mountControls();
baseTable();
const tour = createTour($('stage'), set => {
  stop();
  Object.assign(S, { sev: set.sev, dur: set.dur, stock: { ...set.stock }, policy: set.policy, measures: { ...set.measures }, day: set.day });
  update();
});
$('tour-btn').onclick = () => tour.start();
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; }
  catch { $('copy').textContent = 'Copy failed'; }
  setTimeout(() => { $('copy').textContent = 'Copy link'; }, 1600);
};
document.addEventListener('keydown', e => {
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); playing ? stop() : play(); }
});
update();
let rz = null;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderDay, 120); });
const dayTitle = () => `${$('day-n').textContent}${$('day-s').textContent ? ', ' + $('day-s').textContent : ''}`;
const NOTE = 'Notional model (TSM Energy Blockade Clock); stocks and mix from EIA, MOEA and CSIS';
addExportBar($('supply'), { target: () => $('supply'), title: () => `Taiwan grid supply against demand · ${dayTitle()}`, note: NOTE, where: 'after' });
addExportBar($('darklist'), { target: () => $('sectors'), title: () => `Who has power · ${dayTitle()}`, note: NOTE, where: 'after' });
addExportBar($('baseline').parentElement, { csv: () => tableRows($('baseline')), csvLabel: 'Copy table as CSV', where: 'after' });
