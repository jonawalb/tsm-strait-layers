// HTML builders for the control panel. Each builder returns markup; app.js wires events.
import { PLA, TAIWAN, BLUE_ROUTES, RED_ROUTES } from './layers.js';
import { BLUE_ACTIONS } from './modes/approach.js';
import { PLA_ACTIONS, TW_ACTIONS } from './modes/crossing.js';
import { SALVO_CONTROLS } from './modes/salvo.js';
import { PRESETS } from './modes/activity.js';

const STEPS = ['Find', 'Fix', 'Track', 'Target', 'Engage', 'Assess'];

export const GEO_TOGGLES = [
  { id: 'adiz', name: 'Taiwan ADIZ', col: '--geo', cls: 'dash' },
  { id: 'median', name: 'Median line', col: '--geo', cls: 'line' },
  { id: 'zones', name: '12 / 24 nm zones (approx.)', col: '--zone' },
  { id: 'fic', name: 'First Island Chain', col: '--fic', cls: 'line' },
  { id: 'bases', name: 'U.S., Japanese, Philippine sites', col: '--ally' },
];

export const MODE_LAYERS = {
  approach: PLA.map(l => l.id).concat('twascm'),
  crossing: TAIWAN.map(l => l.id).concat(['ascm', 'sam', 'srbm']),
  activity: [],
};

const sec = (title, body, extra = '') => `<section class="sec" ${extra}><h2 class="eyebrow">${title}</h2>${body}</section>`;
const chainList = () => `<ol class="chain" id="chain">${STEPS.map(s => `<li><span class="bar"></span><span class="nm">${s}</span></li>`).join('')}</ol>`;

const toggle = (id, t, s) => `<label class="tg"><input type="checkbox" id="${id}"><span class="sw" aria-hidden="true"></span><span class="t">${t}<small>${s}</small></span></label>`;

const routeButtons = routes => `<div class="routes" id="routes" role="group" aria-label="Route">${routes.map((r, i) =>
  `<button type="button" data-route="${i}" aria-pressed="false">${r.n}</button>`).join('')}</div>`;

const scrubber = () => `<div class="scrub"><button class="play" id="play" type="button" aria-label="Play route">Play</button>
  <input id="progress" type="range" min="0" max="1000" value="0" aria-label="Progress along route"></div>`;

const slider = (id, t, min, max, step, note = '') => `<label class="slider" for="${id}"><span class="sl-h"><span>${t}</span><output id="${id}-out"></output></span>
  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">${note ? `<small>${note}</small>` : ''}</label>`;

export function layerList(mode, show) {
  const ids = MODE_LAYERS[mode === 'salvo' ? 'approach' : mode];
  const all = [...PLA, ...TAIWAN];
  const groups = {};
  ids.forEach(id => { const l = all.find(x => x.id === id); (groups[l.group] = groups[l.group] || []).push(l); });
  const row = (id, name, col, cls, rng = '') => `<label class="lrow"><input type="checkbox" id="lyr-${id}" ${show[id] ? 'checked' : ''}>
    <span class="swatch ${cls || ''}" style="color:var(${col})"></span><span>${name}</span><span class="rng">${rng}</span></label>`;
  let html = Object.entries(groups).map(([g, ls]) => `<div class="lgroup"><h3>${g}</h3>${ls.map(l =>
    row(l.id, l.name, l.col, l.role === 'sensor' ? 'dash' : '', l.rng)).join('')}</div>`).join('');
  if (mode === 'activity') {
    html += `<div class="lgroup"><h3>TSM data</h3>${row('ccg', 'CCG incursions by location', '--ccg', 'dot')}${row('transitline', 'Allied Strait transits', '--blue', 'line')}</div>`;
  }
  html += `<div class="lgroup"><h3>Geography</h3>${GEO_TOGGLES.map(t => row(t.id, t.name, t.col, t.cls)).join('')}</div>`;
  return html + '<p class="fine">* notional round number. Layer toggles change what is drawn; actions change what works.</p>';
}

export function panelApproach() {
  return sec('Scenario', routeButtons(BLUE_ROUTES) + scrubber() + '<dl class="readout" id="readout"></dl>')
    + sec('Threat at this position', '<div class="status" id="status" aria-live="polite"></div><ul class="notes" id="notes"></ul>')
    + sec('PLA kill chain · F2T2EA', chainList() + '<p class="why" id="why"></p><div id="flight"></div>')
    + sec('Blue actions · break a link', `<div class="toggles">${BLUE_ACTIONS.map(a => toggle('cm-' + a.k, a.t, a.s)).join('')}</div>`)
    + sec('Layers', '<div class="layers" id="layers"></div>');
}

export function panelCrossing() {
  return sec('Crossing', routeButtons(RED_ROUTES) + scrubber()
      + slider('speed', 'Transit speed', 6, 20, 1, 'Amphibious groups move at the pace of the slowest ship.') + '<div id="exposure"></div>')
    + sec('Threat to the PLA group', '<div class="status" id="status" aria-live="polite"></div><ul class="notes" id="notes"></ul>')
    + sec("Taiwan's kill chain", chainList() + '<p class="why" id="why"></p>')
    + sec('PLA actions', `<div class="toggles">${PLA_ACTIONS.map(a => toggle('rc-' + a.k, a.t, a.s)).join('')}</div>`
      + slider('supp', 'Launchers destroyed by suppression', 0, 0.9, 0.05))
    + sec('Taiwan actions', `<div class="toggles">${TW_ACTIONS.map(a => toggle('rc-' + a.k, a.t, a.s)).join('')}</div>`)
    + sec('Layers', '<div class="layers" id="layers"></div>');
}

export function panelSalvo() {
  const sizes = [['ascm', 'Coastal anti-ship missiles', 60], ['df21', 'DF-21D', 24], ['df26', 'DF-26', 24]];
  return sec('Who can shoot', '<div class="status" id="status" aria-live="polite"></div><p class="fine">The group sits where you left it on the Approach tab. Drag it on the map to change what can fire.</p>')
    + sec('Salvo outcome', '<div id="salvo" aria-live="polite"></div>')
    + sec('Defense', SALVO_CONTROLS.map(c => slider('sv-' + c.k, c.t, c.min, c.max, c.step)).join(''))
    + sec('Missiles per salvo', sizes.map(([k, t, max]) => slider('sn-' + k, t, 0, max, 1)).join('')
      + '<p class="fine">All figures notional. The model is a simplified Hughes salvo exchange: expected values, no timing, no reloads.</p>')
    + sec('Layers', '<div class="layers" id="layers"></div>');
}

export function panelActivity(asOf) {
  return sec('Window', `<div class="presets" id="presets">${PRESETS.map(p => `<button type="button" data-preset="${p.k}">${p.t}</button>`).join('')}</div>
      <p class="fine">Or drag across the timeline under the map. Data through ${asOf}.</p><div id="stats"></div>`)
    + sec('Layers', '<div class="layers" id="layers"></div>');
}
