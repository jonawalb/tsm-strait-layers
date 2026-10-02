// Kill Chain Builder: state, palette, and glue between the model and the views.
import { TYPES, CATS } from '../data/catalog.js';
import { PRESETS } from '../data/presets.js';
import { evaluate, singlePoints } from './model.js';
import { createBoard, freeSpot } from './board.js';
import { createPanel } from './panel.js';
import { renderTimeline, renderChecks } from './timeline.js';
import { readHash, writeHash } from './hash.js';
import { createTour } from './tour.js';
import { addExportBar } from '../../../shared/js/export.js';
import { initFx, before as fxBefore, after as fxAfter } from './fx.js';

const S = { sc: { target: 'cv', D: 1200, kt: 30, emcon: false }, nodes: [], links: [], dead: new Set(), sel: null, choose: false, nid: 0, preset: null };
const CAT_ORDER = { sensor: 0, c2: 1, shooter: 2 };
const byId = id => S.nodes.find(n => n.id === id);

function label(id) {
  const n = byId(id);
  if (!n) return '?';
  const t = TYPES[n.type], name = t.variants && n.v ? t.variants[n.v].tag : t.short;
  const same = S.nodes.filter(m => m.type === n.type && (m.v || '') === (n.v || ''));
  return same.length > 1 ? `${name} ${same.indexOf(n) + 1}` : name;
}

// The board as it was last loaded (a preset, the blank board or a shared link): what "Reset all" returns to.
let start = null;
function load({ sc, nodes, links, dead = [] }, preset = null) {
  start = { snap: { sc: { ...sc }, nodes: nodes.map(n => ({ ...n })), links: links.map(l => [...l]), dead: [...dead] }, preset };
  S.sc = { ...sc };
  S.nodes = nodes.map((n, i) => ({ ...n, id: i }));
  S.links = links.map(l => [...l]);
  S.dead = new Set(dead);
  S.nid = S.nodes.length; S.sel = null; S.choose = false; S.preset = preset; api.msg = '';
}

const api = {
  S, label, node: byId, msg: '',
  update(opts = {}) {
    const g = { nodes: S.nodes, links: S.links, dead: S.dead };
    const r = evaluate(g, S.sc), spof = singlePoints(g, S.sc);
    const r0 = S.dead.size ? evaluate({ ...g, dead: new Set() }, S.sc) : r;
    fxBefore();
    board.render(r, spof, opts.focus ?? null);
    panel.render(r, spof, r0);
    renderTimeline(document.getElementById('kc-timeline'), r, S, label);
    renderChecks(document.getElementById('kc-checks'), r, S, label);
    document.body.classList.toggle('choosing', S.choose);
    fxAfter(r);
    writeHash(S);
  },
  loadPreset(key) {
    if (key === 'blank') load({ sc: { ...S.sc }, nodes: [], links: [] }, 'blank');
    else load(PRESETS[key], key);
    api.update();
  },
  startName() {
    if (!start || start.preset === 'blank') return 'blank board';
    return start.preset && PRESETS[start.preset] ? PRESETS[start.preset].name : 'the chain you opened';
  },
  resetAll(blank) {
    if (blank) { const keep = start; load({ sc: { ...S.sc }, nodes: [], links: [] }, 'blank'); start = keep; }
    else { const { snap, preset } = start; load(snap, preset); }
    api.msg = blank ? 'Board cleared.' : `Back to ${api.startName()}.`;
    api.update();
  },
  addNode(type, x, y) {
    const t = TYPES[type];
    if (x == null) [x, y] = freeSpot(S.nodes, t.cat);
    const n = { id: S.nid++, type, x, y };
    if (t.variants) n.v = Object.keys(t.variants)[0];
    S.nodes.push(n); S.sel = n.id; S.preset = null; api.msg = `Added ${label(n.id)}.`;
    api.update({ focus: n.id });
  },
  removeNode(id) {
    S.nodes = S.nodes.filter(n => n.id !== id);
    S.links = S.links.filter(([a, b]) => a !== id && b !== id);
    S.dead.delete(id);
    if (S.sel === id) S.sel = null;
    S.preset = null; api.msg = '';
    api.update();
  },
  link(a, b, fromMenu = false) {
    const na = byId(a), nb = byId(b);
    if (!na || !nb || a === b) return;
    let [x, y] = CAT_ORDER[TYPES[na.type].cat] <= CAT_ORDER[TYPES[nb.type].cat] ? [a, b] : [b, a];
    const cx = TYPES[byId(x).type].cat, cy = TYPES[byId(y).type].cat;
    if (cx === cy && cx !== 'c2') api.msg = `Links run from sensors through command to shooters. Two ${CATS[cx].name.toLowerCase()} cannot be linked directly.`;
    else if (S.links.some(([p, q]) => (p === x && q === y) || (p === y && q === x))) api.msg = 'Those nodes are already linked.';
    else { S.links.push([x, y]); S.preset = null; api.msg = `Linked ${label(x)} → ${label(y)}.`; }
    if (!fromMenu) S.sel = S.sel ?? x;
    api.update();
  },
  unlink(a, b) { S.links = S.links.filter(([p, q]) => !(p === a && q === b)); S.preset = null; api.update(); },
  clickNode(id, kb = false) {
    if (S.choose) api.toggleDead(id, kb);
    else { S.sel = S.sel === id && !kb ? null : id; api.update({ focus: kb ? id : null }); }
  },
  toggleDead(id, kb = false) { S.dead.has(id) ? S.dead.delete(id) : S.dead.add(id); api.update({ focus: kb ? id : null }); },
  strike(k) {
    const live = S.nodes.filter(n => !S.dead.has(n.id));
    for (let i = 0; i < k && live.length; i++) S.dead.add(live.splice(Math.floor(Math.random() * live.length), 1)[0].id);
    api.update();
  },
  restore() { S.dead.clear(); api.update(); },
};

