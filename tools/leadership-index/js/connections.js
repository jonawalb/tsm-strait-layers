// Connections view: the compared actors plus the shortest paths between every pair, across the
// layers now switched on. State alignment is drawn between compared actors but never used for paths,
// because it is a state-level relation, not a personal one.
import { LAYERS, SIGN_TEXT, edgeActive, stateEdge, dyadAt, yearOf } from './edges.js';
import { srcLink } from './profile.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

const pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

// ctx: {L, people: Map, edges: all built edges, layers, t, cmp: [ids], decorate(p) -> node}
export function computeConnections(ctx) {
  const { L, people, edges, layers, t, cmp } = ctx;
  const sel = cmp.filter(id => people.has(id));
  const inRecord = p => p.posts.some(x => (yearOf(x.start) ?? -Infinity) <= t);
  const uni = new Set(L.people.filter(inRecord).map(p => p.id)); sel.forEach(id => uni.add(id));
  const E = edges.filter(e => layers[e.layer] && e.layer !== 'st' && uni.has(e.a) && uni.has(e.b) && edgeActive(e, t));
  const adj = new Map(), byPair = new Map();
  for (const e of E) {
    (adj.get(e.a) || adj.set(e.a, new Set()).get(e.a)).add(e.b);
    (adj.get(e.b) || adj.set(e.b, new Set()).get(e.b)).add(e.a);
    const k = pk(e.a, e.b); (byPair.get(k) || byPair.set(k, []).get(k)).push(e);
  }
  const bfs = s => { const par = new Map([[s, null]]), Q = [s]; for (let i = 0; i < Q.length; i++) for (const w of adj.get(Q[i]) || []) if (!par.has(w)) { par.set(w, Q[i]); Q.push(w); } return par; };
  const nodeIds = new Set(sel), pathPairs = new Set(), pairs = [];
  for (let i = 0; i < sel.length; i++) {
    const par = bfs(sel[i]);
    for (let j = i + 1; j < sel.length; j++) {
      const a = sel[i], b = sel[j];
      let path = null;
      if (par.has(b)) { path = []; for (let v = b; v != null; v = par.get(v)) path.unshift(v); }
      if (path) { path.forEach(v => nodeIds.add(v)); for (let k = 1; k < path.length; k++) pathPairs.add(pk(path[k - 1], path[k])); }
      const direct = byPair.get(pk(a, b)) || [];
      const pa = people.get(a), pb = people.get(b);
      pairs.push({ a, b, path, direct, rel: direct.filter(e => e.layer === 'rel'),
        dyad: pa.country !== pb.country ? dyadAt(L, pa.country, pb.country, t) : null });
    }
  }
  const drawn = [];
  for (const k of pathPairs) drawn.push(...(byPair.get(k) || []));
  if (layers.st) for (const p of pairs) if (!p.rel.length) { const e = stateEdge(L, people.get(p.a), people.get(p.b), t); if (e) { e.layerLabel = LAYERS.st.label; e.na = people.get(e.a).name; e.nb = people.get(e.b).name; drawn.push(e); p.state = e; } }
  const selSet = new Set(sel);
  const nodes = [...nodeIds].map(id => ({ ...ctx.decorate(people.get(id)), inter: !selSet.has(id), cmp: selSet.has(id) }));
  return { nodes, edges: drawn, pairs, sel };
}

const signBadge = s => `<span class="sgn" data-sg="${s}">${SIGN_TEXT[s]}</span>`;
const whyList = es => `<ul class="why">${es.flatMap(e => e.why).map(w => `<li>${esc(w.text)} ${w.sources.map(u => srcLink(u)).join(' ')}</li>`).join('')}</ul>`;

export function renderConnList(el, C, people, { onPick }) {
  const name = id => `<button type="button" class="linkbtn" data-pick="${esc(id)}">${esc(people.get(id).name)}</button>`;
  if (C.sel.length < 2) {
    el.innerHTML = `<p class="eyebrow">Connections</p><p class="fine">Add at least two people to compare. Shift-click or Ctrl-click people in the network, or use <b>Compare</b> on org chart cards and profiles.</p>`;
  } else {
    el.innerHTML = `<p class="eyebrow">Connections between ${C.sel.length} people <span class="fine">${C.pairs.length} pairs; small grey circles are intermediaries on shortest paths</span></p>
    <ul class="conn">${C.pairs.map(p => {
      const byL = {}; for (const e of p.direct) (byL[e.layer] ||= []).push(e);
      const signs = [...new Set(p.rel.map(e => e.sign))];
      return `<li class="pair-row"><p class="pair-names">${name(p.a)} and ${name(p.b)}</p>
        <p class="pr-line">${signs.length ? signs.map(signBadge).join(' ') + ' <span class="fine">personal relation</span>' : '<span class="fine">No sourced personal relation</span>'}
          ${p.dyad ? ` · <span class="sgn st" data-sg="${p.dyad.sign}">${esc(p.dyad.a)}–${esc(p.dyad.b)} ${esc(p.dyad.type || SIGN_TEXT[p.dyad.sign])}</span> <span class="fine">state level, not personal</span> ${srcLink(p.dyad.source)}` : ''}</p>
        <p class="pr-line fine">${p.path ? (p.path.length === 2 ? 'Directly tied' : `Shortest path ${p.path.length - 1} steps: ${p.path.map(id => esc(people.get(id).name)).join(' → ')}`) : 'Not connected through the layers now switched on'}</p>
        ${Object.keys(byL).length ? Object.keys(LAYERS).filter(k => byL[k]).map(k => `<details class="pr-d"><summary><i class="sw-${k}"></i>${LAYERS[k].label} <span class="fine">${byL[k].length}</span></summary>${whyList(byL[k])}</details>`).join('') : ''}
        ${p.state ? `<details class="pr-d"><summary><i class="sw-st"></i>State alignment</summary>${whyList([p.state])}</details>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.pick)));
}

// Chips for the compared actors.
export function renderCmpBar(el, cmp, people, { onRemove, onClear, onShow, onPacket, showing }) {
  const ids = cmp.filter(id => people.has(id));
  el.hidden = !ids.length;
  if (!ids.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="eyebrow">Compare</span>
    <ul class="chipsel">${ids.map(id => { const p = people.get(id); return `<li style="--k:var(--k-${p.country})"><span class="cdot"></span>${esc(p.name)} <span class="fine">${p.country}</span><button type="button" class="x" data-rm="${esc(id)}" aria-label="Remove ${esc(p.name)} from comparison">×</button></li>`; }).join('')}</ul>
    ${showing ? '' : `<button type="button" class="btn solid" data-show ${ids.length < 2 ? 'disabled' : ''}>Show connections</button>`}
    <button type="button" class="btn" data-packet>Packet</button>
    <button type="button" class="linkbtn" data-clear>Clear</button>`;
  el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => onRemove(b.dataset.rm)));
  el.querySelector('[data-clear]').addEventListener('click', onClear);
  el.querySelector('[data-show]')?.addEventListener('click', onShow);
  el.querySelector('[data-packet]')?.addEventListener('click', onPacket);
}
