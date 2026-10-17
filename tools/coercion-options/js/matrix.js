// Comparison matrix (rows x options) and the selected option's card. Citation numbers link to the source list.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';
import { OPTIONS, ROWS } from '../data/options.js';
import { SOURCES } from '../data/sources.js';
import { OPT_COLOR } from './charts.js';

const IDS = Object.keys(SOURCES);
const num = id => IDS.indexOf(id) + 1;
const refs = c => c.length ? `<sup class="refs">${c.map(id => `<a href="#src-${id}" title="${esc(SOURCES[id].short)}">${num(id)}</a>`).join(',')}</sup>` : '';
const cell = parts => parts.map(p => `${esc(p.t)}${refs(p.c)}`).join(' ');

export function drawMatrix(root, sel, rowFilter) {
  const rows = ROWS.filter(r => !rowFilter || rowFilter === r.id);
  root.innerHTML = `<table class="matrix">
    <thead><tr><th scope="col" class="rh">Compare</th>${OPTIONS.map(o =>
      `<th scope="col" class="${o.id === sel ? 'on' : ''}" style="--oc:${OPT_COLOR[o.id]}">
        <button type="button" data-opt="${o.id}" aria-pressed="${o.id === sel}">${esc(o.name)}<small>${esc(o.tag)}</small></button></th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><th scope="row" class="rh">${esc(r.name)}</th>${OPTIONS.map(o =>
      `<td class="${o.id === sel ? 'on' : ''}" style="--oc:${OPT_COLOR[o.id]}">${cell(o.cells[r.id])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

export function drawCard(root, sel) {
  const o = OPTIONS.find(x => x.id === sel);
  root.style.setProperty('--oc', OPT_COLOR[sel]);
  root.innerHTML = `<p class="eyebrow">${esc(o.tag)}</p><h2 class="card-h">${esc(o.name)}</h2>
    <dl class="optdl">${ROWS.map(r => `<dt>${esc(r.name)}</dt><dd>${cell(o.cells[r.id])}</dd>`).join('')}</dl>`;
}

export function drawSources(root) {
  root.innerHTML = IDS.map(id => `<li id="src-${id}">${esc(SOURCES[id].cite)} <a href="${SOURCES[id].url}" target="_blank" rel="noopener">Link</a></li>`).join('');
}
