// Editor for the model's notional parameters: approach length, attacker speed and, per category,
// the baseline, the diminishing-returns scale, the reach and the largest share engaged.
// Edits live in the URL hash only when they differ from the country's defaults.
import { ctx } from './ctx.js';

const FIELDS = [
  ['base', 'Baseline', 0, 0.9, 0.01, 'Capability already in hand, 0 to 1'],
  ['k', 'Scale', 0.01, 100000, 'any', 'Spending (bn) that closes about 63% of the remaining gap'],
  ['reach', 'Reach km', 0, 1000, 1, 'How far from the defended coast or line the layer shoots'],
  ['w', 'Max share', 0, 1, 0.05, 'Largest share of the attacking force the layer could engage'],
];
const shooting = c => c.w > 0 || c.reach > 0;
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Distance slider runs from a quarter to twice the country's default, on a 5 km grid that includes the default.
const kmMin = km => Math.max(5, km - 5 * Math.floor((km * 0.75) / 5));

export function readOver(q, P) {
  const over = { cats: {}, geo: {} };
  const d = +q.get('d'), v = +q.get('v');
  if (q.has('d') && Number.isFinite(d) && d > 0) over.geo.km = num(Math.round(d), 5, 2000);
  if (q.has('v') && Number.isFinite(v) && v > 0) over.geo.speed = num(v, 1, 100);
  (q.get('pc') || '').split('_').filter(Boolean).forEach(e => {
    const [id, ...vals] = e.split('~');
    if (!P.cats.some(c => c.id === id && c.id !== 'other')) return;
    const o = {};
    FIELDS.forEach(([f, , lo, hi], i) => { const x = parseFloat(vals[i]); if (vals[i] !== '' && vals[i] != null && Number.isFinite(x)) o[f] = num(x, lo, hi); });
    if (Object.keys(o).length) over.cats[id] = o;
  });
  return over;
}

export function writeOver(q, over) {
  if (over.geo.km != null) q.set('d', over.geo.km);
  if (over.geo.speed != null) q.set('v', over.geo.speed);
  const pc = Object.entries(over.cats).filter(([, o]) => Object.keys(o).length)
    .map(([id, o]) => [id, ...FIELDS.map(([f]) => (o[f] != null ? o[f] : ''))].join('~'));
  if (pc.length) q.set('pc', pc.join('_'));
}

export function mountParams(el, getOver, onChange) {
  const edit = fn => { const o = structuredClone(getOver()); fn(o); onChange(o); };
  const build = () => {
    const P = ctx.P, g = P.geo, unit = g.unit === 'kn' ? 'knots' : 'km/h';
    el.innerHTML = `<p class="fine">All of these are <span class="notional">notional</span>. Change any of them to test how much the result depends on it. Edits go into the link.</p>
      <div class="slider"><div class="sl-h"><label for="pg-km">${P.geoLabel || 'Approach length'}</label><output id="pg-km-out"></output></div>
        <input type="range" id="pg-km" min="${kmMin(g.km)}" max="${g.km * 2}" step="5"><small>Distance the attacking force covers under the defender's fires. Default ${g.km} km.</small></div>
      <div class="slider"><div class="sl-h"><label for="pg-v">Attacker speed</label><output id="pg-v-out"></output></div>
        <input type="range" id="pg-v" min="1" max="${Math.max(30, g.speed * 3)}" step="1"><small>Default ${g.speed} ${unit}.</small></div>
      <div class="tablewrap"><table class="ptab"><thead><tr><th>Category</th>${FIELDS.map(f => `<th title="${f[5]}">${f[1]}</th>`).join('')}</tr></thead><tbody>
      ${P.cats.filter(c => c.id !== 'other').map(c => `<tr><td><span class="sw8" style="background:var(${c.col})"></span> ${c.t}</td>${FIELDS.map(([f, lab, lo, hi, st]) =>
        (f === 'reach' || f === 'w') && !shooting(c) ? '<td class="fine">n/a</td>'
          : `<td><input type="number" data-c="${c.id}" data-f="${f}" min="${lo}" max="${hi}" step="${st}" aria-label="${c.t}: ${lab}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <button type="button" class="btn" id="pg-reset">Reset to defaults</button>`;
    el.dataset.k = P.k;
    const km = el.querySelector('#pg-km'), v = el.querySelector('#pg-v');
    km.oninput = () => edit(o => { if (+km.value === g.km) delete o.geo.km; else o.geo.km = +km.value; });
    v.oninput = () => edit(o => { if (+v.value === g.speed) delete o.geo.speed; else o.geo.speed = +v.value; });
    el.querySelectorAll('input[data-f]').forEach(i => i.onchange = () => edit(o => {
      const id = i.dataset.c, f = i.dataset.f, def = P.cats.find(c => c.id === id)[f], x = parseFloat(i.value);
      const F = FIELDS.find(z => z[0] === f);
      o.cats[id] = o.cats[id] || {};
      if (!Number.isFinite(x) || Math.abs(x - def) < 1e-9) delete o.cats[id][f]; else o.cats[id][f] = num(x, F[2], F[3]);
      if (!Object.keys(o.cats[id]).length) delete o.cats[id];
    }));
    el.querySelector('#pg-reset').onclick = () => onChange({ cats: {}, geo: {} });
  };
  const draw = () => {
    if (el.dataset.k !== ctx.P.k) build();
    const G = ctx.geo, unit = G.unit === 'kn' ? 'kn' : 'km/h';
    el.querySelector('#pg-km').value = G.km; el.querySelector('#pg-km-out').textContent = `${G.km} km`;
    el.querySelector('#pg-v').value = G.speed; el.querySelector('#pg-v-out').textContent = `${G.speed} ${unit}`;
    el.querySelectorAll('input[data-f]').forEach(i => {
      if (document.activeElement === i) return;
      i.value = ctx.cat[i.dataset.c][i.dataset.f];
      i.classList.toggle('edited', getOver().cats[i.dataset.c]?.[i.dataset.f] != null);
    });
  };
  return { build, draw };
}
