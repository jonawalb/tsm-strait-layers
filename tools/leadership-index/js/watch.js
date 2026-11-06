// Profile section "On their watch": TSM activity during each tenure in a tracked post,
// beside the previous and next holder. Descriptive only: no tests, no trend lines.
import { trackedTenures, activity, COVER, TRANSIT_GAP } from './trackposts.js';
import { TSM } from '../../../shared/data/tsm.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { triggerStripHtml, triggerKindSelect, TRIG_KINDS } from './layerviews.js';

let cache = null;
const f1 = v => v == null ? '–' : v.toFixed(1);
const ymd = d => d || '?';

export function coverageText() {
  return `daily PLA aircraft ${COVER.aircraft[0]} to ${COVER.aircraft[1]}; ADIZ entries from ${COVER.adiz[0]} (days where TSM and MND agree); PLAN ships from ${COVER.plan[0]}; joint combat readiness patrol flags from 2022-12; CCG incidents ${COVER.ccg[0]?.slice(0, 4)} only; allied transits from ${COVER.transits[0]} (gap ${TRANSIT_GAP[0].slice(0, 7)} to ${TRANSIT_GAP[1].slice(0, 7)}); named exercises listed through 2025-12`;
}

// opts.triggers: Taiwan politics events (layers.js, optional); opts.trigK: kind filter.
export function watchHtml(p, L, opts = {}) {
  const trigs = opts.triggers || null, tk = opts.trigK || 'all';
  cache ||= trackedTenures(L);
  const parts = [];
  for (const { t, held, undated } of cache.values()) {
    const mine = held.filter(h => h.person.id === p.id);
    if (undated.some(u => u.person.id === p.id) && !mine.length) {
      parts.push(`<div class="w-post"><p class="w-h">${esc(t.label)}</p><p class="fine">No sourced start date for this post, so no tenure window is computed.</p></div>`);
    }
    for (const h of mine) {
      const prev = held.filter(x => x.person.id !== p.id && x.from < h.from).pop() || null;
      const next = held.find(x => x.person.id !== p.id && x.from > h.from) || null;
      const cols = [prev && { h: prev, role: 'Previous holder' }, { h, role: 'This tenure', me: true }, next && { h: next, role: 'Next holder' }].filter(Boolean)
        .map(c => ({ ...c, a: activity([c.h.from, c.h.to > TSM.asOf ? TSM.asOf : c.h.to]) }));
      const cell = fn => cols.map(c => `<td class="${c.me ? 'me' : ''}">${fn(c.a, c)}</td>`).join('');
      const noCover = a => !a.covered;
      parts.push(`<div class="w-post"><p class="w-h">${esc(t.label)}</p>
      <div class="tablewrap w-tab"><table>
        <thead><tr><th scope="col"></th>${cols.map(c => `<th scope="col" class="${c.me ? 'me' : ''}">${esc(c.role)}<br>${c.me ? esc(c.h.person.name) : `<button type="button" class="linkbtn" data-pick="${esc(c.h.person.id)}">${esc(c.h.person.name)}</button>`}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><th scope="row">Tenure</th>${cell((a, c) => `${ymd(c.h.post.start)} to ${c.h.post.end || 'present'}${c.h.approx ? ' <span class="fine" title="Year or month only; read as mid-year or mid-month">≈</span>' : ''}`)}</tr>
          <tr><th scope="row">Days with TSM daily data</th>${cell(a => a.days ? `<b class="num">${a.days}</b>` : '<span class="fine">outside coverage</span>')}</tr>
          <tr><th scope="row">PLA aircraft per day, mean</th>${cell(a => noCover(a) ? '–' : `<b class="num">${f1(a.aircraft.mean)}</b> <span class="fine">n=${a.aircraft.n}</span>`)}</tr>
          <tr><th scope="row">ADIZ entries per day, mean</th>${cell(a => a.adiz.n ? `<b class="num">${f1(a.adiz.mean)}</b> <span class="fine">n=${a.adiz.n}</span>` : '–')}</tr>
          <tr><th scope="row">PLAN ships per day, mean</th>${cell(a => a.plan.n ? `<b class="num">${f1(a.plan.mean)}</b> <span class="fine">n=${a.plan.n}</span>` : `<span class="fine">${noCover(a) ? '–' : 'before ' + COVER.plan[0]}</span>`)}</tr>
          <tr><th scope="row">Joint combat readiness patrol days per 30</th>${cell(a => a.jcrp.n ? `<b class="num">${f1(a.jcrp.per30)}</b> <span class="fine">${a.jcrp.count} in ${a.jcrp.n} d</span>` : '–')}</tr>
          <tr><th scope="row">CCG incidents near Taiwan <span class="fine">${COVER.ccg[0]?.slice(0, 4)} only</span></th>${cell(a => a.ccg.win ? `<b class="num">${a.ccg.count}</b>` : '–')}</tr>
          <tr><th scope="row">Allied Strait transits</th>${cell(a => a.transits.win ? `<b class="num">${a.transits.count}</b>${a.transits.gap ? ' <span class="fine">list has a gap</span>' : ''}` : '–')}</tr>
          ${trigs ? `<tr><th scope="row">Taiwan politics events${tk !== 'all' ? ` <span class="fine">${esc(TRIG_KINDS[tk] || tk)}</span>` : ''}</th>${cell((a, c) => `<b class="num">${triggerStripHtml(trigs, c.h.from, c.h.to, tk).n}</b>`)}</tr>` : ''}
          <tr><th scope="row">Named exercises started</th>${cell(a => a.exercises.length ? `<ul class="w-ex">${a.exercises.map(e => `<li><a href="${esc(e.sources?.[0] || '#')}" target="_blank" rel="noopener">${esc(e.event_name.replace(/\s*\(.*$/, ''))}</a> <span class="fine">${esc(e.start_date)}</span></li>`).join('')}</ul>` : '<span class="fine">none listed</span>')}</tr>
        </tbody></table></div>${trigs ? triggerStripHtml(trigs, h.from, h.to, tk).html : ''}</div>`);
    }
  }
  if (!parts.length) return '';
  return `<h3 class="pf-h">On their watch</h3>
    <p class="w-warn"><b>Activity during a tenure is not evidence that this person caused it.</b> Coverage: ${esc(coverageText())}.</p>
    ${trigs ? `<p class="trg-ctl">${triggerKindSelect(trigs, tk)}</p>` : ''}
    ${parts.join('')}
    <p class="fine">Means are over days with a recorded value (n). Each series counts only the part of a tenure inside its own coverage. Sources: TSM PLA Activity Center and Taiwan MND daily reports; exercises from the Exercises as Theater dataset, linked to the first source for each.</p>`;
}
