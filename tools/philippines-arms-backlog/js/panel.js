// Panel: filter controls and the case detail card.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { CATS, STATUSES, OPEN, TIER, fmtD, fmtM, fmtAge, summary } from './model.js';
import { caseHistory, srcLink } from './mdata.js';

const KIND = { notified: 'Notified to Congress', loa: 'LOA signed: moves to the contracted tier', delivery: 'Delivery', event: 'Milestone', delay: 'Setback or delay', done: 'Left the backlog', tier: 'Tier change' };
const STLABEL = { nna: 'Notified, not accepted', contracted: 'Contracted', delivering: 'Contracted, deliveries under way', gone: 'Left the backlog' };
const CATVAR = { Traditional: 'trad', Asymmetric: 'asym', Munitions: 'mun' };

export function buildFilters(S, onChange) {
  const sm = summary();
  const cats = document.getElementById('cats');
  cats.innerHTML = CATS.map(k => `<button type="button" data-cat="${k}" aria-pressed="${S.cats.has(k)}" style="border-left-color:var(--k-${CATVAR[k]})">${k}<b>${sm.nCat[k]} case${sm.nCat[k] === 1 ? '' : 's'}</b></button>`).join('');
  cats.querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.cat;
    if (S.cats.has(k) && S.cats.size > 1) S.cats.delete(k); else S.cats.add(k);
    onChange();
  });
  const st = document.getElementById('status');
  st.innerHTML = STATUSES.map(s => { const n = OPEN.filter(s.test).length; return `<button type="button" data-st="${s.id}">${s.label}<small>${n} case${n === 1 ? '' : 's'}</small></button>`; }).join('');
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
  const open = list.filter(c => !c.gone);
  const c = open.filter(x => x.tier === 'contracted'), n = open.filter(x => x.tier === 'nna');
  const sum = a => a.reduce((s, x) => s + x.m, 0);
  document.getElementById('filter-read').textContent =
    `Showing ${open.length} of ${summary().n} open cases: contracted ${fmtM(sum(c))} (${c.length}), notified but not accepted ${fmtM(sum(n))} (${n.length})` +
    (S.gone && list.length > open.length ? `, plus ${list.length - open.length} that left.` : '.');
}

/** The case's row in every monthly tracker record (March 2026 onward). */
function historyHtml(key, { open = false, month = null } = {}) {
  const h = caseHistory(key);
  if (!h.length) return '';
  const tag = e => [e.add ? '<span class="pill k-add">Notified</span>' : '', e.moved ? '<span class="pill k-contracted">LOA signed</span>' : '',
    e.out ? '<span class="pill k-out">Left the backlog</span>' : '', `<span class="pill k-${e.tier}">${TIER[e.tier].name}</span>`].join('');
  const ups = e => (e.st ? `${escapeHtml(e.st.t)}${srcLink(e.st.src)}${e.ups.length ? '<br>' : ''}` : '') + (e.ups.length
    ? e.ups.map(u => `${escapeHtml(fmtD(u.d))}: ${escapeHtml(u.t)}${srcLink(u.src)}`).join('<br>')
    : (e.st ? '' : 'No dated development recorded this month.'));
  return `<details class="hist"${open ? ' open' : ''}><summary class="eyebrow">Monthly tracker record</summary>
    <p class="fine">Newest first. The Philippines tracker starts in March 2026; no monthly records exist before it.</p>
    <ol class="hist-l">${[...h].reverse().map(e => `<li class="${e.out ? 'k-done' : ''}${month === e.mo ? ' here' : ''}"><span class="d">${e.label}</span>${tag(e)} ${ups(e)}</li>`).join('')}</ol></details>`;
}

export function renderDetail(c, list, onSelect, box = document.getElementById('detail'), opts = {}) {
  if (!c) { box.innerHTML = '<p class="fine">Select a row in the timeline to see its record.</p>'; return; }
  const i = list.findIndex(x => x.key === c.key);
  const tierEv = c.tiers.slice(1).map(t => ({ m: 'loa', d: t.d, date: t.date, t: t.t + (t.inferred ? ' (date inferred)' : ''), src: t.src }));
  const events = [{ m: 'notified', d: c.notified, date: c.nD, t: `${fmtM(c.m)}, transmittal ${c.tn}. Enters the notified-not-accepted tier.`, src: c.link }, ...tierEv, ...c.ms.filter(x => x.m !== 'loa')]
    .sort((a, b) => a.date - b.date);
  const pills = [`<span class="pill k-${c.tier}">${TIER[c.tier].name}</span>`, `<span class="pill k-${c.cat}">${c.cat}</span>`];
  if (c.partial && c.tier === 'contracted') pills.push('<span class="pill k-deliv">Partly delivered</span>');
  const conf = c.conf === 'high'
    ? '<span class="badge v-verified" title="Tier rests on direct evidence: see the status and sources.">High confidence</span>'
    : '<span class="badge v-diff" title="Tier rests on the absence of any LOA, contract or delivery record, not on a record of refusal.">Medium confidence</span>';
  const signed = c.signed ? `<p class="fine">Signed contract price in Philippine records: ₱${c.signed.php.toLocaleString('en-US')}${srcLink(c.signed.src)}. The tracker carries the notified value.</p>` : '';
  box.innerHTML = `
    <div class="meta">${pills.join('')}${conf}</div>
    <h3>${escapeHtml(c.name)}</h3>
    <p class="money">${fmtM(c.m)} <small>notified ${fmtD(c.notified)}, ${c.gone ? `left the backlog ${fmtD(c.left)}` : `open ${fmtAge(c.age)}`}</small></p>
    <p class="fine tn">Transmittal ${escapeHtml(c.tn || '')} · ${escapeHtml(c.full)}</p>
    ${signed}
    ${c.detail ? `<p class="blurb">${escapeHtml(c.detail)}${(c.detailSrc || []).map(u => srcLink(u)).join('')}</p>` : ''}
    <p class="status-t"><b>${c.gone ? 'Why it left' : `${STLABEL[c.state]} · status, ${fmtD(c.statusAsOf)}`}</b>${escapeHtml(c.gone ? c.outcome : c.status)}${srcLink(c.gone ? c.src : c.statusSrc)}</p>
    ${historyHtml(c.key, opts)}
    <p class="eyebrow">Milestones</p>
    <ol>${events.map(x => `<li class="k-${x.m}"><span class="d">${fmtD(x.d)} · ${KIND[x.m] || 'Milestone'}</span>${escapeHtml(x.t)}${srcLink(x.src)}</li>`).join('')}</ol>
    <div class="nav">
      <button type="button" class="btn" data-go="-1" ${i <= 0 ? 'disabled' : ''}>← Previous</button>
      <button type="button" class="btn" data-go="1" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>`;
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const n = list[i + Number(b.dataset.go)];
    if (n) onSelect(n.key, true);
  });
}
