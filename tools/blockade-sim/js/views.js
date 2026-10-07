// Gauges, timeline tabs and the Gantt chart of cable repairs.
import { el, fmt } from '../../../shared/js/mapkit.js';
import { lineChart, legend, dayTicks } from './charts.js';
import { BASE } from '../data/params.js';
import { PORTWATCH } from '../data/portwatch.js';
import { H } from './model.js';

const $ = id => document.getElementById(id);
const pc = v => Math.round(v * 100) + '%';
const prem = v => (v < 0.1 ? v.toFixed(3) : v.toFixed(2)) + '%';

export const GAUGES = [
  { k: 'lng', n: 'LNG', u: 'days left' }, { k: 'coal', n: 'Coal', u: 'days left' }, { k: 'oil', n: 'Oil', u: 'days left' },
  { k: 'grid', n: 'Power', u: 'of normal demand met' }, { k: 'calls', n: 'Port calls', u: 'a day' },
  { k: 'prem', n: 'War-risk premium', u: 'of hull value' }, { k: 'cables', n: 'Cables up', u: 'international' },
  { k: 'chips', n: 'Chip output', u: 'of normal' },
];

export function mountGauges() {
  $('gauges').innerHTML = GAUGES.map(g => `<figure class="gauge" data-k="${g.k}">
    <figcaption>${g.n}</figcaption><b class="num"></b><span class="u">${g.u}</span>
    <div class="bar" role="meter" aria-label="${g.n}" aria-valuemin="0" aria-valuemax="100"><i></i></div></figure>`).join('');
}

export function updateGauges(sim, day) {
  const d = sim.days[day];
  const set = (k, txt, frac, tone) => {
    const g = document.querySelector(`.gauge[data-k="${k}"]`);
    g.querySelector('b').textContent = txt;
    const f = Math.max(0, Math.min(1, frac));
    g.querySelector('i').style.width = (f * 100).toFixed(1) + '%';
    g.querySelector('.bar').setAttribute('aria-valuenow', Math.round(f * 100));
    g.dataset.tone = tone || (f < 0.25 ? 'bad' : f < 0.6 ? 'warn' : 'good');
  };
  ['lng', 'coal', 'oil'].forEach(k => {
    const s = d.stock[k], c = Math.max(0.01, sim.stock0[k]);
    set(k, s >= 0.5 ? Math.round(s) + ' d' : 'Empty', s / c);
  });
  set('grid', pc(d.grid), d.grid);
  set('calls', d.calls.toFixed(0), d.calls / BASE.callsDay);
  const pk = Math.max(sim.peakPrem, 0.01);
  set('prem', d.state === 'withdrawn' && !sim.cfg.fac ? 'No cover' : prem(d.prem), d.prem / Math.max(1, pk), d.prem > 0.3 ? 'bad' : d.prem > 0.1 ? 'warn' : 'good');
  set('cables', `${Math.round(d.cablesUp * sim.intlTotal)}/${sim.intlTotal}`, d.cablesUp);
  set('chips', pc(d.chips), d.chips);
}

const C = { lng: 'var(--c1)', coal: 'var(--c8)', oil: 'var(--c2)', grid: 'var(--c3)', a: 'var(--faint)' };

