// Spike list with evidence sentences. Official sources: sentence (<= 300 chars) + link. Media: headline + link only.
import { esc, fmt } from './labels.js';

const OUTLET = { official: 'Official', state_media: 'State media', media: 'Media' };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function item(ev) {
  const src = `${esc(ev.source)} · ${esc(ev.date)}`;
  const link = ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(host(ev.url)) || 'link'}</a>` : '';
  if (ev.outlet === 'official' && ev.text) {
    return `<li><q>${esc(ev.text)}</q><span class="evm"><span class="pill">${OUTLET.official}</span> ${src} · ${link}</span></li>`;
  }
  return `<li><span class="hl">${esc(ev.title || '(no headline)')}</span><span class="evm"><span class="pill">${esc(OUTLET[ev.outlet] || ev.outlet)}, headline only</span> ${src} · ${link}</span></li>`;
}

/** spikes: [{week, peak_day, z, delta, n, evidence, i, used, key}], newest first. */
export function renderSpikes(root, spikes, sel, res, onPick) {
  if (!spikes.length) {
    root.innerHTML = '<p class="fine">No spike weeks for this series in the window. A spike is a week in the top tenth of the series\' rise over its own 12-week baseline, with z ≥ 1.5.</p>';
    return;
  }
  root.innerHTML = `<ol class="spikes">${spikes.map(s => `
    <li class="${s.key === sel ? 'open' : ''}">
      <button type="button" data-k="${esc(s.key)}" aria-expanded="${s.key === sel}">
        <span class="d">${res === 'week' ? 'Week of ' + esc(s.week) : esc(s.peak_day)}</span>
        <span class="z">z ${s.z.toFixed(1)} · ${fmt(s.delta, 3)} · ${s.n} docs</span>
        ${s.used ? '<span class="pill used" title="Used in the event study">in event study</span>' : ''}
      </button>
      ${s.key === sel ? `<ul class="ev">${(s.evidence || []).map(item).join('') || '<li class="fine">No quotable sentence passed the checks for this week.</li>'}</ul>` : ''}
    </li>`).join('')}</ol>`;
  root.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.k === sel ? null : b.dataset.k)));
}
