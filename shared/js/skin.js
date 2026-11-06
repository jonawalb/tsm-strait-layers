// Graphics style for games on Interactive Deterrence: "Original" (the site look) or "Trailer" (the night
// plotting table from the /interactive trailers). The choice is per viewer, shared by every game, and asked
// on each game: the choice is remembered per game, so opening a different game asks again.
//   import { skin, skinColors } from '../../shared/js/skin.js';
//   addEventListener('skinchange', () => redraw());   // for canvas games that bake colours in
const slug = (location.pathname.match(/\/tools\/([^/]+)\//) || [])[1] || 'site';
const KEY = 'skin:' + slug;
const ROOT = new URL('../../', import.meta.url).href;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = v => { try { localStorage.setItem(KEY, v); } catch { /* private mode: choice lasts this page */ } };

/** Current skin: 'trailer' or 'original'. */
export const skin = () => document.documentElement.dataset.skin === 'trailer' ? 'trailer' : 'original';

/** Resolved colour tokens for canvas code, e.g. skinColors().accent. */
export function skinColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue('--' + n).trim();
  return Object.fromEntries(['bg', 'panel', 'ink', 'muted', 'faint', 'rule', 'chip', 'accent', 'focus', 'sea', 'land', 'coast',
    'grat', 'blue', 'red', 'good', 'warn', 'bad'].map(k => [k, g(k)]));
}

function apply(v, announce = true) {
  const root = document.documentElement;
  if (v === 'trailer') root.dataset.skin = 'trailer'; else delete root.dataset.skin;
  document.querySelectorAll('.skin-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skin === skin())));
  if (announce) dispatchEvent(new CustomEvent('skinchange', { detail: { skin: skin() } }));
}

function switchEl() {
  const w = document.createElement('div');
  w.className = 'skin-switch';
  w.innerHTML = `<span id="skin-l">Graphics</span><span class="skin-seg" role="group" aria-labelledby="skin-l">
    <button type="button" data-skin="original" aria-pressed="false">Original</button>
    <button type="button" data-skin="trailer" aria-pressed="false">Trailer</button></span>`;
  w.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { write(b.dataset.skin); apply(b.dataset.skin); } });
  return w;
}

// Non-modal (D-28, Defense in Depth): the box docks bottom-right, the page stays usable behind it, and a press
// anywhere outside it closes it as "Original" and still reaches whatever was pressed (it never swallows a click).
function chooser() {
  const d = document.createElement('div');
  d.className = 'skin-chooser';
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'false'); d.setAttribute('aria-labelledby', 'skin-ch-t');
  d.innerHTML = `<div class="box"><h2 id="skin-ch-t">Choose your graphics</h2>
    <p>Same game, same numbers. Pick the look you want to play this game in.</p>
    <div class="opts">
      <button type="button" class="opt" data-skin="original"><i class="sw orig"></i><b>Original</b><span>The clean site look, light or dark.</span></button>
      <button type="button" class="opt" data-skin="trailer"><i class="sw trl"></i><b>Trailer</b><span>The night plotting table, with more motion.</span></button>
    </div><p class="fine">You can switch any time from “Graphics” at the top of the page.</p></div>`;
  const outside = e => { if (!d.contains(e.target)) close('original', false); };
  const close = (v, refocus = true) => {
    document.removeEventListener('pointerdown', outside, true);
    write(v); apply(v); d.remove();
    if (refocus) document.querySelector('.skin-switch button[aria-pressed="true"]')?.focus();
  };
  document.addEventListener('pointerdown', outside, true);   // capture, no preventDefault: the press carries on
  d.addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) close(b.dataset.skin); });
  d.addEventListener('keydown', e => { if (e.key === 'Escape') close('original'); });
  return d;
}

/** Called by chrome.js on a game page. */
export function initSkin() {
  if (!document.getElementById('skin-css')) {
    const l = document.createElement('link');
    l.id = 'skin-css'; l.rel = 'stylesheet'; l.href = ROOT + 'shared/css/trailer.css';
    document.head.appendChild(l);
  }
  const q = new URLSearchParams(location.search).get('skin');
  const saved = q === 'trailer' || q === 'original' ? q : read();
  apply(saved || 'original', false);
  const bar = document.querySelector('.tsm-bar-in') || document.getElementById('tsm-head');
  if (bar && !document.querySelector('.skin-switch')) bar.appendChild(switchEl());
  apply(skin(), false);
  if (!saved && !navigator.webdriver) {
    const d = chooser();
    document.body.appendChild(d);
    d.querySelector('.opt').focus({ preventScroll: true });
  }
}
