// Scenario panel. Built now, fed later: response ranges come from data/scores.js once LTA and
// operational-code scores pass benchmark checks. Draws a 10th–90th percentile band per actor, never a point.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

export const CRISES = [
  { id: 'taiwan-blockade', label: 'Taiwan Strait blockade' },
  { id: 'sts-grayzone', label: 'Gray-zone escalation at Second Thomas Shoal' },
  { id: 'korea-provocation', label: 'Korean Peninsula provocation' },
];
const PENDING = 'Behavioral scores (Leadership Trait Analysis and operational code) are in validation. Response ranges will appear here once scores pass benchmark checks. The two trait readings shown in some profiles are not enough on their own to model crisis responses.';
const MAX_ACTORS = 4;

export function createScenario(el, { actors, scores, state, onChange }) {
  const S = state; // {actors: [ids], crisis: id}
  const meta = scores.meta || {};
  const scale = meta.scale || ['De-escalate', 'Escalate'];

  function band(id) {
    const a = scores.actors?.[id];
    const c = a?.validated ? a.crises?.[S.crisis] : null;
    return c && Number.isFinite(c.p10) && Number.isFinite(c.p90) ? c : null;
  }

  function render() {
    const byId = new Map(actors.map(p => [p.id, p]));
    S.actors = S.actors.filter(id => byId.has(id));
    const picked = S.actors.map(id => byId.get(id));
    const ready = picked.filter(p => band(p.id));
    el.innerHTML = `
      <div class="scen-grid">
        <div>
          <p class="eyebrow">1. Crisis</p>
          <div class="choices" role="group" aria-label="Crisis">${CRISES.map(c => `<button type="button" data-crisis="${c.id}" aria-pressed="${S.crisis === c.id}">${esc(c.label)}</button>`).join('')}</div>
          <p class="eyebrow mt">2. Actors <span class="fine">tier 1, up to ${MAX_ACTORS}</span></p>
          ${actors.length ? `<label class="sr" for="scen-add">Add an actor</label>
          <select id="scen-add" class="sel-in"><option value="">Add an actor…</option>${actors.map(p => `<option value="${esc(p.id)}"${S.actors.includes(p.id) ? ' disabled' : ''}>${esc(p.name)} (${p.country})</option>`).join('')}</select>
          <ul class="scen-actors">${picked.map(p => `<li style="--k:var(--k-${p.country})"><span class="cdot"></span>${esc(p.name)} <button type="button" class="x" data-rm="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">×</button></li>`).join('')}</ul>`
          : '<p class="fine">No tier-1 leaders are loaded yet.</p>'}
        </div>
        <div class="scen-out" aria-live="polite">
          <p class="eyebrow">3. Response range</p>
          <div class="scen-axis"><span>${esc(scale[0])}</span><span>${esc(scale[1])}</span></div>
          <ul class="scen-bars">${picked.map(p => { const b = band(p.id); return `<li style="--k:var(--k-${p.country})">
            <span class="sb-name">${esc(p.name)}</span>
            <span class="sb-track">${b ? `<i style="left:${b.p10 * 100}%;width:${Math.max(1, (b.p90 - b.p10) * 100)}%" title="10th to 90th percentile"></i>` : '<em>pending</em>'}</span></li>`; }).join('') || '<li class="fine">Add actors to compare their ranges.</li>'}</ul>
          ${ready.length ? `<p class="fine">Bands show the 10th to 90th percentile of modeled responses. There is no single predicted value. ${meta.source ? `<a href="${esc(meta.source)}" target="_blank" rel="noopener">Method</a>` : ''}</p>`
            : `<p class="scen-pending">${PENDING}</p>`}
        </div>
      </div>`;
    el.querySelectorAll('[data-crisis]').forEach(b => b.addEventListener('click', () => { S.crisis = b.dataset.crisis; render(); onChange(); }));
    el.querySelector('#scen-add')?.addEventListener('change', ev => {
      const v = ev.target.value; if (!v) return;
      S.actors.push(v); if (S.actors.length > MAX_ACTORS) S.actors.shift();
      render(); onChange(); el.querySelector('#scen-add')?.focus();
    });
    el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { S.actors = S.actors.filter(x => x !== b.dataset.rm); render(); onChange(); }));
  }
  render();
  return { render };
}
