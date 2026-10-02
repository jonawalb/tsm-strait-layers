// A Day in the Strait: compose and render one day's story; day picker, suggestions, URL hash, reveal animations.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { compose, suggestions, summary, longDate, shortDate, tinyDate, clock, addDays, START, AS_OF, LOC_LABEL, atLoc } from './day.js';
import { drawClock } from './clock.js';
import { createDayMap } from './map.js';
import { renderWeek, drawYear } from './context.js';
import { exerciseFor, exerciseLink, linkHtml } from '../../../shared/js/links.js';
import { addExportBar } from '../../../shared/js/export.js';
import { TSM } from '../../../shared/data/tsm.js';

const $ = s => document.querySelector(s);
const esc = escapeHtml;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULT = '2026-06-03';
let D = DEFAULT;
{
  const q = new URLSearchParams(location.hash.slice(1)).get('d');
  if (/^\d{4}-\d{2}-\d{2}$/.test(q || '') && q >= START && q <= AS_OF) D = q;
}

const map = createDayMap($('#map'));
const input = $('#pick');
input.min = START; input.max = AS_OF;
input.onchange = () => { if (input.value >= START && input.value <= AS_OF) go(input.value); };
$('#prev').onclick = () => go(addDays(D, -1));
$('#next').onclick = () => go(addDays(D, 1));
$('#sugg').innerHTML = suggestions(6).map(s => `<button type="button" class="chip" data-d="${s.d}"><b>${tinyDate(s.d)}</b><span>${esc(summary(s.c).slice(0, 3).join(' · '))}</span></button>`).join('');
$('#sugg').querySelectorAll('.chip').forEach(b => b.onclick = () => { go(b.dataset.d); $('#top').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); });
$('#copy-link').onclick = async e => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
  catch { e.target.textContent = 'Copy the address bar'; }
  setTimeout(() => { e.target.textContent = 'Share this day'; }, 1800);
};

