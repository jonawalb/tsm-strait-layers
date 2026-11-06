// Trait readings (Leadership Trait Analysis): only the indices that passed the frozen holdout.
// data/traits.js is optional. If it is missing the page carries on with no readings.
// A fixture build reads data/raw_fixture/traits_fixture.js instead, so fake people never meet real scores.
import { escapeHtml as esc } from '../../../shared/js/mapkit.js';

export const PLAIN = {
  CC: 'How far the leader sees issues in shades of grey versus black and white.',
  TASK: 'Focus on getting the problem solved versus on building relationships and group morale.',
};
const ORDER = ['CC', 'TASK'];

export async function loadTraits(fixture) {
  try {
    const m = await import(fixture ? '../data/raw_fixture/traits_fixture.js' : '../data/traits.js');
    const T = m.TRAITS || {};
    return { meta: T.meta || {}, people: T.people || {} };
  } catch {
    return { meta: {}, people: {} };
  }
}

const pct = v => `${Math.max(0, Math.min(1, v)) * 100}%`;
const fin = v => typeof v === 'number' && Number.isFinite(v);
const n = v => fin(v) ? v.toLocaleString('en-US') : '?';

// Section for one person, or '' when there is no reading (no empty box).
export function traitsHtml(p, T) {
  const R = T.people[p.id];
  if (!R) return '';
  const idx = T.meta.indices || {};
  const keys = ORDER.filter(k => R[k] && fin(R[k].p10) && fin(R[k].p90)).concat(Object.keys(R).filter(k => !ORDER.includes(k) && R[k] && fin(R[k].p10)));
  if (!keys.length) return '';
  const row = k => {
    const r = R[k], I = idx[k] || {};
    const band = fin(I.mean) && fin(I.sd) ? `<i class="tr-norm" style="left:${pct(I.mean - I.sd)};width:calc(${pct(I.mean + I.sd)} - ${pct(I.mean - I.sd)})" title="Norming group mean ±1 SD"></i>` : '';
    return `<li class="tr-row">
      <p class="tr-h"><b>${esc(I.name || k)}</b>${r.cat ? ` <span class="tr-cat">${esc(r.cat)}</span>` : ''}</p>
      <p class="fine tr-plain">${esc(PLAIN[k] || '')}</p>
      <div class="tr-track" role="img" aria-label="${esc(I.name || k)}: 10th to 90th percentile ${r.p10.toFixed(2)} to ${r.p90.toFixed(2)}${fin(I.mean) ? `, norming mean ${I.mean.toFixed(2)}` : ''}">
        ${band}<i class="tr-band" style="left:${pct(r.p10)};width:calc(${pct(r.p90)} - ${pct(r.p10)})"></i></div>
      <div class="tr-axis"><span>0</span><span class="tr-num">reading ${fin(r.score) ? r.score.toFixed(2) : '?'} · range ${r.p10.toFixed(2)}–${r.p90.toFixed(2)}</span><span>1</span></div>
      <p class="fine">Based on ${n(r.n_docs)} docs, ${n(r.n_words)} words (${esc(r.basis || 'basis not stated')}${r.translated ? '; translated' : ''})</p></li>`;
  };
  return `<h3 class="pf-h">Trait readings <a class="tr-label" href="#traits-method">Comparable-text validated</a></h3>
    <p class="fine">Research readings, not forecasts. Shaded band: norming group${T.meta.norm?.name ? ` (${esc(T.meta.norm.name)})` : ''} mean ±1 SD. Coloured band: this leader's 10th to 90th percentile. <a href="#traits-method">How these were checked</a>.</p>
    <ul class="tr-list" style="--k:var(--k-${p.country})">${keys.map(row).join('')}</ul>`;
}

// Method notes, filled from TRAITS.meta when present.
export function traitsMethodHtml(T) {
  const m = T.meta || {};
  const count = Object.keys(T.people).length;
  const idx = m.indices || {};
  const mae = Object.entries(idx).filter(([, I]) => fin(I.holdout_mae)).map(([k, I]) => `${esc(I.name || k)} holdout mean absolute error ${I.holdout_mae.toFixed(3)}`);
  return `<li><b>Trait readings</b>: ${count ? `${count} leaders have readings on ${Object.keys(idx).length || 2} Leadership Trait Analysis indices` : 'no readings are loaded yet'}. Only 2 of the 7 LTA traits, conceptual complexity and task focus, passed the frozen holdout test; the other five are not shown. Validation covers prepared speeches by native English speakers. Spontaneous remarks and translated text are untested, so readings built on them are flagged in each profile. The readings describe language in public texts and are research readings, not forecasts.
    ${m.validated ? `<br><span class="fine">Validation: ${esc(m.validated)}</span>` : ''}
    ${m.instrument ? `<br><span class="fine">Instrument: ${esc(m.instrument)}${m.scorer_sha256 ? `, scorer SHA-256 <code>${esc(String(m.scorer_sha256).slice(0, 12))}…</code>` : ''}</span>` : ''}
    ${m.norm?.citation ? `<br><span class="fine">Norming group: ${esc(m.norm.name || '')}, ${esc(m.norm.citation)}</span>` : ''}
    ${mae.length ? `<br><span class="fine">${mae.join('; ')}.</span>` : ''}
    ${(m.caveats || []).length ? `<ul class="tr-cav">${m.caveats.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</li>`;
}
