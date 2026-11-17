// Country view: a grid of country tiles, and a per-country org chart at the chosen date.
// The tree comes from org parent links. Each org lists only people with a sourced post in it;
// nothing is shown for posts nobody is sourced to. Former holders appear greyed when asked for.
import { yearOf, activeAt, statusAt } from './edges.js';
import { COUNTRY_NAMES, STATUS_TEXT, avatarHtml } from './profile.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

const FLAG = new Set(['removed', 'under_investigation', 'unaccounted']);
const OTHER = '__other';

export function renderTiles(el, L, t, onOpen) {
  const rows = Object.keys(COUNTRY_NAMES).map(c => {
    const ps = L.people.filter(p => p.country === c);
    return { c, n: ps.length, t1: ps.filter(p => p.tier === 1).length, flagged: ps.filter(p => FLAG.has(statusAt(p, t))).length };
  });
  el.innerHTML = `<p class="fine tiles-h">Pick a country to open its organization chart at the date above.</p>
    <ul class="tiles">${rows.map(r => `<li><button type="button" class="tile" data-c="${r.c}" style="--k:var(--k-${r.c})" ${r.n ? '' : 'disabled'}>
      <span class="tile-name">${esc(COUNTRY_NAMES[r.c])}</span><span class="tile-code">${r.c}</span>
      ${r.n ? `<span class="tile-stats"><span><b class="num">${r.n}</b> people</span><span><b class="num">${r.t1}</b> tier 1</span>
        <span${r.flagged ? ' class="flag"' : ''}><b class="num">${r.flagged}</b> removed, investigated or unaccounted</span></span>`
        : '<span class="tile-stats"><span>Records pending</span></span>'}
    </button></li>`).join('')}</ul>`;
  el.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => onOpen(b.dataset.c)));
}

