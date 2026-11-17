// Timelines under the map: China's island-building and Second Thomas Shoal. A dated strip plus cards;
// focusing an entry flashes and zooms to the features it involves.
import { el, escapeHtml } from '../../../shared/js/mapkit.js';
import { TIMELINES } from '../data/timeline.js';

const esc = escapeHtml;
const t = d => Date.parse(d.length === 4 ? d + '-07-01' : d.length === 7 ? d + '-15' : d);
const fmtDate = d => d.length === 4 ? d : new Date(t(d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', ...(d.length > 7 ? { day: 'numeric' } : {}), timeZone: 'UTC' });

export function createTimeline(tabs, strip, cards, onFocus) {
  let cur = null;
  tabs.innerHTML = TIMELINES.map(tl => `<button type="button" role="tab" class="btn" data-t="${tl.id}">${esc(tl.name)}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.t));

  function show(id) {
    cur = TIMELINES.find(x => x.id === id) || TIMELINES[0];
    tabs.querySelectorAll('button').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.t === cur.id)); b.setAttribute('aria-pressed', String(b.dataset.t === cur.id)); });
    const items = [...cur.items].sort((a, b) => t(a.date) - t(b.date));
    strip.innerHTML = '';
    const y0 = new Date(t(items[0].date)).getUTCFullYear(), y1 = new Date(t(items[items.length - 1].date)).getUTCFullYear() + 1;
    const T0 = Date.UTC(y0, 0, 1), T1 = Date.UTC(y1, 0, 1), Wd = 1000, pad = 16;
    strip.setAttribute('viewBox', `0 0 ${Wd} 76`);
    const x = ms => pad + (ms - T0) / (T1 - T0) * (Wd - 2 * pad);
    el('line', { x1: pad, x2: Wd - pad, y1: 34, y2: 34, class: 'tl-axis' }, strip);
    for (let y = y0; y <= y1; y++) {
      el('line', { x1: x(Date.UTC(y, 0, 1)), x2: x(Date.UTC(y, 0, 1)), y1: 28, y2: 40, class: 'tl-tick' }, strip);
      if (y < y1) el('text', { x: x(Date.UTC(y, 0, 1)) + 4, y: 70, class: 'tl-year' + (y1 - y0 > 8 && (y - y0) % 2 ? ' alt' : '') }, strip, y);
    }
    const dots = items.map((it, i) => {
      const g = el('g', { class: 'tl-dot', tabindex: 0, role: 'button', 'aria-label': `${fmtDate(it.date)}: ${it.title}`, transform: `translate(${x(t(it.date)).toFixed(1)} 34)` }, strip);
      el('circle', { r: 7 }, g);
      g.addEventListener('click', () => focus(i, true));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus(i, true); } });
      return g;
    });
    cards.innerHTML = (cur.intro ? `<article class="inc intro"><h3>${esc(cur.name)}</h3><p>${esc(cur.intro)}</p></article>` : '') +
      items.map((it, i) => `<article class="inc" data-i="${i}" tabindex="-1">
      <p class="inc-date num">${fmtDate(it.date)}</p><h3>${esc(it.title)}</h3><p>${esc(it.summary)}</p>
      ${it.vessels?.length ? `<p class="fine">Named in reporting: ${esc(it.vessels.join('; '))}</p>` : ''}
      <p class="fine">${it.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>
      ${it.features?.length ? `<button type="button" class="btn show" data-i="${i}">Show on map</button>` : ''}</article>`).join('');
    const cardEls = [...cards.querySelectorAll('.inc[data-i]')];
    cards.querySelectorAll('.show').forEach(b => b.onclick = () => { focus(+b.dataset.i, false); onFocus(items[+b.dataset.i].features, true); });
    cardEls.forEach((c, i) => c.addEventListener('pointerenter', () => focus(i, false, true)));
    function focus(i, scroll, quiet) {
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      cardEls.forEach((c, k) => c.classList.toggle('on', k === i));
      if (scroll) cardEls[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      onFocus(items[i].features || [], !quiet && scroll);
    }
    cards.onpointerleave = () => onFocus([], false);
  }
  return { show, current: () => cur?.id };
}
