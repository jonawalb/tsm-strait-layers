// Calendar of scheduled or rule-based leadership transitions (data/transitions.js, optional),
// a list of vacant or unconfirmed posts, and profile badges for upcoming items.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { COUNTRY_NAMES, srcLink } from './profile.js';

export const KINDS = { election: 'Election', term_end: 'Term ends', term_limit: 'Term limit', party_congress: 'Party congress', leadership_contest: 'Leadership contest', retirement_age: 'Reaches age limit', mandated_review: 'Mandated review', vacancy: 'Vacancy' };
const RULE_BASED = new Set(['retirement_age', 'term_limit']);
export const todayISO = () => new Date().toISOString().slice(0, 10);
// Start of the period a date names: YYYY → Jan 1, YYYY-MM → the 1st (used for "is it upcoming").
const lo = d => /^\d{4}$/.test(d) ? `${d}-01-01` : /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d;
const hi = d => /^\d{4}$/.test(d) ? `${d}-12-31` : /^\d{4}-\d{2}$/.test(d) ? `${d}-28` : d;
const approx = it => it.date_precision && it.date_precision !== 'day';
const dateText = it => `${approx(it) ? '~' : ''}${it.date}${it.window_end ? ` to ${it.window_end}` : ''}`;

export function upcoming(T, today = todayISO()) {
  return (T?.items || []).filter(it => it.kind !== 'vacancy' && hi(it.window_end || it.date) >= today).sort((a, b) => lo(a.date).localeCompare(lo(b.date)));
}

export function badgesHtml(p, T) {
  const its = upcoming(T).filter(it => it.person === p.id);
  if (!its.length) return '';
  return `<p class="pf-badges">${its.map(it => `<a class="pill cal-b" href="${esc(it.source || '#')}" target="_blank" rel="noopener" title="${esc(it.note || it.post || '')}">${esc(KINDS[it.kind] || it.kind)} ${esc(dateText(it))}${RULE_BASED.has(it.kind) ? ' (rule-based)' : ''}</a>`).join(' ')}</p>`;
}

// state: {c: 'all'|ISO3, k: 'all'|kind}; ctx: {people: Map, onOpen(id), onChange()}
export function renderCalendar(el, T, state, ctx) {
  if (!T) { el.innerHTML = '<p class="fine">The transitions calendar is not loaded yet.</p>'; return; }
  const today = todayISO();
  const endY = new Date(); endY.setMonth(endY.getMonth() + 36);
  const end = endY.toISOString().slice(0, 10);
  const all = upcoming(T, today).filter(it => lo(it.date) <= end);
  const countries = [...new Set(all.map(it => it.country))].sort();
  const kinds = [...new Set(all.map(it => it.kind))];
  const its = all.filter(it => (state.c === 'all' || it.country === state.c) && (state.k === 'all' || it.kind === state.k));
  const vac = (T.items || []).filter(it => it.kind === 'vacancy' && (state.c === 'all' || it.country === state.c));
  const t0 = Date.parse(today), t1 = Date.parse(end), W = 800, padL = 46;
  const X = d => padL + Math.max(0, Math.min(1, (Date.parse(d) - t0) / (t1 - t0))) * (W - padL - 8);
  const lanes = [...new Set(its.map(it => it.country))].sort();
  const H = 30 + lanes.length * 26;
  const yrs = []; for (let y = +today.slice(0, 4) + 1; `${y}-01-01` <= end; y++) yrs.push(y);
  const person = it => it.person && ctx.people.has(it.person) ? ctx.people.get(it.person) : null;
  const marks = its.map(it => {
    const y = 22 + lanes.indexOf(it.country) * 26, a = X(lo(it.date) < today ? today : lo(it.date));
    const b = it.window_end ? X(hi(it.window_end)) : approx(it) ? X(hi(it.date)) : null;
    const lab = `${KINDS[it.kind] || it.kind}: ${person(it)?.name || it.post || ''} ${dateText(it)}`;
    return `<g class="cal-m k-${esc(it.kind)}${approx(it) ? ' approx' : ''}" style="--k:var(--k-${esc(it.country)})">${b && b - a > 2 ? `<rect x="${a}" y="${y - 5}" width="${b - a}" height="10" rx="3"/>` : `<circle cx="${a}" cy="${y}" r="5"/>`}<title>${esc(lab)}</title></g>`;
  }).join('');
  el.innerHTML = `<div class="turn-ctl">
      <label>Country <select class="sel-in" data-cc><option value="all">All countries</option>${countries.map(c => `<option value="${c}"${c === state.c ? ' selected' : ''}>${esc(COUNTRY_NAMES[c] || c)}</option>`).join('')}</select></label>
    </div>
    <div class="choices turn-fam" role="group" aria-label="Kind"><button type="button" data-ck="all" aria-pressed="${state.k === 'all'}">All kinds</button>${kinds.map(k => `<button type="button" data-ck="${k}" aria-pressed="${state.k === k}">${esc(KINDS[k] || k)}</button>`).join('')}</div>
    <figure class="turn-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Upcoming transitions from ${today} to ${end}">
      ${yrs.map(y => `<line x1="${X(`${y}-01-01`)}" x2="${X(`${y}-01-01`)}" y1="10" y2="${H - 4}" class="tk"/><text x="${X(`${y}-01-01`) + 3}" y="10" class="tk">${y}</text>`).join('')}
      ${lanes.map((c, i) => `<text x="0" y="${26 + i * 26}" class="tk cal-lane">${c}</text>`).join('')}${marks}</svg>
      <figcaption class="legend"><span>Today ${today} to ${end}</span><span><i class="lg-dot"></i>Dated item</span><span><i class="lg-sq cal-w"></i>Window or approximate date</span></figcaption></figure>
    <div class="tablewrap"><table><caption class="fine">${its.length} upcoming items. Dates marked ~ are given to the month or year only.</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Country</th><th scope="col">Kind</th><th scope="col">Person or post</th><th scope="col">Note</th><th scope="col">Source</th></tr></thead>
      <tbody>${its.map(it => `<tr><td class="num">${esc(dateText(it))}</td><td>${esc(it.country)}</td><td>${esc(KINDS[it.kind] || it.kind)}${RULE_BASED.has(it.kind) ? ' <span class="fine">rule-based</span>' : ''}</td>
        <td>${person(it) ? `<button type="button" class="linkbtn" data-open="${esc(it.person)}">${esc(person(it).name)}</button><br>` : ''}<span class="fine">${esc(it.post || '')}</span></td><td class="fine">${esc(it.note || '')}</td><td>${srcLink(it.source, 'source')}</td></tr>`).join('') || '<tr><td colspan="6" class="fine">No upcoming items match.</td></tr>'}</tbody></table></div>
    <h3 class="cal-h">Vacant or unconfirmed posts</h3>
    ${vac.length ? `<ul class="src">${vac.map(it => `<li><b>${esc(it.post || '')}</b> <span class="fine">${esc(it.country)}, since ${esc(dateText(it))}</span> ${esc(it.note || '')} ${srcLink(it.source, 'source')}</li>`).join('')}</ul>` : '<p class="fine">None listed.</p>'}`;
  el.querySelector('[data-cc]').addEventListener('change', e => { state.c = e.target.value; ctx.onChange(); });
  el.querySelectorAll('[data-ck]').forEach(b => b.addEventListener('click', () => { state.k = b.dataset.ck; ctx.onChange(); el.querySelector(`[data-ck="${state.k}"]`)?.focus(); }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => ctx.onOpen(b.dataset.open)));
}
