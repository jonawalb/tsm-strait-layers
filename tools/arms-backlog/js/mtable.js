// Table 1 for one month (Cato's or TSM's), as an interactive HTML table in TSM's style: orange header, green
// category rows with subtotals, grey banding. Partly delivered cases in italics with an orange marker. Rows added
// this month are green; cases that left the backlog this month are listed struck through at the bottom. A row
// without a public dollar value (Cato's HIMARS plus-up, January to March 2024) says so and is in no sum.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { MONTHS, EXIT, fmtTable, fmtHouse, wedgeName, statusHtml } from './mdata.js';

const CATS = ['Traditional', 'Asymmetric', 'Munitions'];
const sup = n => `<sup class="mv-fn"><a href="#mvn-${n}" aria-label="Note ${n}">${n}</a></sup>`;

/** Footnote markers for one place in the table: where = { header } | { row } | { cat }. */
function marks(notes, test) { return notes.filter(test).map(n => sup(n.n)).join(''); }

export function tableTitle(m, i) {
  const prev = MONTHS[i - 1];
  return m.kind === 'change'
    ? `Change in backlogged capabilities by weapons category, ${prev ? prev.label : 'December 2024'} to ${m.label}`
    : `Itemized list of backlogged capabilities by weapons category, ${m.label}`;
}

export function renderTable(box, i, { wedge, notes }) {
  const m = MONTHS[i];
  const w = wedge ? m.wedges.find(x => x.id === wedge) : null;
  const keep = w ? new Set(w.keys) : null;
  const newp = new Set(m.chg.newp);
  const open = m.rows.filter(r => !r.out), gone = m.rows.filter(r => r.out);
  let band = 0;
  const body = CATS.map((cat, ci) => {
    const rows = open.filter(r => r.cat === cat && (!keep || keep.has(r.k)));
    if (keep && !rows.length) return '';
    if (ci) band++;
    const c = m.cats[cat];
    const head = `<tr class="mv-cat" role="row"><th scope="rowgroup" role="rowheader">${cat}</th><td role="cell">${fmtTable(c.m)}${marks(notes, n => (n.at.cats || []).includes(cat))}</td><td role="cell">${escapeHtml(c.sh)}</td><td role="cell"></td></tr>`;
    return head + rows.map(r => {
      const cls = ['mv-row', band++ % 2 ? 'b1' : 'b0'];
      if (r.p) cls.push('is-p');
      if (r.add || r.vf) cls.push('is-add');
      if (newp.has(r.k)) cls.push('is-newp');
      const tags = [];
      if (r.add && r.ak !== 'review') tags.push('<span class="mv-tag t-add">New this month</span>');
      if (r.vf) tags.push('<span class="mv-tag t-add">Value now public</span>');
      if (newp.has(r.k)) tags.push('<span class="mv-tag t-newp">Newly partly delivered</span>');
      return `<tr class="${cls.join(' ')}" data-k="${r.k}" role="row">
        <th scope="row" role="rowheader"><button type="button" class="mv-case" data-k="${r.k}">${r.p ? '<span class="mv-pm" aria-hidden="true"></span>' : ''}${escapeHtml(r.n)}${r.nd ? `<span class="mv-nd">&nbsp;· ${r.nd}</span>` : ''}${r.p ? '<span class="mv-sr"> (partly delivered)</span>' : ''}</button>${marks(notes, n => (n.at.rows || []).includes(r.k))}${tags.join('')}</th>
        <td role="cell">${fmtTable(r.m)}</td><td role="cell">${escapeHtml(r.sh)}</td>
        <td role="cell">${statusHtml(r.st)}${r.tn ? `<span class="mv-tn">${escapeHtml(r.tn)}</span>` : ''}</td></tr>`;
    }).join('');
  }).join('');
  const goneRows = keep ? '' : gone.map(r => `<tr class="mv-row is-out" data-k="${r.k}" role="row">
      <th scope="row" role="rowheader"><button type="button" class="mv-case" data-k="${r.k}"><s>${escapeHtml(r.n)}</s></button><span class="mv-tag t-out">${EXIT[r.out]}</span></th>
      <td role="cell"><s>${fmtTable(r.m)}</s></td><td role="cell">${escapeHtml(r.sh)}</td><td role="cell">${statusHtml(r.st)}${r.tn ? `<span class="mv-tn">${escapeHtml(r.tn)}</span>` : ''}</td></tr>`).join('');
  const shareH = `Share of total backlog, ${m.label}${marks(notes, n => n.at.header === 'share')}`;
  box.innerHTML = `
    <p class="mv-t1">Table 1</p>
    <p class="mv-ttl" id="mv-ttl">${escapeHtml(tableTitle(m, i))}</p>
    ${w ? `<p class="mv-filter" role="status">Showing the ${w.keys.length} case${w.keys.length === 1 ? '' : 's'} in <b>${escapeHtml(wedgeName(w.id))}</b> (${fmtHouse(w.m)}). <button type="button" class="btn" data-clear>Show all</button></p>` : ''}
    <div class="mv-scroll" tabindex="0" role="region" aria-labelledby="mv-ttl">
    <table class="mv-table" role="table" aria-labelledby="mv-ttl">
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Capability Sold</th><th scope="col" role="columnheader">Dollar Value (In Millions)</th><th scope="col" role="columnheader">${shareH}</th><th scope="col" role="columnheader">${escapeHtml(m.head.status)}</th></tr></thead>
      <tbody role="rowgroup">${body}</tbody>
      ${goneRows ? `<tbody class="mv-gone" role="rowgroup"><tr role="row"><th colspan="4" scope="rowgroup" role="rowheader">Left the backlog this month (not in the total)</th></tr>${goneRows}</tbody>` : ''}
    </table></div>`;
}
