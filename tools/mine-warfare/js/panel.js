// Panel markup and readouts.
import { ASSETS, LAYING, ASSAULT, GRID } from '../data/params.js';
import { PRESETS } from './model.js';

const N = '<span class="notional">notional</span>';
const slider = (id, label, min, max, step, help = '') => `<label class="slider"><span class="sl-h"><span>${label}</span><output id="${id}-out"></output></span>
  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">${help ? `<small>${help}</small>` : ''}</label>`;

export function panelHtml() {
  return `
  <div class="sec" aria-live="polite"><div class="status" id="status"></div><p class="fine" id="status-note"></p></div>
  <div class="sec">
    <p class="eyebrow"><span class="step roc">1</span> Taiwan lays the field</p>
    <div class="choices tools" id="tool" role="group" aria-label="Paint tool">
      <button type="button" data-v="1"><b>Moored contact</b><small>Floats on a cable</small></button>
      <button type="button" data-v="2"><b>Bottom influence</b><small>Sits on the seabed</small></button>
      <button type="button" data-v="0"><b>Erase</b><small>Remove a group</small></button>
    </div>
    <p class="fine">Click or drag on the grid to place mine groups. Each cell holds ${LAYING.minesPerGroup} mines ${N}.</p>
    <div class="choices" id="presets" role="group" aria-label="Minefield patterns">
      ${PRESETS.map(p => `<button type="button" data-k="${p.k}"><b>${p.t}</b><small>${p.s}</small></button>`).join('')}
    </div>
    <div class="choices two" id="ships" role="group" aria-label="Minelayers">
      ${LAYING.ships.map(s => `<button type="button" data-k="${s.k}"><b>${s.t}</b><small>${s.s}</small></button>`).join('')}
    </div>
    ${slider('sorties', 'Sorties before the assault', 1, 3, 1, 'More warning allows more sorties.')}
    <div class="budget"><div class="bar"><span id="budget-bar"></span></div><p class="fine" id="budget-t"></p></div>
    <button type="button" class="btn" id="clear-field">Clear the field</button>
  </div>
  <div class="sec">
    <p class="eyebrow"><span class="step prc">2</span> The PLA clears it</p>
    ${ASSETS.map(a => slider('as-' + a.k, `${a.t} <small class="muted">${a.s}</small>`, 0, a.max, 1)).join('')}
    ${slider('hours', 'Time available before the landing', 0, 168, 6)}
    <div class="choices two" id="strat" role="group" aria-label="Clearance strategy">
      <button type="button" data-k="lanes"><b>Clear lanes</b><small>Narrow Q-routes to the beach</small></button>
      <button type="button" data-k="area"><b>Clear the area</b><small>Search every cell</small></button>
    </div>
    <div id="lanes-wrap">${slider('lanes', 'Number of lanes', 1, 4, 1, 'Each lane is two cells, about 1 km, wide.')}</div>
    <label class="tg"><input type="checkbox" id="fires"><span class="sw"></span><span class="t">Taiwan's coastal fires cover the field<small>Slow, visible MCM units take losses every hour they work ${N}</small></span></label>
  </div>
`;
}

export function resultsHtml() {
  return `
  <div class="card res">
    <p class="eyebrow" id="res-h">Result</p>
    <dl class="readout" id="readout"></dl>
  </div>
  <div class="card res">
    <p class="eyebrow">Lanes or the whole area?</p>
    <div id="compare"></div>
    <p class="fine">Same field, same assets, same time. Every figure is ${N}.</p>
  </div>`;
}

const f1 = v => (Math.round(v * 10) / 10).toLocaleString('en-US');
export const hrs = h => h == null ? 'more than 60 days' : h < 48 ? `${Math.round(h)} h` : `${f1(h / 24)} days`;