/** Draw the active tab. sim, ref (comparison sim or null), day, tab, onDay */
export function drawTab(tab, sim, ref, day, onDay) {
  const svg = $('chart'), D = sim.days, n = H;
  const band = [0, Math.min(sim.cfg.dur, n - 1)];
  const base = { n, day, onDay, band, xTicks: dayTicks(n), h: 230 };
  let items = [], note = '';
  const refS = (f, label) => (ref ? [{ v: ref.days.map(f), col: C.a, dash: true, label, w: 1.6 }] : []);
  if (tab === 'energy') {
    const s = ['lng', 'coal', 'oil'].map(k => ({ v: D.map(d => d.stock[k] / Math.max(0.01, sim.stock0[k])), col: C[k], label: k === 'lng' ? 'LNG stock' : k === 'coal' ? 'Coal stock' : 'Oil stock' }));
    s.push({ v: D.map(d => d.grid), col: C.grid, label: 'Power supply vs normal demand', w: 3 });
    const series = [...refS(d => d.grid, 'Pinned scenario: power'), ...s];
    lineChart(svg, { ...base, series, yMax: 1, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pc,
      marks: [[sim.ev.runout.lng, 'LNG out'], [sim.ev.gridHalf, 'Power < 50%']] });
    items = series;
    note = 'Stocks as a share of their starting level; power as a share of normal demand. Shaded: scenario active.';
  } else if (tab === 'ship') {
    const series = [...refS(d => d.arrive, 'Pinned scenario: arrivals'),
      { v: D.map(d => d.arrive), col: 'var(--c1)', label: 'Cargo reaching Taiwan', w: 3 },
      { v: D.map(d => 1 - d.avoid), col: 'var(--c5)', label: 'Owners still willing to sail' },
      { v: D.map(d => d.strait / BASE.straitDay), col: 'var(--c3)', label: 'Strait through-traffic' }];
    lineChart(svg, { ...base, series, yMax: 1, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pc });
    items = series;
    note = `Share of normal. Normal = ${BASE.callsDay.toFixed(0)} port calls and ${fmt(BASE.straitDay)} Strait transits a day (IMF PortWatch, ${PORTWATCH.window[0]} to ${PORTWATCH.window[1]}).`;
  } else if (tab === 'ins') {
    const top = Math.max(0.2, sim.peakPrem, ref ? ref.peakPrem : 0) * 1.15;
    const series = [...refS(d => d.prem, 'Pinned scenario'), { v: D.map(d => d.prem), col: 'var(--c4)', label: 'War-risk premium, % of hull value per voyage', w: 3 }];
    const ticks = [0, top / 4, top / 2, (3 * top) / 4].map(v => +v.toFixed(2));
    lineChart(svg, { ...base, series, yMax: top, yTicks: ticks, yFmt: v => v.toFixed(2) + '%',
      marks: [[sim.ev.listed, 'Listed'], [sim.ev.noCover, 'Cover cancelled']] });
    items = series;
    const usd = BASE.hullLng ? ` On a US$${BASE.hullLng}m LNG carrier, the peak is about US$${(sim.peakPrem / 100 * BASE.hullLng).toFixed(2)}m a voyage.` : '';
    note = 'Premium paths follow the Red Sea 2023-24 analogue (see Evidence).' + usd;
  } else if (tab === 'cables') {
    gantt(svg, sim, day, onDay, band);
    items = [{ col: 'var(--bad)', label: 'Out of service' }, { col: 'var(--c5)', label: 'Repair ship on its way' }, { col: 'var(--c1)', label: 'Repairing' }, { col: 'var(--good)', label: 'Repaired' }];
    note = sim.repairs.length ? `Repairs need a cable ship; this run assumes ${Math.round(sim.A.repairShips)} available, ${sim.A.mobilize} days to arrive and ${sim.A.repairWork} days a repair.` : 'No cables cut in this scenario. Pick landing areas under Cables.';
  } else {
    const series = [...refS(d => d.chips, 'Pinned scenario: chips'),
      { v: D.map(d => d.chips), col: 'var(--c6)', label: 'Chip output', w: 3 },
      { v: D.map(d => (d.icExp + d.otherExp) / (BASE.icExportDay + BASE.otherExportDay)), col: 'var(--c2)', label: 'Exports leaving Taiwan' }];
    lineChart(svg, { ...base, series, yMax: 1, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pc, marks: [[sim.ev.chipsDown, 'Fabs < 50%']] });
    items = series;
    note = `Exports normally run about US$${(BASE.icExportDay + BASE.otherExportDay).toFixed(2)}bn a day, US$${BASE.icExportDay.toFixed(2)}bn of it chips and other electronic components (Ministry of Finance, ${BASE.tradeYear}).`;
  }
  $('legend').innerHTML = legend(items);
  $('chart-note').textContent = note;
}

function gantt(svg, sim, day, onDay, band) {
  const rows = sim.repairs.length ? sim.repairs : [];
  const h = Math.max(120, 34 + rows.length * 20);
  lineChart(svg, { n: H, h, day, onDay, band, xTicks: dayTicks(H), series: [], yMax: 1, yTicks: [] });
  const W = +svg.getAttribute('viewBox').split(' ')[2];
  const x = i => 46 + (i / (H - 1)) * (W - 58);
  rows.forEach((r, i) => {
    const y = 16 + i * 20, done = Math.min(H - 1, r.done);
    const g = el('g', { class: 'gantt' }, svg);
    el('rect', { x: x(r.cut), y, width: Math.max(1, x(Math.min(H - 1, r.start - sim.A.mobilize)) - x(r.cut)), height: 12, class: 'g-down' }, g);
    el('rect', { x: x(Math.min(H - 1, r.start - sim.A.mobilize)), y, width: Math.max(0, x(Math.min(H - 1, r.start)) - x(Math.min(H - 1, r.start - sim.A.mobilize))), height: 12, class: 'g-sail' }, g);
    el('rect', { x: x(Math.min(H - 1, r.start)), y, width: Math.max(0, x(done) - x(Math.min(H - 1, r.start))), height: 12, class: 'g-work' }, g);
    if (r.done < H) el('rect', { x: x(done), y, width: Math.max(0, x(H - 1) - x(done)), height: 12, class: 'g-up' }, g);
    el('text', { x: 50, y: y + 9.5, class: 'g-lab' }, g, r.name.replace(/ Cable System| \(.*\)/g, ''));
  });
}
