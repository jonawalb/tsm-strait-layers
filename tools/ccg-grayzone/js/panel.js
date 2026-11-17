// Panel pieces: location filters, incident detail card, "firsts" strip and the full incident table.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { INC, LOCS, LOC, nice, niceLong, vesselTokens, inWindow } from './model.js';
import { dateLinksHtml } from '../../../shared/js/links.js';

const esc = escapeHtml;

export function renderFilters(root, on, w, date, onToggle) {
  root.innerHTML = LOCS.map(L => {
    const n = INC.filter(i => i.loc === L.key && inWindow(i, w) && i.date <= date).length;
    return `<button type="button" class="loc-btn" data-k="${esc(L.key)}" aria-pressed="${on.has(L.key)}" style="--lc:${L.color}">
      <i class="sw"></i><span>${L.label}</span><b class="num">${n}</b></button>`;
  }).join('');
  root.querySelectorAll('.loc-btn').forEach(b => b.onclick = () => onToggle(b.dataset.k));
}

/** Clock times on a small 0-24h strip, only where the tracker recorded them. */
function timeStrip(i) {
  if (!i.times.length) return '<p class="fine">No clock times recorded for this incident.</p>';
  const min = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const pts = i.times.map(t => ({ ...t, m: min(t.t) + t.day * 1440 }));
  const lo = Math.min(0, ...pts.map(p => p.m)), hi = Math.max(1440, ...pts.map(p => p.m));
  const X = m => ((m - lo) / (hi - lo) * 100).toFixed(2);
  const ticks = [0, 6, 12, 18, 24].map(h => `<span class="ts-tick" style="left:${X(h * 60)}%">${String(h).padStart(2, '0')}</span>`).join('');
  const marks = pts.map(p => `<span class="ts-mark" style="left:${X(p.m)}%" title="${esc(p.t)} ${esc(p.what)}"></span>`).join('');
  const a = Math.min(...pts.map(p => p.m)), b = Math.max(...pts.map(p => p.m));
  const span = pts.length > 1 ? `<span class="ts-span" style="left:${X(a)}%;width:${(X(b) - X(a)).toFixed(2)}%"></span>` : '';
  const list = pts.map(p => `<li><span class="num">${esc(p.t)}</span>${p.day ? ` <small>(${p.day > 0 ? 'next day' : 'day before'})</small>` : ''} ${esc(p.what)}</li>`).join('');
  return `<div class="tstrip" aria-hidden="true">${span}${marks}${ticks}</div><ul class="tlist">${list}</ul>`;
}

/** Data notes: duplicates, hull conflicts, rows only in one tracker version, and similar. */
export const flagPills = i => i.flags.map(f => `<span class="pill flag" data-k="${esc(f.k)}" title="${esc(f.text)}">${esc(f.label)}</span>`).join('');
function flagNotes(i) {
  if (!i.flags.length) return '';
  return `<div class="det-flags" role="note"><p class="eyebrow sm">Data notes</p>${i.flags.map(f =>
    `<p class="flag-note"><b>${esc(f.label)}.</b> ${esc(f.text)}</p>`).join('')}</div>`;
}

