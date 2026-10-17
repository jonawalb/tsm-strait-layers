// Monthly and yearly totals per sector: days with reported entries, as heat tables.
import { MONTHS, YEARS, SECTORS, SECTOR_INFO, monthName } from './data.js';

const shade = (v, max) => v ? (0.1 + 0.85 * Math.sqrt(v / max)).toFixed(3) : 0;

export function drawYears(box, { onPick }) {
  const max = Math.max(1, ...YEARS.flatMap(y => SECTORS.map(s => y.agg.sec[s])));
  const head = `<tr><th scope="col">Year</th>${SECTORS.map(s => `<th scope="col">${SECTOR_INFO[s].name}</th>`).join('')}
    <th scope="col">Days with entries</th><th scope="col">MND count</th><th scope="col">JCRP days</th></tr>`;
  const body = YEARS.map(y => {
    const a = y.agg;
    const partial = a.days < 365 ? ` <span class="muted lc">(${a.days} days)</span>` : '';
    return `<tr><th scope="row"><button type="button" class="linkish" data-k="${y.k}">${y.k}</button>${partial}</th>
      ${SECTORS.map(s => `<td class="heat num" style="--t:${shade(a.sec[s], max)}">${a.sec[s]}</td>`).join('')}
      <td class="num">${a.entryDays}</td><td class="num">${a.entered.toLocaleString('en-US')}</td><td class="num">${a.jcrp}</td></tr>`;
  }).join('');
  box.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => onPick(YEARS.find(y => y.k === b.dataset.k)));
}

export function drawMonths(box, { onPick }) {
  const max = Math.max(1, ...MONTHS.flatMap(m => SECTORS.map(s => m.agg.sec[s])));
  const cols = MONTHS.map(m => {
    const mm = +m.k.slice(5);
    return `<th scope="col" class="${mm === 1 ? 'yr' : ''}" title="${monthName(m.k)}">${mm === 1 || m === MONTHS[0] ? m.k.slice(2, 4) : ''}<span class="sr">${monthName(m.k)}</span></th>`;
  }).join('');
  const rows = SECTORS.map(s => `<tr><th scope="row">${SECTOR_INFO[s].name}</th>${MONTHS.map(m => {
    const v = m.agg.sec[s];
    return `<td class="cell ${+m.k.slice(5) === 1 ? 'yr' : ''}" style="--t:${shade(v, max)}"><button type="button" data-k="${m.k}" aria-label="${SECTOR_INFO[s].name}, ${monthName(m.k)}: ${v} day${v === 1 ? '' : 's'}" title="${SECTOR_INFO[s].name}, ${monthName(m.k)}: ${v} day${v === 1 ? '' : 's'}"></button></td>`;
  }).join('')}</tr>`).join('');
  const jc = `<tr class="jc"><th scope="row">JCRP days</th>${MONTHS.map(m => `<td class="${+m.k.slice(5) === 1 ? 'yr' : ''}">${m.agg.jcrp ? `<i title="${monthName(m.k)}: ${m.agg.jcrp} JCRP day${m.agg.jcrp > 1 ? 's' : ''}">${m.agg.jcrp}</i>` : ''}</td>`).join('')}</tr>`;
  box.innerHTML = `<table class="mgrid"><thead><tr><th></th>${cols}</tr></thead><tbody>${rows}${jc}</tbody></table>`;
  box.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => onPick(MONTHS.find(m => m.k === b.dataset.k)));
}

export function markWindow(box, i0, i1) {
  MONTHS.forEach(m => {
    const on = m.i1 >= i0 && m.i0 <= i1;
    box.querySelectorAll(`button[data-k="${m.k}"]`).forEach(b => b.parentElement.classList.toggle('inwin', on));
  });
}
