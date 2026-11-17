// Balloon Tracker: season picker, map, timeline, seasonality and sighting details.
import { EVENTS, META, REFS, SEASONS, SIGHTINGS, seasonStats, seasonOf, countOf, nice, reportUrl, cap, fmtLL } from './data.js';
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { createMap } from './map.js';
import { drawTimeline, drawSeasonality } from './charts.js';
import { createTour } from './tour.js';

const $ = s => document.querySelector(s);
const S = { season: SEASONS.at(-1), day: null, sel: null };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Default: the season with the most positioned sightings, first positioned day. */
const bestSeason = SEASONS.reduce((b, s) => (seasonStats(s).positioned > seasonStats(b).positioned ? s : b), SEASONS[0]);
S.season = bestSeason;
S.day = SIGHTINGS.find(s => seasonOf(s.d) === bestSeason)?.d ?? null;

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const s = (h.get('season') || '').replace('-', '–');
  if (s === 'all') S.season = null; else if (SEASONS.includes(s)) S.season = s;
  if (h.get('day')) S.day = h.get('day');
  if (h.get('s')) S.sel = h.get('s');
}
function writeHash() {
  const h = new URLSearchParams({ season: (S.season || 'all').replace('–', '-') });
  if (S.day) h.set('day', S.day);
  if (S.sel) h.set('s', S.sel);
  history.replaceState(null, '', '#' + h.toString());
}
readHash();

/* Tooltips */
function tipAt(tip, html, e) {
  if (!html) { tip.hidden = true; return; }
  tip.innerHTML = html; tip.hidden = false;
  const box = tip.parentElement.getBoundingClientRect();
  const cx = (e?.clientX ?? box.left + 40) - box.left, cy = (e?.clientY ?? box.top + 40) - box.top;
  tip.style.left = Math.max(4, Math.min(box.width - tip.offsetWidth - 4, cx + 12)) + 'px';
  tip.style.top = Math.max(4, Math.min(box.height - tip.offsetHeight - 4, cy + 12)) + 'px';
}

const map = createMap($('#map'), {
  onPick: s => { S.sel = s.key; S.day = s.d; if (S.season && seasonOf(s.d) !== S.season) S.season = seasonOf(s.d); render(); },
  onHover: (s, e) => tipAt($('#tip'), s && `<b>${nice(s.d)}</b>${s.t ? `, ${s.t}` : ''}<br>${s.nm} nm ${s.brg} of ${s.ref}${s.alt ? `<br>about ${s.alt.toLocaleString('en-US')} ft` : ''}<br><span class="muted">Computed position, approximate</span>`, e),
});
const lastDay = META.last;
const tl = drawTimeline($('#tl'), {
  end: lastDay,
  onPick: ev => { S.day = ev.d; S.sel = null; if (S.season && seasonOf(ev.d) !== S.season) S.season = seasonOf(ev.d); render(); },
  onHover: (h, e) => tipAt($('#tltip'), h && `<b>${nice(h.d)}</b><br>${h.v} balloon${h.v === 1 ? '' : 's'}${h.ev ? (h.ev.s.length ? ` · ${h.ev.s.length} with a position` : ' · no position given') : '<br><span class="muted">TSM sheet only; no matching MND text</span>'}`, e),
});
const sz = drawSeasonality($('#seas'), { onSeason: s => { S.season = s; S.day = null; S.sel = null; render(); } });
$('#seas-legend').innerHTML = sz.legend.map(({ s, k }) => `<span><i class="k s${k % 4}"></i>${s}</span>`).join('');

/* Season chips */
function chips() {
  const all = seasonStats(null);
  $('#seasons').innerHTML = [...SEASONS.map(s => [s, seasonStats(s)]), ['all', all]].map(([s, st]) =>
    `<button type="button" data-s="${s}" aria-pressed="${(S.season || 'all') === s}"><b>${s === 'all' ? 'All' : s}</b><span>${st.balloons} MND${st.sheetOnlyBalloons ? ` + ${st.sheetOnlyBalloons} sheet` : ''}</span></button>`).join('');
  $('#seasons').querySelectorAll('button').forEach(b => b.onclick = () => {
    S.season = b.dataset.s === 'all' ? null : b.dataset.s; S.day = null; S.sel = null; render();
  });
}

