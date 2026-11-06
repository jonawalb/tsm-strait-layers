// "Theme profile" readout under the heatmap: for the current range (and phrase filter),
// the share of each agency's Taiwan statements that use each theme. Bars share one axis.
import { THEMES } from '../data/themes.js';
import { SOURCES, SOURCE_NAMES, weekOf } from './model.js';

export function renderProfile(box, S, agg, recs) {
  const w0 = Math.max(0, weekOf(S.range.from)), w1 = weekOf(S.range.to);
  const tot = Object.fromEntries(SOURCES.map(s => [s, 0]));
  const hit = THEMES.map(() => Object.fromEntries(SOURCES.map(s => [s, 0])));
  for (const r of recs) {
    if (r.w < w0 || r.w > w1 || !S.sources.includes(r.s)) continue;
    if (S.matcher && !S.matcher.test(r)) continue;
    if (!r.a) continue; // themes read the English answer; Chinese-only items cannot match
    tot[r.s]++;
    THEMES.forEach((t, k) => { if (r.th & (1 << k)) hit[k][r.s]++; });
  }
  const on = SOURCES.filter(s => S.sources.includes(s) && tot[s]);
  if (!on.length) { box.innerHTML = '<p class="fine">No statements in this range for the selected sources.</p>'; return; }
  const cap = S.matcher ? ` containing “${S.matcher.phrase}”` : '';
  box.innerHTML = `<div class="pf-head"><p class="eyebrow">Theme profile, ${S.range.label}</p>
    <p class="fine">Share of each agency's Taiwan statements with English text${cap} that use each theme. ${on.map(s => `<span class="pill src-${s}">${s}</span> n=${tot[s]}`).join(' ')}</p></div>
    <div class="pf-grid">${THEMES.map((t, k) => `<div class="pf-row"><span class="pf-lab">${t.short}</span><span class="pf-bars">${on.map(s => {
      const v = hit[k][s] / tot[s];
      return `<span class="pf-bar src-${s}" style="width:${(v * 100).toFixed(1)}%" title="${SOURCE_NAMES[s]}: ${hit[k][s]} of ${tot[s]} (${Math.round(v * 100)}%)"></span><span class="pf-val num">${Math.round(v * 100)}%</span>`;
    }).join('<br>')}</span></div>`).join('')}</div>`;
}
