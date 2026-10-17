// Incident log: a dated strip plus cards, filterable by area and cause. Every card cites its sources.
import { el, escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { INCIDENTS } from '../data/incidents.js';

export const CAUSES = { anchor: 'Anchor or dragging', fishing: 'Fishing gear', natural: 'Earthquake, typhoon or wear', ship: 'Other ship activity', unknown: 'Cause not established' };
const AREAS = [['all', 'All areas'], ['taiwan', 'Taiwan and its islands'], ['ryukyu', 'Nansei islands'], ['philippines', 'Philippines']];
const t = d => Date.parse(d.length === 7 ? d + '-15' : d.length === 4 ? d + '-07-01' : d);

export function createTimeline(root, act) {
  const list = [...INCIDENTS].sort((a, b) => t(a.date) - t(b.date));
  const f = { area: 'all', cause: 'all' };
  root.innerHTML = `
    <div class="tl-h"><div><p class="eyebrow">Incident log</p><h2 class="tl-title">Cable cuts and damage, with sources</h2></div>
      <p class="fine" id="tl-count"></p></div>
    <div class="tl-filters">
      <div class="seg" role="group" aria-label="Area">${AREAS.map(([id, n]) => `<button type="button" class="btn" data-a="${id}">${n}</button>`).join('')}</div>
      <label class="sel">Cause <select id="tl-cause"><option value="all">All causes</option>${Object.entries(CAUSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    </div>
    <svg class="tl-strip" id="tl-strip" role="group" aria-label="Incident dates"></svg>
    <div class="tl-cards" id="tl-cards"></div>`;
  const strip = root.querySelector('#tl-strip'), cards = root.querySelector('#tl-cards');
  root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { f.area = b.dataset.a; draw(); });
  root.querySelector('#tl-cause').onchange = e => { f.cause = e.target.value; draw(); };

  function draw(selId) {
    root.querySelectorAll('[data-a]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === f.area)));
    const shown = list.filter(i => (f.area === 'all' || i.region === f.area) && (f.cause === 'all' || i.cause === f.cause));
    root.querySelector('#tl-count').textContent = `${shown.length} of ${list.length} incidents shown, newest first. Markers on the map sit at the reported area.`;
    const W = 1000, H = 64, y0 = t('2006-01-01'), y1 = t('2027-01-01');
    const x = d => 20 + (t(d) - y0) / (y1 - y0) * (W - 40);
    strip.setAttribute('viewBox', `0 0 ${W} ${H}`);
    strip.innerHTML = '';
    el('line', { x1: 20, x2: W - 20, y1: 40, y2: 40, class: 'tl-axis' }, strip);
    const step = strip.clientWidth && strip.clientWidth < 600 ? 4 : 2;
    for (let y = 2006; y <= 2026; y += step) {
      const xx = x(`${y}-01-01`);
      el('line', { x1: xx, x2: xx, y1: 40, y2: 46, class: 'tl-tick' }, strip);
      el('text', { x: xx, y: 60, class: 'tl-year', 'text-anchor': y === 2006 ? 'start' : 'middle' }, strip, String(y));
    }
    const stack = {};
    for (const i of shown) {
      const xx = x(i.date), k = Math.round(xx / 9);
      stack[k] = (stack[k] || 0) + 1;
      const g = el('g', { class: `tl-dot c-${i.cause}${i.id === selId ? ' on' : ''}`, tabindex: 0, role: 'button', 'aria-label': `${i.dateLabel}: ${i.title}` }, strip);
      el('circle', { cx: xx, cy: 40 - 9 * (stack[k] - 1) - 2, r: 5.5 }, g);
      el('title', {}, g, `${i.dateLabel}: ${i.title}`);
      g.onclick = () => pick(i.id);
      g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i.id); } };
    }
    cards.innerHTML = [...shown].reverse().map(i => `<article class="inc${i.id === selId ? ' on' : ''}" data-i="${esc(i.id)}">
      <p class="inc-date num">${esc(i.dateLabel)} · ${esc(i.areaLabel)}</p>
      <h3>${esc(i.title)}</h3><p>${esc(i.summary)}</p>
      <p class="fine"><span class="cz c-${i.cause}"></span>${esc(CAUSES[i.cause] || i.cause)}${i.days != null ? ` · repaired after ${i.days} day${i.days === 1 ? "" : "s"}` : ''}</p>
      <p class="fine srcs">${i.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>
      <button type="button" class="btn" data-open="${esc(i.id)}">Open on map</button></article>`).join('')
      || '<p class="fine">No incidents match these filters.</p>';
    cards.querySelectorAll('[data-open]').forEach(b => b.onclick = () => pick(b.dataset.open));
  }
  function pick(id) { act.incident(id); }
  draw();
  return {
    show(id) {
      draw(id);
      const c = cards.querySelector(`[data-i="${CSS.escape(id)}"]`);
      if (c) cards.scrollTo({ left: c.offsetLeft - cards.offsetLeft - 8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    },
  };
}
