// Side-panel and list HTML for the exercise tool.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { METRICS, EXERCISES, ZONES, NOTES, SOURCE_ALT, nice, dayLabel, activeZones, coverage } from './data.js';
import { dayLink, linkHtml } from '../../../shared/js/links.js';

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const link = (u, t) => { const h = SOURCE_ALT[u] || u; return `<a href="${escapeHtml(h)}" target="_blank" rel="noopener">${escapeHtml(t || host(u) + (SOURCE_ALT[u] ? ' (archived)' : ''))}</a>`; };

export function exListHtml(sel, compare, picks) {
  return EXERCISES.map(x => {
    const cov = coverage(x);
    const pressed = compare ? picks.includes(x.id) : x.id === sel;
    const dis = compare && cov.none;
    return `<button type="button" data-x="${x.id}" aria-pressed="${pressed}" ${dis ? 'disabled title="No TSM daily data for this exercise"' : ''}>
      <span class="w num">${x.when}</span><b>${escapeHtml(x.short)}</b>
      <span class="z">${ZONES[x.id]?.zones.length ? 'zones mapped' : ''}${cov.none ? (ZONES[x.id]?.zones.length ? ' · ' : '') + 'no TSM daily data' : ''}</span></button>`;
  }).join('');
}

export function dayReadHtml(x, day, m, tl) {
  const v = day.v[m], M = METRICS[m];
  const zs = activeZones(x.id, day.d);
  const items = tl.filter(t => t.date === day.d);
  const status = day.during ? '<span class="pill hot">exercise day</span>' : day.k < 0 ? '<span class="pill">before</span>' : '<span class="pill">after</span>';
  return `<div class="dayhead"><b>${nice(day.d)}</b> ${status}</div>
    <div class="big"><b class="num">${v ?? '—'}</b><span>${v == null ? `No TSM daily data for this day (${M.name}). See the reported peaks below.` : `${M.name} reported by Taiwan MND`}${day.flag === 'J' ? ' · joint combat readiness patrol reported' : ''}</span></div>
    ${zs.length ? `<p class="fine"><b>${zs.length} zone${zs.length > 1 ? 's' : ''} in force</b> on the map.</p>` : ''}
    ${linkHtml(dayLink(day.d), 'Read this day in A Day in the Strait') ? `<p class="xlinks">${linkHtml(dayLink(day.d), 'Read this day in A Day in the Strait')}</p>` : ''}
    ${items.length ? `<ul class="today">${items.map(t => `<li><b>${escapeHtml(t.who)}</b> ${escapeHtml(t.text)} ${link(t.url, t.label)}</li>`).join('')}</ul>` : '<p class="fine">No listed announcement on this day.</p>'}`;
}

export function metricHtml(x, m, win) {
  return Object.entries(METRICS).map(([k, M]) => {
    const n = win.filter(d => d.v[k] != null).length;
    return `<button type="button" data-m="${k}" aria-pressed="${k === m}" ${n ? '' : 'disabled'}><b>${M.short}</b><span>${n ? `${n} of ${win.length} days` : 'not covered'}</span></button>`;
  }).join('');
}

export function timelineHtml(tl, cur) {
  if (!tl.length) return '<li class="empty">No dated statements compiled for this exercise yet. See the sources below.</li>';
  return tl.map(t => `<li class="${t.date <= cur ? 'past' : 'future'}${t.date === cur ? ' now' : ''}">
    <button type="button" class="tl-d num" data-date="${t.date}">${nice(t.date, false)}</button>
    <div><b>${escapeHtml(t.who)}</b> ${escapeHtml(t.text)} ${link(t.url, t.label)}</div></li>`).join('');
}

export function factsHtml(x) {
  const Z = ZONES[x.id];
  const row = (k, v) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`;
  return `<p class="fullname">${escapeHtml(x.name)}</p>
    <dl class="facts">
      ${row('Dates', x.start === x.end ? nice(x.start) : `${nice(x.start)} to ${nice(x.end)}`)}
      ${row('Trigger', x.trigger)}
      ${row('Announced by', x.authority)}
      ${row('Areas', x.zones)}
      ${row('Forces', x.forces)}
      ${row('Reported peak, aircraft', x.peakAir)}
      ${row('Reported peak, ships', x.peakShips)}
      ${row('Note', x.notes)}
    </dl>
    ${NOTES[x.id] ? `<p class="fine warn">${escapeHtml(NOTES[x.id])}</p>` : ''}
    ${Z?.zones.length ? `<p class="fine">Zone coordinates: ${escapeHtml(Z.note)}</p>` : ''}
    <p class="fine">Sources: ${x.sources.map(u => link(u)).join(' · ')}</p>`;
}

export function zoneSrcHtml(x) {
  const Z = ZONES[x.id];
  if (!Z?.zones.length) return `No zone is drawn: no officially published coordinates were found for this exercise. Announced areas: ${escapeHtml(x.zones)}`;
  return `Zones: ${escapeHtml(Z.note)} Sources: ${Z.sources.map(s => link(s.url, s.label)).join(' · ')}.`;
}

export function sourcesHtml() {
  const items = EXERCISES.map(x => `<li><b>${escapeHtml(x.short)}</b> (${x.when}): ${x.sources.map(u => link(u)).join(' · ')}</li>`);
  items.push('<li>Daily counts: Taiwan Security Monitor PLA Activity Center, from Taiwan Ministry of National Defense daily releases. <a href="https://tsm.schar.gmu.edu/" target="_blank" rel="noopener">tsm.schar.gmu.edu</a></li>');
  items.push('<li>Taiwan ADIZ boundary and median line: TSM GIS layer. Coastline: Natural Earth.</li>');
  return items.join('');
}

export function dayLab(k, d) { return `${dayLabel(k)} · ${nice(d)}`; }
