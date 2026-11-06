// Setup panel markup: ROC posture menu, PLA plan, game length and the assumptions editor.
import { MENU, TOGGLES, MINE_COST, BUDGET, SECTORS, VERTICAL, PROB } from '../data/params.js';
import { SOURCES } from '../data/sources.js';

export const NOTIONAL = '<span class="notional">notional</span>';
const srcTag = k => k ? `<a class="pill src-pill" href="#src-${k}" title="${SOURCES[k].t.replace(/"/g, '&quot;')}">source</a>` : NOTIONAL;

const slider = (id, label, min, max, step, help = '') => `<label class="slider"><span class="sl-h"><span>${label}</span><output id="${id}-out"></output></span>
  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">${help ? `<small>${help}</small>` : ''}</label>`;

export function panelHtml() {
  return `
  <div class="sec" aria-live="polite"><div class="status" id="status"></div><p class="fine" id="status-note"></p></div>
  <div class="sec">
    <p class="eyebrow"><span class="step roc">1</span> Taiwan sets the defense</p>
    <div class="budget"><div class="bar"><span id="budget-bar"></span></div><p class="fine" id="budget-t"></p></div>
    <div class="menu" id="menu">
      ${MENU.map(m => `<div class="stepper" data-k="${m.k}">
        <div class="st-t"><b>${m.t}</b><small>${m.s} · ${m.cost} pts ${m.src ? srcTag(m.src) : NOTIONAL}</small></div>
        <div class="st-c"><button type="button" class="st-b" data-d="-1" aria-label="Fewer ${m.t.toLowerCase()}">−</button>
        <output class="num" id="n-${m.k}">0</output>
        <button type="button" class="st-b" data-d="1" aria-label="More ${m.t.toLowerCase()}">+</button></div></div>`).join('')}
    </div>
    <div class="mines"><p class="lbl"><b>Coastal mines</b> <small>${MINE_COST} pts per sector ${NOTIONAL}</small></p>
      <div class="choices three" id="mines" role="group" aria-label="Mined sectors">
        ${Object.entries(SECTORS).map(([k, s]) => `<button type="button" data-k="${k}"><b>${s.t}</b></button>`).join('')}
      </div></div>
    ${TOGGLES.map(t => `<label class="tg"><input type="checkbox" id="tg-${t.k}"><span class="sw"></span><span class="t">${t.t}<small>${t.s} · ${t.cost} pts ${t.src ? srcTag(t.src) : NOTIONAL}</small></span></label>`).join('')}
    <p class="fine">Garrison of about 6,000 troops is included free ${srcTag('ttEditorial')}. The ${BUDGET}-point budget and item costs are ${NOTIONAL}.</p>
  </div>
  <div class="sec">
    <p class="eyebrow"><span class="step prc">2</span> The PLA picks a plan</p>
    <div class="choices two" id="plan" role="group" aria-label="PLA plan">
      <button type="button" data-k="assault"><b>Seize by assault</b><small>Strikes, then a landing</small></button>
      <button type="button" data-k="blockade"><b>Blockade and starve</b><small>Cut supply; wait</small></button>
    </div>
    <div id="assault-opts" class="sub">
      ${slider('strikes', 'Preparatory strike turns', 0, 3, 1, 'Each turn of strikes wears down defenses and sweeps mines, and gives Taiwan warning.')}
      <p class="lbl"><b>Landing sector</b> <small>Broad notional sectors. Click one on the map too.</small></p>
      <div class="choices three" id="sector" role="group" aria-label="Landing sector">
        ${Object.entries(SECTORS).map(([k, s]) => `<button type="button" data-k="${k}"><b>${s.t}</b><small>${s.s}</small></button>`).join('')}
      </div>
      ${slider('lift', 'Landing groups per wave', 2, 6, 1, `About 1,000 troops each ${NOTIONAL}. Ships lost are not replaced.`)}
      <div class="choices two" id="vertical" role="group" aria-label="Vertical assault">
        ${Object.entries(VERTICAL).map(([k, v]) => `<button type="button" data-k="${k}"><b>${v.t}</b><small>${v.s}</small></button>`).join('')}
      </div>
      <label class="tg"><input type="checkbox" id="tg-offload"><span class="sw"></span><span class="t">Falklands-style offload<small>30% less lift, a CSIS excursion case ${srcTag('csis')}</small></span></label>
    </div>
  </div>
  <div class="sec">
    <p class="eyebrow"><span class="step">3</span> Game</p>
    ${slider('turns', 'Turns', 5, 8, 1)}
    <p class="fine" id="turn-note"></p>
    <div class="seedrow"><span class="fine">Dice seed <b class="num" id="seed-t"></b></span><button type="button" class="btn" id="reseed">New dice</button></div>
  </div>
  <div class="sec">
    <details id="assume"><summary><b>Edit the assumptions</b> <small class="muted" id="assume-n"></small></summary>
      <p class="fine">Every probability and rate in the model. Values marked ${NOTIONAL} are TSM assumptions that no open source gives; change them and every readout updates.</p>
      <div id="assume-body"></div>
      <button type="button" class="btn" id="assume-reset">Reset all to defaults</button>
    </details>
  </div>`;
}

export function assumptionsHtml(P) {
  const groups = [...new Set(PROB.map(p => p.g))];
  return groups.map(g => `<fieldset class="as-g"><legend>${g}</legend>
    ${PROB.filter(p => p.g === g).map(p => `<label class="as-row${P[p.k] !== p.v ? ' changed' : ''}">
      <span class="as-t">${p.t} ${p.src ? srcTag(p.src) : NOTIONAL}${p.note ? `<small>${p.note}</small>` : ''}</span>
      <span class="as-i"><input type="number" data-k="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.k]}" aria-label="${p.t}"><small>${p.u}</small></span>
    </label>`).join('')}</fieldset>`).join('');
}

/** Budget spent by a posture. */
export function spent(roc) {
  let n = MENU.reduce((a, m) => a + m.cost * roc[m.k], 0);
  n += MINE_COST * Object.values(roc.mines).filter(Boolean).length;
  for (const t of TOGGLES) if (roc[t.k]) n += t.cost;
  return n;
}
