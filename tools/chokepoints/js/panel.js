// Panel rendering for the Chokepoint Dashboard.
import { fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { CHOKEPOINTS, SOURCES } from '../data/chokepoints.js';
import { VOYAGES, PRESETS, PLACES } from '../data/voyages.js';
import { days, KM_PER_NM } from './graph.js';

const BY_ID = Object.fromEntries(CHOKEPOINTS.map(c => [c.id, c]));
const money = v => v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)} million` : `$${fmt(v / 1000)},000`;

export function buildPanel(root) {
  root.innerHTML = `
  <section class="sec">
    <p class="eyebrow">1 · Pick a voyage</p>
    <div class="choices" id="cp-voyages">${VOYAGES.map(v => `<button type="button" data-v="${v.id}" aria-pressed="false"><b>${v.name}</b><br><small>${v.cargo}</small></button>`).join('')}</div>
  </section>
  <section class="sec" aria-live="polite">
    <div id="cp-status"></div>
    <div class="tiles" id="cp-tiles"></div>
    <p class="fine" id="cp-via"></p>
  </section>
  <section class="sec">
    <p class="eyebrow">2 · Close chokepoints</p>
    <div class="cp-presets" id="cp-presets">${PRESETS.map(p => `<button type="button" class="btn" data-p="${p.id}" aria-pressed="false">${p.name}</button>`).join('')}</div>
    <div class="cp-toggles" id="cp-toggles">${CHOKEPOINTS.map(c => `
      <label class="tg" data-id="${c.id}"><input type="checkbox" value="${c.id}"><span class="sw"></span>
        <span class="t">${c.name}${c.extra ? ' <span class="pill cp-pill-x">extra</span>' : ''}${c.tw ? ' <span class="pill cp-pill-tw">Taiwan</span>' : ''}<span class="pill cp-pill-on">on route</span>
        <small>${escapeHtml(c.facts[0][1])}</small></span></label>`).join('')}</div>
    <p class="fine">Switch on to close. Pills mark chokepoints on the current route and those a Taiwan Strait contingency touches directly.</p>
  </section>
  <section class="sec">
    <p class="eyebrow">3 · Speed and cost</p>
    <div class="slider"><div class="sl-h"><label for="cp-kn">Speed</label><output id="cp-kn-o"></output></div>
      <input type="range" id="cp-kn" min="8" max="22" step="1"><small>Default 14 knots, a round number for a loaded merchant ship <span class="notional">notional</span></small></div>
    <div class="slider"><div class="sl-h"><label for="cp-usd">Daily cost of one ship</label><output id="cp-usd-o"></output></div>
      <input type="range" id="cp-usd" min="20000" max="150000" step="5000"><small>Charter, fuel and crew rolled into one number <span class="notional">notional</span></small></div>
  </section>`;
}

export function renderResult(S, cur, base) {
  const v = VOYAGES.find(x => x.id === S.voyage);
  const st = document.getElementById('cp-status'), tiles = document.getElementById('cp-tiles'), via = document.getElementById('cp-via');
  if (!cur) {
    st.innerHTML = `<div class="status" data-s="bad"><b>No sea route</b><span>${PLACES[v.to]} cannot be reached with these chokepoints closed. ${v.to === 'KHH' ? 'Kaohsiung sits on the Taiwan Strait itself, inside any closure there.' : 'Reopen one to see the detour.'}</span></div>`;
    tiles.innerHTML = ''; via.textContent = '';
    return;
  }
  const dNm = (cur.km - base.km) / KM_PER_NM, dDays = days(cur.km, S.knots) - days(base.km, S.knots);
  const extra = dNm > 1;
  const s = !extra ? 'good' : dDays > 3 ? 'bad' : 'warn';
  st.innerHTML = `<div class="status" data-s="${s}"><b>${extra ? `+${fmt(dNm)} nm detour` : 'Shortest route open'}</b>
    <span>${v.name}: ${fmt(cur.km / KM_PER_NM)} nm (${fmt(cur.km)} km), ${days(cur.km, S.knots).toFixed(1)} days at ${S.knots} knots.</span></div>`;
  const cost = Math.max(0, dDays) * S.usd;
  tiles.innerHTML = `
    <div class="tile"><span>Extra distance</span><b>${extra ? '+' + fmt(dNm) : '0'}</b><span class="num">nautical miles</span></div>
    <div class="tile"><span>Extra time</span><b>${extra ? '+' + dDays.toFixed(1) : '0'}</b><span class="num">days at ${S.knots} kn</span></div>
    <div class="tile"><span>Extra cost, one ship <span class="notional">notional</span></span><b>${extra ? money(cost) : '$0'}</b><span class="num">at ${money(S.usd)}/day</span></div>
    <div class="tile"><span>Share of trip added</span><b>${extra ? '+' + Math.round(dNm / (base.km / KM_PER_NM) * 100) + '%' : '0%'}</b><span class="num">vs. all-open route</span></div>`;
  const names = cur.tags.map(t => BY_ID[t]?.short).filter(Boolean);
  via.innerHTML = `Route passes: ${v.from === 'RT' ? 'Hormuz, ' : ''}${names.length ? names.join(', ') : 'no listed chokepoint'}. Lanes are approximate.`;
}

export function renderToggles(S, cur) {
  document.querySelectorAll('#cp-toggles .tg').forEach(l => {
    const id = l.dataset.id;
    l.querySelector('input').checked = S.closed.has(id);
    l.classList.toggle('on-route', !!cur && cur.tags.includes(id));
    l.classList.toggle('focus', S.focus === id);
  });
  document.querySelectorAll('#cp-voyages button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.voyage)));
  const key = [...S.closed].sort().join(',');
  document.querySelectorAll('#cp-presets button').forEach(b => {
    const p = PRESETS.find(x => x.id === b.dataset.p);
    b.setAttribute('aria-pressed', String([...p.closed].sort().join(',') === key));
  });
  document.getElementById('cp-kn').value = S.knots;
  document.getElementById('cp-kn-o').textContent = `${S.knots} kn`;
  document.getElementById('cp-usd').value = S.usd;
  document.getElementById('cp-usd-o').textContent = money(S.usd);
}

export function renderFacts(id) {
  const c = BY_ID[id], box = document.getElementById('cp-facts');
  if (!c) { box.innerHTML = ''; return; }
  box.innerHTML = `<p class="eyebrow">Chokepoint facts</p><h3 class="cp-fh">${c.name}${c.tw ? ' <span class="pill cp-pill-tw">Taiwan contingency</span>' : ''}</h3>
    <dl class="cp-fl">${c.facts.map(([k, v, s]) => `<dt>${k}</dt><dd>${escapeHtml(v)}${s ? ` <a href="${SOURCES[s].u}" target="_blank" rel="noopener" title="${escapeHtml(SOURCES[s].t)}">[source]</a>` : ''}</dd>`).join('')}</dl>
    <p class="fine">Hover or focus a marker on the map to see another chokepoint here.</p>`;
}