// ctx: {L, orgs: Map, t, asOfY, former, open: Map(orgId -> bool), onOpenPerson, onNet, onBack, onToggle, onAll}
export function renderOrgChart(el, country, ctx) {
  const { L, t, asOfY, former, open } = ctx;
  const orgs = L.orgs.filter(o => o.country === country);
  const ids = new Set(orgs.map(o => o.id));
  const kids = new Map(); const roots = [];
  for (const o of orgs) (o.parent && ids.has(o.parent) && o.parent !== o.id ? (kids.get(o.parent) || kids.set(o.parent, []).get(o.parent)) : roots).push(o);

  // Holders per org at t: current (post active) and former (post started and ended by t).
  const hold = new Map();
  const add = (org, p, post, cur) => {
    const k = ids.has(org) ? org : OTHER;
    if (!hold.has(k)) hold.set(k, new Map());
    const m = hold.get(k), h = m.get(p.id);
    if (!h) m.set(p.id, { p, cur, posts: [post] });
    else if (cur && !h.cur) m.set(p.id, { p, cur, posts: [post] });
    else if (cur === h.cur) h.posts.push(post);
  };
  for (const p of L.people) if (p.country === country) for (const post of p.posts) {
    if (activeAt(post, t, asOfY)) add(post.org, p, post, true);
    else if (former && (yearOf(post.start) ?? -Infinity) <= t && post.end != null) add(post.org, p, post, false);
  }
  const people = k => [...(hold.get(k)?.values() || [])].sort((a, b) => (b.cur - a.cur) || (a.p.tier - b.p.tier) || ((yearOf(b.posts[0].start) ?? 0) - (yearOf(a.posts[0].start) ?? 0)));
  const subCount = new Map();
  const count = o => { if (subCount.has(o.id)) return subCount.get(o.id); const n = people(o.id).filter(h => h.cur).length + (kids.get(o.id) || []).reduce((s, k) => s + count(k), 0); subCount.set(o.id, n); return n; };
  const anyone = new Map();
  const has = o => { if (anyone.has(o.id)) return anyone.get(o.id); const v = people(o.id).length > 0 || (kids.get(o.id) || []).some(has); anyone.set(o.id, v); return v; };
  const sortOrgs = list => list.filter(has).sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name));
  const hidden = orgs.filter(o => !has(o)).length;

  const card = h => {
    const p = h.p, st = statusAt(p, t);
    const titles = [...new Set(h.posts.map(x => x.title))].join('; ');
    const end = !h.cur ? h.posts.map(x => x.end).filter(Boolean).sort().pop() : null;
    return `<li class="pcard${h.cur ? '' : ' former'}" data-s="${st}" style="--k:var(--k-${p.country})">
      <button type="button" class="pc-main" data-open="${esc(p.id)}" aria-label="${esc(p.name)}, ${esc(titles)}${h.cur ? '' : ', former'}${st !== 'active' ? ', ' + esc(STATUS_TEXT[st]) : ''}. Open profile">
        ${avatarHtml(p, 'av')}
        <span class="pc-txt"><span class="pc-name">${esc(p.name)}</span>${p.name_native ? `<span class="pc-native">${esc(p.name_native)}</span>` : ''}
          <span class="pc-title">${esc(titles)}</span>
          ${!h.cur ? `<span class="pc-end">Former, until ${esc(end || '?')}</span>` : ''}
          ${FLAG.has(st) ? `<span class="stpill" data-s="${st === 'removed' ? 'bad' : 'warn'}">${esc(STATUS_TEXT[st])}</span>` : ''}</span>
      </button>
      <span class="pc-acts"><button type="button" class="pc-net" data-net="${esc(p.id)}" aria-label="Show ${esc(p.name)} in the network" title="Show in network">Network</button>
      <button type="button" class="pc-net" data-cmp="${esc(p.id)}" aria-pressed="${ctx.cmp?.has(p.id) ? 'true' : 'false'}" aria-label="${ctx.cmp?.has(p.id) ? 'Remove' : 'Add'} ${esc(p.name)} ${ctx.cmp?.has(p.id) ? 'from' : 'to'} comparison" title="Compare">${ctx.cmp?.has(p.id) ? 'Added' : 'Compare'}</button></span></li>`;
  };
  const node = (o, depth) => {
    const ks = sortOrgs(kids.get(o.id) || []);
    const isOpen = open.has(o.id) ? open.get(o.id) : depth <= 1;
    const ps = people(o.id);
    return `<li class="org d${Math.min(depth, 3)}"><div class="org-box">
      <div class="org-h">${ks.length ? `<button type="button" class="org-tg" data-tg="${esc(o.id)}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Collapse' : 'Expand'} ${esc(o.name)}">${isOpen ? '−' : '+'}</button>` : '<span class="org-tg-sp"></span>'}
        <span class="org-name">${esc(o.name)}${o.name_native ? ` <span class="org-native">${esc(o.name_native)}</span>` : ''}</span>
        <span class="org-meta">${o.type ? `<span class="pill">${esc(o.type)}</span>` : ''}${ks.length && !isOpen ? `<span class="fine">${ks.length} units, ${count(o)} people</span>` : ''}${o.source ? ` <a class="sl" href="${esc(o.source)}" target="_blank" rel="noopener">src</a>` : ''}</span></div>
      ${ps.length ? `<ul class="cards">${ps.map(card).join('')}</ul>` : '<p class="fine org-none">No sourced post holder at this date.</p>'}</div>
      ${ks.length && isOpen ? `<ul class="org-kids k${Math.min(depth + 1, 3)}">${ks.map(k => node(k, depth + 1)).join('')}</ul>` : ''}</li>`;
  };
  const other = people(OTHER);
  const top = sortOrgs(roots);
  el.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><button type="button" class="linkbtn" data-back>All countries</button> <span aria-hidden="true">›</span> <b>${esc(COUNTRY_NAMES[country])}</b></nav>
    <div class="org-tools"><span class="fine">${orgs.length - hidden} organizations with sourced post holders${hidden ? `; ${hidden} with none at this date are hidden` : ''}.</span>
      <span><button type="button" class="linkbtn" data-all="1">Expand all</button> · <button type="button" class="linkbtn" data-all="0">Collapse all</button></span></div>
    ${top.length || other.length ? `<ul class="tree">${top.map(o => node(o, 0)).join('')}
      ${other.length ? `<li class="org d0"><div class="org-box"><div class="org-h"><span class="org-tg-sp"></span><span class="org-name">Other sourced posts <span class="fine">organization not yet in the index</span></span></div><ul class="cards">${other.map(card).join('')}</ul></div></li>` : ''}</ul>`
      : '<p class="fine">No sourced post holders at this date. Move the date or include former officials.</p>'}`;
  el.querySelector('[data-back]').addEventListener('click', ctx.onBack);
  el.querySelectorAll('[data-tg]').forEach(b => b.addEventListener('click', () => ctx.onToggle(b.dataset.tg, b.getAttribute('aria-expanded') !== 'true')));
  el.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', () => ctx.onAll(orgs.map(o => o.id), b.dataset.all === '1')));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpenPerson(b.dataset.open, b)));
  el.querySelectorAll('[data-net]').forEach(b => b.addEventListener('click', () => ctx.onNet(b.dataset.net)));
  el.querySelectorAll('.pcard [data-cmp]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.cmp; ctx.onCmp(id); el.querySelector(`.pcard [data-cmp="${CSS.escape(id)}"]`)?.focus(); }));
}
