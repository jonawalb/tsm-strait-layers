// Method & sources tables, filled from data/meta.js and data/behaviour.js so they always match the shipped data.
import { META } from '../data/meta.js';
import { BEH } from '../data/behaviour.js';
import { DIM, esc, fmtN } from './labels.js';

const $ = id => document.getElementById(id);
const ROLE = { action: 'action', outcome: 'outcome (not the speaker\'s own action)', context: 'context' };

$('cov-rhet').innerHTML = `<table><thead><tr><th>Stream</th><th>Outlet</th><th>Docs</th><th>Span</th></tr></thead><tbody>${
  META.streams.map(s => `<tr><td>${esc(s.label)}<br><code>${esc(s.stream)}</code></td><td>${esc(s.outlet.replace('_', ' '))}</td><td class="num">${fmtN(s.n_docs)}</td><td class="num">${esc(s.first)} – ${esc(s.last)}</td></tr>`).join('')
}</tbody></table>`;

$('cov-beh').innerHTML = `<table><thead><tr><th>Series</th><th>Role</th><th>Span</th><th>Source and notes</th></tr></thead><tbody>${
  BEH.map(b => `<tr><td>${esc(b.label)}<br><small>${esc(b.unit)}${b.weekly_only ? ', weekly only' : ''}</small></td><td>${esc(ROLE[b.role] || b.role)}</td><td class="num">${esc(b.first)} – ${esc(b.last)}</td><td>${esc(b.source)}. ${esc(b.note)}</td></tr>`).join('')
}</tbody></table>`;

const v = META.rhetoric.validation;
$('validation').innerHTML = `<table><thead><tr><th>Dimension</th><th>AUC</th><th>Pearson r</th></tr></thead><tbody>${
  Object.keys(v).map(d => `<tr><td>${esc(DIM[d] || d)}</td><td class="num">${v[d].auc?.toFixed(2) ?? '–'}</td><td class="num">${v[d].pearson?.toFixed(2) ?? '–'}</td></tr>`).join('')
}</tbody></table><p class="fine">${esc(META.rhetoric.validation_note)} Held-out sentences: ${fmtN(META.rhetoric.n_heldout)}.</p>`;

const W = META.res.week, D = META.res.day;
$('params').innerHTML = `<table><thead><tr><th></th><th>Weekly</th><th>Daily</th></tr></thead><tbody>
<tr><td>Lead-lag range K</td><td class="num">±${W.K} weeks</td><td class="num">±${D.K} days</td></tr>
<tr><td>Rolling baseline for anomalies</td><td class="num">${W.P} weeks (≥ ${W.min_base ?? 6} with data)</td><td class="num">${D.P} days (≥ ${D.min_base ?? 7})</td></tr>
<tr><td>Minimum documents per period</td><td class="num">${W.min_docs} (stance ${W.min_docs - 1})</td><td class="num">${D.min_docs}</td></tr>
<tr><td>Minimum overlap / rhetoric coverage</td><td class="num">${W.min_periods} weeks / ${W.min_cov * 100}%</td><td class="num">${D.min_periods} days / ${D.min_cov * 100}%</td></tr>
<tr><td>Event window, test window, estimation window</td><td class="num">±${W.h}, ${W.H}, ${W.Lest} weeks</td><td class="num">±${D.h}, ${D.H}, ${D.Lest} days</td></tr>
<tr><td>Distributed lag: rhetoric lags, behaviour lags</td><td class="num">${W.L}, ${W.Py}</td><td class="num">${D.L}, ${D.Py}</td></tr>
<tr><td>Bootstrap draws, placebo draws</td><td class="num">${W.B}, ${fmtN(W.ndraw)}</td><td class="num">${D.B}, ${fmtN(D.ndraw)}</td></tr>
</tbody></table><p class="fine">Random seed ${META.seed}. Spike rule (rhetoric export): weekly rise over the stream's previous 12 weeks in the top ${Math.round((1 - META.rhetoric.params.q) * 100)}% of that series, at least ${META.rhetoric.params.min_delta} and with z ≥ ${META.rhetoric.params.min_z}; at most ${META.rhetoric.params.k} evidence items per spike week.</p>`;

$('bh-table').innerHTML = `<table><thead><tr><th>View</th><th>Tests</th><th>p &lt; 0.05</th><th>Expected by chance</th><th>Survive BH</th></tr></thead><tbody>${
  Object.entries(META.bh).sort().map(([k, f]) => { const [r, w] = k.split('|'); return `<tr><td>${r === 'week' ? 'Weekly' : 'Daily'}, ${w === 'all' ? 'full overlap' : 'since ' + w}</td><td class="num">${fmtN(f.m)}</td><td class="num">${fmtN(f.nominal)}</td><td class="num">${fmtN(Math.round(f.m * 0.05))}</td><td class="num">${fmtN(f.survive)}</td></tr>`; }).join('')
}</tbody></table>`;
