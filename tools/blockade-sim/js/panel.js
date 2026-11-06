// Scenario controls and the assumptions drawer.
import { ASSUME, SOURCES } from '../data/params.js';
import { PRESETS, AREAS } from './state.js';
import { escapeHtml } from '../../../shared/js/mapkit.js';

const $ = id => document.getElementById(id);
const CH = {
  mode: [['q', 'Quarantine', 'Coast guard and customs board and inspect'], ['b', 'Blockade', 'Navy turns ships away under threat of force']],
  esc: [['none', 'No escorts', ''], ['tw', 'Taiwan escorts', 'Navy and coast guard'], ['allied', 'Allied convoys', 'U.S. and partner navies']],
  ins: [['hold', 'Market holds', 'No listing; small premium rise'], ['listed', 'Area listed', 'War-risk listing, additional premium'], ['withdrawn', 'Cover withdrawn', 'Cancelled after notice']],
  rep: [['peace', 'Peacetime access', 'Repair ships come as normal'], ['after', 'After it lifts', 'No repair inside the zone'], ['escorted', 'Escorted repair', 'Repair ships sail under escort']],
  stk: [['reported', 'Reported stocks', 'Latest public figures'], ['statutory', 'Legal minimum', 'What the rules require'], ['y2027', 'Larger stocks', '2027 LNG rule']],
  pol: [['normal', 'Burn as usual', 'Share shortfalls evenly'], ['conserve', 'Conserve', 'Homes and shops cut 10%'], ['ration', 'Ration early', 'Idle heavy industry, protect fabs']],
};

let cfg, over, onChange;

function choices(box, key, opts) {
  box.innerHTML = opts.map(([v, n, s]) => `<button type="button" data-v="${v}" aria-pressed="false">${n}${s ? `<small>${s}</small>` : ''}</button>`).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cfg[key] = b.dataset.v; fire();
  });
}

function fire() { onChange(cfg, over); }

export function mountPanel(initCfg, initOver, cb) {
  cfg = initCfg; over = initOver; onChange = cb;
  $('presets').innerHTML = PRESETS.map(p => `<button type="button" data-k="${p.k}" aria-pressed="false">${p.n}<small>${p.s}</small></button>`).join('');
  $('presets').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = PRESETS.find(x => x.k === b.dataset.k);
    Object.assign(cfg, structuredClone(p.v)); fire();
  });
  Object.entries(CH).forEach(([k, opts]) => choices($('ch-' + k), k, opts));
  [['sev', v => v + '%'], ['dur', v => v + ' days'], ['floor', v => v ? v + ' days held back' : 'none']].forEach(([k]) => {
    $(k).addEventListener('input', e => { cfg[k] = Number(e.target.value); fire(); });
  });
  ['fac', 'air'].forEach(k => $(k).addEventListener('change', e => { cfg[k] = e.target.checked; fire(); }));
  $('areas').innerHTML = AREAS.map(a => `<label class="tg"><input type="checkbox" data-a="${a.k}"><span class="sw"></span><span class="t">${a.n}<small>${a.s}</small></span></label>`).join('');
  $('areas').addEventListener('change', e => {
    const a = e.target.dataset.a; if (!a) return;
    cfg.cab = e.target.checked ? [...new Set([...cfg.cab, a])] : cfg.cab.filter(x => x !== a); fire();
  });
  mountAssumptions();
}

function mountAssumptions() {
  const groups = [...new Set(ASSUME.map(a => a.g))];
  $('assume').innerHTML = groups.map(g => `<h4>${g}</h4>` + ASSUME.filter(a => a.g === g).map(a => {
    const src = a.src ? SOURCES[a.src] : null;
    return `<div class="slider as" data-k="${a.k}">
      <div class="sl-h"><label for="as-${a.k}">${a.t} ${a.notional ? '<span class="notional">assumption</span>' : '<span class="pill sourced">sourced</span>'}</label><output id="as-${a.k}-o"></output></div>
      <input type="range" id="as-${a.k}" min="${a.min}" max="${a.max}" step="${a.step}">
      <small>${a.note ? escapeHtml(a.note) + ' ' : ''}${src ? `Source: <a href="${src.u}" target="_blank" rel="noopener">${escapeHtml(src.short || src.t)}</a>.` : ''}</small>
    </div>`;
  }).join('')).join('');
  ASSUME.forEach(a => {
    $('as-' + a.k).addEventListener('input', e => {
      const v = Number(e.target.value);
      if (v === a.v) delete over[a.k]; else over[a.k] = v;
      fire();
    });
  });
  $('as-reset').addEventListener('click', () => { Object.keys(over).forEach(k => delete over[k]); fire(); });
}

const fmtA = (a, v) => (a.fmt ? a.fmt(v) : `${v}${a.u ? ' ' + a.u : ''}`);

/** Reflect the scenario in every control. */
export function syncPanel(c, o) {
  cfg = c; over = o;
  document.querySelectorAll('#presets button').forEach(b => {
    const p = PRESETS.find(x => x.k === b.dataset.k);
    b.setAttribute('aria-pressed', String(Object.entries(p.v).every(([k, v]) => JSON.stringify(v) === JSON.stringify(Array.isArray(v) ? [...c[k]].sort((a, b) => AREAS.findIndex(x => x.k === a) - AREAS.findIndex(x => x.k === b)) : c[k]))));
  });
  Object.keys(CH).forEach(k => $('ch-' + k).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === c[k]))));
  $('sev').value = c.sev; $('sev-o').textContent = c.sev + '%';
  $('sev-l').textContent = c.mode === 'q' ? 'Taiwan-bound ships boarded' : 'Taiwan-bound ships turned away';
  $('dur').value = c.dur; $('dur-o').textContent = c.dur + ' days';
  $('floor').value = c.floor; $('floor-o').textContent = c.floor ? c.floor + ' days' : 'none';
  $('fac').checked = c.fac; $('air').checked = c.air;
  document.querySelectorAll('#areas input').forEach(i => { i.checked = c.cab.includes(i.dataset.a); });
  ASSUME.forEach(a => {
    const v = o[a.k] ?? a.v;
    $('as-' + a.k).value = v;
    $('as-' + a.k + '-o').textContent = fmtA(a, v);
    $('as-' + a.k).closest('.as').classList.toggle('changed', a.k in o);
  });
  $('as-count').textContent = Object.keys(o).length ? `${Object.keys(o).length} changed` : 'all at default';
}
