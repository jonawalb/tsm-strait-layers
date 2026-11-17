// Spike list with evidence sentences. Official sources: sentence (<= 300 chars) + link. Media: headline + link only.
// Shared verbatim by say-do-taiwan and say-do-global.
import { esc, fmt } from './labels.js';

const OUTLET = { official: 'Official', state_media: 'State media', media: 'Media' };
const ORIGINAL = { ru: 'Russian original, untranslated', fa: 'Persian original, untranslated', es: 'Spanish original, untranslated', zh: 'Chinese original, untranslated' };
// Sites whose old article links no longer resolve (checked 16 Nov 2026).
const DEAD = { 'mppre.gob.ve': 'link no longer live' };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function item(ev, st) {
  const lang = ORIGINAL[st.lang] ? ` · ${ORIGINAL[st.lang]}` : '';
  const src = `${esc(st.label || ev.source)} · ${esc(ev.date)}${lang}`;
  const h = host(ev.url);
  const link = ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(h) || 'link'}</a>${DEAD[h] ? ` (${DEAD[h]})` : ''}` : '';
  const lt = st.lang && st.lang !== 'en' ? ` lang="${esc(st.lang)}"` : '';
  if (ev.outlet === 'official' && ev.text) {
    return `<li><q${lt}>${esc(ev.text)}</q><span class="evm"><span class="pill">${OUTLET.official}</span> ${src} · ${link}</span></li>`;
  }
  return `<li><span class="hl"${lt}>${esc(ev.title || '(no headline)')}</span><span class="evm"><span class="pill">${esc(OUTLET[ev.outlet] || ev.outlet)}, headline only</span> ${src} · ${link}</span></li>`;
}

/** spikes: [{week, peak_day, z, delta, n, evidence, i, used, key}], newest first. st: {label, lang} of the stream. */
export function renderSpikes(root, spikes, sel, res, onPick, st = {}) {
  if (!spikes.length) {
    root.innerHTML = '<p class="fine">No spike weeks for this series in the window. A spike is a week in the top tenth of the series\' rise over its own 12-week baseline, with z ≥ 1.5.</p>';
    return;
  }
  root.innerHTML = `<p class="fine sk-key">z: how many standard deviations the week sits above the series' own 12-week baseline. Rise: the change in the series. Docs: documents that week.</p><ol class="spikes">${spikes.map(s => `
    <li class="${s.key === sel ? 'open' : ''}">
      <button type="button" data-k="${esc(s.key)}" aria-expanded="${s.key === sel}">
        <span class="d">${res === 'week' ? 'Week of ' + esc(s.week) : esc(s.peak_day)}</span>
        <span class="z">z ${s.z.toFixed(1)} · rise ${fmt(s.delta, 3)} · ${s.n} docs</span>
        ${s.used ? (st.esTested === false ? '<span class="pill used" title="This spike is one of the event study\'s spikes, but there were too few to test">spike in untested event study</span>' : '<span class="pill used" title="Used in the event study">in event study</span>') : ''}
      </button>
      ${s.key === sel ? `<ul class="ev">${(s.evidence || []).map(e => item(e, st)).join('') || '<li class="fine">No quotable sentence passed the checks for this week.</li>'}</ul>` : ''}
    </li>`).join('')}</ol>`;
  root.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.k === sel ? null : b.dataset.k)));
}
