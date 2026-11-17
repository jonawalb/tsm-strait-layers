// Panel: filter controls and the case detail card.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { CATS, STATUSES, OPEN, fmtD, fmtM, fmtB, fmtAge, summary } from './model.js';
import { caseHistory, EXIT, statusHtml } from './mdata.js';

const KIND = { notified: 'Notified to Congress', contract: 'Contract or LOA', delivery: 'First delivery', expect: 'Expected completion', event: 'Milestone', done: 'Left the backlog' };
const VLABEL = { verified: 'Notification verified', tsm: 'TSM data', diff: 'Verified, with caveat', cato: 'Cato data' };
const STLABEL = { waiting: 'No contract reported', contracted: 'Contract or LOA', delivering: 'Deliveries under way', gone: 'Left the backlog' };
const CATVAR = { Traditional: 'trad', Asymmetric: 'asym', Munitions: 'mun' };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

export function buildFilters(S, onChange) {
  const sm = summary();
  const cats = document.getElementById('cats');
  cats.innerHTML = CATS.map(k => `<button type="button" data-cat="${k}" aria-pressed="${S.cats.has(k)}" style="border-left-color:var(--k-${CATVAR[k]})">${k}<b>${fmtB(sm.byCat[k])}</b></button>`).join('');
  cats.querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.cat;
    if (S.cats.has(k) && S.cats.size > 1) S.cats.delete(k); else S.cats.add(k);
    onChange();
  });
  const st = document.getElementById('status');
  st.innerHTML = STATUSES.map(s => `<button type="button" data-st="${s.id}">${s.label}<small>${OPEN.filter(s.test).length} cases</small></button>`).join('');
  st.querySelectorAll('button').forEach(b => b.onclick = () => { S.status = b.dataset.st; onChange(); });
  const sort = document.getElementById('sort');
  sort.onchange = () => { S.sort = sort.value; onChange(); };
  const gone = document.getElementById('gone');
  gone.onchange = () => { S.gone = gone.checked; onChange(); };
}

export function syncFilters(S, list) {
  document.querySelectorAll('#cats button').forEach(b => b.setAttribute('aria-pressed', String(S.cats.has(b.dataset.cat))));
  document.querySelectorAll('#status button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.st === S.status)));
  document.getElementById('sort').value = S.sort;
  document.getElementById('gone').checked = S.gone;
  const open = list.filter(c => !c.gone), m = open.reduce((s, c) => s + c.m, 0);
  const sm = summary();
  document.getElementById('filter-read').textContent =
    `Showing ${open.length} of ${sm.n} open cases, ${fmtB(m)} (${Math.round(m / sm.total * 100)}% of the backlog)` +
    (S.gone ? `, plus ${list.length - open.length} that left it.` : '.');
}

/** Table 1 status for this case in every monthly update (Cato's to December 2024, TSM's from January 2025), merged where unchanged. */
function historyHtml(key, { open = false, month = null } = {}) {
  const h = caseHistory(key);
  if (!h.length) return '';
  const span = e => e.from === e.to ? e.from.label : `${e.from.label} to ${e.to.label}`;
  const tag = e => [e.add ? '<span class="pill k-add">Added</span>' : '', e.newp ? '<span class="pill k-deliv">Now partly delivered</span>' : '',
    e.out ? `<span class="pill k-out">${EXIT[e.out]}</span>` : '', e.p && e === h[0] ? '<span class="pill k-deliv">Partly delivered</span>' : ''].join('');
  const here = e => month && e.from.mo <= month && month <= e.to.mo;
  return `<details class="hist"${open ? ' open' : ''}><summary class="eyebrow">Status by month (Table 1)</summary>
    <p class="fine">Newest first. Orange dot: partly delivered that month. November 2023 to December 2024 from the Cato Institute's updates, January 2025 onward from TSM's.</p>
    <ol class="hist-l">${[...h].reverse().map(e => `<li class="${e.out ? 'k-done' : e.p ? 'k-delivery' : ''}${here(e) ? ' here' : ''}"><span class="d">${span(e)}</span>${tag(e)} ${statusHtml(e.st)}</li>`).join('')}</ol></details>`;
}

export function renderDetail(c, list, onSelect, box = document.getElementById('detail'), opts = {}) {
  if (!c) { box.innerHTML = '<p class="fine">Select a row in the timeline to see its record.</p>'; return; }
  const i = list.findIndex(x => x.key === c.key);
  const events = [{ m: 'notified', d: c.notified, t: `${fmtM(c.m)} notified to Congress.`, src: c.link }, ...c.ms]
    .map(x => ({ ...x, sortD: x.date ? x.date.getTime() : c.nD.getTime() }))
    .sort((a, b) => a.sortD - b.sortD);
  const pills = [`<span class="pill k-${c.cat}">${c.cat}</span>`, `<span class="pill ${c.state === 'delivering' ? 'k-deliv' : c.gone ? 'k-gone' : ''}">${c.gone ? escapeHtml(c.outcome) : STLABEL[c.state]}</span>`];
  if (c.delayed) pills.push('<span class="pill k-delay">Named delayed by MND</span>');
  const v = c.verify;
  box.innerHTML = `
    <div class="meta">${pills.join('')}<span class="badge v-${v.v}" title="${escapeHtml(v.note || '')}">${VLABEL[v.v]}</span></div>
    <h3>${escapeHtml(c.name)}</h3>
    <p class="money">${fmtM(c.m)} <small>${c.gone ? `notified ${fmtD(c.notified)}, left the backlog ${fmtD(c.left)}` : `waiting ${fmtAge(c.age)} since ${fmtD(c.notified)}`}</small></p>
    ${c.detail ? `<p class="blurb">${escapeHtml(c.detail)}</p>` : ''}
    <p class="status-t"><b>${c.gone ? 'Why it left' : 'Latest TSM status'}</b>${escapeHtml(c.gone ? c.note : c.status)}</p>
    ${v.note ? `<p class="fine"><b>Verification.</b> ${escapeHtml(v.note)}${v.url ? ` <a href="${v.url}" target="_blank" rel="noopener">${host(v.url)}</a>` : ''}</p>` : ''}
    ${historyHtml(c.key, opts)}
    <p class="eyebrow">Milestones</p>
    <ol>${events.map(x => `<li class="k-${x.m}"><span class="d">${fmtD(x.d)} · ${KIND[x.m]}</span>${escapeHtml(x.t)}
      ${x.src ? ` <a href="${x.src}" target="_blank" rel="noopener">${host(x.src)}</a>` : ` <span class="fine">(${escapeHtml(c.srcLabel || 'TSM status notes')})</span>`}</li>`).join('')}</ol>
    <div class="nav">
      <button type="button" class="btn" data-go="-1" ${i <= 0 ? 'disabled' : ''}>← Previous</button>
      <button type="button" class="btn" data-go="1" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>`;
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const n = list[i + Number(b.dataset.go)];
    if (n) onSelect(n.key, true);
  });
}
