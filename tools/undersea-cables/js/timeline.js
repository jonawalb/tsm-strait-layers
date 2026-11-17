// Incident timeline under the map: a dated strip plus cards. Cards with a replay button apply a cut scenario.
import { el, escapeHtml } from '../../../shared/js/mapkit.js';
import { INCIDENTS } from '../data/incidents.js';
import { dayLink, exerciseFor, exerciseLink, linkHtml } from '../../../shared/js/links.js';

const esc = escapeHtml;
const t = d => Date.parse(d.length === 7 ? d + '-15' : d);
const fmtDate = d => new Date(t(d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', ...(d.length > 7 ? { day: 'numeric' } : {}), timeZone: 'UTC' });

/** Links to PLA activity around a full incident date: the day view (2026) or a PLA exercise that week. */
function xlinks(d) {
  if (d.length !== 10) return '';
  const x = exerciseFor(d);
  const a = [linkHtml(dayLink(d), 'PLA and CCG activity that day'), x ? linkHtml(exerciseLink(x.id, d), `PLA exercise within a week: ${esc(x.short)}`) : ''].filter(Boolean);
  return a.length ? `<p class="xlinks">${a.join('')}</p>` : '';
}

export function createTimeline(strip, cards, onReplay) {
  const items = [...INCIDENTS].sort((a, b) => t(a.date) - t(b.date));
  if (!items.length) return;
  const y0 = new Date(t(items[0].date)).getUTCFullYear(), y1 = new Date(t(items[items.length - 1].date)).getUTCFullYear() + 1;
  const T0 = Date.UTC(y0, 0, 1), T1 = Date.UTC(y1, 0, 1);
  const Wd = 1000, Hd = 64, pad = 16;
  strip.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
  const x = d => pad + (t(d) - T0) / (T1 - T0) * (Wd - 2 * pad);
  el('line', { x1: pad, x2: Wd - pad, y1: 34, y2: 34, class: 'tl-axis' }, strip);
  for (let y = y0; y <= y1; y++) {
    const xx = pad + (Date.UTC(y, 0, 1) - T0) / (T1 - T0) * (Wd - 2 * pad);
    el('line', { x1: xx, x2: xx, y1: 28, y2: 40, class: 'tl-tick' }, strip);
    if (y < y1) el('text', { x: xx + 4, y: 58, class: 'tl-year' }, strip, y);
  }
  const dots = items.map((it, i) => {
    const g = el('g', { class: 'tl-dot', tabindex: 0, role: 'button', 'aria-label': `${fmtDate(it.date)}: ${it.title}`, transform: `translate(${x(it.date).toFixed(1)} 34)` }, strip);
    el('circle', { r: 7 }, g);
    const go = () => { focus(i, true); };
    g.addEventListener('click', go);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return g;
  });
  cards.innerHTML = items.map((it, i) => `<article class="inc" data-i="${i}">
    <p class="inc-date num">${fmtDate(it.date)}</p><h3>${esc(it.title)}</h3><p>${esc(it.summary)}</p>
    ${it.vessels?.length ? `<p class="fine">Vessel${it.vessels.length > 1 ? 's' : ''} named in reporting: ${esc(it.vessels.join('; '))}</p>` : ''}
    <p class="fine">${it.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>
    ${xlinks(it.date)}
    ${it.preset ? `<button type="button" class="btn replay" data-p="${it.preset}">Replay on the map</button>` : ''}</article>`).join('');
  cards.querySelectorAll('.replay').forEach(b => b.onclick = () => onReplay(b.dataset.p));
  const cardEls = [...cards.querySelectorAll('.inc')];
  cardEls.forEach((c, i) => c.addEventListener('pointerenter', () => focus(i, false)));
  function focus(i, scroll) {
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    cardEls.forEach((c, k) => c.classList.toggle('on', k === i));
    if (scroll) cardEls[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }
}
