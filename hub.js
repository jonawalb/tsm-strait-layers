// Landing page: this week's dashboard, category selector, search, tool cards, keyboard navigation and help.
import { ALL_CATEGORIES, CATEGORIES, TOOLS, inCat, onSite, DEV_SEALED, addTools } from './shared/js/registry.js';
import { createProjection, drawBasemap, el } from './shared/js/mapkit.js';
import { LAND_INDOPAC } from './shared/data/land-indopac.js';
import { mountWeek } from './shared/js/week/week.js';
import { SITE } from './shared/js/site.js';
import { TAGLINES } from './shared/js/taglines.js';

const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Tools in the Coming Soon section (registry `dev: true`) are left out of every site-wide count.
const COUNTED = TOOLS.filter(t => t.cat !== 'dev');

// Last change per tool, from the repository's commit log (commit date and subject). Update when a tool changes.
const UPDATED = {
  'strait-layers': ['2026-09-28', 'Header links back to the hub'],
  'energy-blockade': ['2026-09-28', 'First release'],
  'mine-warfare': ['2026-09-28', 'First release'],
  'arms-backlog': ['2026-10-07', 'September 2026 update added'],
  'undersea-cables': ['2026-09-28', 'Data corrections'],
  'history-time-machine': ['2026-09-28', 'Data corrections'],
  'ccg-grayzone': ['2026-09-28', 'Map now covers 2024 to 2026'],
  'dark-fleet': ['2026-09-28', 'AIS refreshed from the collector'],
  'rhetoric-heatmap': ['2026-09-28', 'July to September 2026 statements added'],
  'beijing-decoder': ['2026-09-28', 'First release'],
  'narrative-diffusion': ['2026-09-28', 'First release'],
  'day-in-the-strait': ['2026-09-28', 'MND-verified daily counts'],
  'strait-snapshot': ['2026-09-28', 'MND-verified daily counts'],
  'transit-response': ['2026-09-28', 'MND-verified counts and transits'],
  'joint-sword': ['2026-09-28', 'MND-verified daily counts'],
  'markets-vs-analysts': ['2026-09-28', 'MND-verified daily counts'],
  'escalation-ladder': ['2026-09-28', 'MND-verified daily counts'],
  'scs-features': ['2026-09-28', 'MND-verified daily counts'],
};
const shortDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// Hero map: the Indo-Pacific with Taiwan picked out and a few range rings for texture.
const proj = createProjection({ lon0: 95, lon1: 150, lat0: -5, lat1: 42, width: 700 });
const svg = $('hero-map');
const { root } = drawBasemap(svg, proj, LAND_INDOPAC, { gratStep: 10 });
const tw = [121, 23.7];
[600, 1500, 3000].forEach((km, i) => {
  const pts = [];
  for (let b = 0; b <= 360; b += 3) {
    const d = km / 6371, t = b * Math.PI / 180, p1 = tw[1] * Math.PI / 180, l1 = tw[0] * Math.PI / 180;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
    const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    pts.push([l2 * 180 / Math.PI, p2 * 180 / Math.PI]);
  }
  el('path', { d: proj.line(pts, true), class: 'hero-ring', style: `animation-delay:${i * 0.6}s` }, root);
});
const [tx, ty] = proj.project(tw);
el('circle', { cx: tx, cy: ty, r: 5, class: 'hero-tw' }, root);
el('text', { x: tx + 9, y: ty + 4, class: 'hero-lbl' }, root, 'Taiwan');

