// Side panel (filters, selected crossing, hull tracker) and the full table below the map.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { STRAITS, STRAIT, ROLES, ROWS, HULLS, JSO, nice, shipLabel, shipLong, hullKey, relUrl, DIR_WORD, inWin } from './model.js';

export function renderFilters(root, S, counts, on) {
  root.innerHTML = `<p class="eyebrow">Straits</p><div class="filters">${STRAITS.map(s =>
    `<button type="button" class="f-btn" data-s="${s.key}" aria-pressed="${S.straits.has(s.key)}" style="--sc:${s.color}">
      <i class="sw"></i><span>${s.name}</span><b class="num">${counts[s.key] || 0}</b></button>`).join('')}</div>
    <p class="eyebrow">Ship types</p><div class="roles">${ROLES.map(r =>
    `<button type="button" class="btn sm" data-r="${r.key}" aria-pressed="${S.roles.has(r.key)}">${r.label}</button>`).join('')}</div>`;
  root.querySelectorAll('[data-s]').forEach(b => b.onclick = e => on.strait(b.dataset.s, e.shiftKey || e.altKey));
  root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => on.role(b.dataset.r));
}

export function renderDetail(root, S, list, on) {
  const r = S.sel != null ? ROWS[S.sel] : null;
  if (!r) {
    root.innerHTML = `<p class="eyebrow">Crossing detail</p><p class="fine">Click an arrow on the map or a row in the table. Arrows point the way ships went; thicker arrows mean more crossings in the window.</p>`;
    return;
  }
  const s = STRAIT[r.strait], k = list.indexOf(r.i);
  root.innerHTML = `<div class="det-h"><p class="eyebrow">Crossing ${k >= 0 ? `${k + 1} of ${list.length}` : ''}</p>
      <span class="det-nav"><button type="button" class="btn sm" data-d="-1" aria-label="Previous crossing" ${k <= 0 ? 'disabled' : ''}>‹</button>
      <button type="button" class="btn sm" data-d="1" aria-label="Next crossing" ${k < 0 || k >= list.length - 1 ? 'disabled' : ''}>›</button></span></div>
    <h3 class="det-date">${nice(r.date)}</h3>
    <p class="det-where" style="--sc:${s.color}"><i class="sw"></i>${s.name}, heading ${DIR_WORD[r.dir]} toward the ${r.out ? s.outTo : s.inTo}</p>
    <ul class="ships">${r.ships.map(sh => `<li><button type="button" class="hull-link" data-h="${hullKey(sh)}" aria-pressed="${S.hull === hullKey(sh)}">${esc(shipLong(sh))}</button><span class="fine">${HULLS.get(hullKey(sh)).rows.length}×</span></li>`).join('')}</ul>
    ${r.note ? `<p class="det-note">${esc(r.note)}</p>` : ''}
    <a class="xlink" href="${relUrl(r.rel)}" target="_blank" rel="noopener">JSO release ${r.rel.slice(1, 9).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')} (PDF, Japanese)</a>`;
  root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => on.pick(list[k + Number(b.dataset.d)]));
  root.querySelectorAll('[data-h]').forEach(b => b.onclick = () => on.hull(b.dataset.h));
}

/** Hull tracker: most frequent hulls in the current window, and the selected hull's history. */
export function renderHulls(root, S, winRows, on) {
  const c = new Map();
  winRows.forEach(r => r.ships.forEach(sh => { const k = hullKey(sh); c.set(k, (c.get(k) || 0) + 1); }));
  const top = [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  const max = top.length ? top[0][1] : 1;
  const h = S.hull ? HULLS.get(S.hull) : null;
  root.innerHTML = `<p class="eyebrow">Ships seen most often in this window</p>
    ${top.length ? `<ol class="hbar">${top.map(([k, n]) => `<li><button type="button" data-h="${k}" aria-pressed="${S.hull === k}">
      <span class="hl">${esc(shipLabel(HULLS.get(k).ship))}</span><span class="hb"><i style="width:${(n / max * 100).toFixed(0)}%"></i></span><b class="num">${n}</b></button></li>`).join('')}</ol>`
      : '<p class="fine">No crossings match the filters in this window.</p>'}
    ${h ? `<div class="hist"><p class="eyebrow">${esc(shipLong(h.ship))}: every reported crossing</p>
      <ol class="hist-list">${h.rows.map(i => { const r = ROWS[i]; return `<li><button type="button" data-i="${i}" class="${inWin(r, S.w) ? '' : 'out'}">
        <span class="num">${nice(r.date)}</span> ${STRAIT[r.strait].short}, ${DIR_WORD[r.dir]}</button></li>`; }).join('')}</ol>
      <p class="fine">Numbered circles beside each strait on the map give the order of these crossings.</p>
      <button type="button" class="btn sm" data-clear>Clear ship</button></div>` : '<p class="fine">Pick a ship to trace every crossing Japan reported for it.</p>'}`;
  root.querySelectorAll('[data-h]').forEach(b => b.onclick = () => on.hull(b.dataset.h));
  root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => on.pick(Number(b.dataset.i), true));
  root.querySelector('[data-clear]')?.addEventListener('click', () => on.hull(null));
}

export function renderTable(tbody, note, S, list, on) {
  note.textContent = `${list.length} crossing${list.length === 1 ? '' : 's'} match the filters in this window, newest first.`;
  tbody.innerHTML = list.slice().reverse().map(i => {
    const r = ROWS[i], s = STRAIT[r.strait];
    return `<tr data-i="${i}" class="${S.sel === i ? 'sel' : ''}"><td class="num nowrap">${r.date}</td>
      <td class="nowrap" style="--sc:${s.color}"><i class="sw"></i>${s.name}</td><td>${DIR_WORD[r.dir]}</td>
      <td>${r.ships.map(sh => esc(shipLabel(sh))).join(', ')}</td><td>${esc(r.note)}</td>
      <td><a href="${relUrl(r.rel)}" target="_blank" rel="noopener">${r.rel}</a></td></tr>`;
  }).join('');
  tbody.querySelectorAll('tr').forEach(tr => tr.onclick = e => { if (e.target.tagName !== 'A') on.pick(Number(tr.dataset.i), true); });
}

export function renderEpisodes(root, S, eps, on) {
  root.innerHTML = eps.length ? eps.map(ep => {
    const off = ep.pts.filter(p => p[1] > 148 || p[2] < 19.5);
    return `<details class="ep-card ${ep.kind}"><summary><b>${esc(ep.title)}</b> <span class="fine">${nice(ep.s)}${ep.e !== ep.s ? ' to ' + nice(ep.e) : ''}</span></summary>
      <p>${esc(ep.text)}</p>
      <ul class="fine">${ep.pts.map(p => `<li>${nice(p[0])}: ${esc(p[3])}${off.includes(p) ? ' (off this map)' : ''}. ${p[4].map(shipLabel).join(', ')}. <a href="${relUrl(p[5])}" target="_blank" rel="noopener">${p[5]}</a></li>`).join('')}</ul></details>`;
  }).join('') : '<p class="fine">No carrier deployments or joint sailings in this window.</p>';
}
export { JSO };
