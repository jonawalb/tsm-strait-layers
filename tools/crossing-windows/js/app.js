// Crossing Windows: state, URL hash, panel wiring and rendering.
import { POINTS, STATIONS, YEARS, MONTHS_LONG, DEFAULTS, weekLabel, evaluate, windows, aggregate, bestSpan, stormExposure } from './model.js';
import { drawHeatmap, drawWeekChart, drawMonthChart } from './charts.js';
import { renderDrill } from './drill.js';
import { createLocator } from './map.js';
import { PORTS } from './astro.js';
import { createTour } from './tour.js';
import { PROVENANCE } from '../data/provenance.js';
import * as fx from './fx.js';
import { widths } from './fxbars.js';

const $ = id => document.getElementById(id);
const pct = v => Math.round(v * 100) + '%';
const PRESETS = { ss3: { h: 1.25, w: 21 }, ss2: { h: 0.5, w: 16 }, ss4: { h: 2.5, w: 27 } };
const TIDE_YEARS = [2026, 2027, 2028, 2029, 2030];
let s = { ...DEFAULTS };

// ---- URL hash ------------------------------------------------------------------------------
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k, lo, hi) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : DEFAULTS[k]; };
  const pick = (k, ok) => (ok.includes(q.get(k)) ? q.get(k) : DEFAULTS[k]);
  s = {
    p: pick('p', Object.keys(POINTS)), h: num('h', 0.25, 4), w: num('w', 6, 40), n: Math.round(num('n', 1, 10)),
    r: num('r', 0, 1000), fog: q.has('fog') ? q.get('fog') !== '0' : DEFAULTS.fog, st: pick('st', Object.keys(STATIONS)),
    wk: Math.round(num('wk', 1, 52)) - 1, yr: Math.round(num('yr', 2026, 2030)), port: pick('port', Object.keys(PORTS)),
  };
  if (!q.has('wk')) s.wk = DEFAULTS.wk;
}
function writeHash() {
  const q = new URLSearchParams({ p: s.p, h: s.h, w: s.w, n: s.n, r: s.r, fog: s.fog ? 1 : 0, st: s.st, wk: s.wk + 1, yr: s.yr, port: s.port });
  history.replaceState(null, '', '#' + q.toString());
}

// ---- panel ---------------------------------------------------------------------------------
$('points').innerHTML = Object.entries(POINTS).map(([id, p]) => `<button type="button" data-p="${id}">${p.label}</button>`).join('');
$('i-st').innerHTML = Object.entries(STATIONS).map(([id, t]) => `<option value="${id}">${t.label}</option>`).join('');
$('i-port').innerHTML = Object.entries(PORTS).map(([id, t]) => `<option value="${id}">${t.label}</option>`).join('');
$('i-yr').innerHTML = TIDE_YEARS.map(y => `<option>${y}</option>`).join('');

function syncPanel() {
  $('i-h').value = s.h; $('o-h').textContent = s.h.toFixed(2) + ' m';
  $('i-w').value = s.w; $('o-w').textContent = s.w + ' kt';
  $('i-n').value = s.n; $('o-n').textContent = s.n + (s.n === 1 ? ' day' : ' days');
  $('i-r').value = s.r; $('o-r').textContent = s.r ? s.r + ' km' : 'off';
  $('i-fog').checked = s.fog; $('i-st').value = s.st; $('i-st').disabled = !s.fog;
  $('i-wk').value = s.wk; $('o-wk').textContent = `${s.wk + 1}: ${weekLabel(s.wk)}`;
  $('i-yr').value = s.yr; $('i-port').value = s.port;
  document.querySelectorAll('#points button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === s.p));
  document.querySelectorAll('#presets button').forEach(b => {
    const p = PRESETS[b.dataset.preset];
    b.setAttribute('aria-pressed', p.h === s.h && p.w === s.w);
  });
}
const set = patch => { Object.assign(s, patch); render(); };
const bindRange = (id, key, parse = parseFloat) => $(id).addEventListener('input', e => set({ [key]: parse(e.target.value) }));
bindRange('i-h', 'h'); bindRange('i-w', 'w', v => parseInt(v, 10)); bindRange('i-n', 'n', v => parseInt(v, 10));
bindRange('i-r', 'r', v => parseInt(v, 10)); bindRange('i-wk', 'wk', v => parseInt(v, 10));
$('i-fog').addEventListener('change', e => set({ fog: e.target.checked }));
$('i-st').addEventListener('change', e => set({ st: e.target.value }));
$('i-yr').addEventListener('change', e => set({ yr: +e.target.value }));
$('i-port').addEventListener('change', e => set({ port: e.target.value }));
$('points').addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ p: b.dataset.p }); });
$('presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ ...PRESETS[b.dataset.preset] }); });
$('wk-prev').onclick = () => set({ wk: (s.wk + 51) % 52 });
$('wk-next').onclick = () => set({ wk: (s.wk + 1) % 52 });
$('weekchart').addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); set({ wk: (s.wk + (e.key === 'ArrowLeft' ? 51 : 1)) % 52 }); }
});
$('reset-btn').onclick = () => { s = { ...DEFAULTS }; render(); };
$('copy-btn').onclick = async () => {
  writeHash();
  try { await navigator.clipboard.writeText(location.href); $('copy-btn').textContent = 'Copied'; }
  catch { $('copy-btn').textContent = 'Link in address bar'; }
  setTimeout(() => { $('copy-btn').textContent = 'Copy link'; }, 1600);
};
const locator = createLocator($('locator'), {
  onPoint: p => set({ p }), onPort: port => set({ port }), onStation: st => set({ st, fog: true }),
});

