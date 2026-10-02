// Side panel: scenario controls, chain status, adversary strikes, and the node inspector.
import { fmt, escapeHtml, listText } from '../../../shared/js/mapkit.js';
import { TYPES, TARGETS, FIX_SIGMA } from '../data/catalog.js';
import { PRESETS } from '../data/presets.js';
import { STEPS, distOf } from './model.js';
import { inspectorHtml, bindInspector } from './inspector.js';

const f1 = x => (Math.round(x * 10) / 10).toLocaleString('en-US');
const N = '<span class="notional">notional</span>';

export function createPanel(root, api) {
  const { S } = api;
  root.innerHTML = `
  <div class="sec">
    <p class="eyebrow">Preset chains</p>
    <div class="choices" id="kc-presets">${Object.entries(PRESETS).map(([k, p]) =>
      `<button type="button" data-p="${k}" title="${escapeHtml(p.blurb)}">${p.name}</button>`).join('')}
      <button type="button" data-p="blank">Blank board</button></div>
    <div class="btnrow kc-reset">
      <button type="button" class="btn" id="kc-reset" aria-expanded="false" aria-controls="kc-reset-opts">Reset all</button>
      <span id="kc-reset-opts" hidden>
        <button type="button" class="btn" id="kc-reset-start"></button>
        <button type="button" class="btn" id="kc-reset-blank">Clear to a blank board</button>
        <button type="button" class="btn" id="kc-reset-no">Cancel</button>
      </span>
    </div>
  </div>
  <div class="sec">
    <p class="eyebrow">Target</p>
    <div class="choices three" id="kc-targets">${Object.entries(TARGETS).map(([k, t]) =>
      `<button type="button" data-t="${k}">${t.name}</button>`).join('')}</div>
    <p class="fine" id="kc-tnote"></p>
    <label class="slider"><span class="sl-h"><span>Target distance from home coast ${N}</span><output id="kc-d-o"></output></span>
      <input type="range" id="kc-d" min="20" max="3000" step="10"></label>
    <label class="slider"><span class="sl-h"><span>Target speed ${N}</span><output id="kc-kt-o"></output></span>
      <input type="range" id="kc-kt" min="0" max="40" step="1"></label>
    <label class="tg"><input type="checkbox" id="kc-emcon"><span class="sw"></span><span class="t">Target goes silent (EMCON)<small>Cuts its radio and radar emissions to a trace.</small></span></label>
  </div>
  <div class="sec" aria-live="polite">
    <p class="eyebrow">Kill chain · F2T2EA</p>
    <div class="status" id="kc-status"><b></b><span></span></div>
    <ol class="chain" id="kc-chain">${STEPS.map(s => `<li><span class="bar"></span><span class="nm">${s}</span></li>`).join('')}</ol>
    <p class="why" id="kc-why"></p>
    <dl class="readout" id="kc-read"></dl>
  </div>
  <div class="sec">
    <p class="eyebrow">Adversary attacks</p>
    <div class="btnrow">
      <button type="button" class="btn" data-strike="1">Strike 1 random node</button>
      <button type="button" class="btn" data-strike="2">Strike 2</button>
      <button type="button" class="btn" id="kc-choose" aria-pressed="false">Pick targets</button>
      <button type="button" class="btn" id="kc-restore">Restore all</button>
    </div>
    <p class="fine" id="kc-strike"></p>
  </div>
  <div class="sec" id="kc-insp"></div>`;

  const $ = s => root.querySelector(s);
  root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => api.loadPreset(b.dataset.p));
  root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const t = TARGETS[b.dataset.t];
    Object.assign(S.sc, { target: b.dataset.t, kt: t.kt, D: t.D });
    api.update();
  });
  $('#kc-d').oninput = e => { S.sc.D = +e.target.value; api.update(); };
  $('#kc-kt').oninput = e => { S.sc.kt = +e.target.value; api.update(); };
  $('#kc-emcon').onchange = e => { S.sc.emcon = e.target.checked; api.update(); };
  root.querySelectorAll('[data-strike]').forEach(b => b.onclick = () => api.strike(+b.dataset.strike));
  $('#kc-choose').onclick = () => { S.choose = !S.choose; api.update(); };
  $('#kc-restore').onclick = () => api.restore();
  const resetOpen = open => {
    $('#kc-reset-opts').hidden = !open; $('#kc-reset').setAttribute('aria-expanded', open);
    if (open) { $('#kc-reset-start').textContent = `Back to start: ${api.startName()}`; $('#kc-reset-start').focus(); }
  };
  $('#kc-reset').onclick = () => resetOpen($('#kc-reset-opts').hidden);
  $('#kc-reset-start').onclick = () => { resetOpen(false); api.resetAll(false); };
  $('#kc-reset-blank').onclick = () => { resetOpen(false); api.resetAll(true); };
  $('#kc-reset-no').onclick = () => resetOpen(false);
  let inspKey = '';

  function render(r, spof, r0) {
    const sc = S.sc, tgt = TARGETS[sc.target];
    root.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === S.preset));
    root.querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === sc.target));
    $('#kc-tnote').textContent = tgt.note + (Number.isFinite(tgt.dwell) ? ` It stays located for about ${tgt.dwell} minutes (notional).` : '');
    $('#kc-d').value = sc.D; $('#kc-d-o').textContent = `${fmt(sc.D)} km`;
    $('#kc-kt').value = sc.kt; $('#kc-kt-o').textContent = `${sc.kt} kt · ${fmt(sc.kt * 1.852)} km/h`;
    $('#kc-emcon').checked = sc.emcon;

    const st = statusOf(r, api);
    const box = $('#kc-status');
    box.dataset.s = st.s; box.querySelector('b').textContent = st.b; box.querySelector('span').textContent = st.t;
    [...$('#kc-chain').children].forEach((li, i) => li.dataset.s = r.steps[i] ? 'ok' : 'off');
    $('#kc-why').innerHTML = whyText(r, api);
    const best = r.best;
    const rows = [
      ['Closing paths', `${r.closing.length} of ${r.evals.length}${r.truncated ? '+' : ''}`],
      ['Independent paths', `${r.disjoint}`],
      ['Single points of failure', spof.length ? escapeHtml(listText(spof.map(api.label))) : (r.closing.length ? 'none' : '–')],
    ];
    if (best) {
      rows.push(['Best path', escapeHtml(best.p.map(api.label).join(' → '))]);
      rows.push(['Appearance to impact', `${f1(best.total)} min`]);
      rows.push(['Error at impact', `${f1(best.err)} km vs ${best.basket} km basket`]);
    }
    $('#kc-read').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    $('#kc-choose').setAttribute('aria-pressed', S.choose);
    $('#kc-restore').disabled = !S.dead.size;
    const strikeEl = $('#kc-strike');
    if (S.dead.size) {
      const lost = [...S.dead].map(api.label);
      strikeEl.innerHTML = `Knocked out: <b>${escapeHtml(listText(lost))}</b>. Closing paths ${r0.closing.length} → <b>${r.closing.length}</b>; independent paths ${r0.disjoint} → <b>${r.disjoint}</b>. ${r.closing.length ? 'The chain survives.' : r0.closing.length ? '<b>The chain is broken.</b>' : ''}`;
    } else strikeEl.textContent = S.choose ? 'Click or press Enter on any node to knock it out. Click again to restore it.' : 'Strike nodes to see how much damage the chain can absorb.';

    const sel = S.nodes.find(n => n.id === S.sel);
    const key = [S.sc.D, S.sel, sel && sel.v, S.nodes.map(n => n.id).join(','), S.links.join(';'), [...S.dead].join(','), api.msg || ''].join('|');
    if (key !== inspKey) {
      inspKey = key;
      $('#kc-insp').innerHTML = inspectorHtml(S, sel, api);
      bindInspector($('#kc-insp'), S, sel, api);
    }
    const dOut = $('#kc-insp .dist-o');
    if (sel && dOut) dOut.textContent = `${fmt(distOf(sel, sc))} km`;
  }
  return { render };
}