export function renderDetail(root, i, { hasPrev, hasNext, pos, total }) {
  if (!i) {
    root.innerHTML = `<p class="eyebrow">Incident</p><p class="fine">No incidents recorded yet at the selected locations in this period. Move the slider forward, pick another year or turn a location back on.</p>`;
    return;
  }
  const L = LOC[i.loc];
  const vs = vesselTokens(i.vessels), cga = vesselTokens(i.cga);
  const hull = s => /^\d{3,5}\b/.test(s);
  root.innerHTML = `
    <div class="det-h"><p class="eyebrow">Incident ${pos} of ${total} shown</p>
      <div class="det-nav"><button type="button" class="btn" data-d="-1" ${hasPrev ? '' : 'disabled'} aria-label="Previous incident">‹</button>
      <button type="button" class="btn" data-d="1" ${hasNext ? '' : 'disabled'} aria-label="Next incident">›</button></div></div>
    <h2 class="det-date">${niceLong(i.date)}</h2>
    ${dateLinksHtml(i.date) ? `<p class="xlinks">${dateLinksHtml(i.date)}</p>` : ''}
    <p class="det-loc" style="--lc:${L.color}"><i class="sw"></i>${L.label} <span class="pill approx">approximate position</span></p>
    ${i.locRec ? `<p class="det-rec">Tracker category: ${esc(i.locRec)}</p>` : ''}
    <p class="det-where">${L.where}</p>
    ${flagNotes(i)}
    ${i.cites.length ? `<div class="det-cites"><p class="eyebrow sm">Checked against the CGA release</p><p class="flag-note">${esc(i.checked)}</p>
      <p class="flag-note">${i.cites.map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join(' · ')} <small class="muted">(Chinese)</small></p></div>` : ''}
    ${i.desc ? `<p class="det-desc">${esc(i.desc)}</p>` : '<p class="det-desc muted">No location description recorded.</p>'}
    <p class="eyebrow sm">Event timeline</p>
    ${i.timeline ? `<p class="det-tl">${esc(i.timeline)}</p>` : ''}
    ${timeStrip(i)}
    <p class="eyebrow sm">Known CCG/PRC vessels</p>
    <p class="det-vs">${vs.map(v => `<span class="pill ${hull(v) ? 'hull' : ''}">${esc(v)}</span>`).join('') || '<span class="muted">Not recorded</span>'}</p>
    <p class="eyebrow sm">Known CGA vessels</p>
    <p class="det-vs">${cga.map(v => `<span class="pill cga">${esc(v)}</span>`).join('') || '<span class="muted">Not recorded in the tracker</span>'}</p>`;
}

export function renderFirsts(root, firsts, w, date, onGo) {
  const list = firsts.filter(f => f.date >= w.s && f.date <= w.e);
  root.innerHTML = list.map(f => {
    const done = f.date <= date;
    const L = f.loc ? LOC[f.loc] : null;
    return `<button type="button" class="first ${done ? 'done' : 'locked'}" data-j="${firsts.indexOf(f)}" style="--lc:${L ? L.color : 'var(--accent)'}">
      <span class="f-date num">${nice(f.date)}</span><b>${esc(f.title)}</b>
      <span class="f-text">${done ? esc(f.text) : 'Ahead on the timeline. Click to jump.'}</span></button>`;
  }).join('') || '<p class="fine">No firsts fall in this period.</p>';
  root.querySelectorAll('.first').forEach(b => b.onclick = () => onGo(firsts[Number(b.dataset.j)]));
}

export function renderTable(tbody, w, on, sel, onPick) {
  tbody.innerHTML = INC.filter(i => on.has(i.loc) && inWindow(i, w)).slice().reverse().map(i => `
    <tr data-id="${i.id}" class="${i.id === sel ? 'sel' : ''}" tabindex="0">
      <td class="num nowrap">${i.date}</td><td class="nowrap"><i class="sw" style="--lc:${LOC[i.loc].color}"></i>${LOC[i.loc].label}${i.major ? `<br><small class="muted">${esc(i.major)}</small>` : ''}</td>
      <td>${esc(i.desc || '—')}</td><td>${esc(i.timeline || '—')}</td><td>${esc(i.vessels || '—')}</td><td>${esc(i.cga || '—')}</td>
      <td class="flags">${flagPills(i) || ''}${i.cites.map(c => `<a class="pill cite" href="${esc(c.url)}" target="_blank" rel="noopener">CGA release</a>`).join('')}</td></tr>`).join('');
  tbody.querySelectorAll('tr').forEach(tr => {
    const go = () => onPick(Number(tr.dataset.id), true);
    tr.onclick = go;
    tr.onkeydown = e => { if (e.key === 'Enter') go(); };
  });
}
