// Panel: sector filters, hull frequency, incident detail; and the incident table below.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { SECTORS, SECTOR, INC, niceLong, hullCounts } from './model.js';

export function renderSectors(root, S, counts, on) {
  root.innerHTML = SECTORS.map(s => `<button type="button" class="sec-btn" data-s="${s.key}" aria-pressed="${S.sectors.has(s.key)}">
    <span>${esc(s.label)}</span><b class="num">${counts[s.key] || 0}</b></button>`).join('');
  root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => on.sector(b.dataset.s));
}

export function renderHulls(root, S, list, on) {
  const hc = hullCounts(list), max = hc.length ? hc[0][1] : 1;
  root.innerHTML = hc.length ? `<ol class="hbar">${hc.map(([h, n]) => `<li><button type="button" data-h="${h}" aria-pressed="${S.hull === h}">
      <span class="hl num">${h}</span><span class="hb"><i style="width:${(n / max * 100).toFixed(0)}%"></i></span><b class="num">${n}</b></button></li>`).join('')}</ol>`
    : '<p class="fine">No hull numbers recorded for incidents up to this date.</p>';
  root.querySelectorAll('[data-h]').forEach(b => b.onclick = () => on.hull(b.dataset.h));
}

export function renderDetail(root, S, list, on) {
  const i = S.sel != null ? INC[S.sel] : null;
  if (!i) {
    root.innerHTML = '<p class="eyebrow">Incident detail</p><p class="fine">Click a pin, a hull number or a table row. Pins sit in the area the record names, never at an exact position.</p>';
    return;
  }
  const k = list.findIndex(x => x.k === i.k);
  root.innerHTML = `<div class="det-h"><p class="eyebrow">Incident${k >= 0 ? ` ${k + 1} of ${list.length}` : ''}</p>
      <span class="det-nav"><button type="button" class="btn sm" data-d="-1" aria-label="Previous incident" ${k <= 0 ? 'disabled' : ''}>‹</button>
      <button type="button" class="btn sm" data-d="1" aria-label="Next incident" ${k < 0 || k >= list.length - 1 ? 'disabled' : ''}>›</button></span></div>
    <h3 class="det-date">${niceLong(i.date)}</h3>
    <p class="det-desc">${esc(i.desc)} <span class="pill approx">approximate area: ${esc(SECTOR[i.sec[0]].label.toLowerCase())}</span></p>
    ${i.timeline ? `<p class="det-tl"><b>Timeline:</b> ${esc(i.timeline)}</p>` : ''}
    <p class="det-vs">${i.ccg.length ? i.ccg.map(h => `<button type="button" class="pill hull" data-h="${h}" aria-pressed="${S.hull === h}">${h}</button>`).join(' ') : ''}
      ${!i.ccg.length || i.odd.length ? `<span class="fine">As recorded: ${esc(i.vessels)}</span>` : ''}</p>
    ${i.flags.length ? `<div class="det-flags"><p class="eyebrow">Data notes</p>${i.flags.map(f => `<p class="flag-note"><b>${esc(f.label)}.</b> ${esc(f.text)}</p>`).join('')}</div>` : ''}
    ${i.cites.length ? `<div class="det-cites">${i.cites.map(c => `<a class="xlink" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join(' ')}${i.checked ? `<p class="fine">${esc(i.checked)}</p>` : ''}</div>` : ''}`;
  root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => on.pick(list[k + Number(b.dataset.d)].k));
  root.querySelectorAll('[data-h]').forEach(b => b.onclick = () => on.hull(b.dataset.h));
}

export function renderTable(tbody, note, S, list, on) {
  note.textContent = `${list.length} incident${list.length === 1 ? '' : 's'} up to the slider date, newest first. Filters apply.`;
  tbody.innerHTML = list.slice().reverse().map(i => `<tr data-k="${i.k}" class="${S.sel === i.k ? 'sel' : ''}">
    <td class="num nowrap">${i.date}</td><td>${esc(i.desc)}</td><td>${esc(i.timeline)}</td><td class="num">${esc(i.vessels)}</td>
    <td>${i.cites.map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">CGA</a>`).join(' ')}</td></tr>`).join('');
  tbody.querySelectorAll('tr').forEach(tr => tr.onclick = e => { if (e.target.tagName !== 'A') on.pick(Number(tr.dataset.k)); });
}