// Category selector
// State: a section (`cat`) and, for sections with subsections, an open subsection (`sub`). Hash: #cat or #cat/sub.
let [cat, sub = ''] = location.hash.slice(1).split('/');
if (!CATEGORIES.some(c => c.id === cat)) { cat = 'all'; sub = ''; }
// Includes hidden sections (e.g. the Indo-Pacific tools listed under Regions) so their cards still get a label.
const catName = Object.fromEntries(ALL_CATEGORIES.filter(c => onSite(c)).map(c => [c.id, c.name]));
// Subsection names a tool is filed under (sub: { regions: 'mideast' } → "Middle East"), for search.
const subName = Object.fromEntries(ALL_CATEGORIES.flatMap(c => (c.subs || []).map(s => [`${c.id}:${s.id}`, s.name])));
const subNames = t => Object.entries(t.sub || {}).flatMap(([c, ids]) => [].concat(ids).map(id => subName[`${c}:${id}`] || '')).join(' ');
const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, TOOLS.filter(t => inCat(t, c.id)).length]));
// A sealed section (Coming Soon) lists nothing, not even names, until its password is entered.
let devOpen = !DEV_SEALED;
const sealedNow = c => c.sealed && !devOpen;
// TSM Interactive lists every tool under "Everything"; other sites open on an overview of section tiles.
const TILES = SITE !== 'tsm';
document.body.classList.add('site-' + SITE);
$('cats').innerHTML = [{ id: 'all', name: TILES ? 'All sections' : 'Everything' }, ...CATEGORIES].map(c =>
  `<button type="button" data-cat="${c.id}"><b>${c.name}</b><span>${c.id === 'all' ? COUNTED.length : sealedNow(c) ? '🔒' : counts[c.id]}</span></button>`).join('');
