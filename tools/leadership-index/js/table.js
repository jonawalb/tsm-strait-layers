// Sortable table of the people now visible.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

const COLS = [
  { k: 'name', label: 'Name' }, { k: 'country', label: 'Country' }, { k: 'tier', label: 'Tier', num: true },
  { k: 'topPost', label: 'Top post at date' }, { k: 'statusNow', label: 'Status' }, { k: 'ties', label: 'Ties', num: true },
];
const STATUS = { active: 'Active', removed: 'Removed', under_investigation: 'Under investigation', retired: 'Retired', deceased: 'Deceased', unaccounted: 'Replaced, fate not announced' };

const TCOLS = [{ k: 'CC', label: 'CC', num: true, title: 'Conceptual complexity reading (0–1)' }, { k: 'TASK', label: 'Task', num: true, title: 'Task focus reading (0–1)' }];

const SCOL = { k: 'stmts', label: 'Statements', num: true, title: 'Documents in the TSM rhetoric corpus attributed to this person (local snapshot; lower bound)' };

export function renderTable(el, rows, sort, { onSort, onPick, sel, hasTraits, traitCols, onTraitCols, hasStatements, stCol, onStCol }) {
  const { k, dir } = sort;
  const tOn = hasTraits && traitCols, sOn = hasStatements && stCol;
  const cols = COLS.concat(tOn ? TCOLS : [], sOn ? [SCOL] : []);
  const f2 = v => typeof v === 'number' ? v.toFixed(2) : '';
  const s = rows.slice().sort((a, b) => {
    const x = a[k] ?? '', y = b[k] ?? '';
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (c || a.name.localeCompare(b.name)) * (dir === 'asc' ? 1 : -1);
  });
  el.innerHTML = `<table><caption class="fine">${rows.length} people shown. Click a column to sort, a name to open the profile.${hasTraits ? ` <label class="tcol"><input type="checkbox" id="tcol"${traitCols ? ' checked' : ''}> Show trait readings (CC, task focus)</label>` : ''}${hasStatements ? ` <label class="tcol"><input type="checkbox" id="scol"${stCol ? ' checked' : ''}> Show statement counts</label>` : ''}</caption>
    <thead><tr>${cols.map(c => `<th scope="col"${c.title ? ` title="${c.title}"` : ''} aria-sort="${c.k === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="thbtn" data-k="${c.k}">${c.label}${c.k === k ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
    <tbody>${s.map(r => `<tr${r.id === sel ? ' class="sel"' : ''} style="--k:var(--k-${r.country})">
      <td><button type="button" class="linkbtn" data-pick="${esc(r.id)}">${esc(r.name)}</button>${r.name_native ? ` <span class="fine">${esc(r.name_native)}</span>` : ''}</td>
      <td><span class="cdot"></span>${r.country}</td><td class="num">${r.tier}</td><td>${esc(r.topPost || '')}</td>
      <td>${STATUS[r.statusNow]}</td><td class="num">${r.ties}</td>${tOn ? `<td class="num">${f2(r.CC)}</td><td class="num">${f2(r.TASK)}</td>` : ''}${sOn ? `<td class="num">${r.stmts ? r.stmts.toLocaleString('en-US') : ''}</td>` : ''}</tr>`).join('') || '<tr><td colspan="${cols.length}" class="fine">No people match the filters.</td></tr>'}</tbody></table>`;
  el.querySelectorAll('.thbtn').forEach(b => b.addEventListener('click', () => {
    const nk = b.dataset.k; onSort({ k: nk, dir: nk === k && dir === 'asc' ? 'desc' : (nk === k ? 'asc' : (cols.find(c => c.k === nk).num ? 'desc' : 'asc')) });
  }));
  el.querySelector('#tcol')?.addEventListener('change', e => onTraitCols(e.target.checked));
  el.querySelector('#scol')?.addEventListener('change', e => onStCol(e.target.checked));
  el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.pick)));
}