const board = createBoard(document.getElementById('kc-board'), api);
initFx(api);
const panel = createPanel(document.getElementById('panel'), api);

// Palette: click or Enter adds a node to its lane; drag drops it where you release.
const pal = document.getElementById('kc-palette');
pal.innerHTML = Object.entries(CATS).map(([c, cat]) => `<div class="pal-g"><span class="pal-h">${cat.name}</span>${
  Object.entries(TYPES).filter(([, t]) => t.cat === c).map(([k, t]) =>
    `<button type="button" class="pal cat-${c}" data-type="${k}" title="${t.name}. Click to add, or drag onto the board.">${t.short}</button>`).join('')}</div>`).join('');
let pd = null, lastDrag = 0;
pal.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-type]');
  if (!b || e.button > 0) return;
  pd = { type: b.dataset.type, x: e.clientX, y: e.clientY, ghost: null, id: e.pointerId };
});
window.addEventListener('pointermove', e => {
  if (!pd) return;
  if (!pd.ghost && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 6) {
    pd.ghost = document.createElement('div');
    pd.ghost.className = `ghost-node cat-${TYPES[pd.type].cat}`;
    pd.ghost.textContent = TYPES[pd.type].short;
    document.body.appendChild(pd.ghost);
  }
  if (pd.ghost) { pd.ghost.style.left = e.clientX - 60 + 'px'; pd.ghost.style.top = e.clientY - 18 + 'px'; }
});
window.addEventListener('pointerup', e => {
  if (!pd) return;
  const d = pd; pd = null;
  if (!d.ghost) return; // a plain click; the click handler adds the node
  d.ghost.remove();
  const at = board.boardPoint(e);
  if (at) api.addNode(d.type, at[0], at[1]);
  lastDrag = Date.now();
});
pal.addEventListener('click', e => {
  const b = e.target.closest('[data-type]');
  if (!b) return;
  if (Date.now() - lastDrag < 400) return;
  api.addNode(b.dataset.type);
});

const tour = createTour(document.getElementById('kc-stage'), set => {
  load(PRESETS[set.preset], set.preset);
  (set.dead || []).forEach(i => S.dead.add(i));
  if (set.sel != null) S.sel = set.sel;
  api.update();
});
document.getElementById('kc-tour').onclick = () => tour.start();
document.getElementById('kc-copy').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
  catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1800);
};

const pKey = new URLSearchParams(location.hash.slice(1)).get('p');
const fromHash = readHash();
if (PRESETS[pKey]) load(PRESETS[pKey], pKey); else if (fromHash) load(fromHash); else load(PRESETS.pla, 'pla');
api.update();
{
  const NOTE = 'Notional values (TSM Kill Chain Builder), a teaching model';
  const g = id => document.getElementById(id);
  addExportBar(document.querySelector('.boardbox'), { target: () => g('kc-board'), title: 'Kill chain board', note: NOTE });
  addExportBar(document.querySelector('.under'), { target: () => g('kc-timeline'), title: 'Kill chain: fastest path timeline and position error', note: NOTE });
}