const catBtns = [...$('cats').querySelectorAll('button')];
function pickCat(c) {
  [cat, sub = ''] = c.split('/');
  history.replaceState(null, '', cat === 'all' ? './' : '#' + cat + (sub ? '/' + sub : ''));
  render();
}
catBtns.forEach(b => b.onclick = () => pickCat(b.dataset.cat));
$('sections').addEventListener('click', e => {
  const b = e.target.closest('[data-open-cat]');
  if (!b) return;
  e.preventDefault(); pickCat(b.dataset.openCat); $('cats').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
$('q').addEventListener('input', render);

// Categories (and single tools) whose tools need a second password on this site.
const locked = new Set(ALL_CATEGORIES.filter(c => c.locked && onSite(c)).map(c => c.id));
const isLocked = t => (locked.has(t.cat) || !!t.locked || !!t.vault) && !window.TSMVault?.isOpen?.(t.slug);
const LOCK = ' <span class="lock-badge" title="Opening this tool asks for a password">🔒 Password Protected</span>';

/** Overview tile for one section: name, blurb, tool count and the first few tool names. */
function tile(c) {
  if (sealedNow(c)) return `<button type="button" class="sec-tile locked" data-open-cat="${c.id}">
    <b>${esc(c.name)}${LOCK}</b><span class="sec-tile-b">${esc(c.blurb)}</span>
    <span class="sec-tile-l">Enter the password to see what is here.</span><span class="go">Open section →</span></button>`;
  const ts = TOOLS.filter(t => inCat(t, c.id) && t.status === 'live');
  return `<button type="button" class="sec-tile${c.locked ? ' locked' : ''}" data-open-cat="${c.id}">
    <span class="sec-tile-n">${ts.length} tool${ts.length === 1 ? '' : 's'}</span>
    <b>${esc(c.name)}${c.locked ? LOCK : ''}</b><span class="sec-tile-b">${esc(c.blurb)}</span>
    <span class="sec-tile-l">${ts.slice(0, 4).map(t => esc(t.title)).join(' · ')}${ts.length > 4 ? ' · …' : ''}</span>
    <span class="go">Open section →</span></button>`;
}

function card(t) {
  const href = `tools/${t.slug}/`;
  const soon = t.status !== 'live';
  // Only real update notes are shown; tools with no update since release show nothing.
  const [d, note] = UPDATED[t.slug] || [];
  const upd = soon || !d || note === 'First release' ? '' : `<span class="upd">Updated ${shortDate(d)} · ${esc(note)}</span>`;
  const inner = `<div class="thumb"><img data-thumb="${href}" alt="" width="640" height="400"></div>
    <div class="card-body"><p class="card-cat">${esc(catName[t.cat] || '')}${isLocked(t) ? LOCK : ''}</p><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p>
    ${upd}<span class="go">${soon ? 'Coming soon' : 'Open →'}</span></div>`;
  return soon ? `<div class="tool soon" aria-disabled="true">${inner}</div>` : `<a class="tool" href="${href}">${inner}</a>`;
}

/** Password form for a sealed section; on success the section's tools are decrypted and listed. */
function sealedForm(c) {
  $('sections').innerHTML = `<section class="cat-sec" id="sec-${c.id}"><button type="button" class="btn sec-back" data-open-cat="all">← All sections</button>
    <div class="cat-h"><h2>${esc(c.name)}${LOCK}</h2><p>This section is password protected. Enter the password to see its tools.</p></div>
    <form class="sealed-form" autocomplete="off"><label for="sealed-pw">Password</label>
      <input id="sealed-pw" ${window.TSMVault?.inputAttrs?.() || 'type="password" autocomplete="off"'} required>
      <button type="submit" class="btn">Unlock</button><span class="sealed-msg" role="alert"></span></form></section>`;
  const f = $('sections').querySelector('.sealed-form'), pw = f.querySelector('input'), msg = f.querySelector('.sealed-msg');
  pw.focus();
  const opened = txt => {
    if (devOpen) return;
    addTools(JSON.parse(txt));
    for (const x of CATEGORIES) counts[x.id] = TOOLS.filter(t => inCat(t, x.id)).length;
    devOpen = true;
    catBtns.forEach(b => { const x = CATEGORIES.find(y => y.id === b.dataset.cat); if (x) b.querySelector('span').textContent = counts[x.id]; });
    render();
  };
  // After the master password, this tab already holds the section's key: list its tools without asking.
  window.TSMVault?.unseal?.(DEV_SEALED, 4).then(opened, () => {});
  f.addEventListener('submit', e => {
    e.preventDefault();
    if (!window.TSMVault?.unsealWithPassword) { msg.textContent = 'Unlocking is not available on this page.'; return; }
    msg.textContent = 'Checking…';
    window.TSMVault.unsealWithPassword(DEV_SEALED, 4, pw.value).then(opened, () => { msg.textContent = 'That password is not right.'; pw.select(); });
  });
}

/** A section's subsections (registry `subs`) with their tools; tools without a subsection go in "More". */
// A tool's subsection in a section can be one id or a list (e.g. a tool that covers two regions).
const inSub = (t, c, id) => [].concat(t.sub?.[c.id] ?? []).includes(id);
function subGroups(c, list) {
  return [...c.subs.map(s => [s, list.filter(t => inSub(t, c, s.id))]),
    [{ id: 'more', name: 'More', blurb: 'Other tools in this section.' }, list.filter(t => !c.subs.some(s => inSub(t, c, s.id)))]]
    .filter(([, ts]) => ts.length);
}
/** Tile for one subsection, opened like a section tile. */
function subTile(c, s, ts) {
  return `<button type="button" class="sec-tile${s.locked ? ' locked' : ''}" data-open-cat="${c.id}/${s.id}">
    <span class="sec-tile-n">${ts.length} tool${ts.length === 1 ? '' : 's'}</span>
    <b>${esc(s.name)}${s.locked ? LOCK : ''}</b><span class="sec-tile-b">${esc(s.blurb)}</span>
    <span class="sec-tile-l">${ts.slice(0, 4).map(t => esc(t.title)).join(' · ')}${ts.length > 4 ? ' · …' : ''}</span>
    <span class="go">Open →</span></button>`;
}

// While a site has a single tool, search adds nothing: hide the box and its hint.
if (COUNTED.length <= 1) {
  document.querySelector('.search')?.style.setProperty('display', 'none');
  $('q-hint')?.style.setProperty('display', 'none');
  const intro = document.querySelector('.hero-text p');
  if (intro) intro.textContent = intro.textContent.replace(', or search for a tool.', '.');
}
// With tools in only one section, the section chips (Everything / that section) add nothing either.
if (CATEGORIES.filter(c => counts[c.id]).length <= 1) $('cats').style.setProperty('display', 'none');

const NARR_WORDS = /disinfo|rhetoric|narrative|propaganda|information|statement|china|russia/;

function render() {
  catBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
  const q = $('q').value.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  // Search also covers every section and subsection a tool is listed under (e.g. "Middle East").
  const hay = t => `${t.title} ${t.blurb} ${t.slug.replace(/-/g, ' ')} ${(t.cats || [t.cat]).map(c => catName[c] || '').join(' ')} ${subNames(t)}`.toLowerCase();
  const match = t => terms.every(w => hay(t).includes(w));
  const cats = CATEGORIES.filter(c => cat === 'all' || c.id === cat);
  const liveNow = TOOLS.filter(t => t.status === 'live' && (cat === 'all' ? t.cat !== 'dev' : inCat(t, cat)) && match(t));
  document.body.classList.toggle('home-overview', TILES && !q && cat === 'all');
  // Inside a section or subsection the headline, search and gallery card step aside.
  document.body.classList.toggle('in-section', TILES && !q && cat !== 'all');
  if (TILES && !q) {
    // Overview: one tile per section (TSM last). A section: its tools, with a way back.
    if (cat === 'all') {
      $('sections').innerHTML = `<section class="cat-sec overview"><div class="cat-h"><h2>Pick a section</h2>
        <p>${COUNTED.length} tools in ${CATEGORIES.filter(c => c.id !== 'dev').length} sections.</p></div><div class="sec-tiles">${CATEGORIES.map(tile).join('')}</div></section>`;
    } else {
      const c = CATEGORIES.find(x => x.id === cat), list = TOOLS.filter(t => inCat(t, cat));
      if (sealedNow(c)) { sealedForm(c); $('q-status').textContent = ''; return; }
      // A section whose tools all fall in one subsection skips the tile step and lists them directly.
      const groups = c.subs && subGroups(c, list).length > 1 ? subGroups(c, list) : [];
      const open = groups.find(([s]) => s.id === sub);
      if (open) {
        // Inside a subsection: its tools, with a way back to the section.
        const [s, ts] = open;
        $('sections').innerHTML = `<section class="cat-sec" id="sec-${c.id}-${s.id}"><button type="button" class="btn sec-back" data-open-cat="${c.id}">← ${esc(c.name)}</button>
          <div class="cat-h"><h2>${esc(s.name)}${s.locked ? LOCK : ''}</h2><p>${esc(s.blurb)}</p></div>
          <div class="tools">${ts.map(card).join('')}</div></section>`;
      } else {
        $('sections').innerHTML = `<section class="cat-sec" id="sec-${c.id}"><button type="button" class="btn sec-back" data-open-cat="all">← All sections</button>
          <div class="cat-h"><h2>${c.name}${c.locked ? LOCK : ''}</h2><p>${c.blurb}</p></div>
          ${groups.length ? `<div class="sec-tiles">${groups.map(([s, ts]) => subTile(c, s, ts)).join('')}</div>`
            : `<div class="tools">${list.map(card).join('')}</div>`}</section>`;
      }
    }
    $('q-status').textContent = '';
    return;
  }
  const featured = liveNow.length ? `<section class="cat-sec live-now"><div class="cat-h"><h2>${q ? 'Matches' : 'Live now'}</h2>
      </div>
      <div class="tools featured">${liveNow.map(card).join('')}</div></section>` : '';
  const html = featured + cats.map(c => {
    const list = TOOLS.filter(t => inCat(t, c.id) && match(t) && !(liveNow.includes(t)));
    if (!list.length) return '';
    return `<section class="cat-sec" id="sec-${c.id}"><div class="cat-h"><h2>${c.name}${c.locked ? LOCK : ''}</h2><p>${c.blurb}</p></div>
      <div class="tools">${list.map(card).join('')}</div></section>`;
  }).join('');
  const narr = SITE === 'deterrence' && NARR_WORDS.test(q) ? ` For state rhetoric and information warfare, see <a href="/narratives/">Narrative Tracking</a>.` : '';
  $('sections').innerHTML = html || `<p class="empty">No tools match “${esc(q)}”. Try a category name, such as “trackers” or “classroom”.${narr}</p>`;
  $('q-status').textContent = q ? `${liveNow.length} tool${liveNow.length === 1 ? '' : 's'} match` : '';
}
// Landing extras on section-tile sites: a Game Theory Gallery card beside the headline, and a rotating
// "Try one" spotlight of open tools beside the section tiles. Both show only on the overview.
if (TILES) {
  const hero = document.querySelector('.hero');
  const gtg = TOOLS.find(t => t.slug === 'game-theory-gallery' && t.status === 'live');
  if (hero && gtg) hero.insertAdjacentHTML('beforeend', `<a class="promo" href="tools/game-theory-gallery/">
    <svg class="promo-sketch" viewBox="0 0 172 100" aria-hidden="true">
      <path d="M20 47 L70 22 M20 53 L70 80 M82 19 L118 8 M82 23 L118 38"/>
      <circle cx="14" cy="50" r="6"/><circle cx="76" cy="21" r="6"/><circle cx="76" cy="81" r="5" class="term"/>
      <text x="124" y="12">(2, 1)</text><text x="124" y="42">(0, 0)</text><text x="86" y="85">(1, 2)</text>
      <text x="22" y="26" class="lbl">Fight</text><text x="22" y="84" class="lbl">Yield</text></svg>
    <span class="promo-t"><b>Check out the Game Theory Gallery</b>
      <span>Play with interactive models and tables of the field's most influential theories.</span>
      <span class="go">Open the gallery →</span></span></a>`);
  const main = $('sections');
  const grid = document.createElement('div');
  grid.className = 'home-grid wrap';
  main.classList.remove('wrap');
  main.before(grid); grid.append(main);
  const pool = TOOLS.filter(t => t.status === 'live' && t.cat !== 'dev' && !isLocked(t) && TAGLINES[t.slug] && t.slug !== 'game-theory-gallery');
  if (pool.length) {
    const aside = document.createElement('aside');
    aside.className = 'spot'; aside.setAttribute('aria-label', 'Try one');
    aside.innerHTML = `<div class="spot-h"><p class="spot-k">Try one</p><div class="spot-nav">
      <button type="button" class="spot-b" data-d="-1" aria-label="Previous tool">‹</button><span class="spot-n" aria-hidden="true"></span>
      <button type="button" class="spot-b" data-d="1" aria-label="Next tool">›</button></div></div><div class="spot-card"></div>`;
    grid.append(aside);
    let i = Math.floor(Math.random() * pool.length), timer = null, hold = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Each tool's animated trailer (the same ones as jwalberg.com/interactive); the spotlight moves on when it ends.
    const TRAILERS = 'https://jwalberg.com/interactive/motion/';
    let dur = 17000;
    const show = () => {
      const t = pool[i];
      aside.querySelector('.spot-card').innerHTML = `<a class="spot-link" href="tools/${t.slug}/"><h3>${esc(t.title)}</h3>
        <div class="spot-img"><iframe src="${TRAILERS}${t.slug}/${reduced ? '?poster' : ''}" title="Animated preview of ${esc(t.title)}"
          tabindex="-1" aria-hidden="true" loading="eager"></iframe></div>
        <p>${esc(TAGLINES[t.slug])}</p><span class="go">Open →</span></a>`;
      aside.querySelector('.spot-n').textContent = `${i + 1} / ${pool.length}`;
      dur = 17000;
    };
    addEventListener('message', e => { if (e.origin === 'https://jwalberg.com' && e.data?.duration) { dur = e.data.duration * 1000; tick(); } });
    const step = d => { i = (i + d + pool.length) % pool.length; show(); tick(); };
    const tick = () => { clearTimeout(timer); if (!reduced) timer = setTimeout(function next() { if (!hold && !document.hidden) step(1); else timer = setTimeout(next, 1500); }, dur); };
    aside.addEventListener('click', e => { const b = e.target.closest('.spot-b'); if (b) step(+b.dataset.d); });
    aside.addEventListener('pointerenter', () => { hold = true; }); aside.addEventListener('pointerleave', () => { hold = false; });
    aside.addEventListener('focusin', () => { hold = true; }); aside.addEventListener('focusout', () => { hold = false; });
    show(); tick();
  }
}

render();

// Keyboard: "/" search, "?" help, arrows move between cards (by position) and along the category bar.
const cards = () => [...$('sections').querySelectorAll('a.tool')];
function moveCard(from, key) {
  const all = cards();
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const vert = key === 'ArrowDown' || key === 'ArrowUp';
  let best = null, bestD = Infinity;
  for (const c of all) {
    if (c === from) continue;
    const r = c.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const ok = key === 'ArrowRight' ? dx > 4 && Math.abs(dy) < a.height / 2
      : key === 'ArrowLeft' ? dx < -4 && Math.abs(dy) < a.height / 2
        : key === 'ArrowDown' ? dy > 4 : dy < -4;
    if (!ok) continue;
    const d = vert ? Math.abs(dy) * 3 + Math.abs(dx) : Math.abs(dx);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best && key === 'ArrowRight') best = all[all.indexOf(from) + 1];
  if (!best && key === 'ArrowLeft') best = all[all.indexOf(from) - 1];
  return best || null;
}
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || $('help').open) return;
  const t = e.target, typing = t.matches('input, textarea, select, [contenteditable]');
  if (!typing && e.key === '/') { e.preventDefault(); $('q').focus(); $('q').select(); return; }
  if (!typing && e.key === '?') { e.preventDefault(); openHelp(); return; }
  if (t === $('q')) {
    if (e.key === 'Escape' && $('q').value) { $('q').value = ''; render(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') { const c = cards()[0]; if (c) { e.preventDefault(); c.focus(); } }
    return;
  }
  if (!ARROWS.includes(e.key)) return;
  const i = catBtns.indexOf(t);
  if (i >= 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault(); catBtns[(i + (e.key === 'ArrowRight' ? 1 : -1) + catBtns.length) % catBtns.length].focus(); return;
  }
  if (t.matches('a.tool')) {
    const n = moveCard(t, e.key);
    if (n) { e.preventDefault(); n.focus({ preventScroll: true }); n.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); $('q').focus(); }
  }
});

