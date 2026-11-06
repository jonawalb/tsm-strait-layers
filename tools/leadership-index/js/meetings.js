// Meetings: sourced meetings, calls, talks and joint statements (data/meetings.js, optional).
// Gives a dated network layer between index people, a profile section, and a pairwise matrix.
import { yearOf } from './edges.js';
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { COUNTRY_NAMES } from './profile.js';

const KIND = { meeting: 'Meeting', call: 'Call', talks: 'Talks', joint_statement: 'Joint statement' };
const pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const enc = m => `<li><span class="tl-d">${esc(m.date)}</span> ${esc(KIND[m.kind] || m.kind)}: <a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>${m.source ? ` <span class="fine">${esc(m.source)}</span>` : ''}</li>`;

// One edge per pair of index people; `dates` lets the page count encounters up to the chosen date.
export function meetingEdges(M, people) {
  if (!M) return [];
  const byPair = new Map();
  for (const m of M.items || []) {
    if (!m.b || !people.has(m.a) || !people.has(m.b) || m.a === m.b) continue;
    const k = pk(m.a, m.b);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k).push(m);
  }
  return [...byPair.entries()].map(([k, ms]) => {
    ms.sort((x, y) => x.date.localeCompare(y.date));
    const [a, b] = k.split('|');
    return { layer: 'mt', a, b, items: ms, dates: ms.map(m => yearOf(m.date)), weight: ms.length, from: yearOf(ms[0].date), to: null, id: `mt:${k}`,
      why: ms.map(m => ({ text: `${m.date} ${KIND[m.kind] || m.kind}: ${m.title}`, sources: [m.url] })) };
  });
}
// Weight and explanation restricted to encounters on or before t.
export function meetingEdgeAt(e, t) {
  const keep = e.items.filter((m, i) => e.dates[i] <= t);
  return { ...e, weight: keep.length, why: keep.map(m => ({ text: `${m.date} ${KIND[m.kind] || m.kind}: ${m.title}`, sources: [m.url] })) };
}

export function meetingsHtml(p, M, people, tISO) {
  if (!M) return '';
  const mine = (M.items || []).filter(m => (m.a === p.id || m.b === p.id) && m.date <= tISO);
  if (!mine.length) return '';
  const idx = new Map(), other = new Map();
  for (const m of mine) {
    const o = m.a === p.id ? m.b : m.a;
    if (o && people.has(o)) { (idx.get(o) || idx.set(o, []).get(o)).push(m); continue; }
    const c = m.a === p.id ? (m.b_country || '?') : (people.get(m.a)?.country || '?');
    const nm = m.a === p.id ? m.b_name : people.get(m.a)?.name || m.a;
    if (!other.has(c)) other.set(c, new Map());
    const g = other.get(c); (g.get(nm) || g.set(nm, []).get(nm)).push(m);
  }
  const last = mine.map(m => m.date).sort().pop();
  const y0 = Math.floor(yearOf(mine.map(m => m.date).sort()[0])), y1 = Math.ceil(yearOf(tISO));
  const x = d => ((yearOf(d) - y0) / Math.max(1, y1 - y0) * 100).toFixed(2);
  const kinds = Object.entries(mine.reduce((s, m) => (s[m.kind] = (s[m.kind] || 0) + 1, s), {})).map(([k, n]) => `${KIND[k] || k} ${n}`).join(' · ');
  return `<h3 class="pf-h">Meetings</h3>
    <p class="fine">${mine.length} sourced encounters to ${esc(tISO.slice(0, 7))}; last ${esc(last)}. ${esc(kinds)}.</p>
    <div class="mt-strip" role="img" aria-label="Encounters from ${y0} to ${y1}">${mine.map(m => `<i style="left:${x(m.date)}%" title="${esc(m.date)}: ${esc(m.title)}"></i>`).join('')}<span>${y0}</span><span>${y1}</span></div>
    ${idx.size ? `<ul class="mt-list">${[...idx.entries()].sort((a, b) => b[1].length - a[1].length).map(([o, ms]) => `<li><details><summary><button type="button" class="linkbtn" data-pick="${esc(o)}">${esc(people.get(o).name)}</button> <span class="fine">${people.get(o).country} · ${ms.length}× · last ${esc(ms.map(m => m.date).sort().pop())}</span></summary><ul class="why">${ms.map(enc).join('')}</ul></details></li>`).join('')}</ul>` : ''}
    ${other.size ? `<p class="fine mt-o">Counterparts not in the index:</p><ul class="mt-list">${[...other.entries()].sort().map(([c, g]) => `<li><b class="fine">${esc(COUNTRY_NAMES[c] || c)}</b><ul class="mt-sub">${[...g.entries()].sort((a, b) => b[1].length - a[1].length).map(([nm, ms]) => `<li><details><summary>${esc(nm)} <span class="fine">${ms.length}×</span></summary><ul class="why">${ms.map(enc).join('')}</ul></details></li>`).join('')}</ul></li>`).join('')}</ul>` : ''}`;
}

// Pairwise counts among the compared actors; clicking a cell lists the encounters.
export function renderMatrix(el, M, people, sel, tISO) {
  if (!M || sel.length < 2) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  const items = (M.items || []).filter(m => m.b && m.date <= tISO);
  const cell = (a, b) => items.filter(m => (m.a === a && m.b === b) || (m.a === b && m.b === a));
  const nm = id => esc(people.get(id).name);
  el.innerHTML = `<p class="eyebrow">Meeting matrix <span class="fine">sourced encounters to ${esc(tISO.slice(0, 7))}; click a count to list them</span></p>
    <div class="tablewrap"><table class="mx"><thead><tr><th scope="col"></th>${sel.map(id => `<th scope="col">${nm(id)}</th>`).join('')}</tr></thead>
    <tbody>${sel.map(a => `<tr><th scope="row">${nm(a)}</th>${sel.map(b => { if (a === b) return '<td class="mx-self">–</td>'; const n = cell(a, b).length; return `<td>${n ? `<button type="button" class="mx-n" data-a="${esc(a)}" data-b="${esc(b)}" style="--w:${Math.min(1, n / 10)}">${n}</button>` : '<span class="fine">0</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="mx-out" aria-live="polite"></div>`;
  el.querySelectorAll('.mx-n').forEach(b => b.addEventListener('click', () => {
    const ms = cell(b.dataset.a, b.dataset.b);
    el.querySelector('.mx-out').innerHTML = `<p class="pair-names">${nm(b.dataset.a)} and ${nm(b.dataset.b)}</p><ul class="why">${ms.map(enc).join('')}</ul>`;
  }));
}
export const MEETING_KINDS = KIND;
