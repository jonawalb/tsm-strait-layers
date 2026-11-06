// Panel: filter controls and the case detail card.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { CATS, STATUSES, OPEN, fmtD, fmtM, fmtB, fmtAge, summary } from './model.js';
import { caseHistory, EXIT, srcLink } from './mdata.js';

const KIND = { notified: 'Notified to Congress', contract: 'Contract', delivery: 'First delivery', expect: 'Expected completion', event: 'Milestone', amend: 'Amendment, Sec. 36(b)(5)(C)', delay: 'Reported delay', done: 'Left the backlog' };
const STLABEL = { waiting: 'No contract or delivery found', contracted: 'Contract on record', delivering: 'Deliveries under way', gone: 'Left the backlog' };
const CATVAR = { Traditional: 'trad', Asymmetric: 'asym', Munitions: 'mun' };

export function buildFilters(S, onChange) {
  const sm = summary();
  const cats = document.getElementById('cats');
  cats.innerHTML = CATS.map(k => `<button type="button" data-cat="${k}" aria-pressed="${S.cats.has(k)}" style="border-left-color:var(--k-${CATVAR[k]})">${k}<b>${fmtB(sm.byCat[k])} · ${sm.nCat[k]}</b></button>`).join('');
  cats.querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.cat;
    if (S.cats.has(k) && S.cats.size > 1) S.cats.delete(k); else S.cats.add(k);
    onChange();
  });
  const st = document.getElementById('status');
  st.innerHTML = STATUSES.map(s => `<button type="button" data-st="${s.id}">${s.label}<small>${OPEN.filter(s.test).length} case${OPEN.filter(s.test).length === 1 ? "" : "s"}</small></button>`).join('');
  st.querySelectorAll('button').forEach(b => b.onclick = () => { S.status = b.dataset.st; onChange(); });
  const sort = document.getElementById('sort');
  sort.onchange = () => { S.sort = sort.value; onChange(); };
  const gone = document.getElementById('gone');
  if (gone) gone.onchange = () => { S.gone = gone.checked; onChange(); };
}

export function syncFilters(S, list) {
  document.querySelectorAll('#cats button').forEach(b => b.setAttribute('aria-pressed', String(S.cats.has(b.dataset.cat))));
  document.querySelectorAll('#status button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.st === S.status)));
  document.getElementById('sort').value = S.sort;
  const gone = document.getElementById('gone');
  if (gone) gone.checked = S.gone;
  const open = list.filter(c => !c.gone), m = open.reduce((s, c) => s + c.m, 0);
  const sm = summary();
  document.getElementById('filter-read').textContent =
    `Showing ${open.length} of ${sm.n} open cases, ${fmtB(m)} (${Math.round(m / sm.total * 100)}% of the backlog)` +
    (S.gone && list.length > open.length ? `, plus ${list.length - open.length} that left it.` : '.');
}

/** The case's row in every monthly tracker record (March 2026 onward). */
function historyHtml(key, { open = false, month = null } = {}) {
  const h = caseHistory(key);
  if (!h.length) return '';
  const tag = e => [e.add ? '<span class="pill k-add">Added</span>' : '', e.newp ? '<span class="pill k-deliv">Now partly delivered</span>' : '',
    e.out ? `<span class="pill k-out">${EXIT[e.out]}</span>` : '', e.p && !e.newp ? '<span class="pill k-deliv">Partly delivered</span>' : ''].join('');
  const ups = e => (e.st ? `${escapeHtml(e.st.t)}${srcLink(e.st.src)}${e.ups.length ? '<br>' : ''}` : '') + (e.ups.length
    ? e.ups.map(u => `${escapeHtml(fmtD(u.d))}: ${escapeHtml(u.t)}${srcLink(u.src)}`).join('<br>')
    : (e.st ? '' : 'No dated development recorded this month.'));
  return `<details class="hist"${open ? ' open' : ''}><summary class="eyebrow">Monthly tracker record</summary>
    <p class="fine">Newest first. The Japan tracker starts in March 2026 (March to June built retrospectively); no monthly records exist before it.</p>
    <ol class="hist-l">${[...h].reverse().map(e => `<li class="${e.out ? 'k-done' : e.p ? 'k-delivery' : ''}${month === e.mo ? ' here' : ''}"><span class="d">${e.label}</span>${tag(e)} ${ups(e)}</li>`).join('')}</ol></details>`;
}

export function renderDetail(c, list, onSelect, box = document.getElementById('detail'), opts = {}) {
  if (!c) { box.innerHTML = '<p class="fine">Select a row in the timeline to see its record.</p>'; return; }
  const i = list.findIndex(x => x.key === c.key);
  const events = [{ m: 'notified', d: c.notified, t: `${fmtM(c.m)}${c.amended ? ' (value today, after amendments)' : ''}: transmittal ${c.tn}.`, src: c.link }, ...c.ms]
    .map(x => ({ ...x, sortD: x.date ? x.date.getTime() : c.nD.getTime() }))
    .sort((a, b) => a.sortD - b.sortD);
  const pills = [`<span class="pill k-${c.cat}">${c.cat}</span>`, `<span class="pill ${c.state === 'delivering' ? 'k-deliv' : c.gone ? 'k-gone' : ''}">${c.gone ? escapeHtml(c.outcome) : STLABEL[c.state]}</span>`];
  if (c.amended) pills.push('<span class="pill k-amend">Amended</span>');
  const conf = c.conf === 'medium'
    ? '<span class="badge v-diff" title="The research file rates this case medium confidence; see the status and the notes below.">Medium confidence</span>'
    : '<span class="badge v-verified" title="Notification and status checked against the linked sources.">High confidence</span>';
  box.innerHTML = `
    <div class="meta">${pills.join('')}${conf}</div>
    <h3>${escapeHtml(c.name)}</h3>
    <p class="money">${fmtM(c.m)} <small>${c.gone ? `notified ${fmtD(c.notified)}, left the backlog ${fmtD(c.left)}` : `waiting ${fmtAge(c.age)} since ${fmtD(c.notified)}`}</small></p>
    <p class="fine tn">Transmittal ${escapeHtml(c.tn || '')} · ${escapeHtml(c.full)}</p>
    ${c.detail ? `<p class="blurb">${escapeHtml(c.detail)}${(c.detailSrc || []).map(u => srcLink(u)).join('')}</p>` : ''}
    <p class="status-t"><b>${c.gone ? 'Why it left' : `Status, ${fmtD(c.statusAsOf)}`}</b>${escapeHtml(c.gone ? c.note : c.status)}${srcLink(c.gone ? c.src : c.statusSrc)}</p>
    ${historyHtml(c.key, opts)}
    <p class="eyebrow">Milestones</p>
    <ol>${events.map(x => `<li class="k-${x.m}"><span class="d">${fmtD(x.d)} · ${KIND[x.m]}</span>${escapeHtml(x.t)}${srcLink(x.src)}${srcLink(x.src2)}</li>`).join('')}</ol>
    <div class="nav">
      <button type="button" class="btn" data-go="-1" ${i <= 0 ? 'disabled' : ''}>← Previous</button>
      <button type="button" class="btn" data-go="1" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>`;
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const n = list[i + Number(b.dataset.go)];
    if (n) onSelect(n.key, true);
  });
}