/* Details */
function details() {
  const ev = S.day ? EVENTS.find(e => e.d === S.day) : null;
  const box = $('#detail');
  if (!ev) { box.innerHTML = '<p class="fine">Pick a dot on the map, a bar on the timeline or a day in the list.</p>'; return; }
  const sel = SIGHTINGS.find(s => s.key === S.sel);
  const n = countOf(ev);
  const mismatch = ev.sheet != null && ev.n != null && ev.sheet !== ev.n
    ? `<p class="fine warn">TSM's sheet records ${ev.sheet} for this day; MND's text says ${ev.n}.</p>` : '';
  box.innerHTML = `<h3>${nice(ev.d)}</h3>
    <p class="fine">Reporting window from 6 a.m. ${nice(ev.d)} (UTC+8). ${n} balloon${n === 1 ? '' : 's'} reported${ev.s.length ? `, ${ev.s.length} with a position` : ', no positions given'}.</p>
    ${mismatch}
    ${ev.s.length ? `<ol class="sights">${ev.s.map((s, k) => `<li><button type="button" data-k="${ev.d}-${k}" aria-pressed="${S.sel === `${ev.d}-${k}`}">
      <b>${s.nm} nm ${s.brg} of ${s.ref}</b>${s.t ? ` · ${s.t}` : ''}${s.alt ? ` · ~${s.alt.toLocaleString('en-US')} ft` : ''}
      ${s.ll ? `<span class="muted">≈ ${fmtLL(s.ll)}</span>` : '<span class="muted">reference point not mapped</span>'}
      ${s.shared ? `<span class="muted">One position given for ${s.shared} balloons</span>` : ''}${s.miles ? '<span class="muted">MND wrote "miles"; mapped as nautical miles</span>' : ''}</button></li>`).join('')}</ol>` : ''}
    ${ev.head.length ? `<p class="fine">Heading reported: ${ev.head.map(cap).join(', ')}.</p>` : ''}
    ${ev.alts.length && ev.alts.length !== ev.s.length ? `<p class="fine">Altitudes reported: ${ev.alts.map(a => a.toLocaleString('en-US') + ' ft').join(', ')}.</p>` : ''}
    <blockquote class="quote">${escapeHtml(ev.text)}</blockquote>
    <p class="links"><a href="${reportUrl(ev.id)}" target="_blank" rel="noopener">MND report ${ev.id}</a></p>
    ${sel && sel.d === ev.d ? `<p class="fine">The dot is placed ${sel.nm} nautical miles (${Math.round(sel.nm * 1.852)} km) from central ${sel.ref} on a ${sel.brg} bearing. MND rounds distances and gives 8-point bearings, so the true spot could be several kilometers off.</p>` : ''}`;
  box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { S.sel = b.dataset.k; render(); });
}

function list(st) {
  const box = $('#list');
  const rows = [...st.ev].reverse();
  box.innerHTML = `<p class="fine">${rows.length} report${rows.length === 1 ? '' : 's'} mention balloons${S.season ? ` in the ${S.season} season` : ''}.</p>
    <ol class="evs">${rows.map(e => `<li><button type="button" data-d="${e.d}" aria-pressed="${e.d === S.day}">
      <span class="dt">${nice(e.d)}</span><span class="num">${countOf(e)}</span><span class="muted">${e.s.length ? `${e.s.length} positioned` : 'count only'}</span></button></li>`).join('')}</ol>`;
  box.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { S.day = b.dataset.d; S.sel = null; render(); });
}

function render() {
  const st = seasonStats(S.season);
  chips();
  $('#stitle').textContent = S.season ? `${S.season} season` : 'All seasons';
  $('#readout').innerHTML = `
    <dt>Reports with balloons</dt><dd>${st.reports}</dd>
    <dt>Balloons counted by MND</dt><dd>${st.balloons}</dd>
    <dt>With a position</dt><dd>${st.positioned}</dd>
    <dt>First / last</dt><dd>${st.first ? `${nice(st.first)} / ${nice(st.last)}` : '–'}</dd>
    <dt>Busiest day</dt><dd>${st.peak ? `${nice(st.peak.d)} (${countOf(st.peak)})` : '–'}</dd>
    <dt>Sheet-only days</dt><dd>${st.sheetOnly}${st.sheetOnly ? ` (${st.sheetOnlyBalloons} balloons)` : ''}</dd>`;
  $('#nopos').hidden = st.positioned > 0;
  map.update({ season: S.season, selKey: S.sel, dayD: S.day });
  tl.update({ season: S.season, dayD: S.day });
  sz.update({ season: S.season });
  details();
  list(st);
  writeHash();
}

const tour = createTour($('#stage'), set => {
  S.season = set.season === 'best' ? bestSeason : set.season;
  S.day = set.day === 'first' ? SIGHTINGS.find(s => seasonOf(s.d) === bestSeason)?.d ?? null : set.day ?? null;
  S.sel = set.sel === 'first' ? SIGHTINGS.find(s => s.d === S.day)?.key ?? null : null;
  render();
  if (set.scroll) document.querySelector(set.scroll)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
});
$('#tour').onclick = () => tour.start();
$('#copy').onclick = () => navigator.clipboard?.writeText(location.href).then(() => { $('#copy').textContent = 'Link copied'; setTimeout(() => { $('#copy').textContent = 'Copy link'; }, 1500); });
$('#m-first').textContent = nice(META.first);
$('#m-last').textContent = nice(META.last);
$('#m-n').textContent = META.reports.toLocaleString('en-US');
$('#m-refs').innerHTML = Object.entries(REFS).filter(([k]) => SIGHTINGS.some(s => s.ref === k))
  .map(([k, r]) => `<a href="${r.src}" target="_blank" rel="noopener">${k}</a> (${fmtLL(r.ll)})`).join(', ');
render();