// ---- rendering -----------------------------------------------------------------------------
const pickWeek = wk => { set({ wk }); };
const monthOf = wk => MONTHS_LONG[Math.min(11, Math.floor((wk * 7 + 3) / 30.44))];

function claimText(agg, rank, best) {
  const r = m => rank.indexOf(m) + 1, mo = agg.month;
  const top = rank.slice(0, 3).map(m => `${MONTHS_LONG[m]} (${pct(mo[m])})`).join(', ');
  const endWk = (best.start + 3) % 52;
  const aprOk = r(3) <= 4, octOk = r(9) <= 4;
  return `<p>With these limits at the <b>${POINTS[s.p].label.toLowerCase()}</b> point, <b>April</b> ranks
    <b>${r(3)} of 12</b> months (${pct(mo[3])} of days open a ${s.n}-day window) and <b>October</b> ranks <b>${r(9)} of 12</b> (${pct(mo[9])}).</p>
    <p>The best months in this record are ${top}. The best four straight weeks run ${weekLabel(best.start).split(' to ')[0]} to
    ${weekLabel(endWk).split(' to ')[1]}, at ${pct(best.v)}.</p>
    <p>${aprOk && octOk ? 'Both claimed months hold up under these limits.'
      : aprOk ? 'April holds up. October does not: most October days fail the wave test. Raise the wave limit to see October recover.'
      : octOk ? 'October holds up under these limits, April less so.'
      : 'Neither claimed month ranks near the top under these limits. Summer weeks score higher on wind and waves; raise the typhoon radius to see how much of that summer calm typhoons take back.'}</p>
    <p class="fine">This tool does not model rain, cloud, heat or conditions at the beaches, any of which may enter an assessment like Easton's. The typhoon test also fails only the days a storm is actually inside the radius; a planner committing a fleet for weeks may weigh the chance of a storm arriving mid-operation far more heavily. The comparison tests only whether the wind, wave, fog and typhoon record agrees with the months named.</p>`;
}

function render() {
  syncPanel();
  const ev = evaluate(s), open = windows(ev.go, s.n), agg = aggregate(open), tc = stormExposure(s.r);
  const best = bestSpan(agg.week, 4);
  $('hm-note').textContent = `${POINTS[s.p].label} · waves ≤ ${s.h.toFixed(2)} m · wind ≤ ${s.w} kt · ${s.n}-day window`;
  const lim = `${s.p}|${s.h}|${s.w}|${s.n}|${s.r}|${s.fog}|${s.st}`;
  fx.chart($('heatmap'), 'hm', () => drawHeatmap($('heatmap'), $('tip-hm'), agg, s, { onPick: pickWeek, stormYears: tc.grid }));
  fx.chart($('weekchart'), lim, () => drawWeekChart($('weekchart'), $('tip-wk'), agg, tc.share, s, { onPick: pickWeek }));
  const rank = fx.chart($('monthchart'), lim, () => drawMonthChart($('monthchart'), agg));
  fx.count($('monthchart'), '.mval');
  $('claim-text').innerHTML = claimText(agg, rank, best);
  fx.chart($('dr-wind'), `${s.p}|${s.wk}|${s.w}`, () => fx.chart($('dr-wave'), `${s.p}|${s.wk}|${s.h}`,
    () => fx.chart($('dr-tide'), `${s.wk}|${s.yr}|${s.port}`, () => renderDrill($('drill'), s, ev))));
  widths($('dr-tests'), '.tb b');
  fx.count($('dr-tests'), 'em.num');
  fx.count($('dr-storms'), 'b.num');
  fx.count($('dr-fog'), 'b.num');
  fx.stagger($('dr-rows'), 'tr');
  fx.chart($('locator'), String(s.r), () => locator.update(s));
  const wkv = agg.week[s.wk], stt = $('status');
  stt.dataset.s = wkv >= 0.5 ? 'good' : wkv >= 0.2 ? 'warn' : 'bad';
  $('st-b').textContent = `${pct(wkv)} of days open a window`;
  fx.count($('status'), '#st-b');
  $('st-s').textContent = `Week of ${weekLabel(s.wk)} (${monthOf(s.wk)}), ${YEARS[0]} to ${YEARS[YEARS.length - 1]}. April ${pct(agg.month[3])}, October ${pct(agg.month[9])}; best 4 weeks from ${weekLabel(best.start).split(' to ')[0]}.`;
  writeHash();
}

const P = PROVENANCE;
$('prov').textContent = `Data built ${P.built} by scripts/build.py. Wind and waves: ${P.range[0]} to ${P.range[1]}, no missing days. ` +
  `Fog station-days reported: ${Object.entries(P.stations).map(([k, v]) => `${STATIONS[k].label.split(' (')[0]} ${v.daysReported.toLocaleString('en-US')}`).join(', ')}. ` +
  `IBTrACS storms within 1,500 km at tropical-storm strength: ${P.typhoon.storms}. Tide fit error (2026 holdout, RMS): ` +
  Object.entries(P.tides).map(([k, v]) => `${PORTS[k].label.split(',')[0]} ${Math.round(v.holdout2026RmseM * 100)} cm`).join(', ') + '.';

readHash();
render();
window.addEventListener('hashchange', () => { readHash(); render(); });
const tour = createTour(document.body, patch => { s = { ...DEFAULTS, ...patch }; render(); });
$('tour-btn').onclick = () => tour.start();