function statusOf(r, api) {
  if (!r.evals.length && !r.seeing.length) return { s: 'warn', b: 'No chain yet', t: 'Nothing on the board can see the target and reach a shooter.' };
  const b = r.best;
  if (b && b.closes) return { s: 'bad', b: `Chain closes · ${r.disjoint} independent path${r.disjoint === 1 ? '' : 's'}`,
    t: `${api.label(b.shooter)} hits about ${Math.round(b.total)} minutes after the target appears.` };
  if (!b) return { s: 'good', b: r.seeing.length ? 'No path to a shooter' : 'Chain breaks at Find',
    t: r.seeing.length ? 'Sensors see the target, but no live link runs from a sensor to a shooter.' : 'No live sensor can see the target.' };
  return { s: 'good', b: `Chain breaks at ${STEPS[b.progress]}`, t: 'No path from a sensor to a shooter closes every step.' };
}

function whyText(r, api) {
  const L = api.label, b = r.best;
  if (!r.seeing.length && !(b && b.progress)) return '<b>No sensor can see the target.</b> It is out of reach of every live sensor, or its signature is too small on the channels they use. Every link after Find fails.';
  if (!b) return `<b>Found by ${escapeHtml(listText(r.seeing.map(L)))}</b>, but no sensor is linked through command to a shooter.`;
  const s = TYPES[api.node(b.sensor).type], w = TYPES[api.node(b.shooter).type];
  if (b.progress === 0) return `<b>${L(b.sensor)} cannot see the target</b>, so this path starts blind.`;
  if (b.progress === 1) return `<b>Found by ${L(b.sensor)}</b>, but its position is only good to about ${s.sigma} km. A fix needs a sensor accurate to ${FIX_SIGMA} km or better. Link a sharper sensor to the same shooter.`;
  if (b.progress === 2) {
    if (b.total > b.dwell) return `<b>Too slow.</b> The target stays located for about ${b.dwell} minutes, but this path takes ${f1(b.total)} minutes from its appearance to impact. Cut decision steps or bring a faster sensor and shooter closer.`;
    return `<b>Fixed, but the fix goes stale.</b> The best position data is ${f1(b.src.age)} minutes old when the weapon arrives. The target has moved and the error grows to ${f1(b.err)} km, larger than the ${w.short}'s ${b.basket} km seeker basket. A tracking sensor linked to the shooter, fewer decision steps, or a slower target would close it.`;
  }
  if (b.progress === 3) return `<b>Tracked, but nobody can authorize the shot.</b> Route the path through a theater HQ or local command, or use a shooter whose crew can decide on scene.`;
  if (b.progress === 4) {
    if (w.ships && !TARGETS[api.S.sc.target].ship) return `<b>Wrong weapon.</b> The ${w.short} engages ships only.`;
    return `<b>Out of range.</b> ${L(b.shooter)} is ${fmt(b.dw)} km from the target and reaches ${fmt(b.reach)} km.`;
  }
  const upd = b.src.kind === 'mid' ? ' with in-flight updates' : '';
  const trk = b.src.kind === 'fix' ? 'the fix stays good enough' : b.src.id === b.sensor ? `keeps the aim point current${upd}` : `${L(b.src.id)} keeps the aim point current${upd}`;
  return `<b>Chain closed.</b> ${L(b.sensor)} fixes the target${b.src.id === b.sensor && b.src.kind !== 'fix' ? ' and' : ','} ${trk}, ${L(b.auth)} authorizes, and ${L(b.shooter)} engages. Error at impact ${f1(b.err)} km inside a ${b.basket} km basket.${r.assessBy != null ? ` ${L(r.assessBy)} can assess the result.` : ' No linked sensor can assess the result.'}`;
}
