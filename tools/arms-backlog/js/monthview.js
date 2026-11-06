// Month by month: Figure 1 donut and Table 1 for one monthly update (the Cato Institute's, November 2023 to
// December 2024, then TSM's), drawn in TSM's style, with a month navigator, wedge-to-table filtering, change
// marking against the previous month, and a case card with the
// case's status history. The source line names each month's publisher.
import { escapeHtml } from '../../../shared/js/mapkit.js';
import { MONTHS, LATEST, moIndex, fmtHouse, changeSummary } from './mdata.js';
import { createDonut } from './donut.js';
import { renderTable } from './mtable.js';
import { byKey, fmtD } from './model.js';
import { renderDetail } from './panel.js';

const $ = id => document.getElementById(id);

export function createMonthView(S, { save, showInTimeline }) {
  if (moIndex(S.month) < 0) S.month = LATEST;
  const donut = createDonut($('mv-fig'), { onWedge: id => setWedge(S.wedge === id ? null : id, id) });
  const dlg = $('mv-card'), dlgBody = $('mv-card-body');
  let lastRow = null;

  // Month picker: a select plus a strip of small bars (one per month, height = total).
  const sel = $('mv-select');
  sel.innerHTML = [...MONTHS].reverse().map(m => `<option value="${m.mo}">${m.label}</option>`).join('');
  sel.onchange = () => go(sel.value);
  // Year labels sit over January; the first month gets one only if the next January is at least 3 bars away.
  const max = Math.max(...MONTHS.map(m => m.total));
  const jan1 = MONTHS.findIndex(m => m.mo.endsWith('-01'));
  const strip = $('mv-strip');
  strip.innerHTML = MONTHS.map((m, i) => {
    const [y, mm] = m.mo.split('-');
    const yr = mm === '01' || (!i && (jan1 < 0 || jan1 >= 3));
    return `<button type="button" tabindex="-1" data-mo="${m.mo}" aria-label="${m.label}: ${fmtHouse(m.total)}"><i style="height:${Math.round(m.total / max * 100)}%"></i>${yr ? `<b>${y}</b>` : ''}</button>`;
  }).join('');
  strip.querySelectorAll('button').forEach(b => b.onclick = () => go(b.dataset.mo));
  // The strip is one tab stop (roving tabindex on the current month): ←/→ step, Home/End jump to the ends.
  strip.addEventListener('keydown', e => {
    const to = { ArrowLeft: moIndex(S.month) - 1, ArrowRight: moIndex(S.month) + 1, Home: 0, End: MONTHS.length - 1 }[e.key];
    if (to === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (to >= 0 && to < MONTHS.length) go(MONTHS[to].mo);
    strip.querySelector('[aria-current="true"]').focus();
  });
  $('mv-prev').onclick = () => step(-1);
  $('mv-next').onclick = () => step(1);

  // ←/→ anywhere in the view (and on the bare page), except inside form fields, the strip and the open card.
  const keys = e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || dlg.open) return;
    const t = e.target;
    if (t.closest && t.closest('select, input, textarea, .mv-scroll, .mv-strip')) return;
    if (t !== document.body && !$('monthview').contains(t)) return;
    e.preventDefault();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  };
  document.addEventListener('keydown', keys);

  // Keep focus in the view across a redraw: on the wedge of the same kind, or on the other arrow at either end.
  function step(d) {
    const i = moIndex(S.month) + d;
    if (i < 0 || i >= MONTHS.length) return;
    const a = document.activeElement, w = a && a.dataset && a.closest('#mv-fig') ? a.dataset.w : null;
    go(MONTHS[i].mo);
    if (w) { const p = $('mv-fig').querySelector(`path[data-w="${w}"]`) || $('mv-fig').querySelector('path'); if (p) p.focus(); }
    else if (a === $('mv-prev') && a.disabled) $('mv-next').focus();
    else if (a === $('mv-next') && a.disabled) $('mv-prev').focus();
  }
  function go(mo) { S.month = mo; S.wedge = null; render(true); }
  function setWedge(w, focusId) { S.wedge = w; render(false); if (focusId) donut.focusWedge(focusId); }

  function render(announce) {
    const i = moIndex(S.month), m = MONTHS[i];
    if (S.wedge && !m.wedges.some(w => w.id === S.wedge)) S.wedge = null;
    $('mv-month').textContent = m.label;
    $('mv-prev').disabled = i === 0;
    $('mv-next').disabled = i === MONTHS.length - 1;
    $('mv-prev').setAttribute('aria-label', i ? `Previous month: ${MONTHS[i - 1].label}` : 'Previous month');
    $('mv-next').setAttribute('aria-label', i < MONTHS.length - 1 ? `Next month: ${MONTHS[i + 1].label}` : 'Next month');
    sel.value = m.mo;
    strip.querySelectorAll('button').forEach(b => {
      const on = b.dataset.mo === m.mo;
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.tabIndex = on ? 0 : -1;
    });
    const sum = changeSummary(i);
    $('mv-chg').textContent = sum;
    if (announce) $('mv-live').textContent = `${m.label}. ${m.rows.filter(r => !r.out).length} open cases. ${sum}`;

    donut.set(m, S.wedge, []);
    renderTable($('mv-tablebox'), i, { wedge: S.wedge, notes: [] });
    $('mv-tablebox').querySelectorAll('.mv-case').forEach(b => b.onclick = () => openCard(b.dataset.k, b));
    $('mv-tablebox').querySelectorAll('tr.mv-row').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('a, button')) return;
      openCard(tr.dataset.k, tr.querySelector('.mv-case'));
    }));
    const clr = $('mv-tablebox').querySelector('[data-clear]');
    if (clr) clr.onclick = () => { setWedge(null); $('mv-fig').querySelector('path')?.focus(); };

    // Source line (no notes are shown: owner rule 2026-10-07). Cato months credit Cato and its authors, and link the archived post. No dataset files are linked.
    // A month taken from TSM's dataset before its post is out (post null) names the dataset instead.
    const lnk = (href, t) => `<a class="xlink" href="${href}" target="_blank" rel="noopener">${t} ↗</a>`;
    const by = m.pub === 'Cato' ? `Cato Institute (${escapeHtml(m.post.by)}), Cato at Liberty blog` : 'Taiwan Security Monitor';
    $('mv-src').innerHTML = (m.post ? `<p>Source: ${by}, <a href="${m.post.url}" target="_blank" rel="noopener">${escapeHtml(m.post.title)}</a>, published ${fmtD(m.post.published)}.</p>
      <p class="xlinks">${lnk(m.post.url, 'View original')}${m.pub === 'Cato' && m.post.wayback ? ` ${lnk(m.post.wayback, 'Archived copy')}` : ''}
</p>` : `<p>Source: ${by}, ${escapeHtml(m.label)} backlog dataset. TSM's ${escapeHtml(m.label)} update has not yet been published.</p>`)
      + `
      <p class="fine">Table text: ${escapeHtml(m.src.rows.split(':')[0])}. Total: ${escapeHtml(m.src.total)}.</p>`;
    save();
  }

  function openCard(k, from) {
    const c = byKey[k];
    if (!c) return;
    lastRow = from || null;
    const m = MONTHS[moIndex(S.month)];
    const seen = new Set();
    const list = m.rows.filter(r => !seen.has(r.k) && seen.add(r.k)).map(r => byKey[r.k]).filter(Boolean);
    renderDetail(c, list, kk => openCard(kk, lastRow), dlgBody, { open: true, month: m.mo });
    $('mv-card-tl').hidden = !!c.early;  // cases that left before 2025 are not in the timeline
    $('mv-card-tl').onclick = () => { lastRow = null; dlg.close(); showInTimeline(k); };
    if (!dlg.open) dlg.showModal();
    dlgBody.scrollTop = 0;
    dlg.querySelector('.mv-x').focus();
  }
  dlg.addEventListener('close', () => { if (lastRow && document.contains(lastRow)) lastRow.focus(); });
  dlg.querySelector('.mv-x').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  render(false);
  return { render };
}