// Help dialog
function openHelp() { $('help').showModal(); }
$('help-btn').onclick = openHelp;
$('help').addEventListener('click', e => { if (e.target === $('help') || e.target.closest('[data-close]')) $('help').close(); });

// This week's dashboard (Taiwan Strait data, TSM site only): small shared data first, heavy tool data after first paint.
// The week panel reads and links into these tools; a promoted-list build (taiwanmonitor.com) may not publish them.
const WEEK_TOOLS = ['strait-snapshot', 'ccg-grayzone', 'dark-fleet', 'transit-response', 'day-in-the-strait'];
if (SITE === 'tsm' && WEEK_TOOLS.every(s => TOOLS.some(t => t.slug === s))) mountWeek($('week')); else $('week').remove();

// Thumbnails are screenshots of real data, so the build encrypts them. Load through fetch
// (which the access gate decrypts), then fall back to the drawn thumb.svg.
const thumbCache = new Map();
function loadThumbs() {
  document.querySelectorAll('img[data-thumb]:not([src])').forEach(img => {
    const base = img.dataset.thumb;
    if (!thumbCache.has(base)) {
      thumbCache.set(base, fetch(base + 'thumb.png').then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(b => (b.type && !b.type.startsWith('image') ? new Blob([b], { type: 'image/png' }) : b))
        .then(b => URL.createObjectURL(b)).catch(() => base + 'thumb.svg'));
    }
    thumbCache.get(base).then(src => { img.src = src; img.onerror = () => img.remove(); });
  });
}
new MutationObserver(loadThumbs).observe(document.body, { childList: true, subtree: true });
loadThumbs();
