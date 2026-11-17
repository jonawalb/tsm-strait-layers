// Table 1 for one monthly tracker record, in TSM's style, split by tier: a dark band per tier with its own subtotal,
// green category rows inside it, grey banding, partly delivered cases in italics with an orange marker. Shares are
// shares of the tier, not of a combined total. The last column lists that month's status and dated developments.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { MONTHS, fmtTable, fmtHouse, wedgeName, srcLink } from './mdata.js';
import { fmtD } from './model.js';

const CATS = ['Traditional', 'Asymmetric', 'Munitions'];
const TIER_HEAD = { contracted: 'Contracted backlog (LOA signed)', nna: 'Notified, not accepted (no signed LOA)' };
const pct = (m, t) => t ? `${(m / t * 100).toFixed(1)}%` : '–';

export const tableTitle = m => `Itemized list of U.S. arms sales to the Philippines by tier and weapons category, ${m.label}`;

function upsHtml(r) {
  const st = r.st ? `<span class="mv-st">${escapeHtml(r.st.t)}${srcLink(r.st.src)}</span>` : '';
  if (!r.ups.length) return st || '<span class="mv-none">No dated development this month</span>';
  return st + r.ups.map(u => `<span class="mv-up"><b>${escapeHtml(fmtD(u.d))}:</b> ${escapeHtml(u.t)}${srcLink(u.src)}</span>`).join('');
}

export function renderTable(box, i, { wedge }) {
  const m = MONTHS[i];
  const w = wedge ? m.wedges.find(x => x.id === wedge) : null;
  const keep = w ? new Set(w.keys) : null;
  const open = m.rows.filter(r => !r.out), gone = m.rows.filter(r => r.out);
  let band = 0;
  const body = ['contracted', 'nna'].map(tier => {
    const tt = m.tot[tier];
    const inTier = open.filter(r => r.tier === tier && (!keep || keep.has(r.k)));
    if (keep && !inTier.length) return '';
    const head = `<tr class="mv-tier t-${tier}" role="row"><th scope="rowgroup" role="rowheader">${TIER_HEAD[tier]}</th><td role="cell">${fmtTable(tt)}</td><td role="cell">${tt ? '100%' : '–'}</td><td role="cell">${open.filter(r => r.tier === tier).length} case${open.filter(r => r.tier === tier).length === 1 ? '' : 's'}</td></tr>`;
    const cats = CATS.map(cat => {
      const rows = inTier.filter(r => r.cat === cat).sort((a, b) => b.m - a.m);
      if (!rows.length) return '';
      const cm = m.cats[tier][cat];
      return `<tr class="mv-cat" role="row"><th scope="rowgroup" role="rowheader">${cat}</th><td role="cell">${fmtTable(cm)}</td><td role="cell">${pct(cm, tt)}</td><td role="cell"></td></tr>` + rows.map(r => {
        const cls = ['mv-row', band++ % 2 ? 'b1' : 'b0'];
        if (r.p) cls.push('is-p');
        if (r.add) cls.push('is-add');
        if (r.moved) cls.push('is-moved');
        const tags = [];
        if (r.add) tags.push('<span class="mv-tag t-add">New this month</span>');
        if (r.moved) tags.push('<span class="mv-tag t-moved">LOA signed this month</span>');
        return `<tr class="${cls.join(' ')}" data-k="${r.k}" role="row">
          <th scope="row" role="rowheader"><button type="button" class="mv-case" data-k="${r.k}">${r.p ? '<span class="mv-pm" aria-hidden="true"></span>' : ''}${escapeHtml(r.n)}${r.p ? '<span class="mv-sr"> (partly delivered)</span>' : ''}</button>${tags.join('')}</th>
          <td role="cell">${fmtTable(r.m)}</td><td role="cell">${pct(r.m, tt)}</td>
          <td role="cell">${upsHtml(r)}</td></tr>`;
      }).join('');
    }).join('');
    return head + cats;
  }).join('');
  const goneRows = keep ? '' : gone.map(r => `<tr class="mv-row is-out" data-k="${r.k}" role="row">
      <th scope="row" role="rowheader"><button type="button" class="mv-case" data-k="${r.k}"><s>${escapeHtml(r.n)}</s></button><span class="mv-tag t-out">Left the backlog</span></th>
      <td role="cell"><s>${fmtTable(r.m)}</s></td><td role="cell">–</td><td role="cell">${upsHtml(r)}</td></tr>`).join('');
  box.innerHTML = `
    <p class="mv-ttl" id="mv-ttl">${escapeHtml(tableTitle(m))}</p>
    ${w ? `<p class="mv-filter" role="status">Showing the ${w.keys.length} case${w.keys.length === 1 ? '' : 's'} in <b>${escapeHtml(wedgeName(w.id))}</b> (${fmtHouse(w.m)}). <button type="button" class="btn" data-clear>Show all</button></p>` : ''}
    <div class="mv-scroll" tabindex="0" role="region" aria-labelledby="mv-ttl">
    <table class="mv-table" role="table" aria-labelledby="mv-ttl">
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Capability Notified</th><th scope="col" role="columnheader">Dollar Value (In Millions)</th><th scope="col" role="columnheader">Share of its tier, ${escapeHtml(m.label)}</th><th scope="col" role="columnheader">${m.rows.some(r => r.st) ? 'Status and developments this month' : 'Developments this month'}</th></tr></thead>
      <tbody role="rowgroup">${body}</tbody>
      ${goneRows ? `<tbody class="mv-gone" role="rowgroup"><tr role="row"><th colspan="4" scope="rowgroup" role="rowheader">Left the backlog this month (in neither tier)</th></tr>${goneRows}</tbody>` : ''}
    </table></div>`;
}
