// Panel controls: build once, then sync from state on every update.
import { SYSTEMS, INV_PRESETS, SUPPLY } from '../data/inventory.js';
import { THREATS, SALVOS, DOCTRINES } from '../data/threats.js';

const $ = id => document.getElementById(id);
const NOT = '<span class="notional">notional</span>';
const pctf = v => Math.round(v * 100) + '%';
const slider = (id, label, min, max, step, extra = '') =>
  `<div class="slider"><div class="sl-h"><label for="${id}">${label}${extra}</label><output id="${id}-out"></output></div>
   <input type="range" id="${id}" min="${min}" max="${max}" step="${step}"></div>`;
const choice = (k, n, s) => `<button type="button" data-k="${k}"><b>${n}</b><br><small>${s}</small></button>`;

export const DRONE_POL = [
  { k: 'none', n: 'Never', s: 'Guns, jamming and fighters only' },
  { k: 'cheap', n: 'Cheaper SAMs', s: 'Tien Kung II and NASAMS only' },
  { k: 'all', n: 'Any interceptor', s: 'Anything with stock left' },
];

export function mountControls(S, update) {
  $('salvo-choices').innerHTML = SALVOS.map(p => choice(p.k, p.n, p.s)).join('');
  $('salvo-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.salvo = { ...SALVOS.find(p => p.k === b.dataset.k).v }; update(); });
  $('salvo-sliders').innerHTML = THREATS.map(t => slider('sv-' + t.k, `${t.long} a day`, 0, t.max, t.k === 'd' ? 10 : 1, t.k === 'd' ? ' ' + NOT : '')).join('') +
    slider('surge', 'Opening surge, days 1 to 3', 1, 3, 0.25, ' ' + NOT);
  THREATS.forEach(t => { $('sv-' + t.k).oninput = e => { S.salvo[t.k] = +e.target.value; update(); }; });
  $('surge').oninput = e => { S.surge = +e.target.value; update(); };
  $('cap').onchange = e => { S.cap = e.target.checked; update(); };

  $('inv-choices').innerHTML = INV_PRESETS.map(p => choice(p.k, p.n, p.s)).join('');
  $('inv-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.inv = { ...INV_PRESETS.find(p => p.k === b.dataset.k).v }; update(); });
  $('inv-sliders').innerHTML = SYSTEMS.map(s => slider('iv-' + s.k, `<i class="key" style="background:${s.col}"></i>${s.n}`, 0, s.max, 1)).join('');
  SYSTEMS.forEach(s => { $('iv-' + s.k).oninput = e => { S.inv[s.k] = +e.target.value; update(); }; });
  $('avail-box').innerHTML = slider('avail', 'Share of stock in position and able to fire', 0.3, 1, 0.05, ' ' + NOT);
  $('avail').oninput = e => { S.avail = +e.target.value; update(); };

  $('rules').innerHTML = THREATS.map(t => `<div class="rule">
      <p class="rule-h"><i class="key" style="background:${t.col}"></i>${t.n}</p>
      <div class="seg" role="group" aria-label="Firing doctrine against ${t.long.toLowerCase()}">
        ${DOCTRINES.map(d => `<button type="button" data-c="${t.k}" data-k="${d.k}" title="${d.s}">${d.n}</button>`).join('')}
      </div>
      <p class="fine doc-note" id="dn-${t.k}"></p>
      ${slider('pk-' + t.k, 'Kill chance per interceptor', 0.2, 0.95, 0.05)}
    </div>`).join('');
  $('rules').querySelectorAll('.seg button').forEach(b => b.onclick = () => { S.doc[b.dataset.c] = b.dataset.k; update(); });
  THREATS.forEach(t => { $('pk-' + t.k).oninput = e => { S.pk[t.k] = +e.target.value; update(); }; });
  $('drone-choices').innerHTML = DRONE_POL.map(p => choice(p.k, p.n, p.s)).join('');
  $('drone-choices').querySelectorAll('button').forEach(b => b.onclick = () => { S.dronePol = b.dataset.k; update(); });
  $('nk-box').innerHTML = slider('nk', 'Drones stopped by guns, jamming and fighters', 0, 0.9, 0.05, ' ' + NOT);
  $('nk').oninput = e => { S.nk = +e.target.value; update(); };
  $('savepac').onchange = e => { S.savePac = e.target.checked; update(); };

  $('supply-box').innerHTML = slider('prod', 'Tien Kung III built, per year', 0, 192, 12) +
    `<p class="fine">Peacetime capacity is ${SUPPLY.tk3PerYear} a year (Taipei Times). Whether production continues under attack is ${NOT}.</p>` +
    slider('us', 'PAC-3 MSE arriving from the U.S., per week', 0, 40, 1, ' ' + NOT) +
    `<p class="fine">No public source gives a wartime delivery rate. A blockade could make it zero.</p>`;
  $('prod').oninput = e => { S.prod = +e.target.value; update(); };
  $('us').oninput = e => { S.us = +e.target.value; update(); };
}

export function syncControls(S) {
  const salvo = SALVOS.find(p => THREATS.every(t => p.v[t.k] === S.salvo[t.k]));
  $('salvo-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', !!salvo && b.dataset.k === salvo.k));
  $('salvo-note').innerHTML = salvo ? salvo.note : 'Custom salvo. Every figure here is your own assumption.';
  THREATS.forEach(t => { $('sv-' + t.k).value = S.salvo[t.k]; $(`sv-${t.k}-out`).textContent = Math.round(S.salvo[t.k]); });
  $('surge').value = S.surge; $('surge-out').textContent = S.surge === 1 ? 'none' : `×${S.surge}`;
  $('cap').checked = S.cap;

  const inv = INV_PRESETS.find(p => SYSTEMS.every(s => p.v[s.k] === S.inv[s.k]));
  $('inv-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', !!inv && b.dataset.k === inv.k));
  $('inv-note').textContent = inv ? inv.note : 'Custom inventory.';
  SYSTEMS.forEach(s => { $('iv-' + s.k).value = S.inv[s.k]; $(`iv-${s.k}-out`).textContent = S.inv[s.k]; });
  $('avail').value = S.avail; $('avail-out').textContent = pctf(S.avail);

  $('rules').querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', S.doc[b.dataset.c] === b.dataset.k));
  THREATS.forEach(t => { const d = DOCTRINES.find(x => x.k === S.doc[t.k]); $('dn-' + t.k).textContent = d ? `${d.n}: ${d.s.toLowerCase()}.` : ''; });
  THREATS.forEach(t => { $('pk-' + t.k).value = S.pk[t.k]; $(`pk-${t.k}-out`).textContent = pctf(S.pk[t.k]); });
  $('drone-choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === S.dronePol));
  $('nk').value = S.nk; $('nk-out').textContent = pctf(S.nk);
  $('savepac').checked = S.savePac;
  $('prod').value = S.prod; $('prod-out').textContent = S.prod;
  $('us').value = S.us; $('us-out').textContent = S.us;
}
