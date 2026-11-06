// Table 1 for one monthly tracker record, in TSM's style: orange header, green category rows with subtotals, grey
// banding, partly delivered cases in italics with an orange marker. The last column lists the dated developments
// that month, each with its source. Rows added that month are green; cases that left are struck through at the bottom.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { MONTHS, EXIT, fmtTable, fmtHouse, wedgeName, srcLink } from './mdata.js';
import { fmtD } from './model.js';

const CATS = ['Traditional', 'Asymmetric', 'Munitions'];
const pct = (m, t) => `${(m / t * 100).toFixed(1)}%`;

export const tableTitle = m => `Itemized list of backlogged capabilities by weapons category, ${m.label}`;

function upsHtml(r) {
  const st = r.st ? `<span class="mv-st">${escapeHtml(r.st.t)}${srcLink(r.st.src)}</span>` : '';
  if (!r.ups.length) return st || '<span class="mv-none">No dated development this month</span>';
  return st + r.ups.map(u => `<span class="mv-up"><b>${escapeHtml(fmtD(u.d))}:</b> ${escapeHtml(u.t)}${srcLink(u.src)}${srcLink(u.src2)}</span>`).join('');
}

export function renderTable(box, i, { wedge }) {
  const m = MONTHS[i];
  const w = wedge ? m.wedges.find(x => x.id === wedge) : null;
  const keep = w ? new Set(w.keys) : null;
  const open = m.rows.filter(r => !r.out), gone = m.rows.filter(r => r.out);
  let band = 0;
  const body = CATS.map((cat, ci) => {
    const rows = open.filter(r => r.cat === cat && (!keep || keep.has(r.k))).sort((a, b) => b.m - a.m);
    if (keep && !rows.length) return '';
    if (ci) band++;
    const c = m.cats[cat];
    const head = `<tr class="mv-cat" role="row"><th scope="rowgroup" role="rowheader">${cat}</th><td role="cell">${fmtTable(c.m)}</td><td role="cell">${pct(c.m, m.total)}</td><td role="cell"></td></tr>`;
    return head + rows.map(r => {
      const cls = ['mv-row', band++ % 2 ? 'b1' : 'b0'];
      if (r.p) cls.push('is-p');
      if (r.add) cls.push('is-add');
      if (r.newp) cls.push('is-newp');
      const tags = [];
      if (r.add) tags.push('<span class="mv-tag t-add">New this month</span>');
      if (r.newp) tags.push('<span class="mv-tag t-newp">Newly partly delivered</span>');
      return `<tr class="${cls.join(' ')}" data-k="${r.k}" role="row">
        <th scope="row" role="rowheader"><button type="button" class="mv-case" data-k="${r.k}">${r.p ? '<span class="mv-pm" aria-hidden="true"></span>' : ''}${escapeHtml(r.n)}${r.p ? '<span class="mv-sr"> (partly delivered)</span>' : ''}</button>${tags.join('')}</th>
        <td role="cell">${fmtTable(r.m)}</td><td role="cell">${pct(r.m, m.total)}</td>
        <td role="cell">${upsHtml(r)}</td></tr>`;
    }).join('');
  }).join('');
  const goneRows = keep ? '' : gone.map(r => `<tr class="mv-row is-out" data-k="${r.k}" role="row">
      <th scope="row" role="rowheader"><button type="button" class="mv-case" data-k="${r.k}"><s>${escapeHtml(r.n)}</s></button><span class="mv-tag t-out">${EXIT[r.out]}</span></th>
      <td role="cell"><s>${fmtTable(r.m)}</s></td><td role="cell">–</td><td role="cell">${upsHtml(r)}</td></tr>`).join('');
  box.innerHTML = `
    <p class="mv-ttl" id="mv-ttl">${escapeHtml(tableTitle(m))}</p>
    ${w ? `<p class="mv-filter" role="status">Showing the ${w.keys.length} case${w.keys.length === 1 ? '' : 's'} in <b>${escapeHtml(wedgeName(w.id))}</b> (${fmtHouse(w.m)}). <button type="button" class="btn" data-clear>Show all</button></p>` : ''}
    <div class="mv-scroll" tabindex="0" role="region" aria-labelledby="mv-ttl">
    <table class="mv-table" role="table" aria-labelledby="mv-ttl">
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Capability Sold</th><th scope="col" role="columnheader">Dollar Value (In Millions)</th><th scope="col" role="columnheader">Share of total backlog, ${escapeHtml(m.label)}</th><th scope="col" role="columnheader">${m.rows.some(r => r.st) ? 'Status and developments this month' : 'Developments this month'}</th></tr></thead>
      <tbody role="rowgroup">${body}</tbody>
      ${goneRows ? `<tbody class="mv-gone" role="rowgroup"><tr role="row"><th colspan="4" scope="rowgroup" role="rowheader">Left the backlog this month (not in the total)</th></tr>${goneRows}</tbody>` : ''}
    </table></div>`;
}
