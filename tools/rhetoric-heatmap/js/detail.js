// Panel readout for a selected cell: the actual statements, with the matching sentences
// highlighted and links back to the official transcripts.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { THEMES } from '../data/themes.js';
import { SOURCE_NAMES, TR_LABEL, THEME_RE_G, sentences, weekStart } from './model.js';
import { dayLink, exerciseFor, exerciseLink, linkHtml } from '../../../shared/js/links.js';

const LINK_TEXT = ['Transcript for that day', 'Original release', 'Spokesperson index (direct link not held)'];
const PAGE = 25;

// Links out of the selected week: the week's first day in A Day in the Strait (2026 only), and
// the replay of any PLA exercise that falls inside the week.
function weekLinks(start) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10));
  const ex = days.map(exerciseFor).find(x => x && days.some(d => d >= x.start && d <= x.end));
  const html = [linkHtml(dayLink(start), `See ${start} in A Day in the Strait`),
    ex ? linkHtml(exerciseLink(ex.id, ex.start), `Replay ${ex.short}`) : ''].filter(Boolean).join('');
  return html ? `<p class="xlinks">${html}</p>` : '';
}

function mark(text, re) {
  if (!re) return escapeHtml(text);
  re.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += escapeHtml(text.slice(last, m.index)) + '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

// The sentences of an answer that carry the match; falls back to the opening sentences.
function excerpt(r, re, zh) {
  const sents = sentences(zh ? r.zh : r.a, zh);
  const hits = [];
  sents.forEach((s, i) => { re.lastIndex = 0; if (re.test(s)) hits.push(i); });
  const pick = (hits.length ? hits : [0, 1]).slice(0, 3).filter(i => i < sents.length);
  return pick.map((i, j) => (j && pick[j - 1] !== i - 1 ? '… ' : '') + mark(sents[i], re)).join(' ');
}

function card(r, re, zh) {
  const links = [];
  if (r.u) links.push(`<a href="${escapeHtml(r.u)}" target="_blank" rel="noopener">${LINK_TEXT[r.lk]}</a>`);
  if (r.uz) links.push(`<a href="${escapeHtml(r.uz)}" target="_blank" rel="noopener" lang="zh">Chinese original</a>`);
  r.ua.forEach((u, k) => links.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener">Also published${r.ua.length > 1 ? ' ' + (k + 1) : ''}</a>`));
  const altText = zh ? r.a : r.zh;
  return `<article class="quote">
    <p class="q-meta"><span class="pill src-${r.s}">${r.s}</span> <span class="num">${r.d}</span>${r.sp ? ' · ' + escapeHtml(r.sp) : ''}
      <span class="tr" title="Translation provenance">${TR_LABEL[r.tr]}</span></p>
    <blockquote ${zh ? 'lang="zh"' : ''}>${excerpt(r, re, zh)}</blockquote>
    <details><summary>Question and full answer</summary>
      ${r.q ? `<p class="q-q"><b>${escapeHtml(r.as || 'Question')}:</b> ${escapeHtml(r.q)}</p>` : '<p class="q-q"><i>Opening remarks or standalone statement.</i></p>'}
      <p class="q-a" ${zh ? 'lang="zh"' : ''}>${mark(zh ? r.zh : r.a, re)}</p>
      ${altText ? `<p class="q-a alt" ${zh ? '' : 'lang="zh"'}>${escapeHtml(altText)}</p>` : ''}
    </details>
    <p class="q-links">${links.join(' · ')}</p>
  </article>`;
}

export function renderDetail(box, S, agg, recs) {
  const sel = S.sel;
  if (!sel) { box.innerHTML = '<p class="fine">Click any cell to read the statements behind it.</p>'; return; }
  const isPhrase = sel.row === THEMES.length;
  const ids = agg.cells[sel.row]?.[sel.w] || [];
  const tot = agg.total[sel.w];
  const name = isPhrase ? `“${escapeHtml(S.matcher.phrase)}”` : escapeHtml(THEMES[sel.row].label);
  const zh = isPhrase && S.matcher.zh;
  const re = isPhrase ? new RegExp(S.matcher.re.source, S.matcher.re.flags) : THEME_RE_G[sel.row];
  const bySrc = {};
  ids.forEach(i => { bySrc[recs[i].s] = (bySrc[recs[i].s] || 0) + 1; });
  const split = Object.entries(bySrc).map(([s, n]) => `<span class="pill src-${s}" title="${SOURCE_NAMES[s]}">${s} ${n}</span>`).join('');
  const filt = S.matcher && !isPhrase ? `<p class="fine">Filtered to statements containing “${escapeHtml(S.matcher.phrase)}”.</p>` : '';
  const head = `<div class="d-head"><p class="eyebrow">Week of ${weekStart(sel.w)}</p><h3>${name}</h3>
    <p class="d-count"><b class="num">${ids.length}</b> of <span class="num">${tot}</span> Taiwan-related statements with ${zh ? 'Chinese' : 'English'} text${tot ? ` (${Math.round(100 * ids.length / tot)}%)` : ''} ${split}</p>${filt}${weekLinks(weekStart(sel.w))}</div>`;
  if (!ids.length) {
    const held = agg.held[sel.w], other = held - tot;
    const msg = tot ? 'No statement this week matched.'
      : other ? `TSM holds ${other} Taiwan-related statement${other === 1 ? '' : 's'} from the selected sources this week without ${zh ? 'Chinese' : 'English'} text${zh ? '' : ' (Chinese only; theme rules read English, so they cannot match; search a Chinese phrase such as 台独 to read them)'}.`
      : 'TSM holds no Taiwan-related statements from the selected sources for this week. That does not mean no briefing was held: many briefings take no Taiwan question.';
    box.innerHTML = head + `<p class="fine">${msg}</p>`;
    return;
  }
  let shown = PAGE;
  const draw = () => {
    const list = ids.slice().sort((a, b) => recs[a].d.localeCompare(recs[b].d)).slice(0, shown);
    box.innerHTML = head + `<div class="quotes">${list.map(i => card(recs[i], re, zh)).join('')}</div>` +
      (ids.length > shown ? `<button type="button" class="btn more">Show ${Math.min(PAGE, ids.length - shown)} more</button>` : '');
    box.querySelector('.more')?.addEventListener('click', () => { shown += PAGE; draw(); });
  };
  draw();
}
