// Side-by-side comparison of the user's plan against the presets at the same budget and scenario.
import { evaluate } from './model.js';
import { barHtml } from './alloc.js';

const pct = v => Math.round(v * 100) + '%';

export function renderCompare(rows, total, sc) {
  const res = rows.map(r => ({ ...r, e: evaluate(r.shares, total, sc) }));
  const best = k => Math.max(...res.map(r => k(r.e)));
  const metrics = [
    ['Force engaged', e => e.engaged, pct],
    ['Hours under fire', e => e.fireHours, v => v.toFixed(1) + ' h'],
    ['Shooters left', mobileWeighted, pct],
    ['Resilience', e => e.resilience, v => Math.round(v)],
  ];
  return `<table class="cmp"><thead><tr><th>Plan</th><th class="cmp-bar">Mix</th>${metrics.map(m => `<th>${m[0]}</th>`).join('')}</tr></thead><tbody>
    ${res.map(r => `<tr${r.you ? ' class="you"' : ''}><td><b>${r.t}</b>${r.s ? `<small>${r.s}</small>` : ''}</td><td class="cmp-bar" data-l="Mix">${barHtml(r.shares)}</td>
      ${metrics.map(m => { const v = m[1](r.e); return `<td data-l="${m[0]}" class="num${Math.abs(v - best(m[1])) < 1e-9 && res.length > 1 ? ' best' : ''}">${m[2](v)}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table>`;
}

/** Share of all shooting capability (mobile launchers and platforms) still alive, weighted by what was bought. */
export function mobileWeighted(e) {
  const m = (e.E.ascm + e.E.drones + e.E.strike), p = e.E.platforms;
  return (m * e.surv.mobile + p * e.surv.platform) / (m + p || 1);
}
