// Red-cell packet: a print-ready page with a cover and one card per compared actor.
// Built only from data already on the page. Ties are limited to links among the selected actors.
import { LAYERS, SIGN_TEXT, activeAt, statusAt, edgeActive, yearOf } from './edges.js';
import { COUNTRY_NAMES, STATUS_TEXT, avatarHtml, creditHtml } from './profile.js';
import { traitsHtml } from './traits.js';
import { trackedTenures, activity } from './trackposts.js';
import { upcoming, KINDS } from './transitions.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

const f1 = v => v == null ? '–' : v.toFixed(1);

// D: {L, people, orgs, edges (person-level, incl. meetings), t, tISO, layers, TRAITS, RHET, MEETINGS, TONE, TRANSITIONS}
export function renderPacket(el, sel, D, { onClose }) {
  const { L, people, orgs, t, tISO, TRAITS, RHET, MEETINGS, TONE, TRANSITIONS } = D;
  const ids = sel.filter(id => people.has(id));
  const set = new Set(ids);
  const org = id => orgs.get(id)?.name || id;
  const tenures = trackedTenures(L);
  const among = D.edges.filter(e => e.layer !== 'st' && set.has(e.a) && set.has(e.b) && edgeActive(e, t));
  const validated = [
    TRAITS.meta?.indices && Object.keys(TRAITS.people).length ? `Trait readings for ${Object.values(TRAITS.meta.indices).map(i => i.name).join(' and ')} (frozen holdout; prepared native-English speeches only)` : null,
    Object.keys(RHET.people).length ? 'Statement attribution (speaker or author; 19–20 of 20 correct in spot checks)' : null,
    MEETINGS?.meta?.precision ? `Meeting matching (${MEETINGS.meta.precision})` : null,
    ...(TONE?.meta?.metrics || []).map(m => `Tone, ${m.label}: ${m.validated}`),
  ].filter(Boolean).map(v => String(v).replace(/\.\s*$/, ''));
  const notValidated = ['The other five Leadership Trait Analysis traits and operational-code scores', 'Readings from spontaneous or translated text', 'Network centrality as a measure of power'];

  const card = id => {
    const p = people.get(id), st = statusAt(p, t);
    const cur = p.posts.filter(x => activeAt(x, t, D.asOfY));
    const career = p.posts.slice().sort((a, b) => (yearOf(b.start) ?? 0) - (yearOf(a.start) ?? 0)).slice(0, 6);
    const ties = new Map();
    for (const e of among) if (e.a === id || e.b === id) { const o = e.a === id ? e.b : e.a; (ties.get(o) || ties.set(o, []).get(o)).push(e); }
    const tieText = e => e.layer === 'rel' ? `${SIGN_TEXT[e.sign]} relation` : e.layer === 'fa' ? `Faction: ${e.why[0].text.replace(/^Both in ([^:]+):.*$/, '$1')}` : e.layer === 'co' ? `Career overlap ${e.weight} yr` : e.layer === 'mt' ? `Meetings ${e.weight}` : LAYERS[e.layer]?.label || e.layer;
    const R = RHET.people[id];
    const mt = (MEETINGS?.items || []).filter(m => (m.a === id || m.b === id) && m.date <= tISO);
    const tr = upcoming(TRANSITIONS).filter(it => it.person === id);
    const watch = [];
    for (const { t: tp, held } of tenures.values()) for (const h of held) if (h.person.id === id) {
      const a = activity([h.from, h.to > tISO ? tISO : h.to]);
      watch.push(`${tp.label}, ${h.post.start}–${h.post.end || 'present'}: ${a.days ? `${a.days} days of TSM data, ${f1(a.aircraft.mean)} PLA aircraft/day, ${f1(a.jcrp.per30)} JCRP days per 30, ${a.exercises.length} named exercises` : 'outside TSM coverage'}`);
    }
    return `<article class="pk-card" style="--k:var(--k-${p.country})">
      <header class="pk-h" data-s="${st}">${avatarHtml(p, 'pf-av')}<div><p class="eyebrow">${esc(COUNTRY_NAMES[p.country])} · Tier ${p.tier}</p>
        <h2>${esc(p.name)}</h2>${p.name_native ? `<p class="pf-native">${esc(p.name_native)}</p>` : ''}
        <p class="fine">${esc(STATUS_TEXT[st])}${st !== 'active' && p.status_date ? ` since ${esc(p.status_date)}` : ''}</p>${creditHtml(p)}</div></header>
      <div class="pk-grid">
        <section><h3>Posts at ${esc(tISO.slice(0, 7))}</h3>${cur.length ? `<ul>${cur.map(x => `<li><b>${esc(x.title)}</b>, ${esc(org(x.org))} <span class="fine">since ${esc(x.start || '?')}</span></li>`).join('')}</ul>` : '<p class="fine">No sourced post at this date.</p>'}
          <h3>Career (latest six)</h3><ul>${career.map(x => `<li>${esc(x.title)}, ${esc(org(x.org))} <span class="fine">${esc(x.start || '?')}–${esc(x.end || 'present')}</span></li>`).join('')}</ul></section>
        <section><h3>Ties among these actors</h3>${ties.size ? `<ul>${[...ties.entries()].map(([o, es]) => `<li><b>${esc(people.get(o).name)}</b>: ${es.map(e => `<span class="${e.layer === 'rel' ? 'sgn' : ''}" ${e.layer === 'rel' ? `data-sg="${e.sign}"` : ''}>${esc(tieText(e))}</span>`).join(', ')}</li>`).join('')}</ul>` : '<p class="fine">No recorded ties to the other selected actors at this date.</p>'}
          ${tr.length ? `<h3>Upcoming transitions</h3><ul>${tr.map(it => `<li>${esc(KINDS[it.kind] || it.kind)} ${esc(it.date)}${it.date_precision && it.date_precision !== 'day' ? ' (approximate)' : ''}: ${esc(it.post || '')}</li>`).join('')}</ul>` : ''}
          ${R || mt.length ? `<h3>Statements and meetings</h3><ul>${R ? `<li>${R.n_docs.toLocaleString('en-US')} attributed documents ${esc(R.first)} to ${esc(R.last)}: ${R.n_direct} own words, ${R.n_readout} readouts; ${R.taiwan_docs} mention Taiwan. Lower bound (local snapshot).</li>` : ''}${mt.length ? `<li>${mt.length} sourced encounters; last ${esc(mt.map(m => m.date).sort().pop())}.</li>` : ''}</ul>` : ''}
          ${watch.length ? `<h3>On their watch</h3><ul>${watch.map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="fine">Activity during a tenure is not evidence that this person caused it.</p>` : ''}</section>
      </div>
      ${traitsHtml(p, TRAITS)}
      <aside class="pk-val"><p><b>Validated:</b> ${validated.length ? validated.map(esc).join('; ') : 'nothing on this card beyond sourced facts'}.</p><p><b>Not validated:</b> ${notValidated.join('; ')}.</p><p><b>Not forecasts:</b> nothing on this card predicts what this person will do.</p></aside>
    </article>`;
  };

  el.innerHTML = `<div class="pk-bar"><button type="button" class="btn solid" data-print>Print / Save as PDF</button><button type="button" class="btn" data-close>Close packet</button>
      <span class="fine">Use your browser's print dialog to choose A4 or Letter. Each actor prints on its own page.</span></div>
    <section class="pk-cover"><p class="eyebrow">Taiwan Security Monitor · Indo-Pacific Leadership Index</p><h1>Red-cell packet</h1>
      <p class="pk-gate">For TSM internal use; open-source data.</p>
      <h3>Actors</h3><ol>${ids.map(id => { const p = people.get(id); return `<li><b>${esc(p.name)}</b>${p.name_native ? ` ${esc(p.name_native)}` : ''} <span class="fine">${esc(COUNTRY_NAMES[p.country])}</span></li>`; }).join('')}</ol>
      <dl class="readout"><dt>Generated</dt><dd>${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC</dd><dt>Network date</dt><dd>${esc(tISO.slice(0, 7))}</dd>
        <dt>Index asOf</dt><dd>${esc(L.asOf)}</dd><dt>Traits scorer</dt><dd>${esc(TRAITS.meta?.scorer_sha256 ? String(TRAITS.meta.scorer_sha256).slice(0, 16) : 'not loaded')}</dd>
        <dt>Rhetoric build</dt><dd>${esc(RHET.meta?.built || RHET.meta?.build || 'not loaded')}${RHET.meta?.snapshot ? `, snapshot ${esc(RHET.meta.snapshot)}` : ''}</dd>
        <dt>Meetings build</dt><dd>${esc(MEETINGS?.meta?.build || 'not loaded')}</dd><dt>Tone build</dt><dd>${esc(TONE?.meta?.build || 'not loaded')}</dd><dt>Transitions asOf</dt><dd>${esc(TRANSITIONS?.meta?.asOf || 'not loaded')}</dd></dl>
      <p class="fine">Every fact on these cards comes from a sourced record in the index; sources are in each person's profile online. Ties are limited to links among the actors above. Scores are research readings, not forecasts.</p></section>
    ${ids.map(card).join('')}`;
  el.querySelector('[data-print]').addEventListener('click', () => window.print());
  el.querySelector('[data-close]').addEventListener('click', onClose);
}
