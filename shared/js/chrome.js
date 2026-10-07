// Injects the shared TSM site bar, header and footer into a tool page.
// Usage (tools/<slug>/index.html): <header id="tsm-head"></header> ... <footer id="tsm-foot"></footer>
//   import { mountChrome } from '../../shared/js/chrome.js';
//   mountChrome({ title: 'CCG Gray-Zone Map', sub: 'One-sentence description.', category: 'Live trackers' });
// Pages with their own header (strait-layers) call mountNav() alone: it prepends the site bar to <body>.
import { CATEGORIES, ALL_CATEGORIES, TOOLS, ALL_TOOLS, DEV_SEALED, addTools, onSite } from './registry.js';
import { NAV_CSS } from './nav-css.js';
import { initSkin } from './skin.js';

const ROOT = new URL('../../', import.meta.url).href;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountChrome({ title, sub = '', category = '', credit = 'Jonathan Walberg' }) {
  document.title = `${title} | Taiwan Security Monitor`;
  if (!document.querySelector('link[rel="icon"]')) {
    const l = document.createElement('link');
    l.rel = 'icon'; l.type = 'image/png'; l.href = ROOT + 'shared/assets/favicon.png';
    document.head.appendChild(l);
  }
  const head = document.getElementById('tsm-head');
  if (head) {
    head.className = 'tsm-head';
    head.innerHTML = `
      <a class="tsm-brand" href="${ROOT}">
        <img src="${ROOT}shared/assets/tsm-logo.png" alt="Taiwan Security Monitor, George Mason University" width="52" height="52">
        <div><p class="tsm-org">Taiwan Security Monitor${category ? ' · ' + category : ''}</p><h1 class="tsm-title">${title}</h1>
        ${sub ? `<p class="tsm-sub">${sub}</p>` : ''}</div>
      </a>`;
  }
  const foot = document.getElementById('tsm-foot');
  if (foot) {
    foot.className = 'tsm-foot';
    foot.innerHTML = `<img src="${ROOT}shared/assets/tsm-logo.png" alt="" width="34" height="34">
      <p><b>Taiwan Security Monitor</b> · Schar School of Policy and Government, George Mason University.
      <a href="https://tsm.schar.gmu.edu/" target="_blank" rel="noopener">tsm.schar.gmu.edu</a></p>`;
  }
  mountNav();
}

/** Current tool slug from the URL (tools/<slug>/), or ''. */
function currentSlug() {
  const m = location.pathname.match(/\/tools\/([^/]+)\//);
  return m ? m[1] : '';
}

/** Slim site bar: home link, tools menu by category, quick search, prev/next within the category. */
export function mountNav() {
  if (document.getElementById('tsm-bar')) return;
  if (!document.getElementById('tsm-nav-css')) {
    const st = document.createElement('style');
    st.id = 'tsm-nav-css'; st.textContent = NAV_CSS;
    document.head.appendChild(st);
  }
  const live = TOOLS.filter(t => t.status === 'live');
  const slug = currentSlug();
  const cur = live.find(t => t.slug === slug);
  // Prev/next and the menu flag tools behind a password; from an open tool, prev/next skip them.
  const lockedCats = new Set(ALL_CATEGORIES.filter(c => c.locked && onSite(c)).map(c => c.id));
  const isLocked = t => (lockedCats.has(t.cat) || !!t.locked || !!t.vault) && !window.TSMVault?.isOpen?.(t.slug);
  const inCat = cur ? live.filter(t => t.cat === cur.cat && (t === cur || isLocked(cur) || !isLocked(t))) : [];
  const i = cur ? inCat.indexOf(cur) : -1;
  const prev = i > 0 ? inCat[i - 1] : null, next = i >= 0 && i < inCat.length - 1 ? inCat[i + 1] : null;
  const catName = cur ? CATEGORIES.find(c => c.id === cur.cat)?.name : '';
  const href = t => `${ROOT}tools/${t.slug}/`;

  const groups = CATEGORIES.map(c => {
    const ts = live.filter(t => t.cat === c.id);
    if (!ts.length) return '';
    return `<div class="tsm-menu-g"><p>${esc(c.name)}</p><ul>${ts.map(t =>
      `<li><a href="${href(t)}"${t.slug === slug ? ' aria-current="page"' : ''}>${esc(t.title)}${isLocked(t) ? ' <span title="Password protected" aria-label="password protected">🔒</span>' : ''}</a></li>`).join('')}</ul></div>`;
  }).join('');

  const bar = document.createElement('nav');
  bar.id = 'tsm-bar'; bar.className = 'tsm-bar'; bar.setAttribute('aria-label', 'TSM Interactive');
  bar.innerHTML = `<div class="tsm-bar-in">
    <a class="tsm-bar-home" href="${ROOT}"><img src="${ROOT}shared/assets/tsm-logo.png" alt="" width="24" height="24"><span>TSM Interactive</span></a>
    <div class="tsm-bar-menu">
      <button type="button" class="tsm-bar-btn" id="tsm-menu-btn" aria-expanded="false" aria-controls="tsm-menu">All tools<span class="tsm-caret" aria-hidden="true"></span></button>
      <div class="tsm-menu" id="tsm-menu" hidden>${groups}<a class="tsm-menu-all" href="${ROOT}">Landing page with every tool</a></div>
    </div>
    <div class="tsm-bar-search">
      <label class="tsm-vh" for="tsm-q">Find a tool</label>
      <input id="tsm-q" type="search" placeholder="Find a tool" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="tsm-q-list" aria-autocomplete="list">
      <ul id="tsm-q-list" class="tsm-q-list" role="listbox" aria-label="Matching tools" hidden></ul>
    </div>
    ${cur && inCat.length > 1 ? `<div class="tsm-bar-step" role="group" aria-label="More in ${esc(catName)}">
      ${prev ? `<a href="${href(prev)}" rel="prev" title="Previous in ${esc(catName)}: ${esc(prev.title)}"><span aria-hidden="true">‹</span> <span class="tsm-step-t">${esc(prev.title)}</span></a>` : ''}
      <span class="tsm-step-n">${esc(catName)} ${i + 1}/${inCat.length}</span>
      ${next ? `<a href="${href(next)}" rel="next" title="Next in ${esc(catName)}: ${esc(next.title)}"><span class="tsm-step-t">${esc(next.title)}</span> <span aria-hidden="true">›</span></a>` : ''}
    </div>` : ''}
  </div>`;
  // TSM build: the masthead's green band has a slot for the bar (scripts/build_site.py adds it).
  const slot = document.getElementById('tsm-mast-bar');
  if (slot) slot.append(bar); else document.body.prepend(bar);
  wireMenu(bar);
  wireSearch(bar, live, href);
  // Games offer a choice of graphics (Original or Trailer), asked per game, on whichever site they appear.
  if (ALL_TOOLS.find(t => t.slug === slug)?.game) initSkin();
  else if (DEV_SEALED && window.TSMVault?.unseal) {
    // Coming Soon pages: their registry entry is sealed; read it once this page's password has been entered.
    window.TSMVault.unseal(DEV_SEALED, 4).then(txt => { addTools(JSON.parse(txt)); if (ALL_TOOLS.find(t => t.slug === slug)?.game) initSkin(); }, () => {});
  }
  unlinkMissingTools();
}

// A site built from a subset of tools (taiwanmonitor.com publishes only promoted ones) drops the others from the
// registry, and every site lists only its own tools. A link from this page to a sibling tool this site does not
// publish would 404, so it becomes plain text.
// Tools draw some text later, so links added after load are checked too.
function unlinkMissingTools() {
  const toolsRoot = location.pathname.replace(/\/tools\/[^/]+\/.*$/, '/tools/');
  const check = root => root.querySelectorAll?.('a[href]').forEach(a => {
    let u; try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (u.origin !== location.origin || !u.pathname.startsWith(toolsRoot)) return;
    const m = u.pathname.slice(toolsRoot.length).match(/^([a-z0-9-]+)\/(index\.html)?$/);
    if (!m || TOOLS.some(t => t.slug === m[1] && t.status === 'live')) return;
    a.replaceWith(document.createTextNode(a.textContent));
  });
  check(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && check(n.parentNode || n))))
    .observe(document.body, { childList: true, subtree: true });
}