function go(d) {
  if (d < START || d > AS_OF) return;
  D = d;
  render(true);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = n => (n < 10 ? NUMW[n] : String(n));

function lede(c) {
  const lines = [];
  const W = n => word(n).charAt(0).toUpperCase() + word(n).slice(1);
  if (c.air === 0) lines.push('<span class="l-air">No PLA aircraft detected.</span>');
  else if (c.air != null) lines.push(`<span class="l-air">${W(c.air)} PLA aircraft</span>${c.adiz ? `, ${word(c.adiz)} of them into Taiwan's air defense zone.` : '.'}`);
  if (c.plan != null) lines.push(`<span class="l-plan">${W(c.plan)} Chinese navy ${c.plan === 1 ? 'ship' : 'ships'}</span>${c.official ? ` and ${word(c.official)} other government ${c.official === 1 ? 'ship' : 'ships'}.` : '.'}`);
  if (String(c.flag ?? '').includes('J')) lines.push('<span class="l-j">A joint combat readiness patrol.</span>');
  if (String(c.flag ?? '').includes('L')) lines.push('<span class="l-j">A long-distance flight.</span>');
  c.incidents.forEach(i => lines.push(`<span class="l-ccg">China Coast Guard ships ${esc(atLoc(i.loc))}.</span>`));
  c.transits.forEach(t => lines.push(`<span class="l-tr">${esc(t[1])} (${esc(t[5])}) sails the Strait.</span>`));
  return lines.map(l => `<p>${l}</p>`).join('');
}

function glyphs(n, lit, cls) {
  if (n == null) return '';
  return `<div class="glyphs ${cls}" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join('')}</div>`;
}

function counters(c) {
  const box = (n, label, sub, g) => `<div class="counter"><b class="big num" data-n="${n ?? ''}">${n ?? '–'}</b><span class="c-l">${label}</span><span class="c-s">${sub}</span>${g}</div>`;
  $('#counters').innerHTML = [
    box(c.air, 'PLA aircraft detected', c.rank ? `${c.rank.below > 0 ? `More than on ${c.rank.pct}% of days in 2026.` : 'No day in 2026 had fewer.'} The 2026 average is ${c.rank.avg.toFixed(1)}.` : '', glyphs(c.air, c.adiz ?? 0, 'g-air') + (c.air ? '<p class="g-legend"><span><i class="lit"></i>entered the ADIZ</span><span><i></i>did not</span></p>' : '')),
    box(c.adiz, 'entered Taiwan\'s ADIZ', c.air ? `${Math.round((c.adiz / c.air) * 100)}% of the aircraft, which crossed the Strait median line or entered the air defense zone` : '', ''),
    box(c.plan, 'PLA Navy ships', 'Warships detected around Taiwan', glyphs(c.plan, c.plan ?? 0, 'g-ship')),
    box(c.official, 'official ships', 'Other PRC government ships, which MND counts separately', glyphs(c.official, c.official ?? 0, 'g-off')),
  ].join('');
  const w = c.win;
  $('#window-note').innerHTML = `These are totals for the 24 hours from <b>6 a.m. ${shortDate(w.startDay)}</b> to <b>6 a.m. ${shortDate(w.endDay)}</b>, Taiwan time, from the Ministry of National Defense report issued on the morning of ${shortDate(w.reportDate)}. MND does not publish when each aircraft or ship was seen, so neither do we.`;
}

function eventList(c) {
  const inW = c.events.filter(e => e.inWindow), out = c.events.filter(e => !e.inWindow);
  const src = e => e.url ? `<a href="${e.url}" target="_blank" rel="noopener">MND press release</a>` : 'Coast Guard Administration, via the TSM tracker';
  const li = (e, i) => `<li data-i="${i}" class="k-${e.kind}"><span class="ev-num">${i + 1}</span><span class="ev-time num">${clock(e.ts)}</span>
    <span class="ev-body"><b>${esc(e.title)}</b><span>${esc(e.where)}</span><small>${src(e)}</small></span></li>`;
  const untimed = c.incidents.filter(i => !i.times.length);
  $('#events').innerHTML = (inW.length ? `<ol class="evlist">${inW.map(li).join('')}</ol>` :
    `<p class="empty">Nothing on this day has a recorded clock time. The totals above are what the data can say.</p>`) +
    (untimed.length ? `<p class="fine">Recorded without a clock time: ${untimed.map(i => `CCG ${esc(atLoc(i.loc))}${i.desc ? ` (${esc(i.desc)})` : ''}`).join('; ')}.</p>` : '') +
    (out.length ? `<p class="fine">Outside this window (small rings outside the clock): ${out.map(e => `${tinyDate(new Date(e.ts).toISOString().slice(0, 10))} ${clock(e.ts)}, ${esc(e.title.toLowerCase())}${e.kind === 'ccg' ? ` at ${esc(e.where)}` : ''}`).join('; ')}.</p>` : '');
}

function incidentCards(c) {
  if (!c.incidents.length) { $('#ccg-cards').innerHTML = '<p class="fine">No China Coast Guard incursion is recorded for this date.</p>'; return; }
  $('#ccg-cards').innerHTML = c.incidents.map(i => `<article class="inc">
    <p class="eyebrow">China Coast Guard · ${esc(LOC_LABEL[i.loc])} <span class="pill approx">approximate area on map</span></p>
    ${i.desc ? `<p class="inc-d">${esc(i.desc)}</p>` : ''}
    ${i.timeline ? `<p class="inc-t"><b>Timeline, as recorded:</b> ${esc(i.timeline)}</p>` : ''}
    <p class="inc-v"><b>Vessels:</b> ${esc(i.vessels || 'not recorded')}</p>
    <p class="xlinks">${linkHtml(`../ccg-grayzone/#d=${D}`, 'On the CCG Gray-Zone Map')}</p></article>`).join('');
}

function render(scrollSafe) {
  const c = compose(D);
  input.value = D;
  $('#prev').disabled = D <= START;
  $('#next').disabled = D >= AS_OF;
  $('#date').textContent = longDate(D);
  $('#lede').innerHTML = lede(c);
  counters(c);
  const clk = drawClock($('#clock'), c, { onHover: i => {
    clk.highlight(i);
    document.querySelectorAll('.evlist li').forEach(li => li.classList.toggle('hi', Number(li.dataset.i) === i));
  } });
  eventList(c);
  document.querySelectorAll('.evlist li').forEach(li => {
    li.onmouseenter = () => clk.highlight(Number(li.dataset.i));
    li.onmouseleave = () => clk.highlight(-1);
  });
  map.update(c);
  $('#map-note').textContent = mapNote(c);
  const ex = exerciseFor(D);
  if (ex) $('#map-note').insertAdjacentHTML('beforeend', ` ${linkHtml(exerciseLink(ex.id, D), `Replay ${ex.short}`)}`);
  incidentCards(c);
  renderWeek($('#week'), D, go);
  drawYear($('#year'), D, go);
  $('#year-note').textContent = c.rank ? `Each bar is one day of 2026. ${shortDate(D)} had ${plural(c.air, 'aircraft', 'aircraft')}; the busiest day of the year had ${c.rank.max}. Click a bar to open that day.` : '';
  history.replaceState(null, '', '#d=' + D);
  document.title = `A Day in the Strait: ${shortDate(D)} | Taiwan Security Monitor`;
  if (scrollSafe) animateCounters(true);
}

function mapNote(c) {
  const bits = [];
  if (c.adiz != null) bits.push(`The ADIZ is shaded by how many aircraft entered it (${c.adiz}). MND does not publish flight tracks, so no aircraft are drawn.`);
  if (c.incidents.length) bits.push('Coast Guard circles mark the tracker\'s location category, not a position.');
  if (c.transits.length) bits.push('The transit arrow is schematic: the transit tracker records the date and ship, not the route.');
  if (!c.incidents.length && !c.transits.length) bits.push('No Coast Guard incursion or allied transit is recorded for this date.');
  return bits.join(' ');
}

/* Reveal-on-scroll and count-up */
function animateCounters(force) {
  document.querySelectorAll('.big[data-n]').forEach(b => {
    const n = Number(b.dataset.n);
    if (!b.dataset.n || reduced) { b.textContent = b.dataset.n || '–'; return; }
    if (!force && b.dataset.done) return;
    b.dataset.done = '1';
    const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur); b.textContent = Math.round(n * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
if ('IntersectionObserver' in window && !reduced) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    if (e.target.id === 'count-sec') animateCounters(false);
    io.unobserve(e.target);
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(s => io.observe(s));
} else {
  document.querySelectorAll('.reveal').forEach(s => s.classList.add('in'));
}
addEventListener('hashchange', () => {
  const q = new URLSearchParams(location.hash.slice(1)).get('d');
  if (q && q !== D && q >= START && q <= AS_OF) go(q);
});
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowLeft' && e.altKey) go(addDays(D, -1));
  if (e.key === 'ArrowRight' && e.altKey) go(addDays(D, 1));
});

// Export: the day's map, and the 2026 chart with its daily rows
const NOTE = 'Data: TSM PLA Activity Center (Taiwan MND daily reports), CCG Incident Tracker, Strait Transit Tracker';
addExportBar(document.querySelector('#map').closest('.mapbox'), { where: 'after', target: () => $('#map'), note: NOTE, title: () => `A Day in the Strait: ${longDate(D)}` });
addExportBar(document.querySelector('.yearbox'), { where: 'after', target: () => $('#year'), note: NOTE,
  title: 'PLA aircraft around Taiwan per day, 2026',
  csv: () => [['date', 'aircraft', 'adiz_entries', 'plan_ships', 'official_ships', 'flag'], ...TSM.daily.filter(r => r[0] >= START).map(r => r.slice(0, 6))] });

render(false);

{ const a = document.getElementById('asof'); if (a) a.textContent = longDate(AS_OF).replace(/^[A-Za-z]+, /, ''); }