export function statusOf(S, ev, base, groups) {
  if (!groups) return { s: 'good', b: 'No minefield', t: 'The landing craft sail straight in. Paint mines on the grid or pick a pattern.' };
  const total = ev.sim.order.length, pct = Math.round(ev.now.lost / ASSAULT.craft * 100);
  if (!Object.values(S.assets).some(Boolean)) return { s: 'bad', b: 'No clearance', t: `Going in blind costs about ${Math.round(base)} of ${ASSAULT.craft} landing craft.` };
  if (ev.n >= total) return { s: 'warn', b: `Search finished in ${hrs(ev.sim.finish)}`, t: `Missed mines still cost about ${f1(ev.now.lost)} craft (${pct}%) at hour ${S.hours}.` };
  const more = ev.sim.finish == null ? null : ev.sim.finish - S.hours;
  return { s: 'bad', b: `Only ${Math.round(ev.n / total * 100)}% searched by hour ${S.hours}`, t: more == null
    ? `At this rate the search never finishes. Going now costs about ${f1(ev.now.lost)} craft (${pct}%).`
    : `Finishing needs ${hrs(more)} more. Going now costs about ${f1(ev.now.lost)} craft (${pct}%).` };
}

export function readoutHtml(S, ev, base, groups) {
  const mines = groups * LAYING.minesPerGroup;
  const rows = [
    ['Mines in the water', `${mines.toLocaleString('en-US')} in ${groups} groups`],
    ['Cells to search', `${ev.sim.order.length} of ${GRID.cols * GRID.rows}${ev.sim.mix > 1 ? ' · mixed types, 1.5× effort' : ''}`],
    ['Searched by hour ' + S.hours, `${ev.n} cells`],
    ['Empty water searched', `${ev.empty} cells`],
    ['Mine groups neutralized', f1(ev.found)],
    [S.strat === 'lanes' ? 'Lanes fully searched' : 'Rows fully searched', S.strat === 'lanes' ? `${ev.lanesOpen} of ${S.lanes}` : `${ev.rowsClear} of ${GRID.rows}`],
    ['Search time needed', hrs(ev.sim.finish)],
    ['Assault frontage', `${f1(ev.frontKm)} km`],
    ['Craft lost, go at hour ' + S.hours, `${f1(ev.now.lost)} of ${ASSAULT.craft}`],
    ['Craft lost, wait to finish', ev.done ? `${f1(ev.done.lost)} of ${ASSAULT.craft}` : 'never finishes'],
    ['Craft lost with no clearance', `${f1(base)} of ${ASSAULT.craft}`],
  ];
  if (S.fires) rows.push(['MCM units lost by hour ' + S.hours, ev.mcmLost.filter(m => m.n > 0.05).map(m => `${f1(m.n)} ${m.t.replace('MCM ', '').replace('Mine-hunting ', '')}`).join(', ') || 'none']);
  return rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

export function compareHtml(S, L, A) {
  const cell = (ev, k) => ({
    searched: `${Math.round(ev.n / ev.sim.order.length * 100)}%`,
    need: hrs(ev.sim.finish),
    now: f1(ev.now.lost),
    done: ev.done ? f1(ev.done.lost) : '–',
    front: `${f1(ev.frontKm)} km`,
  })[k];
  const row = (t, k) => `<tr><td>${t}</td><td class="num">${cell(L, k)}</td><td class="num">${cell(A, k)}</td></tr>`;
  return `<table class="mini cmp"><thead><tr><th></th><th${S.strat === 'lanes' ? ' class="on"' : ''}>${S.lanes} lane${S.lanes > 1 ? 's' : ''}</th><th${S.strat === 'area' ? ' class="on"' : ''}>Whole area</th></tr></thead><tbody>
    ${row(`Searched by hour ${S.hours}`, 'searched')}${row('Search time needed', 'need')}${row(`Craft lost, go at hour ${S.hours}`, 'now')}${row('Craft lost, wait to finish', 'done')}${row('Assault frontage', 'front')}
  </tbody></table>`;
}
