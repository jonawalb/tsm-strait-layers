// Panel readouts: control list, event card, filters, compare diff, event table and source list.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { PLACES, POWERS, BANDS, controller } from '../data/control.js';
import { CATS, yearOf } from '../data/events.js';
import { SRC } from '../data/sources.js';
import { exerciseFor, exerciseLink, linkHtml } from '../../../shared/js/links.js';

const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d) {
  const [y, m, day] = d.split('-');
  if (!m) return y;
  return (day ? +day + ' ' : '') + MONTHS[+m - 1] + ' ' + y;
}
const swatch = p => `<span class="sw-dot" style="background:var(${POWERS[p].col})"></span>`;
const catPills = e => e.cats.map(c => `<span class="pill" style="color:var(${CAT[c].col})">${CAT[c].name}</span>`).join('');

/** State of each band at the end of a year. */
export function bandState(band, year) {
  for (const [a, z, t] of band.segs) if (year >= a && (z == null || year < z)) return t;
  return 'none';
}

export function eraText(year) {
  const gov = bandState(BANDS[0], year);
  const ml = bandState(BANDS[1], year) !== 'none';
  if (year < 1945) return `Taiwan and Penghu are a Japanese colony. ${year < 1912 ? 'The Qing Empire rules the mainland.' : year < 1931 ? 'The Republic of China is the government of the mainland, contested by warlords.' : 'The Republic of China is the government of the mainland, facing Japanese invasion, Communist uprising and warlords.'}`;
  if (year < 1949) return 'The Republic of China governs Taiwan and the mainland. Civil war on the mainland.';
  const us = bandState(BANDS[3], year) === 'PRC as China' ? 'Washington recognizes Beijing and keeps unofficial ties with Taipei.' : 'Washington recognizes the government in Taipei.';
  const dem = year >= 1996 ? ' Taiwan elects its president directly.' : '';
  return `${gov === 'Republic of China' ? 'The ROC governs Taiwan' : ''}${ml ? ' under martial law' : ''}; the PRC governs the mainland. ${us}${dem}`;
}

export function renderControl(ul, title, year, prevYear) {
  title.textContent = `Control at the end of ${year}`;
  ul.innerHTML = PLACES.map(p => {
    const c = controller(p, year), was = controller(p, prevYear);
    const ch = c !== was ? `<span class="chg">changed from ${POWERS[was].name}</span>` : '';
    return `<li>${swatch(c)}<span class="pl">${p.name}</span><span class="pw">${POWERS[c].name}${ch}</span></li>`;
  }).join('');
}

/** For a dated PLA exercise, a link to its day-by-day replay in Anatomy of an Exercise. */
function exLink(ev) {
  if (!ev.cats.includes('mil') || ev.date.length !== 10) return '';
  const x = exerciseFor(ev.date);
  return x && ev.date >= x.start && ev.date <= x.end ? `<p>${linkHtml(exerciseLink(x.id, ev.date), 'Replay this exercise day by day')}</p>` : '';
}

export function renderEvent(box, ev, year, nav) {
  if (!ev) {
    const { prev, next } = nav;
    box.innerHTML = `<p class="none">No listed event in ${year}.</p><div class="nearby">
      ${prev ? `<button type="button" class="btn jump" data-id="${prev.id}">‹ ${yearOf(prev)} · ${esc(prev.title)}</button>` : ''}
      ${next ? `<button type="button" class="btn jump" data-id="${next.id}">${yearOf(next)} · ${esc(next.title)} ›</button>` : ''}</div>`;
    return;
  }
  const q = ev.q ? `<blockquote><p>“${esc(ev.q.t)}”</p><cite>${esc(ev.q.by)} · <a href="${esc(SRC[ev.q.src].u)}" target="_blank" rel="noopener">${esc(SRC[ev.q.src].t)}</a></cite></blockquote>` : '';
  const same = nav.sameYear.length > 1 ? `<p class="fine same">${nav.sameYear.length} events in ${year}: ${nav.sameYear.map(e =>
    e.id === ev.id ? `<b>${esc(e.title)}</b>` : `<button type="button" class="linkbtn jump" data-id="${e.id}">${esc(e.title)}</button>`).join(' · ')}</p>` : '';
  box.innerHTML = `<p class="ev-date num">${fmtDate(ev.date)}</p><h3 class="ev-title">${esc(ev.title)}</h3>
    <div class="ev-cats">${catPills(ev)}</div><p class="ev-text">${esc(ev.text)}</p>${q}
    ${exLink(ev)}<p class="ev-src">Source${ev.src.length > 1 ? 's' : ''}: ${ev.src.map(k => `<a href="${esc(SRC[k].u)}" target="_blank" rel="noopener">${esc(SRC[k].t)}</a> (${esc(SRC[k].org)})`).join('; ')}</p>${same}`;
}