function wireMenu(bar) {
  const btn = bar.querySelector('#tsm-menu-btn'), menu = bar.querySelector('#tsm-menu');
  const set = open => {
    menu.hidden = !open; btn.setAttribute('aria-expanded', open);
    if (open) { // keep the menu inside the viewport on narrow screens (it is anchored to the button's left edge)
      menu.style.left = '0px';
      const r = menu.getBoundingClientRect(), over = r.right - (innerWidth - 16);
      if (over > 0) menu.style.left = `${-Math.min(over, r.left - 16)}px`;
    }
    if (open) (menu.querySelector('[aria-current]') || menu.querySelector('a')).focus();
  };
  btn.addEventListener('click', () => set(menu.hidden));
  menu.addEventListener('keydown', e => {
    const links = [...menu.querySelectorAll('a')], k = links.indexOf(document.activeElement);
    if (e.key === 'Escape') { set(false); btn.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      links[(k + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
    }
  });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('.tsm-bar-menu')) set(false); });
  bar.addEventListener('focusout', e => { if (!menu.hidden && e.relatedTarget && !e.relatedTarget.closest('.tsm-bar-menu')) set(false); });
}

function wireSearch(bar, live, href) {
  const q = bar.querySelector('#tsm-q'), list = bar.querySelector('#tsm-q-list');
  const catOf = id => CATEGORIES.find(c => c.id === id)?.name || '';
  let hits = [], act = -1;
  const mark = () => {
    list.querySelectorAll('[role=option]').forEach((li, k) => li.setAttribute('aria-selected', k === act));
    if (act >= 0) q.setAttribute('aria-activedescendant', `tsm-q-${act}`); else q.removeAttribute('aria-activedescendant');
  };
  const show = () => {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    hits = !words.length ? [] : live.map(t => {
      const title = t.title.toLowerCase(), hay = `${title} ${t.blurb} ${catOf(t.cat)}`.toLowerCase();
      if (!words.every(w => hay.includes(w))) return null;
      return { t, s: words.reduce((s, w) => s + (title.includes(w) ? 2 : 1), 0) };
    }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 7).map(h => h.t);
    act = hits.length ? 0 : -1;
    list.innerHTML = hits.length
      ? hits.map((t, k) => `<li role="option" id="tsm-q-${k}"><a href="${href(t)}" tabindex="-1"><b>${esc(t.title)}</b><span>${esc(catOf(t.cat))}</span></a></li>`).join('')
      : (words.length ? '<li class="tsm-q-none">No tool matches.</li>' : '');
    list.hidden = !words.length;
    q.setAttribute('aria-expanded', !list.hidden);
    mark();
  };
  q.addEventListener('input', show);
  q.addEventListener('focus', () => { if (q.value) show(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; mark();
    } else if (e.key === 'Enter' && act >= 0) { e.preventDefault(); location.href = href(hits[act]); }
    else if (e.key === 'Escape') { q.value = ''; list.hidden = true; q.setAttribute('aria-expanded', 'false'); }
  });
  q.addEventListener('blur', () => setTimeout(() => { list.hidden = true; q.setAttribute('aria-expanded', 'false'); }, 150));
}
