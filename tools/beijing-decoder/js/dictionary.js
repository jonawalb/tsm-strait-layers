// Dictionary list (filterable) and the detail readout for one formulation.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { FORMULATIONS, TIERS, HALVES, HALF_TOTALS } from '../data/formulations.js';
import { dayLink, linkHtml } from '../../../shared/js/links.js';

const TR = { tsm: 'TSM translation (official English on the linked page may be worded differently)', official: 'Official English', mt: 'Machine translation (Google)', zh: 'Chinese only (no official English)',
  claude: 'Machine translation (Claude)' };
const LINK = { day: 'Transcript for that day', item: 'Original release', index: 'Spokesperson index (direct link not held)' };
export const byId = Object.fromEntries(FORMULATIONS.map(f => [f.id, f]));

export const tierPill = t => `<span class="tier t${t}" title="${TIERS[t].desc}">${t} · ${TIERS[t].name}</span>`;

// Bars: uses per 100 Taiwan-related statements, by half-year.
export function spark(f, { w = 200, h = 42, labels = false } = {}) {
  const rate = f.byHalf.map((n, i) => (HALF_TOTALS[i] ? (100 * n) / HALF_TOTALS[i] : 0));
  const max = Math.max(1, ...rate);
  const bw = w / rate.length;
  const bars = rate.map((r, i) => {
    const bh = r ? Math.max(2, (r / max) * (h - (labels ? 14 : 2))) : 0;
    const y = h - (labels ? 12 : 0) - bh;
    return `<rect x="${(i * bw + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5"><title>${HALVES[i]}: ${f.byHalf[i]} of ${HALF_TOTALS[i]} statements (${r.toFixed(1)} per 100)</title></rect>`
      + (labels && i % 2 === 0 ? (i === rate.length - 1
        ? `<text x="${w}" y="${h - 1}" text-anchor="end">${HALVES[i].replace('H', ' H')}</text>`
        : `<text x="${(i * bw + 1).toFixed(1)}" y="${h - 1}">${HALVES[i].replace('H', ' H')}</text>`) : '');
  }).join('');
  return `<svg class="spark t${f.tier}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Uses per 100 Taiwan-related statements by half-year">${bars}</svg>`;
}

export function renderList(box, { tier, query, selected }) {
  const q = (query || '').trim().toLowerCase();
  const items = FORMULATIONS.filter(f => (!tier || f.tier === tier) &&
    (!q || (f.zh + ' ' + f.en + ' ' + f.gloss).toLowerCase().includes(q)));
  box.innerHTML = items.length ? items.map(f => `<button type="button" class="entry${f.id === selected ? ' on' : ''}" data-id="${f.id}" aria-pressed="${f.id === selected}">
      <span class="e-zh" lang="zh">${escapeHtml(f.zh)}</span>
      <span class="e-en">${escapeHtml(f.en)}</span>
      <span class="e-meta">${tierPill(f.tier)} <span class="num">${f.n}</span> uses</span>
      ${spark(f, { w: 120, h: 22 })}
    </button>`).join('') : '<p class="fine">No formulation matches that filter.</p>';
}

function example(e) {
  const links = [];
  if (e.u) links.push(`<a href="${escapeHtml(e.u)}" target="_blank" rel="noopener">${LINK[e.lk]}</a>`);
  if (e.uz) links.push(`<a href="${escapeHtml(e.uz)}" target="_blank" rel="noopener">Chinese original</a>`);
  const day = linkHtml(dayLink(e.d), 'That day in the Strait');
  if (day) links.push(day);
  return `<li><p class="x-meta"><span class="pill src-${e.s}">${e.s}</span> <span class="num">${e.d}</span>${e.sp ? ' · ' + escapeHtml(e.sp) : ''} <span class="tr">${TR[e.tr]}</span></p>
    ${e.zh ? `<p class="x-zh" lang="zh">${escapeHtml(e.zh)}</p>` : ''}${e.en ? `<p class="x-en">${escapeHtml(e.en)}</p>` : ''}
    <p class="x-links">${links.join(' · ')}</p></li>`;
}

export function renderDetail(box, id) {
  const f = byId[id];
  if (!f) { box.innerHTML = '<p class="fine">Pick a formulation from the dictionary or click a highlight.</p>'; return; }
  const src = f.src.length ? `<p class="fine">Source: ${f.src.map(([n, u]) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(n)}</a>`).join(', ')}</p>` : '';
  box.innerHTML = `<p class="d-zh" lang="zh">${escapeHtml(f.zh)}</p>
    <h3 class="d-en">${escapeHtml(f.en)}</h3>
    <p>${tierPill(f.tier)}</p>
    <p><b>Gloss.</b> ${escapeHtml(f.gloss)}</p>
    <p><b>What it has signalled.</b> ${escapeHtml(f.signal)}</p>${src}
    <div class="d-counts"><p class="eyebrow">In the TSM corpus</p>
      ${f.n ? `<p class="fine"><b class="num">${f.n}</b> statements since ${f.first}: ${Object.entries(f.bySrc).filter(([, n]) => n).map(([s, n]) => `<span class="pill src-${s}">${s} ${n}</span>`).join('')}</p>
      ${spark(f, { w: 300, h: 70, labels: true })}
      <p class="fine">Uses per 100 Taiwan-related statements, by half-year. Collection widened in 2026, and Chinese text (used for the Chinese pattern) exists mostly for 2026 items, so compare early and late bars with care. The last bar, 2026 H2, covers July to September only.</p>`
      : '<p class="fine">No use in the TSM spokesperson corpus (July 2022 to September 2026).</p>'}
    </div>
    ${f.ex.length ? `<div><p class="eyebrow">Example uses</p><ul class="examples">${f.ex.map(example).join('')}</ul></div>` : ''}
    <details class="rule"><summary>Matching rule</summary><p class="fine">Chinese: <code>${escapeHtml(f.zre)}</code><br>English (case-insensitive): <code>${escapeHtml(f.ere)}</code></p></details>`;
}

/** Corpus counts for every formulation, for "Copy data as CSV". */
export function csvRows() {
  return [['id', 'chinese', 'english', 'tier', 'statements_total', 'first_use', ...HALVES.map(h => `${h}_statements`)],
    ...FORMULATIONS.map(f => [f.id, f.zh, f.en, f.tier, f.n, f.first || '', ...f.byHalf]),
    ['(all Taiwan-related statements)', '', '', '', '', '', ...HALF_TOTALS]];
}
