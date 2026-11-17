// Inspector and menu builder: keyboard-friendly alternatives to dragging, plus node properties.
import { fmt, escapeHtml } from '../../../shared/js/mapkit.js';
import { TYPES, CATS, CH_NAMES, FIX_SIGMA, TRACK_UPDATE } from '../data/catalog.js';
import { distOf, reachOf } from './model.js';

const N = '<span class="notional">notional</span>';
const opt = (v, t, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${escapeHtml(t)}</option>`;

function typeOptions() {
  return Object.entries(CATS).map(([c, cat]) => `<optgroup label="${cat.name}">${
    Object.entries(TYPES).filter(([, t]) => t.cat === c).map(([k, t]) => opt(k, t.name)).join('')}</optgroup>`).join('');
}

function props(n, S) {
  const t = TYPES[n.type], rows = [];
  if (t.cat === 'sensor') {
    rows.push(['Reach vs. reference signature', Object.entries(t.ch).map(([c, r]) => `${CH_NAMES[c]} ${fmt(r)} km`).join(', ')]);
    if (t.rmin) rows.push(['Skip zone', `inside ${fmt(t.rmin)} km`]);
    rows.push(['Location error', `${t.sigma} km${t.sigma <= FIX_SIGMA ? ' (can fix)' : ' (too coarse to fix)'}`]);
    rows.push(['Report time', `${t.proc} min`]);
    rows.push(['Time between looks', `${t.update} min${t.update <= TRACK_UPDATE ? ' (can track)' : ' (snapshots only)'}`]);
    rows.push(['Damage assessment', t.assess ? 'yes' : 'no']);
  } else if (t.cat === 'c2') {
    rows.push(['Can authorize a shot', t.authority ? 'yes' : 'no']);
    if (t.authority) rows.push(['Decision time', `${t.decide} min`]);
    rows.push(['Relay time', `${t.relay} min`]);
  } else {
    const v = t.variants && n.v && t.variants[n.v];
    rows.push(['Reach', `${fmt(reachOf(n))} km${v && v.src ? ' <span class="pill">CSIS</span>' : ''}`]);
    rows.push(['Average weapon speed', `${t.speed} km/min`]);
    rows.push(['Launch preparation', `${t.launch} min`]);
    rows.push(['Seeker basket (radius)', `${t.basket} km`]);
    rows.push(['In-flight updates', t.mid ? 'yes' : 'no']);
    rows.push(['On-scene firing authority', t.authority ? `yes, ${t.decide} min` : 'no']);
    if (t.ships) rows.push(['Targets', 'ships only']);
  }
  rows.push(['Distance to target', `<span class="dist-o">${fmt(distOf(n, S.sc))} km</span>`]);
  return rows;
}

export function inspectorHtml(S, sel, api) {
  const from = S.nodes.filter(n => TYPES[n.type].cat !== 'shooter');
  const to = S.nodes.filter(n => TYPES[n.type].cat !== 'sensor');
  let h = `<p class="eyebrow">Build with menus</p>
    <div class="menu-row"><label for="kc-add-type" class="sr">Node type</label><select id="kc-add-type">${typeOptions()}</select>
      <button type="button" class="btn" id="kc-add">Add node</button></div>
    <div class="menu-row"><label for="kc-from" class="sr">Link from</label><select id="kc-from">${from.map(n => opt(n.id, api.label(n.id), n.id === S.sel)).join('')}</select>
      <span aria-hidden="true">→</span><label for="kc-to" class="sr">Link to</label><select id="kc-to">${to.map(n => opt(n.id, api.label(n.id))).join('')}</select>
      <button type="button" class="btn" id="kc-link"${from.length && to.length ? '' : ' disabled'}>Connect</button></div>
    ${api.msg ? `<p class="fine msg">${escapeHtml(api.msg)}</p>` : ''}`;
  if (!sel) return h + `<p class="fine">Select a node on the board to see its properties: click it, or Tab to it and press Enter.</p>`;
  const t = TYPES[sel.type], dead = S.dead.has(sel.id);
  const links = S.links.filter(([a, b]) => a === sel.id || b === sel.id);
  h += `<div class="insp-h"><span class="dot cat-${t.cat}"></span><h3>${escapeHtml(api.label(sel.id))}</h3></div>
    <p class="fine">${escapeHtml(t.note)}</p>`;
  if (t.variants) h += `<div class="choices two" id="kc-var">${Object.entries(t.variants).map(([k, v]) =>
    `<button type="button" data-v="${k}" aria-pressed="${(sel.v || Object.keys(t.variants)[0]) === k}">${v.label} · ${fmt(v.reach)} km</button>`).join('')}</div>`;
  if (t.fwd) h += `<label class="slider"><span class="sl-h"><span>Distance to target ${N}</span><output class="dist-o"></output></span>
    <input type="range" id="kc-dist" min="0" max="${S.sc.D}" step="5" value="${distOf(sel, S.sc)}"><small>How far forward this platform operates.</small></label>`;
  h += `<table class="props"><caption>Properties ${N}${t.variants ? ' except CSIS-sourced reach' : ''}</caption><tbody>${
    props(sel, S).map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
  h += `<p class="eyebrow sm">Links</p>${links.length ? `<ul class="links">${links.map(([a, b]) =>
    `<li>${escapeHtml(api.label(a))} → ${escapeHtml(api.label(b))} <button type="button" class="x" data-un="${a}-${b}" aria-label="Remove link ${escapeHtml(api.label(a))} to ${escapeHtml(api.label(b))}">×</button></li>`).join('')}</ul>`
    : '<p class="fine">No links yet. Drag from the round port on the right edge of a node, or use Connect above.</p>'}`;
  h += `<div class="btnrow"><button type="button" class="btn" id="kc-kill">${dead ? 'Restore node' : 'Knock out'}</button>
    <button type="button" class="btn" id="kc-del">Delete node</button></div>`;
  return h;
}

export function bindInspector(box, S, sel, api) {
  const q = s => box.querySelector(s);
  q('#kc-add').onclick = () => api.addNode(q('#kc-add-type').value);
  const lk = q('#kc-link');
  if (lk) lk.onclick = () => api.link(+q('#kc-from').value, +q('#kc-to').value, true);
  if (!sel) return;
  box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { sel.v = b.dataset.v; api.update(); });
  const d = q('#kc-dist');
  if (d) d.oninput = () => { sel.dist = +d.value; api.update(); };
  box.querySelectorAll('[data-un]').forEach(b => b.onclick = () => { const [a, c] = b.dataset.un.split('-').map(Number); api.unlink(a, c); });
  q('#kc-kill').onclick = () => api.toggleDead(sel.id);
  q('#kc-del').onclick = () => api.removeNode(sel.id);
}