export function renderFilters(box, on, onChange) {
  box.innerHTML = CATS.map(c => `<label class="tg"><input type="checkbox" value="${c.id}" ${on.has(c.id) ? 'checked' : ''}><span class="sw"></span>
    <span class="t"><span class="cat-dot" style="background:var(${c.col})"></span>${c.name}</span></label>`).join('');
  box.querySelectorAll('input').forEach(i => i.addEventListener('change', () => onChange(i.value, i.checked)));
}

export function renderLegend(box) {
  box.innerHTML = CATS.map(c => `<span><span class="cat-dot" style="background:var(${c.col})"></span>${c.name}</span>`).join('');
}

/** Differences between two years: places, bands and events in between. */
export function diffOf(a, b, events) {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const places = PLACES.filter(p => controller(p, lo) !== controller(p, hi))
    .map(p => ({ id: p.id, t: `${p.name}: ${POWERS[controller(p, lo)].name} → ${POWERS[controller(p, hi)].name}` }));
  const bands = BANDS.filter(bd => bandState(bd, lo) !== bandState(bd, hi))
    .map(bd => `${bd.label}: ${bandState(bd, lo)} → ${bandState(bd, hi)}`.replace(/none/g, 'none'));
  const between = events.filter(e => yearOf(e) > lo && yearOf(e) <= hi);
  return { lo, hi, places, bands, between };
}

export function renderDiff(box, d) {
  if (d.lo === d.hi) { box.innerHTML = `<p class="fine">Pick two different years to compare.</p>`; return; }
  const list = arr => arr.length ? `<ul>${arr.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="fine">No change.</p>';
  const evs = d.between.slice(0, 10).map(e => `<button type="button" class="linkbtn jump" data-id="${e.id}">${yearOf(e)} ${esc(e.title)}</button>`).join('');
  box.innerHTML = `<p class="eyebrow">What changed from end-${d.lo} to end-${d.hi}</p>
    <div class="diff-grid"><div><h4>Control</h4>${list(d.places.map(p => p.t))}</div>
    <div><h4>Arrangements</h4>${list(d.bands)}</div>
    <div><h4>${d.between.length} listed event${d.between.length === 1 ? '' : 's'} in between</h4><div class="evlinks">${evs}${d.between.length > 10 ? `<span class="fine">and ${d.between.length - 10} more</span>` : ''}</div></div></div>`;
}

export function renderTable(tbody, events, onPick) {
  tbody.innerHTML = events.map(e => `<tr><td class="num nowrap">${fmtDate(e.date)}</td>
    <td><button type="button" class="linkbtn jump" data-id="${e.id}">${esc(e.title)}</button></td><td>${catPills(e)}</td></tr>`).join('');
  tbody.querySelectorAll('.jump').forEach(b => b.addEventListener('click', () => onPick(b.dataset.id, true)));
}

export function renderSources(ul) {
  ul.innerHTML = Object.values(SRC).map(s => `<li>${esc(s.org)}, <a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>.</li>`).join('')
    + '<li>Coastlines: Natural Earth 10 m land, via TSM shared map data.</li>';
}
