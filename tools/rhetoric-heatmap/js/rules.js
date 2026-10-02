// Renders the theme-rule table and the exercise list (with sources) below the tool.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { THEMES } from '../data/themes.js';

export function renderRules(tableBody, eventsList, events) {
  tableBody.innerHTML = THEMES.map(t => `<tr><th scope="row">${escapeHtml(t.label)}</th>
    <td><code>${escapeHtml(t.re)}</code></td><td>${escapeHtml(t.note)}</td></tr>`).join('');
  eventsList.innerHTML = events.map(e => `<li><b>${escapeHtml(e.name)}</b>, <span class="num">${e.start}${e.end !== e.start ? ' to ' + e.end : ''}</span>.
    ${e.src.map(([n, u]) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(n)}</a>`).join(', ')}</li>`).join('');
}
