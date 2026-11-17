// Side-by-side comparison of the user's plan against the presets at the same budget.
// "What it buys" mode compares the mixes and what they pay for; "Range model" mode compares spreads, never single values.
import { ctx } from './ctx.js';
import { barHtml, money } from './alloc.js';
import { units } from './buys.js';
import { ranges, METRICS } from './range.js';

const pct = v => Math.round(v * 100);

function bandHtml(r) {
  if (pct(r.min) === pct(r.max)) return ''; // no spread: no band
  const b = pct(r.lo) === pct(r.hi) ? '' : `<i class="b" style="left:${r.lo * 100}%;width:${Math.max(1, (r.hi - r.lo) * 100)}%"></i>`; // zero-width band: not drawn
  return `<span class="mband" aria-hidden="true"><i class="w" style="left:${r.min * 100}%;width:${(r.max - r.min) * 100}%"></i>${b}</span>`;
}

export function renderCompare(rows, total, mode) {
  if (mode === 'range') {
    const res = rows.map(r => ({ ...r, g: ranges(r.shares, total) }));
    return `<table class="cmp"><thead><tr><th>Plan</th><th class="cmp-bar">Mix</th>${METRICS.map(m => `<th>${m.t}</th>`).join('')}</tr></thead><tbody>
      ${res.map(r => `<tr${r.you ? ' class="you"' : ''}><td><b>${r.t}</b>${r.s ? `<small>${r.s}</small>` : ''}</td><td class="cmp-bar" data-l="Mix">${barHtml(r.shares)}</td>
        ${METRICS.map(m => `<td data-l="${m.t}" class="num">${pct(r.g[m.id].lo) === pct(r.g[m.id].hi) ? pct(r.g[m.id].lo) : `${pct(r.g[m.id].lo)}–${pct(r.g[m.id].hi)}`}${m.id === 'res' ? '' : '%'}${bandHtml(r.g[m.id])}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
  }
  // What it buys: the three biggest lines in each plan, with what they pay for.
  return `<table class="cmp"><thead><tr><th>Plan</th><th class="cmp-bar">Mix</th><th>Biggest lines and what they pay for</th></tr></thead><tbody>
    ${rows.map(r => {
      const top = ctx.cats.filter(c => r.shares[c.id] > 0.005).sort((a, b) => r.shares[b.id] - r.shares[a.id]).slice(0, 3);
      return `<tr${r.you ? ' class="you"' : ''}><td><b>${r.t}</b>${r.s ? `<small>${r.s}</small>` : ''}</td><td class="cmp-bar" data-l="Mix">${barHtml(r.shares)}</td>
        <td data-l="Biggest lines"><ul class="toplines">${top.map(c => `<li><span class="sw8" style="background:var(${c.col})"></span>${c.t} <span class="num">${money(r.shares[c.id] * total)}</span>${c.cost ? `<small>${units(c, r.shares[c.id] * total)}</small>` : ''}</li>`).join('')}</ul></td></tr>`;
    }).join('')}
  </tbody></table>`;
}
