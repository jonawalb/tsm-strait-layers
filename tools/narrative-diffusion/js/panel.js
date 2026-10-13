// Panel readouts: summary tiles, the record list for a selection, and coverage bars.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { LANES } from '../data/coverage.js';
import { KIND, coverageIn, fromT } from './model.js';
import { dayLink, linkHtml } from '../../../shared/js/links.js';

function mark(text, re) {
  re.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += escapeHtml(text.slice(last, m.index)) + '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

export function renderTiles(box, sum) {
  const f0 = sum.firsts[0];
  const nMedia = sum.firsts.filter(f => LANES[f.lane].group === 'media').length;
  box.innerHTML = `
    <div class="tile"><b class="num">${sum.hits.length.toLocaleString()}</b><span>records found</span></div>
    <div class="tile"><b class="num">${f0 ? f0.r.d : '–'}</b><span>first seen${f0 ? `, ${LANES[f0.lane].name}` : ''}</span></div>
    <div class="tile"><b class="num">${sum.firsts.length} / ${LANES.length}</b><span>sources reached (${nMedia} state media)</span></div>
    <div class="tile"><b class="num">${sum.median == null ? '–' : (sum.median < 0 ? '−' : '+') + Math.abs(Math.round(sum.median)) + ' d'}</b><span>median state-media lag behind first official use${sum.firstOfficial && sum.firstOfficial.r.d < '2025-01-01' ? '; inflated, because TSM\'s state-media collection starts in January 2025' : ''}</span></div>`;
}

export function renderRecords(box, sum, sel, m, onMore) {
  let rs, head;
  if (sel && sel.rs) {
    rs = sel.rs;
    head = `${escapeHtml(LANES[sel.lane].name)}, ${rs[0].d}${rs.length > 1 && rs[rs.length - 1].d !== rs[0].d ? ' to ' + rs[rs.length - 1].d : ''}`;
  } else if (sel && sel.lane != null) {
    rs = sum.byLane[sel.lane];
    head = `${escapeHtml(LANES[sel.lane].name)}: all ${rs.length} records`;
  } else {
    rs = sum.firsts.map(f => f.r);
    head = 'First appearance in each source';
  }
  const limit = sel?.limit || 30;
  box.innerHTML = `<p class="eyebrow">Records</p><h3 class="r-head">${head}</h3>
    ${rs.length ? `<ol class="recs">${rs.slice(0, limit).map(r => `<li>
      <p class="r-meta"><span class="pill g-${LANES[r.lane].group}">${escapeHtml(LANES[r.lane].name)}</span> <span class="num">${r.d}</span>
        <span class="kind k${r.kind}">${KIND[r.kind]}${r.zh ? ' · 中文' : ''}</span></p>
      ${dayLink(r.d) ? `<p class="r-day">${linkHtml(dayLink(r.d), 'That day in the Strait')}</p>` : ''}
      <p class="r-title"><a href="${escapeHtml(r.u)}" target="_blank" rel="noopener" ${r.zh ? 'lang="zh"' : ''}>${mark(r.title, m.re)}</a></p>
      ${r.text ? `<p class="r-text" ${r.zh ? 'lang="zh"' : ''}>${mark(r.text, m.re)}</p>` : ''}</li>`).join('')}</ol>` : '<p class="fine">No records.</p>'}
    ${rs.length > limit ? `<button type="button" class="btn more">Show more (${rs.length - limit} left)</button>` : ''}
    ${sel ? '<button type="button" class="btn back">Back to first appearances</button>' : ''}`;
  box.querySelector('.more')?.addEventListener('click', () => onMore({ ...sel, limit: limit + 30 }));
  box.querySelector('.back')?.addEventListener('click', () => onMore(null));
}

export function renderCoverage(box, sum, win) {
  const m0 = fromT(win[0]).slice(0, 7), m1 = fromT(win[1]).slice(0, 7);
  box.innerHTML = `<div class="cov-grid">${LANES.map((ln, i) => {
    const c = coverageIn(ln.key, m0, m1);
    const n = sum.byLane[i].length;
    return `<div class="cov-row"><span class="cov-lab">${escapeHtml(ln.name)}</span>
      <span class="cov-bar" title="${c.any} of ${c.n} months with any records collected; ${c.full} with article text">
        <i class="any" style="width:${(100 * c.any / c.n).toFixed(1)}%"></i><i class="full" style="width:${(100 * c.full / c.n).toFixed(1)}%"></i></span>
      <span class="cov-n num">${c.any}/${c.n} mo</span><span class="cov-hits num">${n || ''}</span></div>`;
  }).join('')}</div>`;
}
